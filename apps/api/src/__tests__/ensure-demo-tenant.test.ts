// ============================================================
// Unit tests for ensure-demo-tenant (exists vs insert).
// Fake store — no Fastify / Postgres.
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import {
  isValidDemoTenantUuid,
  shouldEnsureDemoTenant,
  demoTenantSlug,
  buildDemoTenantRow,
  buildDemoSettingsRow,
  ensureDemoTenant,
  maybeEnsureDemoTenantOnBoot,
  DEMO_TENANT_NAME,
  DEMO_TENANT_SLUG,
  DEMO_TENANT_VERTICAL,
  type DemoTenantStore,
  type DemoTenantRow,
  type DemoSettingsRow,
} from '../modules/public-api/ensure-demo-tenant.js';

const DEMO_ID = 'a648f47a-a2b6-444d-96f8-e1e66785a6e5';

function uniqueErr(): Error & { code: string } {
  return Object.assign(new Error('duplicate key'), { code: '23505' });
}

function createFakeStore(opts?: {
  tenantIds?: string[];
  settingsIds?: string[];
  onInsertTenant?: (row: DemoTenantRow) => void;
}): DemoTenantStore & {
  tenants: Set<string>;
  settings: Set<string>;
  insertedTenants: DemoTenantRow[];
  insertedSettings: DemoSettingsRow[];
} {
  const tenants = new Set(opts?.tenantIds ?? []);
  const settings = new Set(opts?.settingsIds ?? []);
  const insertedTenants: DemoTenantRow[] = [];
  const insertedSettings: DemoSettingsRow[] = [];
  return {
    tenants,
    settings,
    insertedTenants,
    insertedSettings,
    async findTenantById(id) {
      return tenants.has(id) ? { id } : null;
    },
    async insertTenant(row) {
      opts?.onInsertTenant?.(row);
      if (tenants.has(row.id)) throw uniqueErr();
      insertedTenants.push(row);
      tenants.add(row.id);
    },
    async findSettingsByTenantId(tenantId) {
      return settings.has(tenantId) ? { tenantId } : null;
    },
    async insertSettings(row) {
      if (settings.has(row.tenantId)) throw uniqueErr();
      insertedSettings.push(row);
      settings.add(row.tenantId);
    },
  };
}

describe('isValidDemoTenantUuid', () => {
  it('accepts the production DEMO_TENANT_ID', () => {
    expect(isValidDemoTenantUuid(DEMO_ID)).toBe(true);
  });

  it.each(['', 'not-a-uuid', 'a648f47a-a2b6-444d-96f8', DEMO_ID.replace(/-/g, '')])(
    'rejects %p',
    (value) => {
      expect(isValidDemoTenantUuid(value)).toBe(false);
    },
  );
});

describe('shouldEnsureDemoTenant', () => {
  it('is off when DEMO_TENANT_ID is empty or invalid', () => {
    expect(shouldEnsureDemoTenant({ tenantId: '', ensureFlag: '1', nodeEnv: 'production' })).toBe(false);
    expect(
      shouldEnsureDemoTenant({ tenantId: 'nope', ensureFlag: '1', nodeEnv: 'production' }),
    ).toBe(false);
  });

  it('runs in production whenever DEMO_TENANT_ID is a UUID', () => {
    expect(
      shouldEnsureDemoTenant({ tenantId: DEMO_ID, ensureFlag: '', nodeEnv: 'production' }),
    ).toBe(true);
  });

  it('stays off in development unless DEMO_ENSURE_TENANT is on', () => {
    expect(
      shouldEnsureDemoTenant({ tenantId: DEMO_ID, ensureFlag: '', nodeEnv: 'development' }),
    ).toBe(false);
    expect(
      shouldEnsureDemoTenant({ tenantId: DEMO_ID, ensureFlag: '1', nodeEnv: 'development' }),
    ).toBe(true);
    expect(
      shouldEnsureDemoTenant({ tenantId: `  ${DEMO_ID}  `, ensureFlag: 'true', nodeEnv: 'test' }),
    ).toBe(true);
  });
});

describe('demoTenantSlug', () => {
  it('uses the stable slug first, then a UUID suffix', () => {
    expect(demoTenantSlug(DEMO_ID, 0)).toBe(DEMO_TENANT_SLUG);
    expect(demoTenantSlug(DEMO_ID, 1)).toBe('telfin-demo-a648f47a');
  });
});

