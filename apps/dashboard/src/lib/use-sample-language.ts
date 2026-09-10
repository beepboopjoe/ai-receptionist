'use client';
// Persist the marketing voice-sample language across homepage / demo /
// inbound / outbound. Call-me does not read this — live calls still
// auto-detect. Defaults to English, then hydrates from localStorage.
import { useCallback, useEffect, useState } from 'react';
import {
  persistSampleLang,
  readStoredSampleLang,
  type LangCode,
} from '@/lib/voice-samples';

export function useSampleLanguage(defaultLang: LangCode = 'en'): [LangCode, (lang: LangCode) => void] {
  const [lang, setLang] = useState<LangCode>(defaultLang);

  useEffect(() => {
    const stored = readStoredSampleLang();
    if (stored) setLang(stored);
  }, []);

  const update = useCallback((next: LangCode) => {
    setLang(next);
    persistSampleLang(next);
  }, []);

  return [lang, update];
}
