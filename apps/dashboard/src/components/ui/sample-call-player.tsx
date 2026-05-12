'use client';
// ============================================================
// SampleCallPlayer — Pre-scripted call demo, multi-vertical.
//
// Plays pre-generated MP3s from /public/audio/samples/ (the AI
// agent's voice from xAI Grok TTS). Caller lines are text-only —
// realistic since when you call the AI you only HEAR the agent.
// Transcript reveals line by line, advanced by audio.currentTime.
//
// To regenerate the MP3s, see apps/dashboard/README.md.
// ============================================================
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { Vertical } from '@/lib/verticals';
import { SAMPLE_CALLS, type SampleCall } from '@/lib/sample-calls';

// Approximate seconds-per-character of the generated AI audio. The
// xAI TTS output runs roughly 150 wpm in english (~12 chars/sec),
// so 0.083 s/char is a reasonable starting estimate. The transcript
// scroller uses this for line-reveal timing when timestamps aren't
// available from the API.
const SECONDS_PER_AI_CHAR = 0.083;
// Each caller bubble is allotted a fixed window (the audio has a
// "..." pause baked in — this number controls how long that pause
// renders in the UI). Match the silence the script inserts.
const CALLER_BUBBLE_DURATION_S = 1.2;

/**
 * Compute the cumulative end-time (in audio seconds) of every line.
 * AI lines = derived from char count; caller lines = fixed pause.
 * Returned array has length === call.lines.length.
 */
function computeLineEndTimes(call: SampleCall): number[] {
  const out: number[] = [];
  let cursor = 0;
  for (const line of call.lines) {
    if (line.role === 'ai') {
      cursor += line.text.length * SECONDS_PER_AI_CHAR;
    } else {
      cursor += CALLER_BUBBLE_DURATION_S;
    }
    out.push(cursor);
  }
  return out;
}

// ── Individual call card ──────────────────────────────────────
function CallCard({ call, dark = false }: { call: SampleCall; dark?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [audioMissing, setAudioMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const lineEndTimes = useMemo(() => computeLineEndTimes(call), [call]);
  const audioSrc = `/audio/samples/${call.id}.mp3`;

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleLines]);

  // Sync transcript reveal to audio playback time.
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = audio.currentTime;
    let count = 0;
    for (const endTime of lineEndTimes) {
      if (t >= endTime - 0.3) count += 1;
      else break;
    }
    if (count !== visibleLines) setVisibleLines(count);
  }, [lineEndTimes, visibleLines]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    // Reveal the final line on natural end so it doesn't get clipped.
    setVisibleLines(call.lines.length);
  }, [call.lines.length]);

  const handleError = useCallback(() => {
    setAudioMissing(true);
    setPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    if (audioMissing) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(
      () => setPlaying(true),
      () => setAudioMissing(true)
    );
  }, [audioMissing]);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const handleReset = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setVisibleLines(0);
  }, []);

  // Stop playback when card unmounts.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const bg = dark
    ? 'bg-white/5 border-white/10 text-white'
    : 'bg-white border-cream-200 text-cream-900';
  const headerBg = dark ? 'border-white/10' : 'border-cream-200';
  const mutedText = dark ? 'text-white/40' : 'text-cream-500';
  const transcriptBg = dark ? 'bg-black/30 border-white/5' : 'bg-cream-50 border-cream-200';

  return (
    <div className={`rounded-2xl border overflow-hidden ${bg}`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
      />

      {/* Header */}
      <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${headerBg}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg shrink-0">{call.lang === 'en' ? '🇺🇸' : '🇪🇸'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${dark ? 'text-brand-400' : 'text-brand-600'}`}>
                Sample Call
              </p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${dark ? 'bg-white/10 text-white/50' : 'bg-cream-100 text-cream-500'}`}>
                {call.durationLabel}
              </span>
            </div>
            <p className={`text-sm font-semibold mt-0.5 truncate ${dark ? 'text-white' : 'text-cream-900'}`}>{call.title}</p>
            <p className={`text-xs truncate ${mutedText}`}>{call.scenario}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {visibleLines > 0 && (
            <button
              onClick={handleReset}
              className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-white/10 text-white/50 hover:text-white' : 'hover:bg-cream-100 text-cream-500 hover:text-cream-800'}`}
              title="Reset"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            onClick={playing ? handlePause : handlePlay}
            disabled={audioMissing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? 'Pause' : visibleLines > 0 ? 'Resume' : 'Play'}
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div className={`p-4 max-h-56 overflow-y-auto rounded-b-xl ${transcriptBg}`}>
        {audioMissing ? (
          <p className={`text-xs text-center py-4 ${mutedText}`}>
            🎙️ Sample audio not available yet.{' '}
            <a href="/demo" className="text-brand-500 hover:underline font-medium">
              Try the live AI demo →
            </a>
          </p>
        ) : visibleLines === 0 ? (
          <p className={`text-xs text-center py-4 ${mutedText}`}>
            ▶ Press Play to hear this call
          </p>
        ) : (
          <div className="space-y-2.5">
            {call.lines.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${line.role === 'caller' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: 'fadeIn 0.3s ease' }}
              >
                {line.role === 'ai' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold bg-brand-600 text-white">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    line.role === 'ai'
                      ? dark ? 'bg-brand-600/20 text-brand-200' : 'bg-brand-50 text-brand-900 border border-brand-100'
                      : dark ? 'bg-white/10 text-white/70' : 'bg-white text-cream-700 border border-cream-200'
                  }`}
                >
                  {line.text}
                </div>
                {line.role === 'caller' && (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${dark ? 'bg-white/20 text-white/70' : 'bg-cream-200 text-cream-700'}`}>
                    You
                  </div>
                )}
              </div>
            ))}
            {playing && visibleLines < call.lines.length && (
              <div className="flex gap-1 pl-8 py-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-brand-400"
                    style={{ animation: `pulse 1s ease ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────
export function SampleCallPlayer({
  dark = false,
  singleLang,
  vertical,
}: {
  dark?: boolean;
  /** If provided, only show calls for this language */
  singleLang?: 'en' | 'es';
  /** If provided, show calls for this vertical only */
  vertical?: Vertical;
}) {
  let calls = SAMPLE_CALLS;
  if (vertical) calls = calls.filter(c => c.vertical === vertical);
  if (singleLang) calls = calls.filter(c => c.lang === singleLang);

  // Fallback chain — never show a dental script when the user has Real Estate selected.
  if (calls.length === 0 && vertical) {
    calls = SAMPLE_CALLS.filter(c => c.vertical === vertical);
  }
  if (calls.length === 0) {
    calls = SAMPLE_CALLS.filter(c => c.vertical === 'generic' && (!singleLang || c.lang === singleLang));
  }
  if (calls.length === 0) {
    calls = SAMPLE_CALLS.filter(c => c.vertical === 'generic');
  }

  return (
    <div className={`grid grid-cols-1 ${calls.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
      {calls.map(call => (
        <CallCard key={call.id} call={call} dark={dark} />
      ))}
    </div>
  );
}
