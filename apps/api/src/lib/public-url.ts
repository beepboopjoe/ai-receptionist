// ============================================================
// Public API origin helpers.
//
// APP_URL is the origin Telnyx (and RingCentral) POST webhooks to,
// and the host used to build the media-stream WebSocket URL.
// Railway often has API_PUBLIC_URL (Google OAuth) but not APP_URL.
// If APP_URL is unset, we fall back to API_PUBLIC_URL's origin so
// production cannot silently webhook to http://localhost:3001.
// ============================================================

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/**
 * Strip a public API URL down to origin (scheme + host + port).
 * `https://api.example.com/api/v1` → `https://api.example.com`
 * Empty / invalid → null.
 */
export function toPublicOrigin(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** True when the URL's host is loopback / localhost (Telnyx cannot reach it). */
export function looksLikeLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return LOCAL_HOSTS.has(host) || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

/**
 * Resolve the public API origin used for carrier webhooks + media streams.
 *
 * Preference:
 *   1. Explicit APP_URL (stripped to origin), unless production + localhost
 *      — a copied .env.example must not beat Railway's API_PUBLIC_URL.
 *   2. API_PUBLIC_URL origin (path like `/api/v1` is stripped).
 *   3. `http://localhost:3001` for local dev.
 */
export function resolveAppUrl(env: NodeJS.ProcessEnv): string {
  const appOrigin = toPublicOrigin(env['APP_URL']);
  const apiPublicOrigin = toPublicOrigin(env['API_PUBLIC_URL']);
  const production = env['NODE_ENV'] === 'production';

  if (appOrigin && !(production && looksLikeLocalhostUrl(appOrigin))) {
    return appOrigin;
  }
  if (apiPublicOrigin) {
    return apiPublicOrigin;
  }
  return appOrigin ?? 'http://localhost:3001';
}

export function telnyxWebhookUrl(appUrl: string): string {
  const origin = toPublicOrigin(appUrl) ?? appUrl.replace(/\/$/, '');
  return `${origin}/api/v1/webhooks/telnyx`;
}

export function ringcentralWebhookUrl(appUrl: string): string {
  const origin = toPublicOrigin(appUrl) ?? appUrl.replace(/\/$/, '');
  return `${origin}/api/v1/webhooks/ringcentral`;
}

/**
 * Telnyx opens this WebSocket to stream call audio. Same host as APP_URL.
 * Always `wss` — Telnyx requires TLS; production APP_URL must be https.
 */
export function telnyxMediaStreamUrl(appUrl: string): string {
  const origin = toPublicOrigin(appUrl) ?? appUrl;
  const host = new URL(origin).host;
  return `wss://${host}/api/v1/webhooks/telnyx/stream`;
}

/** Warning text when production APP_URL still points at loopback. Null otherwise. */
export function localhostAppUrlWarning(appUrl: string, nodeEnv: string): string | null {
  if (nodeEnv !== 'production') return null;
  if (!looksLikeLocalhostUrl(appUrl)) return null;
  return (
    `APP_URL is ${appUrl} in production. Telnyx webhooks and media streams ` +
    `will not reach this service. Set APP_URL or API_PUBLIC_URL to the public HTTPS origin.`
  );
}
