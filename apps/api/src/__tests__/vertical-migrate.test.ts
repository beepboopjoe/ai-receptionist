import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  shouldStripLegalBlock,
  stripLegalPracticeAreaBlock,
} from '../modules/admin/vertical-migrate.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('stripLegalPracticeAreaBlock', () => {
  it('removes the legal anchor block and keeps custom prose', () => {
    const input = `We are downtown.

<!-- legal-practice-area-v1 -->
Practice area: Personal Injury.
<!-- /legal-practice-area-v1 -->

Call after hours.`;
    expect(stripLegalPracticeAreaBlock(input)).toBe('We are downtown.\n\nCall after hours.');
  });
});

describe('shouldStripLegalBlock', () => {
  it('only strips when leaving legal', () => {
    expect(shouldStripLegalBlock('legal', 'dental')).toBe(true);
    expect(shouldStripLegalBlock('dental', 'legal')).toBe(false);
    expect(shouldStripLegalBlock('legal', 'legal')).toBe(false);
  });
});

describe('vertical + connector wiring (source)', () => {
  it('migrates appointment types on PATCH /tenant and allows admin disconnect', () => {
    const router = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    expect(router).toContain('migrateAppointmentTypes');
    expect(router).toContain('stripLegalPracticeAreaBlock');
    expect(router).toContain('configured: {');
    expect(router).toMatch(/\/integrations\/:provider[\s\S]{0,80}requireRole\("admin"\)/);
  });

  it('exposes POST connect URLs for shipped CRMs', () => {
    for (const file of [
      'modules/crm/hubspot-oauth.router.ts',
      'modules/crm/salesforce-oauth.router.ts',
      'modules/crm/clio-oauth.router.ts',
      'modules/crm/zoho-oauth.router.ts',
    ]) {
      const src = readFileSync(join(srcRoot, file), 'utf8');
      expect(src).toContain('app.post(');
      expect(src).toContain('return reply.send({ url:');
    }
  });

  it('does not enable DEMO_SKIP_COOLDOWN', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
