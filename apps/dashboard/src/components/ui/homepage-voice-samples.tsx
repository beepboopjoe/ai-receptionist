'use client';
// ============================================================
// HomepageVoiceSamples — 6 compact audio cards on the landing
// page showing EN + ES voice samples across verticals.
// ============================================================
import { useState, useRef, useCallback } from 'react';

const SAMPLES = [
  { id: 'dental_en_recall',            emoji: '🦷', title: 'Patient Recall',        lang: '🇺🇸', sub: 'Dental · ~45s' },
  { id: 'insurance_en_lead_followup',  emoji: '📋', title: 'Quote Follow-Up',       lang: '🇺🇸', sub: 'Insurance · ~50s' },
  { id: 'legal_en_intake',             emoji: '⚖️', title: 'New Case Intake',       lang: '🇺🇸', sub: 'Legal · ~55s' },
  { id: 'real_estate_en_showing',      emoji: '🏠', title: 'Showing Request',       lang: '🇺🇸', sub: 'Real Estate · ~45s' },
  { id: 'dental_es_reminder',          emoji: '🦷', title: 'Recordatorio de Cita',  lang: '🇪🇸', sub: 'Dental · ~35s' },
  { id: 'home_services_es_servicio',   emoji: '🔧', title: 'Solicitud de Servicio', lang: '🇪🇸', sub: 'Home Services · ~40s' },
];

function VoiceCard({ sample }: { sample: typeof SAMPLES[0] }) {
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

  return (
    <div className={`group flex items-center gap-4 rounded-2xl border bg-white p-4 transition-all hover:shadow-sm ${
      playing ? 'border-brand-300 shadow-sm' : 'border-cream-200'
    }`}>
      <audio
        ref={audioRef}
        src={`/audio/samples/${sample.id}.mp3`}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => setMissing(true)}
      />

      {/* Emoji */}
      <div className="w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center shrink-0 text-xl">
        {sample.emoji}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm">{sample.lang}</span>
          <p className="text-sm font-semibold text-cream-900 truncate">{sample.title}</p>
        </div>
        <p className="text-xs text-cream-500">{sample.sub}</p>

        {/* Waveform bars — animated when playing */}
        <div className="flex items-end gap-0.5 mt-1.5 h-3">
          {[3, 6, 4, 8, 5, 7, 3, 6, 4, 5].map((h, i) => (
            <div
              key={i}
              className={`w-0.5 rounded-full transition-all ${
                playing ? 'bg-brand-500' : 'bg-cream-300'
              }`}
              style={{
                height: playing ? `${h * 1.5}px` : '3px',
                animationDelay: `${i * 60}ms`,
                animation: playing ? `pulse 0.6s ease ${i * 60}ms infinite alternate` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Play / pause button */}
      <button
        type="button"
        onClick={toggle}
        disabled={missing}
        title={missing ? 'Audio not available' : playing ? 'Pause' : 'Play sample'}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          missing
            ? 'bg-cream-100 text-cream-300 cursor-not-allowed'
            : playing
              ? 'bg-brand-600 text-white shadow-md'
              : 'bg-cream-100 text-cream-600 hover:bg-brand-100 hover:text-brand-600 group-hover:bg-brand-50'
        }`}
      >
        {playing ? (
          /* Pause icon */
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        ) : (
          /* Play icon */
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
    </div>
  );
}

export function HomepageVoiceSamples() {
  return (
    <section className="py-20 px-6 bg-cream-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Hear the voice</p>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            Real calls. English &amp; Spanish.
          </h2>
          <p className="text-cream-600 mt-3 max-w-xl mx-auto">
            Press play on any scenario — this is exactly what your callers hear.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SAMPLES.map((s) => (
            <VoiceCard key={s.id} sample={s} />
          ))}
        </div>

        <p className="text-center text-xs text-cream-400 mt-6">
          xAI Grok TTS · English + Spanish included on every plan · No extra charge
        </p>
      </div>
    </section>
  );
}
