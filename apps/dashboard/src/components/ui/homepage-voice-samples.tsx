'use client';
// ============================================================
// HomepageVoiceSamples — Voice showcase section on the landing
// page. Four public Grok voices (Aurora / Castor / Cosmo / Zenith),
// each with a play button per supported language.
//
// Audio files: /audio/voices/{voice}_{lang}.mp3
// Generate:    pnpm tsx scripts/generate-voice-language-samples.ts
// Source of truth for the voice/language catalog: @/lib/voice-samples
// ============================================================
import { useState, useRef, useCallback } from 'react';
import {
  LANG_CODES, LANGUAGES, VOICE_IDS, VOICES, VOICE_CARD_STYLES,
  type LangCode, type VoiceId,
} from '@/lib/voice-samples';

interface Voice {
  id: VoiceId;
  name: string;
  personality: string;
  color: string;
  textColor: string;
}

const HOMEPAGE_VOICES: Voice[] = VOICE_IDS.map((id) => ({
  id,
  name: VOICES[id].label,
  personality: VOICES[id].description,
  color: VOICE_CARD_STYLES[id].color,
  textColor: VOICE_CARD_STYLES[id].textColor,
}));

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

      {/* Name + personality + named preview */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <h3 className="font-semibold text-cream-900 text-sm">{voice.name}</h3>
          <p className="text-xs text-cream-500 mb-4">{voice.personality}</p>
        </div>
        <PreviewPlayButton voiceId={voice.id} displayName={voice.name} />
      </div>

      {/* Play buttons — one per supported language */}
      <div className="flex gap-1.5 flex-wrap">
        {LANG_CODES.map((lang) => (
          <PlayButtonWithTrack
            key={lang}
            voice={voice.id}
            lang={lang}
            onPlayChange={handlePlay}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewPlayButton({ voiceId, displayName }: { voiceId: VoiceId; displayName: string }) {
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
    } else {
      audio.play().then(() => setPlaying(true), () => setMissing(true));
    }
  }, [playing, missing]);

  const aria = missing
    ? `${displayName} preview not available yet`
    : playing
      ? `Pause ${displayName} sample`
      : `Play ${displayName} sample`;

  return (
    <span>
      <audio
        ref={audioRef}
        src={`/audio/voices/${voiceId}-preview.mp3`}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => setMissing(true)}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={missing}
        title={aria}
        aria-label={aria}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          missing
            ? 'bg-cream-100 text-cream-300 cursor-not-allowed'
            : playing
              ? 'bg-brand-600 text-white'
              : 'bg-cream-100 text-cream-700 hover:bg-brand-50 hover:text-brand-700 border border-cream-200'
        }`}
      >
        {playing ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
    </span>
  );
}

// ── Play button that reports play/pause state upward ──────────
// One button per language. Compact flag-only chips so 7 languages
// fit cleanly inside each voice card.
function PlayButtonWithTrack({
  voice, lang, onPlayChange,
}: {
  voice: string;
  lang: LangCode;
  onPlayChange: (isPlaying: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meta = LANGUAGES[lang];

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

  const aria = missing
    ? `Audio for ${meta.label} not available yet`
    : playing
      ? `Pause ${meta.label} sample`
      : `Play ${meta.label} sample`;

  return (
    <span>
      <audio
        ref={audioRef}
        src={`/audio/voices/${voice}_${lang}.mp3`}
        preload="none"
        onEnded={() => { setPlaying(false); onPlayChange(false); }}
        onError={() => setMissing(true)}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={missing}
        title={aria}
        aria-label={aria}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all ${
          missing
            ? 'bg-cream-100 text-cream-300 cursor-not-allowed'
            : playing
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'bg-cream-100 text-cream-700 hover:bg-brand-50 hover:text-brand-700 border border-cream-200'
        }`}
      >
        <span className="text-sm leading-none" aria-hidden="true">{meta.flag}</span>
        <span className="uppercase tracking-wide">{lang}</span>
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
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">4 distinct voices</p>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            Pick the voice that fits your brand.
          </h2>
          <p className="text-cream-600 mt-3 max-w-xl mx-auto">
            Aurora, Castor, Cosmo, and Zenith — natural Grok voices, seven languages. Tap a flag to hear it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HOMEPAGE_VOICES.map((v) => (
            <VoiceCard key={v.id} voice={v} />
          ))}
        </div>

        <p className="text-center text-xs text-cream-400 mt-6">
          English · Spanish · Italian · Arabic · Farsi · Armenian · Russian — on every plan, switch voices any time in settings
        </p>
      </div>
    </section>
  );
}
