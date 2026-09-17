'use client';
// Browser Web Speech API dictation for the dashboard chat composer.
// Unsupported browsers get a graceful no-op (mic hidden by the caller).
import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<{ 0?: { transcript?: string }; isFinal?: boolean }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechDictationSupported(): boolean {
  return getCtor() !== null;
}

export function useSpeechDictation(onFinal: (transcript: string) => void): {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
} {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) {
      setError('Voice input isn’t available in this browser. Type instead.');
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let finalText = '';
      let live = '';
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        const piece = row?.[0]?.transcript ?? '';
        if (row?.isFinal) finalText += piece;
        else live += piece;
      }
      setInterim(live);
      if (finalText.trim()) {
        onFinalRef.current(finalText.trim());
        setInterim('');
      }
    };
    rec.onerror = (ev) => {
      const code = ev.error ?? '';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone permission was blocked. Type instead, or allow the mic and try again.');
      } else if (code !== 'aborted' && code !== 'no-speech') {
        setError('Couldn’t hear that. Try again, or type the request.');
      }
      setListening(false);
      setInterim('');
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('Couldn’t start the microphone. Type instead.');
      recRef.current = null;
    }
  }, [listening, stop]);

  return { supported, listening, interim, error, toggle, stop };
}
