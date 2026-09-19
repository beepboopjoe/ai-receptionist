'use client';
// ============================================================
// HomepageSampleCall — short script matching the live English
// AI-reveal opener (#56). Not a voice × language feature dump.
// No MP3s. CTA jumps to the live call-me widget.
// ============================================================
import { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import {
  SAMPLE_CALL_SCRIPT,
  type SampleCallLang,
} from '@/lib/demo-opener';

export function HomepageSampleCall() {
  const [lang, setLang] = useState<SampleCallLang>('en');
  const lines = SAMPLE_CALL_SCRIPT[lang];

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 bg-cream-50 border-y border-cream-200">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
            Sample call
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-cream-900 tracking-tight">
            The first line is honest.
          </h2>
          <p className="text-cream-600 mt-3 max-w-xl mx-auto leading-relaxed">
            This is the script — not a recording. The live call above says the same
            opener, then talks like a receptionist.
          </p>
        </div>

        <div
          className="mb-5 flex rounded-lg border border-cream-200 bg-white p-0.5 max-w-xs mx-auto"
          role="group"
          aria-label="Sample call language"
        >
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              lang === 'en' ? 'bg-cream-900 text-white' : 'text-cream-500 hover:text-cream-800'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('es')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              lang === 'es' ? 'bg-cream-900 text-white' : 'text-cream-500 hover:text-cream-800'
            }`}
          >
            Español
          </button>
        </div>

        <div
          className="rounded-3xl border border-cream-200 bg-white p-5 sm:p-7 shadow-sm"
          lang={lang}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-400 mb-5">
            Script · not audio
          </p>
          <ol className="space-y-4">
            {lines.map((line, i) => {
              const isTelfin = line.role === 'telfin';
              return (
                <li
                  key={`${lang}-${i}`}
                  className={`flex ${isTelfin ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[92%] sm:max-w-[85%] ${isTelfin ? '' : 'text-right'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cream-400 mb-1 px-1">
                      {isTelfin ? 'Telfin' : lang === 'es' ? 'Tú' : 'You'}
                    </p>
                    <p
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isTelfin
                          ? 'bg-cream-50 border border-cream-200 text-cream-800 rounded-tl-md'
                          : 'bg-brand-600 text-white rounded-tr-md'
                      }`}
                    >
                      {line.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-7 text-center">
          <a
            href="#call-me"
            className="glow-btn inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl"
          >
            <PhoneCall size={15} aria-hidden />
            Hear it live on your phone
          </a>
          <p className="mt-3 text-xs text-cream-500">
            US &amp; Canada mobiles. No sign-up. We hang up if you don&apos;t answer.
          </p>
        </div>
      </div>
    </section>
  );
}
