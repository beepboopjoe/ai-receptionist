// ============================================================
// Google Calendar OAuth — pure helpers (no Fastify / Redis / DB).
// ============================================================
import { looksLikeLocalhostUrl } from '../../lib/public-url.js';

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
] as const;

export const GOOGLE_CALENDAR_PROVIDER = 'google_calendar';

export interface GoogleCalendarOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  configured: boolean;
  /** True when we fell back to the Google sign-in client (GOOGLE_AUTH_*). */
  usingSignInClient: boolean;
}

export interface GoogleCalendarOAuthState {
  tenantId: string;
  nonce: string;
  returnTo?: string;
}

/**
 * Production must not silently send Google back to localhost (the zod
 * default in .env.example). Prefer an explicit non-localhost URI, else
 * `${APP_URL}/api/v1/integrations/google-calendar/callback`.
 */
export function resolveGoogleCalendarRedirectUri(opts: {
  nodeEnv: string;
  explicit?: string;
  appUrl: string;
}): string {
  const explicit = opts.explicit?.trim() ?? '';
  const production = opts.nodeEnv === 'production';
  if (explicit && !(production && looksLikeLocalhostUrl(explicit))) {
    return explicit;
  }
  const origin = opts.appUrl.replace(/\/$/, '');
  return `${origin}/api/v1/integrations/google-calendar/callback`;
}

/**
 * Calendar OAuth prefers GOOGLE_CLIENT_ID / SECRET. If those are empty,
 * fall back to the existing Google sign-in client so Joey can add one
 * extra redirect URI in Cloud Console instead of minting a second app.
 */
export function resolveGoogleCalendarOAuthConfig(opts: {
  nodeEnv: string;
  appUrl: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  signInClientId?: string;
  signInClientSecret?: string;
}): GoogleCalendarOAuthConfig {
  const usingSignInClient = !opts.clientId?.trim() && Boolean(opts.signInClientId?.trim());
  const clientId = opts.clientId?.trim() || opts.signInClientId?.trim() || '';
  const clientSecret = opts.clientSecret?.trim() || opts.signInClientSecret?.trim() || '';
  const redirectUri = resolveGoogleCalendarRedirectUri({
    nodeEnv: opts.nodeEnv,
    explicit: opts.redirectUri,
    appUrl: opts.appUrl,
  });
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret),
    usingSignInClient,
  };
}

/** Relative dashboard path only — blocks open redirects. */
export function safeReturnTo(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const path = input.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return undefined;
  if (path.includes('\\') || path.includes('\n') || path.includes('\r')) return undefined;
  return path;
}

export function encodeOAuthState(state: GoogleCalendarOAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

export function decodeOAuthState(raw: string): GoogleCalendarOAuthState | null {
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString()) as GoogleCalendarOAuthState;
    if (!decoded?.tenantId || !decoded?.nonce) return null;
    const returnTo = safeReturnTo(decoded.returnTo);
    return {
      tenantId: String(decoded.tenantId),
      nonce: String(decoded.nonce),
      ...(returnTo ? { returnTo } : {}),
    };
  } catch {
    return null;
  }
}

export function buildGoogleCalendarAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: readonly string[];
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: (opts.scopes ?? GOOGLE_CALENDAR_SCOPES).join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function dashboardIntegrationsUrl(
  dashboardUrl: string,
  query: Record<string, string>
): string {
  const dest = safeReturnTo(query['returnTo']) ?? '/settings/integrations';
  const base = dashboardUrl.endsWith('/') ? dashboardUrl : `${dashboardUrl}/`;
  const url = new URL(dest, base);
  for (const [k, v] of Object.entries(query)) {
    if (k === 'returnTo') continue;
    url.searchParams.set(k, v);
  }
  return url.toString();
}
