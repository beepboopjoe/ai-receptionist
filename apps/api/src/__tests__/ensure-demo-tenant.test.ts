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
  demoSettingsNeedHeal,
  isDemoCallMeTenant,
  DEMO_TENANT_NAME,
  DEMO_TENANT_SLUG,
  DEMO_TENANT_VERTICAL,
  DEMO_BUSINESS_CONTEXT,
  DEMO_OFFICE_HOURS,
  type DemoTenantStore,
  type DemoTenantRow,
  type DemoSettingsRow,
  type DemoSettingsLookup,
  type DemoSettingsHealPatch,
} from '../modules/public-api/ensure-demo-tenant.js';

const DEMO_ID = 'a648f47a-a2b6-444d-96f8-e1e66785a6e5';

function uniqueErr(): Error & { code: string } {
  return Object.assign(new Error('duplicate key'), { code: '23505' });
}

function createFakeStore(opts?: {
  tenantIds?: string[];
  settings?: Array<DemoSettingsLookup>;
  /** Convenience: settings exist for these IDs with already-correct 24/7 hours. */
  settingsIds?: string[];
  onInsertTenant?: (row: DemoTenantRow) => void;
}): DemoTenantStore & {
  tenants: Set<string>;
  settingsMap: Map<string, DemoSettingsLookup>;
  insertedTenants: DemoTenantRow[];
  insertedSettings: DemoSettingsRow[];
  patchedSettings: Array<{ tenantId: string; patch: DemoSettingsHealPatch }>;
} {
  const tenants = new Set(opts?.tenantIds ?? []);
  const settingsMap = new Map<string, DemoSettingsLookup>();
  for (const id of opts?.settingsIds ?? []) {
    settingsMap.set(id, {
      tenantId: id,
      officeHours: DEMO_OFFICE_HOURS,
      businessContext: DEMO_BUSINESS_CONTEXT,
    });
  }
  for (const row of opts?.settings ?? []) {
    settingsMap.set(row.tenantId, row);
  }
  const insertedTenants: DemoTenantRow[] = [];
  const insertedSettings: DemoSettingsRow[] = [];
  const patchedSettings: Array<{ tenantId: string; patch: DemoSettingsHealPatch }> = [];
  return {
    tenants,
    settingsMap,
    insertedTenants,
    insertedSettings,
    patchedSettings,
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
      return settingsMap.get(tenantId) ?? null;
    },
    async insertSettings(row) {
      if (settingsMap.has(row.tenantId)) throw uniqueErr();
      insertedSettings.push(row);
      settingsMap.set(row.tenantId, {
        tenantId: row.tenantId,
        officeHours: row.officeHours,
        businessContext: row.businessContext,
      });
    },
    async updateSettings(tenantId, patch) {
      patchedSettings.push({ tenantId, patch });
      settingsMap.set(tenantId, {
        tenantId,
        officeHours: patch.officeHours,
        businessContext: patch.businessContext,
      });
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
  it('is a no-op insert when the tenant and settings already exist and are 24/7', async () => {
    const store = createFakeStore({ tenantIds: [DEMO_ID], settingsIds: [DEMO_ID] });
    await expect(ensureDemoTenant(store, DEMO_ID)).resolves.toEqual({
      tenant: 'exists',
      settings: 'exists',
    });
    expect(store.insertedTenants).toEqual([]);
    expect(store.insertedSettings).toEqual([]);
    expect(store.patchedSettings).toEqual([]);
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
    expect(store.insertedSettings[0]?.voiceName).toBe('eve');
    expect(store.insertedSettings[0]?.businessContext).toMatch(/Telfin/);
    expect(store.insertedSettings[0]?.businessContext).toMatch(/24\/7/);
    expect(store.insertedSettings[0]?.officeHours.mon).toEqual({ open: '00:00', close: '23:59' });
    expect(store.insertedSettings[0]?.officeHours.sunday).toEqual({
      open: true,
      start: '00:00',
      end: '23:59',
    });
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
      vertical: DEMO_TENANT_VERTICAL,
      timezone: 'America/New_York',
      isActive: true,
      onboardingStep: 5,
    });
    expect(DEMO_TENANT_VERTICAL).toBe('generic');
    const settings = buildDemoSettingsRow(DEMO_ID);
    expect(settings.appointmentTypes.map((t) => t.id)).toContain('product_walkthrough');
    expect(settings.businessContext.length).toBeLessThanOrEqual(4000);
  });

  it('heals stale 9–5 hours and a law-firm persona on an existing demo tenant', async () => {
    const store = createFakeStore({
      tenantIds: [DEMO_ID],
      settings: [
        {
          tenantId: DEMO_ID,
          officeHours: {
            mon: { open: '08:00', close: '17:00' },
            fri: { open: '08:00', close: '16:00' },
          },
          businessContext: 'Telfin Demo is a sample law firm used only for the live homepage receptionist demo.',
        },
      ],
    });
    await expect(ensureDemoTenant(store, DEMO_ID)).resolves.toEqual({
      tenant: 'exists',
      settings: 'healed',
    });
    expect(store.insertedSettings).toEqual([]);
    expect(store.patchedSettings).toHaveLength(1);
    expect(store.patchedSettings[0]?.patch.officeHours.sun).toEqual({ open: '00:00', close: '23:59' });
    expect(store.patchedSettings[0]?.patch.businessContext).toBe(DEMO_BUSINESS_CONTEXT);
  });
});

describe('isDemoCallMeTenant', () => {
  it('matches only the configured demo UUID', () => {
    expect(isDemoCallMeTenant(DEMO_ID, DEMO_ID)).toBe(true);
    expect(isDemoCallMeTenant(` ${DEMO_ID} `, DEMO_ID)).toBe(true);
    expect(isDemoCallMeTenant(DEMO_ID, '')).toBe(false);
    expect(isDemoCallMeTenant('11111111-1111-1111-1111-111111111111', DEMO_ID)).toBe(false);
  });
});

describe('demoSettingsNeedHeal', () => {
  it('is false for the canonical 24/7 + product persona', () => {
    expect(
      demoSettingsNeedHeal({
        tenantId: DEMO_ID,
        officeHours: DEMO_OFFICE_HOURS,
        businessContext: DEMO_BUSINESS_CONTEXT,
      }),
    ).toBe(false);
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
