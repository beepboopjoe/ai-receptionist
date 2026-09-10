// ============================================================
// Marketing Desktop | Mobile preview — storage + path helpers.
// The html[data-telfin-view="mobile"] attribute forces mobile
// Tailwind breakpoints (see tailwind.config.ts) and the phone
// frame in globals.css. Real narrow phones never get the
// attribute: native CSS already is mobile.
// ============================================================

export const MARKETING_VIEW_STORAGE_KEY = 'telfin-marketing-view';
export const MARKETING_VIEW_ATTR = 'data-telfin-view';
export const MARKETING_PREVIEW_BAR_CLASS = 'telfin-preview-bar-space';
export const MARKETING_VIEW_MQ = '(max-width: 767px)';

export type MarketingViewMode = 'desktop' | 'mobile';

const MARKETING_PATH =
  /^\/(pricing|demo|inbound|outbound|dental|insurance|legal|real-estate|home-services|knowledge-base|resellers)(\/|$)/;

export function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname === '/partners' || pathname === '/partners/') return true;
  return MARKETING_PATH.test(pathname);
}

export function readStoredMarketingView(): MarketingViewMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MARKETING_VIEW_STORAGE_KEY);
    if (raw === 'desktop' || raw === 'mobile') return raw;
  } catch {
    /* private mode */
  }
  return null;
}

export function persistMarketingView(mode: MarketingViewMode): void {
  try {
    window.localStorage.setItem(MARKETING_VIEW_STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
}

export function applyMarketingViewDom(opts: {
  isMarketing: boolean;
  isNarrow: boolean;
  mode: MarketingViewMode;
}): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (opts.isMarketing && !opts.isNarrow) {
    root.classList.add(MARKETING_PREVIEW_BAR_CLASS);
  } else {
    root.classList.remove(MARKETING_PREVIEW_BAR_CLASS);
  }

  const phonePreview = opts.isMarketing && !opts.isNarrow && opts.mode === 'mobile';
  if (phonePreview) {
    root.setAttribute(MARKETING_VIEW_ATTR, 'mobile');
  } else {
    root.removeAttribute(MARKETING_VIEW_ATTR);
  }
}

/** Inline boot script — keep in sync with isMarketingPath() above. */
export const MARKETING_VIEW_BOOT_SCRIPT = `(function(){try{var p=location.pathname;var m=p==='/'||p==='/partners'||p==='/partners/'||/^\\/(pricing|demo|inbound|outbound|dental|insurance|legal|real-estate|home-services|knowledge-base|resellers)(\\/|$)/.test(p);if(!m||window.innerWidth<768)return;document.documentElement.classList.add('${MARKETING_PREVIEW_BAR_CLASS}');if(localStorage.getItem('${MARKETING_VIEW_STORAGE_KEY}')==='mobile'){document.documentElement.setAttribute('${MARKETING_VIEW_ATTR}','mobile');}}catch(e){}})();`;
