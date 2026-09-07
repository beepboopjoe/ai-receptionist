import { describe, it, expect } from 'vitest';
import { resolveConfig } from './config.js';
import {
  looksLikeLocalhostUrl,
  localhostAppUrlWarning,
  resolveAppUrl,
  telnyxMediaStreamUrl,
  telnyxWebhookUrl,
  toPublicOrigin,
} from './lib/public-url.js';

const validEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/app',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  ENCRYPTION_KEY: 'c'.repeat(64),
  XAI_API_KEY: 'xai-test',
} as NodeJS.ProcessEnv;

describe('resolveConfig', () => {
  it('accepts a complete production env', () => {
    const { valid, missing, config } = resolveConfig(validEnv);
    expect(valid).toBe(true);
    expect(missing).toEqual([]);
    expect(config.DATABASE_URL).toContain('postgres://');
  });

  it('does not throw when required vars are missing — degraded placeholders', () => {
    const { valid, missing, config } = resolveConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    expect(valid).toBe(false);
    expect(missing).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY', 'XAI_API_KEY'])
    );
    expect(config.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(config.PORT).toBe(3001);
  });

  it('returns an empty stub in test without placeholders', () => {
    const { valid, config } = resolveConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    expect(valid).toBe(false);
    expect(config.DATABASE_URL).toBeUndefined();
  });

  it('falls back to API_PUBLIC_URL origin when APP_URL is unset', () => {
    const { config } = resolveConfig({
      ...validEnv,
      API_PUBLIC_URL: 'https://api.example.com/api/v1',
    });
    expect(config.APP_URL).toBe('https://api.example.com');
  });

  it('prefers explicit APP_URL over API_PUBLIC_URL', () => {
    const { config } = resolveConfig({
      ...validEnv,
      APP_URL: 'https://calls.example.com',
      API_PUBLIC_URL: 'https://api.example.com/api/v1',
    });
    expect(config.APP_URL).toBe('https://calls.example.com');
  });

  it('in production, ignores localhost APP_URL in favor of API_PUBLIC_URL', () => {
    const { config } = resolveConfig({
      ...validEnv,
      NODE_ENV: 'production',
      APP_URL: 'http://localhost:3001',
      API_PUBLIC_URL: 'https://ai-receptionist-production-de7b.up.railway.app',
    });
    expect(config.APP_URL).toBe('https://ai-receptionist-production-de7b.up.railway.app');
  });

  it('in development, keeps explicit localhost APP_URL', () => {
    const { config } = resolveConfig({
      ...validEnv,
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3001',
      API_PUBLIC_URL: 'https://api.example.com',
    });
    expect(config.APP_URL).toBe('http://localhost:3001');
  });

  it('treats blank APP_URL as unset and falls back to API_PUBLIC_URL', () => {
    const { config } = resolveConfig({
      ...validEnv,
      APP_URL: '   ',
      API_PUBLIC_URL: 'https://api.example.com/api/v1',
    });
    expect(config.APP_URL).toBe('https://api.example.com');
  });

  it('defaults demo cooldown ops flags to empty (off)', () => {
    const { config } = resolveConfig(validEnv);
    expect(config.DEMO_SKIP_COOLDOWN).toBe('');
    expect(config.DEMO_CLEAR_COOLDOWNS_ON_BOOT).toBe('');
    expect(config.DEMO_ENSURE_TENANT).toBe('');
  });

  it('sanitizes TELNYX_API_KEY quotes, whitespace, and Bearer prefix', () => {
    const { config } = resolveConfig({
      ...validEnv,
      TELNYX_API_KEY: '  "Bearer KEYabcdefghijklmnopqrstuvwxyz012345" \n',
    });
    expect(config.TELNYX_API_KEY).toBe('KEYabcdefghijklmnopqrstuvwxyz012345');
  });

  it('sanitizes XAI_API_KEY quotes, whitespace, and Bearer prefix', () => {
    const { config } = resolveConfig({
      ...validEnv,
      XAI_API_KEY: '  "Bearer xai-abcdefghijklmnopqrstuvwxyz012345" \n',
    });
    expect(config.XAI_API_KEY).toBe('xai-abcdefghijklmnopqrstuvwxyz012345');
  });

  it('defaults XAI_REALTIME_MODEL to grok-voice-think-fast-1.0', () => {
    const { config } = resolveConfig(validEnv);
    expect(config.XAI_REALTIME_MODEL).toBe('grok-voice-think-fast-1.0');
  });

  it('honors XAI_REALTIME_MODEL override', () => {
    const { config } = resolveConfig({
      ...validEnv,
      XAI_REALTIME_MODEL: 'grok-voice-think-fast-2.0',
    });
    expect(config.XAI_REALTIME_MODEL).toBe('grok-voice-think-fast-2.0');
  });

  it('accepts demo cooldown ops flags as raw strings', () => {
    const { config } = resolveConfig({
      ...validEnv,
      DEMO_SKIP_COOLDOWN: '1',
      DEMO_CLEAR_COOLDOWNS_ON_BOOT: 'true',
      DEMO_ENSURE_TENANT: '1',
    });
    expect(config.DEMO_SKIP_COOLDOWN).toBe('1');
    expect(config.DEMO_CLEAR_COOLDOWNS_ON_BOOT).toBe('true');
    expect(config.DEMO_ENSURE_TENANT).toBe('1');
  });
});

describe('public API origin helpers', () => {
  it('strips /api/v1 (and any path) to origin', () => {
    expect(toPublicOrigin('https://api.example.com/api/v1')).toBe('https://api.example.com');
    expect(toPublicOrigin('https://api.example.com/api/v1/')).toBe('https://api.example.com');
    expect(toPublicOrigin(' https://api.example.com:8443/foo ')).toBe('https://api.example.com:8443');
    expect(toPublicOrigin('')).toBeNull();
    expect(toPublicOrigin('not-a-url')).toBeNull();
  });

  it('detects loopback hosts', () => {
    expect(looksLikeLocalhostUrl('http://localhost:3001')).toBe(true);
    expect(looksLikeLocalhostUrl('http://127.0.0.1:3001')).toBe(true);
    expect(looksLikeLocalhostUrl('http://[::1]:3001')).toBe(true);
    expect(looksLikeLocalhostUrl('https://ai-receptionist-production-de7b.up.railway.app')).toBe(false);
  });

  it('builds Telnyx webhook + wss stream URLs from the same origin', () => {
    const origin = 'https://api.example.com';
    expect(telnyxWebhookUrl(origin)).toBe('https://api.example.com/api/v1/webhooks/telnyx');
    expect(telnyxMediaStreamUrl(origin)).toBe('wss://api.example.com/api/v1/webhooks/telnyx/stream');
    expect(telnyxMediaStreamUrl('http://localhost:3001')).toBe(
      'wss://localhost:3001/api/v1/webhooks/telnyx/stream'
    );
  });

  it('warns only when production APP_URL is localhost', () => {
    expect(localhostAppUrlWarning('http://localhost:3001', 'production')).toMatch(/APP_URL/);
    expect(localhostAppUrlWarning('https://api.example.com', 'production')).toBeNull();
    expect(localhostAppUrlWarning('http://localhost:3001', 'development')).toBeNull();
  });

  it('resolveAppUrl defaults to localhost when nothing is set', () => {
    expect(resolveAppUrl({} as NodeJS.ProcessEnv)).toBe('http://localhost:3001');
  });
});
