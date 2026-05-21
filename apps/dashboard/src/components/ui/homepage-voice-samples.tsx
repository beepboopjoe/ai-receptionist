'use client';
// ============================================================
// HomepageVoiceSamples — Voice showcase section on the landing
// page. 5 voice cards (Eve / Ara / Rex / Sal / Leo), each with
// an EN + ES play button so visitors can hear the range.
//
// Audio files: /audio/samples/{voice}_{lang}_demo.mp3
// Generate:    pnpm tsx scripts/generate-voice-demos.ts
// ============================================================
import { useState, useRef, useCallback } from 'react';

interface Voice {
  id: string;
  name: string;
  personality: string;
  color: string;         // Tailwind bg class for the avatar
  textColor: string;     // Tailwind text class for the avatar letter
}

const VOICES: Voice[] = [
  { id: 'eve', name: 'Eve',  personality: 'Warm & professional',    color: 'bg-rose-100',   textColor: 'text-rose-700'   },
  { id: 'ara', name: 'Ara',  personality: 'Bright & energetic',     color: 'bg-amber-100',  textColor: 'text-amber-700'  },
  { id: 'rex', name: 'Rex',  personality: 'Calm & authoritative',   color: 'bg-blue-100',   textColor: 'text-blue-700'   },
  { id: 'sal', name: 'Sal',  personality: 'Friendly & approachable',color: 'bg-emerald-100',textColor: 'text-emerald-700'},
  { id: 'leo', name: 'Leo',  personality: 'Sharp & efficient',      color: 'bg-purple-100', textColor: 'text-purple-700' },
];

// ── Animated waveform bars (shows when either lang is playing) ─
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[4, 7, 5, 9, 6, 8, 4, 7, 5, 6].map((h, i) => (
        <div
          key={i}
          className={`w-0.5 rounded-full transition-all ${active ? 'bg-brand-500' : 'bg-cream-300'}`}
          style={{
            height: active ? `${h * 1.5}px` : '3px',
            animation: active ? `pulse 0.6s ease ${i * 60}ms infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ── Voice card ────────────────────────────────────────────────
function VoiceCard({ voice }: { voice: Voice }) {
  const [anyPlaying, setAnyPlaying] = useState(false);

  // Track playing state from child buttons via a shared counter
  // (simpler than lifting audio refs up)
  const playingCount = useRef(0);
  const handlePlay = useCallback((isPlaying: boolean) => {
    playingCount.current += isPlaying ? 1 : -1;
    setAnyPlaying(playingCount.current > 0);
  }, []);

  return (
    <div className={`rounded-2xl border p-5 bg-white transition-all hover:shadow-sm ${
      anyPlaying ? 'border-brand-300 shadow-sm' : 'border-cream-200'
    }`}>
      {/* Avatar + waveform row */}
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${voice.color} flex items-center justify-center shrink-0`}>
          <span className={`font-serif text-lg font-bold ${voice.textColor}`}>{voice.name[0]}</span>
        </div>
        <Waveform active={anyPlaying} />
      </div>

      {/* Name + personality */}
      <h3 className="font-semibold text-cream-900 text-sm">{voice.name}</h3>
      <p className="text-xs text-cream-500 mb-4">{voice.personality}</p>

      {/* Play buttons */}
      <div className="flex gap-2 flex-wrap">
        <PlayButtonWithTrack voice={voice.id} lang="en" onPlayChange={handlePlay} />
        <PlayButtonWithTrack voice={voice.id} lang="es" onPlayChange={handlePlay} />
      </div>
    </div>
  );
}

// ── Play button that reports play/pause state upward ──────────
function PlayButtonWithTrack({
  voice, lang, onPlayChange,
}: {
  voice: string;
  lang: 'en' | 'es';
  onPlayChange: (isPlaying: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || missing) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      onPlayChange(false);
    } else {
      audio.play().then(() => {
        setPlaying(true);
        onPlayChange(true);
      }, () => setMissing(true));
    }
  }, [playing, missing, onPlayChange]);

  const label = lang === 'en' ? '🇺🇸 English' : '🇪🇸 Español';

  return (
    <span>
      <audio
        ref={audioRef}
        src={`/audio/samples/${voice}_${lang}_demo.mp3`}
        preload="none"
        onEnded={() => { setPlaying(false); onPlayChange(false); }}
        onError={() => setMissing(true)}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={missing}
        title={missing ? 'Audio not available yet — run generate-voice-demos.ts' : playing ? `Pause` : `Play ${label}`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
          missing
            ? 'bg-cream-100 text-cream-300 cursor-not-allowed'
            : playing
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'bg-cream-100 text-cream-700 hover:bg-brand-50 hover:text-brand-700 border border-cream-200'
        }`}
      >
        {playing ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
        {label}
      </button>
    </span>
  );
}

// ── Section ───────────────────────────────────────────────────
export function HomepageVoiceSamples() {
  return (
    <section className="py-20 px-6 bg-cream-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">5 distinct voices</p>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            Pick the voice that fits your brand.
          </h2>
          <p className="text-cream-600 mt-3 max-w-xl mx-auto">
            Every voice speaks English and Spanish. Press play to hear each one — this is exactly what your callers hear.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {VOICES.map((v) => (
            <VoiceCard key={v.id} voice={v} />
          ))}
        </div>

        <p className="text-center text-xs text-cream-400 mt-6">
          English + Spanish on every plan · Switch voices any time in settings
        </p>
      </div>
    </section>
  );
}
