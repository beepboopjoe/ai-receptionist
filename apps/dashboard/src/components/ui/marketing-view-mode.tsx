'use client';
// ============================================================
// Desktop | Mobile layout preview for marketing pages.
// Wide screens: segmented toggle + optional phone frame.
// Narrow screens: native mobile layout; toggle is hidden so
// real phones are never wrapped in a preview chassis.
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Monitor, Smartphone } from 'lucide-react';
import {
  applyMarketingViewDom,
  isMarketingPath,
  MARKETING_VIEW_MQ,
  persistMarketingView,
  readStoredMarketingView,
  type MarketingViewMode,
} from '@/lib/marketing-view-mode';

type MarketingViewContextValue = {
  mode: MarketingViewMode;
  isNarrow: boolean;
  canToggle: boolean;
  setMode: (mode: MarketingViewMode) => void;
};

const MarketingViewContext = createContext<MarketingViewContextValue | null>(null);

export function useMarketingViewMode(): MarketingViewContextValue {
  const ctx = useContext(MarketingViewContext);
  if (!ctx) {
    return {
      mode: 'desktop',
      isNarrow: false,
      canToggle: false,
      setMode: () => undefined,
    };
  }
  return ctx;
}

export function MarketingViewModeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const isMarketing = isMarketingPath(pathname);
  const [mode, setModeState] = useState<MarketingViewMode>('desktop');
  const [isNarrow, setIsNarrow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MARKETING_VIEW_MQ);
    const stored = readStoredMarketingView();
    const narrow = mq.matches;
    setIsNarrow(narrow);
    setModeState(stored ?? (narrow ? 'mobile' : 'desktop'));
    setReady(true);

    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyMarketingViewDom({ isMarketing, isNarrow, mode });
    return () => {
      applyMarketingViewDom({ isMarketing: false, isNarrow: true, mode: 'desktop' });
    };
  }, [isMarketing, isNarrow, mode, ready]);

  const setMode = useCallback((next: MarketingViewMode) => {
    setModeState(next);
    persistMarketingView(next);
  }, []);

  const value = useMemo<MarketingViewContextValue>(
    () => ({
      mode,
      isNarrow,
      canToggle: isMarketing && !isNarrow,
      setMode,
    }),
    [isMarketing, isNarrow, mode, setMode],
  );

  return <MarketingViewContext.Provider value={value}>{children}</MarketingViewContext.Provider>;
}

export function MarketingPreviewBar() {
  const { mode, canToggle, isNarrow, setMode } = useMarketingViewMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || isNarrow || !canToggle) return null;

  const bar = (
    <div className="marketing-view-bar" role="region" aria-label="Layout preview">
      <p className="text-[11px] font-medium tracking-wide text-cream-600">
        Preview
      </p>
      <div
        role="radiogroup"
        aria-label="Desktop or mobile layout"
        className="inline-flex items-center rounded-full border border-cream-300 bg-white p-0.5 shadow-sm"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'desktop'}
          aria-label="Desktop layout"
          onClick={() => setMode('desktop')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            mode === 'desktop'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-cream-700 hover:text-cream-900 hover:bg-cream-50'
          }`}
        >
          <Monitor size={13} aria-hidden />
          Desktop
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'mobile'}
          aria-label="Mobile layout"
          onClick={() => setMode('mobile')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            mode === 'mobile'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-cream-700 hover:text-cream-900 hover:bg-cream-50'
          }`}
        >
          <Smartphone size={13} aria-hidden />
          Mobile
        </button>
      </div>
      <p className="text-[11px] text-cream-500 tabular-nums" aria-live="polite">
        {mode === 'mobile' ? 'Phone-sized preview' : 'Full-width layout'}
      </p>
    </div>
  );

  return createPortal(bar, document.body);
}
