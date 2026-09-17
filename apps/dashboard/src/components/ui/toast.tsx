'use client';
// ============================================================
// Toast — minimal, zero-dependency toast system.
//
// Usage:
//   const toast = useToast();
//   toast.success('Saved!');
//   toast.error('Could not save');
//   toast.info('Working on it…');
//
// Mounted once via <ToastProvider /> in (app)/layout.tsx.
// Stacks bottom-right; auto-dismiss after 4s; click X to dismiss early.
// ============================================================
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import Link from 'next/link';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  href?: string;
  hrefLabel?: string;
}

type ToastAction = { href: string; hrefLabel: string };

interface ToastContextValue {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-green-50  border-green-200',  text: 'text-green-800',  icon: CheckCircle2 },
  error:   { bg: 'bg-red-50    border-red-200',    text: 'text-red-800',    icon: AlertCircle },
  info:    { bg: 'bg-blue-50   border-blue-200',   text: 'text-blue-800',   icon: Info },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: ToastTone, message: string, action?: ToastAction) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, message, ...(action ?? {}) }]);
    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (m, action) => (action ? push('success', m, action) : push('success', m)),
    error:   (m) => push('error', m),
    info:    (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Stack bottom-right, above everything */}
      <div
        className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const styles = TONE_STYLES[t.tone];
          const Icon = styles.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 max-w-sm px-4 py-3 rounded-xl border shadow-lg ${styles.bg} ${styles.text} animate-in slide-in-from-right`}
              role="status"
            >
              <Icon size={18} className="shrink-0 mt-0.5" />
              <div className="text-sm flex-1 space-y-1">
                <p>{t.message}</p>
                {t.href && t.hrefLabel && (
                  <Link href={t.href} className="font-semibold underline underline-offset-2">
                    {t.hrefLabel}
                  </Link>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Read the toast API. Falls back to no-op outside provider so unit tests don't break. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  return {
    success: () => undefined,
    error: () => undefined,
    info: () => undefined,
  };
}
