import { describe, it, expect } from 'vitest';
import { runMigrations } from './run-migrations.js';

describe('runMigrations', () => {
  it('returns a clear failure when DATABASE_URL is unset (does not exit the process)', async () => {
    const prev = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      const result = await runMigrations();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/DATABASE_URL/);
    } finally {
      if (prev !== undefined) process.env['DATABASE_URL'] = prev;
    }
  });
});
