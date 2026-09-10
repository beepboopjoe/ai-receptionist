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
  'modules/public-api/site-chat.router.ts',
];

describe('critical routers keep the /api/v1 prefix', () => {
  it.each(CRITICAL_ROUTERS)('%s is not wrapped in fastify-plugin', (rel) => {
    const src = readFileSync(join(srcRoot, rel), 'utf8');
    expect(src).not.toMatch(/export const \w+Plugin = fp\(/);
    expect(src).not.toMatch(/export const \w+Plugin = fp\s*\(/);
  });
});

const INTERNAL_ROUTE_FILES = [
  'modules/scheduler/router.ts',
  'modules/crm/router.ts',
  'modules/workflow-engine/router.ts',
];

describe('internal voice-agent routes are registered once', () => {
  it.each(['/internal/slots/search', '/internal/appointments/book', '/internal/contacts/identify'])(
    '%s is declared in exactly one router',
    (route) => {
      const hits = INTERNAL_ROUTE_FILES.filter((rel) =>
        readFileSync(join(srcRoot, rel), 'utf8').includes(`'${route}'`)
      );
      expect(hits, `${route} declared in: ${hits.join(', ') || '(none)'}`).toEqual([
        'modules/workflow-engine/router.ts',
      ]);
    }
  );
});

const TENANT_CRUD_FILES = [
  'modules/scheduler/router.ts',
  'modules/crm/router.ts',
  'modules/admin/router.ts',
];

describe('tenant CRUD routes are registered once after /api/v1 unwrap', () => {
  it.each([
    ['GET', '/appointments', 'modules/admin/router.ts'],
    ['GET', '/appointments/:id', 'modules/admin/router.ts'],
    ['PATCH', '/appointments/:id', 'modules/admin/router.ts'],
    ['GET', '/contacts', 'modules/admin/router.ts'],
    ['GET', '/contacts/:id', 'modules/admin/router.ts'],
    ['PATCH', '/contacts/:id', 'modules/admin/router.ts'],
  ] as const)('%s %s lives only in %s', (method, path, owner) => {
    const routeRe = new RegExp(
      `app\\.${method.toLowerCase()}\\(\\s*['\`]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\`]`
    );
    const hits = TENANT_CRUD_FILES.filter((rel) => routeRe.test(readFileSync(join(srcRoot, rel), 'utf8')));
    expect(hits, `${method} ${path} declared in: ${hits.join(', ') || '(none)'}`).toEqual([owner]);
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

describe('tenant_settings updated_at schema-drift migration', () => {
  it('adds updated_at so DEMO_ENSURE_TENANT heal UPDATE cannot 500', () => {
    const sql = readFileSync(
      join(srcRoot, 'db/migrations/0040_tenant_settings_updated_at.sql'),
      'utf8'
    );
    expect(sql).toMatch(/ALTER TABLE tenant_settings/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS updated_at/i);
    expect(sql).toMatch(/tenant_settings_updated_at/);
  });
});
