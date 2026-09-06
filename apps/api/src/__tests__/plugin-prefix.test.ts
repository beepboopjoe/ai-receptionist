// ============================================================
// Regression: routers registered with `{ prefix: '/api/v1' }` in
// main.ts must NOT be wrapped in fastify-plugin. fp() de-encapsulates
// the plugin and mounts routes at the ROOT, so dashboard/Telnyx calls
// to /api/v1/... 404.
//
// Reads source (does not import the routers — they pull in config/db).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const CRITICAL_ROUTERS = [
  'modules/telephony/router.ts',
  'modules/crm/router.ts',
  'modules/scheduler/router.ts',
  'modules/voice-agent/router.ts',
  'modules/agent/agent.router.ts',
  'modules/sms/sms.router.ts',
  'modules/compliance/compliance.router.ts',
  'modules/knowledge-base/kb.router.ts',
];

describe('critical routers keep the /api/v1 prefix', () => {
  it.each(CRITICAL_ROUTERS)('%s is not wrapped in fastify-plugin', (rel) => {
    const src = readFileSync(join(srcRoot, rel), 'utf8');
    expect(src).not.toMatch(/export const \w+Plugin = fp\(/);
    expect(src).not.toMatch(/export const \w+Plugin = fp\s*\(/);
  });
});

describe('escalations schema-drift migration', () => {
  it('adds updated_at so PATCH /escalations cannot 500', () => {
    const sql = readFileSync(
      join(srcRoot, 'db/migrations/0032_escalations_schema_drift.sql'),
      'utf8'
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS updated_at/i);
    expect(sql).toMatch(/ALTER COLUMN call_id DROP NOT NULL/i);
  });
});
