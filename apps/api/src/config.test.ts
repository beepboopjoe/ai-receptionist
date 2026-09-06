import { describe, it, expect } from 'vitest';
import { resolveConfig } from './config.js';

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
});
