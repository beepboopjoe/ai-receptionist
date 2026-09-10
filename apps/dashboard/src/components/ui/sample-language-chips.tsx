'use client';
// Compact EN/ES/IT/AR/FA/HY/RU chips for marketing voice samples.
// Not used by CallMeWidget — live calls detect language on pickup.
import {
  LANG_CODES, LANGUAGES, isRtlLang,
  type LangCode,
} from '@/lib/voice-samples';

export function SampleLanguageChips({
  value,
  onChange,
  className = '',
}: {
  value: LangCode;
  onChange: (lang: LangCode) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-cream-500 uppercase tracking-widest mb-3 text-center">
        Sample language
      </p>
      <div
        role="radiogroup"
        aria-label="Sample language"
        className="flex flex-wrap justify-center gap-2"
      >
        {LANG_CODES.map((code) => {
          const meta = LANGUAGES[code];
          const selected = value === code;
          const rtl = isRtlLang(code);
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${meta.label} (${meta.native})`}
              title={`${meta.label} — ${meta.native}`}
              lang={code}
              dir={rtl ? 'rtl' : 'ltr'}
              onClick={() => onChange(code)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? 'bg-cream-900 border-cream-900 text-white shadow-sm'
                  : 'bg-white border-cream-200 text-cream-700 hover:border-cream-400 hover:text-cream-900'
              }`}
            >
              <span className="text-sm leading-none" aria-hidden>
                {meta.flag}
              </span>
              <span>{code.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