describe('ensureDemoTenant', () => {
  it('is a no-op insert when the tenant and settings already exist', async () => {
    const store = createFakeStore({ tenantIds: [DEMO_ID], settingsIds: [DEMO_ID] });
    await expect(ensureDemoTenant(store, DEMO_ID)).resolves.toEqual({
      tenant: 'exists',
      settings: 'exists',
    });
    expect(store.insertedTenants).toEqual([]);
    expect(store.insertedSettings).toEqual([]);
  });

  it('inserts a minimal tenant + settings with the exact UUID when missing', async () => {
    const store = createFakeStore();
    await expect(ensureDemoTenant(store, DEMO_ID)).resolves.toEqual({
      tenant: 'inserted',
      settings: 'inserted',
    });
    expect(store.insertedTenants).toHaveLength(1);
    expect(store.insertedTenants[0]).toMatchObject({
      id: DEMO_ID,
      name: DEMO_TENANT_NAME,
      slug: DEMO_TENANT_SLUG,
      vertical: DEMO_TENANT_VERTICAL,
      plan: 'trial',
      isActive: true,
      onboardingStep: 5,
    });
    expect(store.insertedSettings).toHaveLength(1);
    expect(store.insertedSettings[0]?.tenantId).toBe(DEMO_ID);
    expect(store.insertedSettings[0]?.voiceProvider).toBe('grok');
    expect(store.insertedSettings[0]?.voiceName).toBe('aurora');
    expect(store.insertedSettings[0]?.businessContext).toMatch(/Telfin Demo/);
    expect(store.insertedSettings[0]?.businessContext).toMatch(/spoken name is Telfin/);
    expect(store.insertedSettings[0]?.officeHours.mon).toEqual({ open: '00:00', close: '23:59' });
  });

  it('inserts settings only when the tenant row already exists', async () => {
    const store = createFakeStore({ tenantIds: [DEMO_ID] });
    await expect(ensureDemoTenant(store, DEMO_ID)).resolves.toEqual({
      tenant: 'exists',
      settings: 'inserted',
    });
    expect(store.insertedTenants).toEqual([]);
    expect(store.insertedSettings).toHaveLength(1);
  });

  it('skips invalid UUIDs without touching the store', async () => {
    const store = createFakeStore();
    const find = vi.spyOn(store, 'findTenantById');
    await expect(ensureDemoTenant(store, 'not-a-uuid')).resolves.toEqual({
      tenant: 'skipped',
      settings: 'skipped',
    });
    expect(find).not.toHaveBeenCalled();
  });

  it('treats a racing unique violation on tenant id as exists', async () => {
    const store = createFakeStore();
    store.insertTenant = async () => {
      store.tenants.add(DEMO_ID);
      throw uniqueErr();
    };
    await expect(ensureDemoTenant(store, DEMO_ID)).resolves.toEqual({
      tenant: 'exists',
      settings: 'inserted',
    });
  });

  it('retries with a unique slug when telfin-demo is taken by another tenant', async () => {
    const store = createFakeStore();
    store.insertTenant = async (row) => {
      if (row.slug === DEMO_TENANT_SLUG) throw uniqueErr();
      store.insertedTenants.push(row);
      store.tenants.add(row.id);
    };
    await expect(ensureDemoTenant(store, DEMO_ID)).resolves.toEqual({
      tenant: 'inserted',
      settings: 'inserted',
    });
    expect(store.insertedTenants[0]?.slug).toBe('telfin-demo-a648f47a');
    expect(store.insertedTenants[0]?.id).toBe(DEMO_ID);
  });

  it('build helpers pin the signup-minimum columns', () => {
    const tenant = buildDemoTenantRow(DEMO_ID, DEMO_TENANT_SLUG);
    expect(tenant).toEqual({
      id: DEMO_ID,
      name: DEMO_TENANT_NAME,
      slug: DEMO_TENANT_SLUG,
      plan: 'trial',
      vertical: 'legal',
      timezone: 'America/New_York',
      isActive: true,
      onboardingStep: 5,
    });
    const settings = buildDemoSettingsRow(DEMO_ID);
    expect(settings.appointmentTypes.map((t) => t.id)).toContain('initial_consult');
  });
});

describe('maybeEnsureDemoTenantOnBoot', () => {
  it('skips the store when the gate is off', async () => {
    const store = createFakeStore();
    const find = vi.spyOn(store, 'findTenantById');
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(
      maybeEnsureDemoTenantOnBoot(
        { tenantId: DEMO_ID, ensureFlag: '', nodeEnv: 'development' },
        store,
        log,
      ),
    ).resolves.toBeNull();
    expect(find).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it('inserts when DEMO_ENSURE_TENANT is on and logs the outcome', async () => {
    const store = createFakeStore();
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(
      maybeEnsureDemoTenantOnBoot(
        { tenantId: DEMO_ID, ensureFlag: '1', nodeEnv: 'development' },
        store,
        log,
      ),
    ).resolves.toEqual({ tenant: 'inserted', settings: 'inserted' });
    expect(log.info).toHaveBeenCalledWith(
      { tenant: 'inserted', settings: 'inserted', tenantId: DEMO_ID },
      'DEMO_ENSURE_TENANT completed',
    );
  });

  it('swallows store errors so boot continues', async () => {
    const store = createFakeStore();
    store.findTenantById = async () => {
      throw new Error('db down');
    };
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(
      maybeEnsureDemoTenantOnBoot(
        { tenantId: DEMO_ID, ensureFlag: '1', nodeEnv: 'development' },
        store,
        log,
      ),
    ).resolves.toEqual({ tenant: 'failed', settings: 'failed' });
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.info).not.toHaveBeenCalled();
  });
});
