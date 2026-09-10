'use client';
// Persist the marketing voice-sample language across homepage / demo /
// inbound / outbound. Call-me does not read this — live calls still
// auto-detect. Read localStorage on first client render (these UIs
// load with ssr:false) so a refresh does not flash English.
import { useCallback, useState } from 'react';
import {
  persistSampleLang,
  readStoredSampleLang,
  type LangCode,
} from '@/lib/voice-samples';

export function useSampleLanguage(defaultLang: LangCode = 'en'): [LangCode, (lang: LangCode) => void] {
  const [lang, setLang] = useState<LangCode>(() => readStoredSampleLang() ?? defaultLang);

  const update = useCallback((next: LangCode) => {
    setLang(next);
    persistSampleLang(next);
  }, []);

  return [lang, update];
}
