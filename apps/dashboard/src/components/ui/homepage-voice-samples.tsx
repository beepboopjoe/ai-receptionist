'use client';
// ============================================================
// HomepageVoiceSamples — four public Grok voices, one-sentence intros.
// Audio: /audio/voices/{voice}_{lang}.mp3
// Generate: pnpm tsx scripts/generate-voice-language-samples.ts
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  VOICE_IDS, VOICES, VOICE_CARD_STYLES, voiceIntroLine, voiceSampleSrc, isRtlLang,
  type VoiceId, type LangCode,
} from '@/lib/voice-samples';
import { useSampleLanguage } from '@/lib/use-sample-language';
import { SampleLanguageChips } from '@/components/ui/sample-language-chips';

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

function VoiceCard({
  voice,
  lang,
  playing,
  onPlayingChange,
}: {
  voice: Voice;
  lang: LangCode;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
}) {
  const [missing, setMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intro = voiceIntroLine(voice.id, lang);
  const rtl = isRtlLang(lang);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setMissing(false);
  }, [lang]);

  useEffect(() => {
    if (!playing) audioRef.current?.pause();
  }, [playing]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || missing) return;
    if (playing) {
      audio.pause();
      onPlayingChange(false);
    } else {
      audio.play().then(
        () => onPlayingChange(true),
        () => setMissing(true),
      );
    }
  }, [playing, missing, onPlayingChange]);

  const aria = missing
    ? `${voice.name} sample not available yet`
    : playing
      ? `Pause ${voice.name} sample`
      : `Play ${voice.name} sample`;

  return (
    <div className={`rounded-2xl border p-5 bg-white transition-all hover:shadow-sm ${
      playing ? 'border-brand-300 shadow-sm' : 'border-cream-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${voice.color} flex items-center justify-center shrink-0`}>
          <span className={`font-serif text-lg font-bold ${voice.textColor}`}>{voice.name[0]}</span>
        </div>
        <Waveform active={playing} />
      </div>

      <h3 className="font-semibold text-cream-900 text-sm">{voice.name}</h3>
      <p className="text-xs text-cream-500 mb-3">{voice.personality}</p>
      <p
        className="text-xs text-cream-600 leading-relaxed mb-4"
        lang={lang}
        dir={rtl ? 'rtl' : 'ltr'}
      >
        {intro}
      </p>

      <audio
        ref={audioRef}
        src={voiceSampleSrc(voice.id, lang)}
        preload="none"
        onEnded={() => onPlayingChange(false)}
        onError={() => setMissing(true)}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={missing}
        title={aria}
        aria-label={aria}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
          missing
            ? 'bg-cream-100 text-cream-300 cursor-not-allowed'
            : playing
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
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
        {playing ? 'Pause' : `Play ${voice.name}`}
      </button>
    </div>
  );
}

export function HomepageVoiceSamples() {
  const [lang, setLang] = useSampleLanguage();
  const [playingId, setPlayingId] = useState<VoiceId | null>(null);

  useEffect(() => {
    setPlayingId(null);
  }, [lang]);

  return (
    <section className="py-20 px-6 bg-cream-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">4 distinct voices</p>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            Pick the voice that fits your brand.
          </h2>
          <p className="text-cream-600 mt-3 max-w-xl mx-auto">
            Aurora, Castor, Cosmo, and Zenith — tap play to hear a one-line intro from each.
          </p>
        </div>

        <SampleLanguageChips value={lang} onChange={setLang} className="mb-8" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HOMEPAGE_VOICES.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              lang={lang}
              playing={playingId === v.id}
              onPlayingChange={(next) => setPlayingId(next ? v.id : null)}
            />
          ))}
        </div>

        <p className="text-center text-xs text-cream-400 mt-6">
          One-line intros in seven languages. Live calls detect language automatically — switch voices any time in settings.
        </p>
      </div>
    </section>
  );
}
