'use client';
// ============================================================
// EmbeddedVoiceDemo — full interactive demo, embeddable in any page
// Same audio/WS logic as /demo, styled to sit inside the landing page
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { getVertical, type Vertical } from '@/lib/verticals';

interface TranscriptEntry {
  role: 'ai' | 'user';
  text: string;
  ts: string;
}

// Per-use-case icons keyed by the suffix after the vertical prefix.
const USE_CASE_ICONS: Record<string, string> = {
  receptionist: '📞',
  new_patient: '🆕',
  intake: '🆕',
  lead_intake: '🆕',
  booking: '📅',
  reminder: '⏰',
  emergency: '🚨',
  recall: '📋',
  lead_followup: '🔁',
  renewal: '🔁',
  client_update: '🔁',
  listing_inquiry: '🏠',
  after_hours: '🌙',
};

function iconForUseCase(useCaseId: string, verticalId: string): string {
  // Strip the vertical prefix to find a matching icon.
  const suffix = useCaseId.startsWith(verticalId + '_')
    ? useCaseId.slice(verticalId.length + 1)
    : useCaseId;
  return USE_CASE_ICONS[suffix] ?? '🎯';
}

const VOICES = [
  { id: 'Ara', label: 'Ara', description: 'Warm & professional' },
  { id: 'Eve', label: 'Eve', description: 'Clear & confident' },
  { id: 'Leo', label: 'Leo', description: 'Friendly & approachable' },
  { id: 'Rex', label: 'Rex', description: 'Authoritative & calm' },
  { id: 'Sal', label: 'Sal', description: 'Neutral & efficient' },
];

const API_WS_BASE =
  (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1')
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
    .replace('/api/v1', '');

function float32ToBase64Pcm16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]!));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64Pcm16ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i]! / 0x8000;
  return float32;
}

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
    const bars = 52;
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
          h = (Math.sin(t) * 0.4 + 0.5) * (H * 0.72) + 6;
          h *= 0.6 + 0.4 * Math.sin(t * 1.7 + i);
        } else {
          h = (Math.sin(t * 0.5) * 0.2 + 0.3) * (H * 0.35) + 4;
        }
        const x = i * (barW + 1);
        const y = (H - h) / 2;
        const alpha = active ? (speaking ? 0.9 : 0.5) : 0.15;
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
      width={560}
      height={72}
      className="w-full rounded-lg"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    />
  );
}

