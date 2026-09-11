// ============================================================
// Customer call-stat filters + source scans.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCallListQuery, ANSWERED_CALL_STATUSES } from '../modules/admin/call-stats.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('parseCallListQuery', () => {
  it('defaults limit/offset and ignores status=all', () => {
    expect(parseCallListQuery({})).toEqual({ limit: 25, offset: 0, includeTest: false });
    expect(parseCallListQuery({ status: 'all' }).status).toBeUndefined();
    expect(parseCallListQuery({ status: 'missed', includeTest: '1' })).toMatchObject({
      status: 'missed',
      includeTest: true,
    });
  });

  it('clamps limit and offset', () => {
    expect(parseCallListQuery({ limit: '999', offset: '-3' })).toMatchObject({
      limit: 100,
      offset: 0,
    });
  });
});

describe('answered definition', () => {
  it('counts completed and transferred, not in-progress', () => {
    expect(ANSWERED_CALL_STATUSES).toEqual(['completed', 'transferred']);
  });
});

describe('call stats wiring (source)', () => {
  it('filters test dials out of list, billing, analytics, and sections', () => {
    const router = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    expect(router).toContain('customerCallsWhere');
    expect(router).toContain("ne(calls.direction, 'test')");
    expect(router).toMatch(/\/billing[\s\S]{0,200}requireRole\("staff"\)/);

    const analytics = readFileSync(join(srcRoot, 'modules/analytics/analytics.router.ts'), 'utf8');
    expect(analytics).toContain('answeredCallSql');
    expect(analytics).toContain("ne(calls.direction, 'test')");

    const sections = readFileSync(join(srcRoot, 'modules/sections/sections.service.ts'), 'utf8');
    expect(sections).toContain("ne(calls.direction, 'test')");
    expect(sections).toContain('Missed last 24h');
  });

  it('does not enable DEMO_SKIP_COOLDOWN', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
