import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GOOGLE_CALENDAR_SCOPES,
  buildGoogleCalendarAuthUrl,
  dashboardIntegrationsUrl,
  decodeOAuthState,
  encodeOAuthState,
  resolveGoogleCalendarOAuthConfig,
  resolveGoogleCalendarRedirectUri,
  safeReturnTo,
} from '../modules/scheduler/google-calendar-oauth.helpers.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('resolveGoogleCalendarRedirectUri', () => {
  it('uses APP_URL in production when the env default is localhost', () => {
    expect(
      resolveGoogleCalendarRedirectUri({
        nodeEnv: 'production',
        explicit: 'http://localhost:3001/api/v1/integrations/google-calendar/callback',
        appUrl: 'https://ai-receptionist-production-de7b.up.railway.app',
      })
    ).toBe(
      'https://ai-receptionist-production-de7b.up.railway.app/api/v1/integrations/google-calendar/callback'
    );
  });

  it('keeps localhost in development', () => {
    expect(
      resolveGoogleCalendarRedirectUri({
        nodeEnv: 'development',
        explicit: 'http://localhost:3001/api/v1/integrations/google-calendar/callback',
        appUrl: 'http://localhost:3001',
      })
    ).toBe('http://localhost:3001/api/v1/integrations/google-calendar/callback');
  });

  it('honors an explicit production URI', () => {
    expect(
      resolveGoogleCalendarRedirectUri({
        nodeEnv: 'production',
        explicit: 'https://api.example.com/api/v1/integrations/google-calendar/callback',
        appUrl: 'https://other.example.com',
      })
    ).toBe('https://api.example.com/api/v1/integrations/google-calendar/callback');
  });
});

describe('resolveGoogleCalendarOAuthConfig', () => {
  it('is unconfigured when no client id/secret are set', () => {
    const cfg = resolveGoogleCalendarOAuthConfig({
      nodeEnv: 'production',
      appUrl: 'https://api.example.com',
    });
    expect(cfg.configured).toBe(false);
    expect(cfg.usingSignInClient).toBe(false);
  });

  it('falls back to GOOGLE_AUTH_* when calendar-specific vars are empty', () => {
    const cfg = resolveGoogleCalendarOAuthConfig({
      nodeEnv: 'production',
      appUrl: 'https://api.example.com',
      signInClientId: 'signin.apps.googleusercontent.com',
      signInClientSecret: 'secret',
    });
    expect(cfg.configured).toBe(true);
    expect(cfg.usingSignInClient).toBe(true);
    expect(cfg.clientId).toBe('signin.apps.googleusercontent.com');
  });

  it('prefers GOOGLE_CLIENT_* over sign-in credentials', () => {
    const cfg = resolveGoogleCalendarOAuthConfig({
      nodeEnv: 'production',
      appUrl: 'https://api.example.com',
      clientId: 'cal.apps.googleusercontent.com',
      clientSecret: 'cal-secret',
      signInClientId: 'signin.apps.googleusercontent.com',
      signInClientSecret: 'signin-secret',
    });
    expect(cfg.usingSignInClient).toBe(false);
    expect(cfg.clientId).toBe('cal.apps.googleusercontent.com');
  });
});

