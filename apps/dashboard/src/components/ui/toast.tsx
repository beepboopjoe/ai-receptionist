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

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
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

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, message }]);
    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (m) => push('success', m),
    error:   (m) => push('error', m),
    info:    (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Stack bottom-right, above everything */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
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
              <p className="text-sm flex-1">{t.message}</p>
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
