'use client';
// ============================================================
// RouteProgress — slim top-bar progress indicator that animates
// across when the URL changes. No deps; uses the existing brand
// color. Mounted once in (app)/layout.tsx so every navigation
// inside the authenticated app gets visual feedback.
//
// Why this matters: SWR's `revalidateOnMount` and Next's client-
// side navigation can leave a long pause where nothing visibly
// changes. A 200–800ms animated bar conveys "we heard you".
// ============================================================
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Each pathname change starts a new animation. We don't have a real
  // "navigation finished" hook, so we approximate: ramp to 90% over ~600ms,
  // then snap to 100% and fade out shortly after.
  useEffect(() => {
    // Cancel any in-flight animation timers.
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    setActive(true);
    setProgress(15);

    timeoutsRef.current.push(setTimeout(() => setProgress(60), 150));
    timeoutsRef.current.push(setTimeout(() => setProgress(90), 400));
    timeoutsRef.current.push(setTimeout(() => setProgress(100), 700));
    timeoutsRef.current.push(setTimeout(() => setActive(false), 1000));

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [pathname]);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-0.5 bg-brand-600 transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: active ? 1 : 0,
        }}
      />
    </div>
  );
}
