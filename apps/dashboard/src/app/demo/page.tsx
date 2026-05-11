'use client';
// ============================================================
// Live Voice Demo — connects to backend WS proxy → xAI Realtime
// Multi-vertical: choose your industry then pick a use case.
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { VERTICALS, VERTICAL_CONFIGS, type Vertical } from '@/lib/verticals';

// Lazy-load the sample player — it's secondary content and uses
// Web Speech API. Demo page's primary value is the live WS demo.
const SampleCallPlayer = dynamic(
  () => import('@/components/ui/sample-call-player').then((m) => m.SampleCallPlayer),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Voice {
  id: string;
  label: string;
  description: string;
}

interface TranscriptEntry {
  role: 'ai' | 'user';
  text: string;
  ts: string;
}

// ── Static config ─────────────────────────────────────────────────────────────
const VOICES: Voice[] = [
  { id: 'eve', label: 'Eve', description: 'Engaging & enthusiastic (default)' },
  { id: 'ara', label: 'Ara', description: 'Balanced & conversational' },
  { id: 'rex', label: 'Rex', description: 'Professional & articulate' },
  { id: 'sal', label: 'Sal', description: 'Versatile & neutral' },
  { id: 'leo', label: 'Leo', description: 'Decisive & commanding' },
];

const API_WS_BASE =
  (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1')
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
    .replace('/api/v1', '');

// ── Float32 PCM → Int16 base64 helper ────────────────────────────────────────
function float32ToBase64Pcm16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── Base64 PCM16 → Float32 helper ────────────────────────────────────────────
function base64Pcm16ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;
  return float32;
}

// ── Waveform canvas component ─────────────────────────────────────────────────
function Waveform({ active, speaking }: { active: boolean; speaking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const bars = 48;
    const barW = W / bars - 1;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      frameRef.current++;

      for (let i = 0; i < bars; i++) {
        const t = frameRef.current * 0.04 + i * 0.25;
        let h: number;
        if (!active) {
          h = 2;
        } else if (speaking) {
          h = (Math.sin(t) * 0.4 + 0.5) * (H * 0.7) + 8;
          h *= 0.6 + 0.4 * Math.sin(t * 1.7 + i);
        } else {
          h = (Math.sin(t * 0.5) * 0.2 + 0.3) * (H * 0.35) + 4;
        }
        const x = i * (barW + 1);
        const y = (H - h) / 2;
        const alpha = active ? (speaking ? 0.9 : 0.5) : 0.2;
        ctx.fillStyle = speaking
          ? `rgba(201,100,66,${alpha})`
          : `rgba(16,185,129,${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, speaking]);

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={80}
      className="w-full rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    />
  );
}

// ── Main demo component ───────────────────────────────────────────────────────
export default function DemoPage() {
  const [selectedVertical, setSelectedVertical] = useState<Vertical>('dental');
  const [selectedUseCase, setSelectedUseCase] = useState('dental_receptionist');
  const [selectedVoice, setSelectedVoice] = useState('eve');

  const verticalConfig = VERTICAL_CONFIGS[selectedVertical];

  // Build use-case list from selected vertical
  const useCases = verticalConfig.useCaseIds.map((id, i) => ({
    id,
    label: verticalConfig.useCaseLabels[i] ?? id,
  }));

  function handleVerticalChange(v: Vertical) {
    setSelectedVertical(v);
    // Reset to receptionist use-case for this vertical
    setSelectedUseCase(VERTICAL_CONFIGS[v].useCaseIds[0] ?? '');
  }

  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCode, setShowCode] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const agentBufferRef = useRef('');

  const isRunning = status === 'connecting' || status === 'ready';

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const playNext = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !audioQueueRef.current.length) {
      isPlayingRef.current = false;
      setAiSpeaking(false);
      return;
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(playNext);
      return;
    }
    isPlayingRef.current = true;
    setAiSpeaking(true);
    const chunk = audioQueueRef.current.shift()!;
    const buffer = ctx.createBuffer(1, chunk.length, 24000);
    buffer.copyToChannel(chunk, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = playNext;
    src.start();
  }, []);

  const handleAudioDelta = useCallback((b64: string) => {
    const chunk = base64Pcm16ToFloat32(b64);
    audioQueueRef.current.push(chunk);
    if (!isPlayingRef.current) playNext();
  }, [playNext]);

  const startSession = useCallback(async () => {
    setErrorMsg('');
    setTranscript([]);
    setStatus('connecting');
    agentBufferRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 24000 });
      await audioCtx.resume();
      audioCtxRef.current = audioCtx;

      const url = `${API_WS_BASE}/api/v1/ws/demo?useCase=${selectedUseCase}&voice=${selectedVoice}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const pcm = e.inputBuffer.getChannelData(0);
          const b64 = float32ToBase64Pcm16(pcm);
          ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b64 }));
        };
      };

      ws.onmessage = (evt) => {
        let event: Record<string, unknown>;
        try { event = JSON.parse(evt.data as string); } catch { return; }

        const type = event['type'] as string;

        switch (type) {
          case 'ready':
            setStatus('ready');
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'response.create' }));
            }
            break;
          case 'error': {
            const msg = (event['error'] as string) ?? 'Connection error';
            setErrorMsg(msg);
            setStatus('error');
            break;
          }
          case 'session_timeout':
            stopSession();
            break;
          case 'response.audio.delta': {
            const delta = event['delta'] as string | undefined;
            if (delta) handleAudioDelta(delta);
            break;
          }
          case 'response.audio_transcript.delta': {
            const delta = event['delta'] as string | undefined;
            if (delta) agentBufferRef.current += delta;
            break;
          }
          case 'response.done': {
            const text = agentBufferRef.current.trim();
            if (text) {
              setTranscript(prev => [...prev, { role: 'ai', text, ts: new Date().toLocaleTimeString() }]);
            }
            agentBufferRef.current = '';
            break;
          }
          case 'conversation.item.input_audio_transcription.completed': {
            const text = (event['transcript'] as string ?? '').trim();
            if (text) {
              setTranscript(prev => [...prev, { role: 'user', text, ts: new Date().toLocaleTimeString() }]);
            }
            break;
          }
        }
      };

      ws.onerror = () => {
        setErrorMsg('Could not connect to demo server. Is the API running?');
        setStatus('error');
      };

      ws.onclose = () => {
        if (status !== 'error') setStatus('idle');
        cleanupAudio();
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start';
      setErrorMsg(msg.includes('getUserMedia') || msg.includes('Permission')
        ? 'Microphone permission denied. Please allow mic access and try again.'
        : msg);
      setStatus('error');
      cleanupAudio();
    }
  }, [selectedUseCase, selectedVoice, handleAudioDelta]);

  const cleanupAudio = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setAiSpeaking(false);
  }, []);

  const stopSession = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    cleanupAudio();
    setStatus('idle');
  }, [cleanupAudio]);

  useEffect(() => () => stopSession(), [stopSession]);

  const codeSnippet = `const ws = new WebSocket(
  "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0",
  { headers: { Authorization: "Bearer YOUR_XAI_KEY" } }
);

ws.on("open", () => {
  ws.send(JSON.stringify({
    type: "session.update",
    session: {
      instructions: "You are an AI receptionist for ${verticalConfig.businessNoun}...",
      voice: "${selectedVoice}",
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      turn_detection: { type: "server_vad" },
    }
  }));
});

// Stream microphone audio
processor.onaudioprocess = (e) => {
  ws.send(JSON.stringify({
    type: "input_audio_buffer.append",
    audio: toBase64Pcm16(e.inputBuffer)
  }));
};`;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
          ← Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xl">{verticalConfig.emoji}</span>
          <span className="text-sm font-semibold text-white/80">AI Receptionist — Voice Demo</span>
        </div>
        <Link href="/signup" className="text-sm px-4 py-1.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white transition-colors">
          Start free trial →
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Try the AI Receptionist Live</h1>
          <p className="text-white/50 text-sm">Pick your industry, choose a scenario, and talk to your AI. No signup required.</p>

          {/* Vertical selector */}
          <div className="flex items-center justify-center flex-wrap gap-2 mt-6">
            <span className="text-xs text-white/30 uppercase tracking-widest mr-1 w-full mb-1">Industry</span>
            {VERTICALS.map((v) => (
              <button
                key={v.id}
                onClick={() => !isRunning && handleVerticalChange(v.id)}
                disabled={isRunning}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedVertical === v.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-white/10 text-white/50 hover:bg-white/15'
                } ${isRunning ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {v.emoji} {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sample Call Player ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <p className="text-xs text-white/30 uppercase tracking-widest px-2">Hear a Sample First</p>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <SampleCallPlayer dark singleLang="en" vertical={selectedVertical} />
          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <p className="text-xs text-white/30 px-2">Ready to test it live? ↓</p>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>

        {/* Main demo panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: selectors */}
          <div className="space-y-6">
            {/* Use case */}
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-xs text-white/40 uppercase tracking-widest">Use Case</p>
              </div>
              <div className="divide-y divide-white/5">
                {useCases.map(uc => (
                  <button
                    key={uc.id}
                    onClick={() => !isRunning && setSelectedUseCase(uc.id)}
                    disabled={isRunning}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                      selectedUseCase === uc.id
                        ? 'text-white bg-brand-600/20'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    } ${isRunning ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedUseCase === uc.id ? 'bg-brand-400' : 'bg-white/20'}`} />
                    {uc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice */}
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-xs text-white/40 uppercase tracking-widest">Voice</p>
              </div>
              <div className="divide-y divide-white/5">
                {VOICES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => !isRunning && setSelectedVoice(v.id)}
                    disabled={isRunning}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 ${
                      selectedVoice === v.id
                        ? 'text-white bg-brand-600/20'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    } ${isRunning ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedVoice === v.id ? 'bg-brand-400' : 'bg-white/20'}`} />
                    <span>
                      <span className="text-sm block">{v.label}</span>
                      <span className="text-xs text-white/30">{v.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: demo panel */}
          <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setShowCode(false)}
                className={`px-5 py-3 text-xs uppercase tracking-widest flex items-center gap-2 transition-colors ${!showCode ? 'text-white border-b-2 border-brand-400' : 'text-white/40 hover:text-white/70'}`}
              >
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Demo
              </button>
              <button
                onClick={() => setShowCode(true)}
                className={`px-5 py-3 text-xs uppercase tracking-widest transition-colors ${showCode ? 'text-white border-b-2 border-brand-400' : 'text-white/40 hover:text-white/70'}`}
              >
                Code
              </button>
            </div>

            {showCode ? (
              <div className="flex-1 p-6 overflow-auto">
                <pre className="text-xs text-green-400 leading-relaxed whitespace-pre-wrap">{codeSnippet}</pre>
              </div>
            ) : (
              <div className="flex-1 flex flex-col p-6 gap-4">
                <Waveform active={isRunning} speaking={aiSpeaking} />

                <div className="text-center text-xs">
                  {status === 'idle' && <span className="text-white/30">Click START to begin the conversation</span>}
                  {status === 'connecting' && <span className="text-amber-400 animate-pulse">Connecting to AI…</span>}
                  {status === 'ready' && !aiSpeaking && <span className="text-green-400">● Listening — speak now</span>}
                  {status === 'ready' && aiSpeaking && <span className="text-brand-400 animate-pulse">● AI speaking…</span>}
                  {status === 'error' && <span className="text-red-400">{errorMsg}</span>}
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 min-h-[180px] max-h-[280px] rounded-lg bg-black/30 p-4 border border-white/5">
                  {transcript.length === 0 ? (
                    <p className="text-white/20 text-xs text-center mt-8">
                      {status === 'ready' ? 'Say something — transcript will appear here…' : 'Transcript'}
                    </p>
                  ) : (
                    transcript.map((entry, i) => (
                      <div key={i} className={`flex gap-3 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {entry.role === 'ai' && (
                          <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center shrink-0 mt-0.5 text-xs">AI</div>
                        )}
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${entry.role === 'ai' ? 'bg-brand-900/60 text-brand-100' : 'bg-white/10 text-white/80'}`}>
                          <p>{entry.text}</p>
                          <p className="text-xs mt-1 opacity-40">{entry.ts}</p>
                        </div>
                        {entry.role === 'user' && (
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5 text-xs">You</div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>

                {!isRunning ? (
                  <button
                    onClick={startSession}
                    className="mt-2 w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm-1 17.93V22h2v-2.07A8 8 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z"/></svg>
                    START
                  </button>
                ) : (
                  <button
                    onClick={stopSession}
                    className="mt-2 w-full py-3.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-medium flex items-center justify-center gap-3 transition-all"
                  >
                    <span className="w-3 h-3 rounded-sm bg-red-400" />
                    STOP
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom info cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          {[
            { icon: '🔒', title: 'Private', desc: 'Your API key never leaves the server. Audio is not stored.' },
            { icon: '⚡', title: 'Real-time', desc: 'Sub-300ms latency via xAI Realtime WebSocket API.' },
            { icon: verticalConfig.emoji, title: 'Industry-tuned', desc: `${verticalConfig.useCaseIds.length} pre-built scenarios for ${verticalConfig.label} — fully customizable.` },
          ].map(item => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-sm font-medium text-white/80 mb-1">{item.title}</div>
              <div className="text-xs text-white/40">{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-white/30 text-sm">Ready to deploy this for your business?</p>
          <Link href="/signup" className="inline-flex items-center gap-2 mt-3 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors">
            Start free trial — setup in 10 minutes →
          </Link>
        </div>
      </div>
    </div>
  );
}
