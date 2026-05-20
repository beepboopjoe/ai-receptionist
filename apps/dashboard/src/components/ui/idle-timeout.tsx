'use client';
// ============================================================
// IdleTimeout — HIPAA idle session enforcement.
//
// When hipaaMode is enabled for a tenant, HIPAA requires that
// workstations are locked / sessions terminated after a period
// of inactivity. This component enforces a 15-minute idle limit:
//
//   - 13:00 min: nothing
//   - 12:58 … 15:00: shows a countdown warning modal
//   - 15:00: auto-logout → /login?reason=idle_timeout
//
// Only mounts the listeners when hipaaMode === true. Reads the
// compliance status via SWR with a 5-minute cache so it doesn't
// add extra requests per page navigation.
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { logout } from '@/lib/auth';
import { complianceApi } from '@/lib/api';

const IDLE_MS        = 15 * 60 * 1000; // 15 minutes
const WARN_BEFORE_MS =  2 * 60 * 1000; // show warning with 2 min remaining

// ── Warning modal ─────────────────────────────────────────────────────────────
function IdleWarningModal({
  secondsLeft,
  onStaySignedIn,
}: {
  secondsLeft: number;
  onStaySignedIn: () => void;
}) {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const label = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
      aria-describedby="idle-warning-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="idle-warning-title" className="font-semibold text-gray-900 text-base">
              Session expiring soon
            </h2>
            <p id="idle-warning-desc" className="text-sm text-gray-500 mt-1">
              You'll be automatically signed out in{' '}
              <span className="font-mono font-semibold text-amber-700">{label}</span> due to
              HIPAA inactivity policy.
            </p>
          </div>
        </div>

        <button
          onClick={onStaySignedIn}
          className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
          autoFocus
        >
          Stay signed in
        </button>

        <p className="text-center text-xs text-gray-400">
          Move your mouse or press any key to dismiss automatically
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function IdleTimeout() {
  const router = useRouter();

  // Only fetch if we're in a browser session — never on the server
  const { data: status } = useSWR(
    typeof window !== 'undefined' ? 'compliance-status' : null,
    () => complianceApi.getStatus(),
    { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false }
  );

  const hipaaMode = status?.hipaaMode ?? false;

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarn, setShowWarn]         = useState(false);
  const [secondsLeft, setSecondsLeft]   = useState(120);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (warnRef.current)     clearTimeout(warnRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const signOut = useCallback(async () => {
    clearTimers();
    setShowWarn(false);
    await logout();
    router.replace('/login?reason=idle_timeout');
  }, [clearTimers, router]);

  const startCountdown = useCallback(() => {
    setSecondsLeft(Math.floor(WARN_BEFORE_MS / 1000));
    setShowWarn(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    setShowWarn(false);
    setSecondsLeft(Math.floor(WARN_BEFORE_MS / 1000));

    // Start the warn timer at (IDLE_MS - WARN_BEFORE_MS) idle time
    warnRef.current = setTimeout(() => {
      startCountdown();
    }, IDLE_MS - WARN_BEFORE_MS);

    // Start the logout timer at IDLE_MS idle time
    timerRef.current = setTimeout(() => {
      void signOut();
    }, IDLE_MS);
  }, [clearTimers, startCountdown, signOut]);

  const handleActivity = useCallback(() => {
    if (!hipaaMode) return;
    resetTimers();
  }, [hipaaMode, resetTimers]);

  useEffect(() => {
    if (!hipaaMode) {
      clearTimers();
      setShowWarn(false);
      return;
    }

    // Start timers on mount
    resetTimers();

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      clearTimers();
      events.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [hipaaMode, resetTimers, handleActivity, clearTimers]);

  if (!showWarn) return null;

  return (
    <IdleWarningModal
      secondsLeft={secondsLeft}
      onStaySignedIn={resetTimers}
    />
  );
}
