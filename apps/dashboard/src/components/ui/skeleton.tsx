// ============================================================
// Skeleton — uniform loading shimmer. Replaces ad-hoc
// "Loading…" / spinner usages across the dashboard.
// ============================================================

interface SkeletonProps {
  /** Tailwind width class — e.g. 'w-32', 'w-full' */
  width?: string;
  /** Tailwind height class — e.g. 'h-4', 'h-12' */
  height?: string;
  /** Border radius — defaults to small */
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  rounded = 'md',
  className = '',
}: SkeletonProps) {
  const r =
    rounded === 'full' ? 'rounded-full'
    : rounded === 'lg' ? 'rounded-lg'
    : rounded === 'sm' ? 'rounded'
    : 'rounded-md';
  return (
    <div
      className={`${width} ${height} ${r} bg-gray-100 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/** Multi-line skeleton for list rows. Each row mimics avatar + 2 text lines. */
export function ListRowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton width="w-10" height="h-10" rounded="full" />
          <div className="flex-1 space-y-2">
            <Skeleton width="w-1/3" height="h-3" />
            <Skeleton width="w-1/2" height="h-3" />
          </div>
          <Skeleton width="w-16" height="h-5" rounded="full" />
        </div>
      ))}
    </div>
  );
}

/** Stat-card skeleton — matches the dashboard StatCard shape. */
export function StatCardSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton width="w-24" height="h-3" />
          <Skeleton width="w-16" height="h-9" />
        </div>
        <Skeleton width="w-12" height="h-12" rounded="lg" />
      </div>
    </div>
  );
}
