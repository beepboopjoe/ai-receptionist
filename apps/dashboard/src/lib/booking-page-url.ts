/** Public booking URL for a tenant slug. Same origin as the dashboard. */
export function bookingPagePath(slug: string): string {
  return `/book/${encodeURIComponent(slug)}`;
}

export function bookingPageUrl(slug: string, origin?: string): string {
  const path = bookingPagePath(slug);
  if (origin) return `${origin.replace(/\/$/, '')}${path}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return path;
}