export function EmbeddedVoiceDemo({ vertical: verticalProp = 'dental' }: { vertical?: Vertical } = {}) {
  const verticalConfig = getVertical(verticalProp);
  const useCases = verticalConfig.useCaseIds.map((id, i) => ({
    id,
    label: verticalConfig.useCaseLabels[i] ?? id,
    icon: iconForUseCase(id, verticalConfig.id),
  }));

  const [selectedUseCase, setSelectedUseCase] = useState(useCases[0]?.id ?? 'dental_receptionist');
  const [selectedVoice, setSelectedVoice] = useState('Ara');

  // When the parent switches verticals, reset the selected use case to the first
  // one for that vertical so we don't try to use a stale ID across industries.
  useEffect(() => {
    setSelectedUseCase(verticalConfig.useCaseIds[0] ?? 'dental_receptionist');
  }, [verticalConfig.id]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    // Resume the AudioContext if the browser suspended it
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

  const startSession = useCallback(async () => {
    setErrorMsg('');
    setTranscript([]);
    setStatus('connecting');
    agentBufferRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 24000 });
      // CRITICAL: resume immediately — browsers suspend AudioContext after any await
      await audioCtx.resume();
      audioCtxRef.current = audioCtx;

      const url = `${API_WS_BASE}/api/v1/ws/demo?useCase=${selectedUseCase}&voice=${selectedVoice}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // Route mic → processor → MUTED gain node (keeps processor alive without echo)
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const pcm = e.inputBuffer.getChannelData(0);
          ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: float32ToBase64Pcm16(pcm) }));
        };
      };

      ws.onmessage = (evt) => {
        let event: Record<string, unknown>;
        try { event = JSON.parse(evt.data as string); } catch { return; }
        const type = event['type'] as string;

        switch (type) {
          case 'ready':
            setStatus('ready');
            // Trigger AI to speak its opening greeting immediately
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'response.create' }));
            }
            break;
          case 'error': setErrorMsg((event['error'] as string) ?? 'Connection error'); setStatus('error'); break;
          case 'session_timeout': stopSession(); break;
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
            if (text) setTranscript(prev => [...prev, { role: 'ai', text, ts: new Date().toLocaleTimeString() }]);
            agentBufferRef.current = '';
            break;
          }
          case 'conversation.item.input_audio_transcription.completed': {
            const text = (event['transcript'] as string ?? '').trim();
            if (text) setTranscript(prev => [...prev, { role: 'user', text, ts: new Date().toLocaleTimeString() }]);
            break;
          }
        }
      };

      ws.onerror = () => { setErrorMsg('Could not connect to demo server.'); setStatus('error'); };
      ws.onclose = () => { if (status !== 'error') setStatus('idle'); cleanupAudio(); };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start';
      setErrorMsg(msg.includes('getUserMedia') || msg.includes('Permission')
        ? 'Microphone access denied — please allow mic and try again.'
        : msg);
      setStatus('error');
      cleanupAudio();
    }
  }, [selectedUseCase, selectedVoice, handleAudioDelta, cleanupAudio, stopSession, status]);

  useEffect(() => () => stopSession(), [stopSession]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-green-900/40 border border-green-700/40 rounded-full px-4 py-1.5 text-sm text-green-400 mb-5">
          <span className="w-2 h-2 bg-green-400 rounded-full inline-block animate-pulse" />
          Interactive · No account required · Uses your browser mic
        </div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-3">
          Hear your AI receptionist.<br />
          <span className="text-brand-400">Right now.</span>
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Pick a scenario, click Start, and have a real conversation — exactly as your {verticalConfig.contactNounPlural} would on the phone.
        </p>
      </div>

      {/* Main panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: selectors */}
        <div className="space-y-4">
          {/* Use case picker */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden font-mono">
            <div className="px-4 py-2.5 border-b border-white/10">
              <p className="text-xs text-white/40 uppercase tracking-widest">Use Case</p>
            </div>
            {useCases.map(uc => (
              <button
                key={uc.id}
                onClick={() => !isRunning && setSelectedUseCase(uc.id)}
                disabled={isRunning}
                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 border-b border-white/5 last:border-0 ${
                  selectedUseCase === uc.id
                    ? 'bg-brand-600/20 text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                } ${isRunning ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span>{uc.icon}</span>
                <span>{uc.label}</span>
                {selectedUseCase === uc.id && (
                  <span className="ml-auto w-1.5 h-1.5 bg-brand-400 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Voice picker */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden font-mono">
            <div className="px-4 py-2.5 border-b border-white/10">
              <p className="text-xs text-white/40 uppercase tracking-widest">Voice</p>
            </div>
            {VOICES.map(v => (
              <button
                key={v.id}
                onClick={() => !isRunning && setSelectedVoice(v.id)}
                disabled={isRunning}
                className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0 ${
                  selectedVoice === v.id
                    ? 'bg-brand-600/20 text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                } ${isRunning ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedVoice === v.id ? 'bg-brand-400' : 'bg-white/20'}`} />
                <span>
                  <span className="text-sm block font-mono">{v.label}</span>
                  <span className="text-xs text-white/30">{v.description}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Signup CTA (desktop) */}
          <div className="hidden lg:block rounded-xl border border-brand-500/30 bg-brand-600/10 p-4 text-center">
            <p className="text-xs text-brand-300 mb-3">Ready to deploy this for your {verticalConfig.businessNoun}?</p>
            <Link
              href="/signup"
              className="block w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
            >
              Start free trial →
            </Link>
          </div>
        </div>

        {/* Right: demo panel */}
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 flex flex-col overflow-hidden font-mono">
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/3">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs text-white/30">AI Receptionist — Voice Demo</span>
            <div className="ml-auto flex items-center gap-1.5">
              {isRunning
                ? <><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /><span className="text-xs text-green-400">Live</span></>
                : <span className="text-xs text-white/20">Ready</span>
              }
            </div>
          </div>

          <div className="flex-1 flex flex-col p-5 gap-4">
            {/* Waveform */}
            <Waveform active={isRunning} speaking={aiSpeaking} />

            {/* Status line */}
            <div className="text-center text-xs h-4">
              {status === 'idle'       && <span className="text-white/25">Click START to begin the conversation</span>}
              {status === 'connecting' && <span className="text-amber-400 animate-pulse">Connecting to AI…</span>}
              {status === 'ready' && !aiSpeaking && <span className="text-green-400">● Listening — speak now</span>}
              {status === 'ready' && aiSpeaking  && <span className="text-brand-400 animate-pulse">● AI speaking…</span>}
              {status === 'error'      && <span className="text-red-400">{errorMsg}</span>}
            </div>

            {/* Transcript */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[180px] max-h-[260px] rounded-lg bg-black/30 p-4 border border-white/5">
              {transcript.length === 0 ? (
                <p className="text-white/20 text-xs text-center mt-10">
                  {status === 'ready' ? 'Say something — transcript appears here…' : 'Transcript'}
                </p>
              ) : (
                transcript.map((entry, i) => (
                  <div key={i} className={`flex gap-2 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {entry.role === 'ai' && (
                      <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">AI</div>
                    )}
                    <div className={`max-w-[78%] rounded-xl px-3 py-2 text-sm ${entry.role === 'ai' ? 'bg-brand-900/60 text-brand-100' : 'bg-white/10 text-white/80'}`}>
                      <p>{entry.text}</p>
                      <p className="text-[10px] mt-1 opacity-40">{entry.ts}</p>
                    </div>
                    {entry.role === 'user' && (
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">You</div>
                    )}
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* START / STOP */}
            {!isRunning ? (
              <button
                onClick={startSession}
                className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-[0.99] text-white font-semibold flex items-center justify-center gap-3 transition-all shadow-lg shadow-brand-900/40 text-sm"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm-1 17.93V22h2v-2.07A8 8 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z"/>
                </svg>
                START — Talk to the AI
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="w-full py-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-semibold flex items-center justify-center gap-3 transition-all text-sm"
              >
                <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
                STOP
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 text-center">
        {[
          { icon: '🔒', title: 'Completely private',  desc: 'API key stays server-side. Audio is not stored or logged.' },
          { icon: '⚡', title: 'Real-time voice AI',   desc: 'Sub-300ms latency via xAI Grok Realtime API.' },
          { icon: verticalConfig.emoji, title: `${verticalConfig.label}-tuned`, desc: `5 pre-built scenarios — fully customizable per ${verticalConfig.businessNoun}.` },
        ].map(item => (
          <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
            <span className="text-2xl block mb-2">{item.icon}</span>
            <p className="text-sm font-semibold text-white/80 mb-1">{item.title}</p>
            <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Mobile signup CTA */}
      <div className="lg:hidden mt-6 text-center">
        <p className="text-white/30 text-sm mb-3">Ready to deploy this for your {verticalConfig.businessNoun}?</p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
        >
          Start free trial — setup in 10 minutes →
        </Link>
      </div>
    </div>
  );
}