describe('buildGoogleCalendarAuthUrl', () => {
  it('asks Google for offline calendar access and a refresh token', () => {
    const url = new URL(
      buildGoogleCalendarAuthUrl({
        clientId: 'cid.apps.googleusercontent.com',
        redirectUri: 'https://api.example.com/api/v1/integrations/google-calendar/callback',
        state: 'abc',
      })
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('cid.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toContain('/integrations/google-calendar/callback');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('response_type')).toBe('code');
    const scope = url.searchParams.get('scope') ?? '';
    for (const s of GOOGLE_CALENDAR_SCOPES) {
      expect(scope).toContain(s);
    }
  });
});

describe('OAuth state', () => {
  it('round-trips tenantId, nonce, and a safe returnTo', () => {
    const encoded = encodeOAuthState({
      tenantId: 't1',
      nonce: 'n1',
      returnTo: '/onboarding/step-2-calendar',
    });
    expect(decodeOAuthState(encoded)).toEqual({
      tenantId: 't1',
      nonce: 'n1',
      returnTo: '/onboarding/step-2-calendar',
    });
  });

  it('rejects open redirects in returnTo', () => {
    expect(safeReturnTo('https://evil.example')).toBeUndefined();
    expect(safeReturnTo('//evil.example')).toBeUndefined();
    expect(safeReturnTo('/settings/integrations')).toBe('/settings/integrations');
    const encoded = encodeOAuthState({
      tenantId: 't1',
      nonce: 'n1',
      returnTo: 'https://evil.example',
    });
    expect(decodeOAuthState(encoded)?.returnTo).toBeUndefined();
  });

  it('returns null for garbage state', () => {
    expect(decodeOAuthState('not-base64')).toBeNull();
  });
});

describe('dashboardIntegrationsUrl', () => {
  it('lands on settings/integrations by default', () => {
    expect(
      dashboardIntegrationsUrl('https://app.example.com', { google_connected: '1' })
    ).toBe('https://app.example.com/settings/integrations?google_connected=1');
  });

  it('honors a relative returnTo', () => {
    expect(
      dashboardIntegrationsUrl('https://app.example.com', {
        google_error: 'access_denied',
        returnTo: '/onboarding/step-2-calendar',
      })
    ).toBe('https://app.example.com/onboarding/step-2-calendar?google_error=access_denied');
  });
});

describe('Google Calendar OAuth wiring (source)', () => {
  it('registers the plugin under /api/v1 and is not wrapped in fastify-plugin', () => {
    const main = readFileSync(join(srcRoot, 'main.ts'), 'utf8');
    expect(main).toContain('googleCalendarOAuthPlugin');
    expect(main).toContain("await app.register(googleCalendarOAuthPlugin, { prefix: '/api/v1' })");

    const router = readFileSync(
      join(srcRoot, 'modules/scheduler/google-calendar-oauth.router.ts'),
      'utf8'
    );
    expect(router).not.toMatch(/export const \w+Plugin = fp\(/);
    expect(router).toContain("'/integrations/google-calendar/connect'");
    expect(router).toContain("app.post(");
    expect(router).toContain("'/integrations/google-calendar/callback'");
    expect(router).toContain("'/integrations/google-calendar/status'");
    expect(router).toContain("'/integrations/google-calendar/disconnect'");
  });

  it('stores tokens with AES encryption and persists refreshes', () => {
    const persist = readFileSync(join(srcRoot, 'modules/scheduler/google-calendar-oauth.ts'), 'utf8');
    expect(persist).toContain('encryptCredentials');
    expect(persist).toContain("provider: GOOGLE_CALENDAR_PROVIDER");

    const adapter = readFileSync(join(srcRoot, 'modules/scheduler/adapters/google.adapter.ts'), 'utf8');
    expect(adapter).toContain('createGoogleOAuth2Client');
    expect(adapter).toContain("auth.on('tokens'");
    expect(adapter).not.toContain("credentials['google_client_id']");

    const scheduler = readFileSync(join(srcRoot, 'modules/scheduler/scheduler.service.ts'), 'utf8');
    expect(scheduler).toContain('persistGoogleCalendarTokens');
    expect(scheduler).toContain('bookAppointment');
    expect(scheduler).toContain('adapter.createEvent');
  });

  it('dashboard Connect uses authenticated POST, not a dead Coming soon button', () => {
    const api = readFileSync(
      join(srcRoot, '../../dashboard/src/lib/api.ts'),
      'utf8'
    );
    expect(api).toContain('connectGoogleCalendar');
    expect(api).toContain("'/integrations/google-calendar/connect'");
    expect(api).toContain("method: 'POST'");

    const page = readFileSync(
      join(srcRoot, '../../dashboard/src/app/(app)/settings/integrations/page.tsx'),
      'utf8'
    );
    expect(page).toContain('connectGoogleCalendar');
    expect(page).toContain('Connected');
    expect(page).not.toContain('Live booking is not connectable yet');
  });

  it('does not flip DEMO_SKIP_COOLDOWN', () => {
    const helpers = readFileSync(
      join(srcRoot, 'modules/public-api/public-demo.helpers.ts'),
      'utf8'
    );
    expect(helpers).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
