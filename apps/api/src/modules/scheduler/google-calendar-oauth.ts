// ============================================================
// Google Calendar OAuth — token exchange + encrypted persistence.
// Pure URL/state helpers live in google-calendar-oauth.helpers.ts.
// ============================================================
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { and, eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { encryptCredentials, decryptCredentials } from '../../lib/encryption.js';
import {
  GOOGLE_CALENDAR_PROVIDER,
  resolveGoogleCalendarOAuthConfig,
  type GoogleCalendarOAuthConfig,
} from './google-calendar-oauth.helpers.js';

export {
  GOOGLE_CALENDAR_PROVIDER,
  GOOGLE_CALENDAR_SCOPES,
  buildGoogleCalendarAuthUrl,
  dashboardIntegrationsUrl,
  decodeOAuthState,
  encodeOAuthState,
  resolveGoogleCalendarOAuthConfig,
  resolveGoogleCalendarRedirectUri,
  safeReturnTo,
} from './google-calendar-oauth.helpers.js';

export interface GoogleCalendarTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string; // unix ms as string (matches other OAuth adapters)
}

export function getGoogleCalendarOAuthConfig(): GoogleCalendarOAuthConfig {
  return resolveGoogleCalendarOAuthConfig({
    nodeEnv: config.NODE_ENV,
    appUrl: config.APP_URL,
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI,
    signInClientId: process.env['GOOGLE_AUTH_CLIENT_ID'],
    signInClientSecret: process.env['GOOGLE_AUTH_CLIENT_SECRET'],
  });
}

export function createGoogleOAuth2Client(
  oauth = getGoogleCalendarOAuthConfig(),
  tokens?: Partial<GoogleCalendarTokens> & { access_token?: string; refresh_token?: string }
): OAuth2Client {
  const client = new OAuth2Client({
    clientId: oauth.clientId,
    clientSecret: oauth.clientSecret,
    redirectUri: oauth.redirectUri,
  });
  if (tokens?.access_token || tokens?.refresh_token) {
    client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expires_at ? Number(tokens.expires_at) : undefined,
    });
  }
  return client;
}

export async function exchangeGoogleCalendarCode(code: string): Promise<GoogleCalendarTokens> {
  const oauth = getGoogleCalendarOAuthConfig();
  const client = createGoogleOAuth2Client(oauth);
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error('Google token exchange returned no access_token');
  }
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? '',
    expires_at: String(tokens.expiry_date ?? Date.now() + 3600 * 1000),
  };
}

export async function fetchGoogleAccountEmail(tokens: GoogleCalendarTokens): Promise<string | null> {
  const client = createGoogleOAuth2Client(getGoogleCalendarOAuthConfig(), tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  try {
    const { data } = await oauth2.userinfo.get();
    return data.email ?? null;
  } catch {
    return null;
  }
}

export async function persistGoogleCalendarTokens(opts: {
  tenantId: string;
  tokens: GoogleCalendarTokens;
  metadata?: Record<string, string | null>;
}): Promise<void> {
  const [existing] = await db
    .select({ credentials: integrations.credentials, metadata: integrations.metadata })
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, opts.tenantId),
        eq(integrations.provider, GOOGLE_CALENDAR_PROVIDER)
      )
    )
    .limit(1);

  const previous = existing
    ? decryptCredentials(existing.credentials as Record<string, string>)
    : {};

  const encrypted = encryptCredentials({
    access_token: opts.tokens.access_token,
    refresh_token: opts.tokens.refresh_token || previous['refresh_token'] || '',
    expires_at: opts.tokens.expires_at,
  });

  const nextMeta = {
    ...((existing?.metadata as Record<string, string | null> | undefined) ?? {}),
    ...(opts.metadata ?? {}),
  };

  await db
    .insert(integrations)
    .values({
      tenantId: opts.tenantId,
      provider: GOOGLE_CALENDAR_PROVIDER,
      status: 'connected',
      credentials: encrypted,
      metadata: nextMeta,
      errorMessage: null,
    })
    .onConflictDoUpdate({
      target: [integrations.tenantId, integrations.provider],
      set: {
        credentials: encrypted,
        status: 'connected',
        errorMessage: null,
        metadata: nextMeta,
        updatedAt: new Date(),
      },
    });
}

export async function markGoogleCalendarError(tenantId: string, message: string): Promise<void> {
  await db
    .update(integrations)
    .set({ status: 'error', errorMessage: message.slice(0, 500), updatedAt: new Date() })
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.provider, GOOGLE_CALENDAR_PROVIDER)
      )
    );
}
