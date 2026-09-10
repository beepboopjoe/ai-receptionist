// ============================================================
// Ensure a homepage demo tenant exists for DEMO_TENANT_ID.
//
// After a DB restore the env UUID can point at a missing tenants row,
// which makes POST /public/call-me blow up on calls_tenant_id_fkey.
// This helper INSERTs a minimal inbound persona (tenant + settings)
// with that exact UUID.
//
// Existing demo settings are HEALED (not left stale): office hours
// stay 24/7 and business_context stays the product-demo persona so
// production Railway DEMO_TENANT_ID does not need manual DB surgery
// after a restore or an old 9–5 seed. Tenant identity (name/slug) is
// not rewritten if the row already exists.
//
// Store is injected so tests don't load config/DB.
// ============================================================
import { isTruthyEnv, type DemoCallMeBootLog } from './public-demo.helpers.js';
import { hasAlwaysOpenStreamHours } from '../telephony/office-hours.js';

/** Accept any 8-4-4-4-12 hex UUID (Postgres uuid type). */
export const DEMO_TENANT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDemoTenantUuid(value: string): boolean {
  return DEMO_TENANT_UUID_RE.test(value.trim());
}

/**
 * Boot/ops gate: DEMO_TENANT_ID must be a UUID, then either
 * DEMO_ENSURE_TENANT is on, or NODE_ENV is production (auto-heal
 * after a restore without waiting for an extra flag).
 */
export function shouldEnsureDemoTenant(opts: {
  tenantId: string | undefined | null;
  ensureFlag?: string | null;
  nodeEnv: string;
}): boolean {
  const id = opts.tenantId?.trim() ?? '';
  if (!id || !isValidDemoTenantUuid(id)) return false;
  if (isTruthyEnv(opts.ensureFlag)) return true;
  return opts.nodeEnv === 'production';
}

export const DEMO_TENANT_NAME = 'Telfin Demo';
export const DEMO_TENANT_SLUG = 'telfin-demo';
/** Generic — this tenant is a product demo, not a fake law firm. */
export const DEMO_TENANT_VERTICAL = 'generic';
export const DEMO_TENANT_TIMEZONE = 'America/New_York';
export const DEMO_TENANT_PLAN = 'trial';

/** True when this call's tenant is the configured homepage demo tenant. */
export function isDemoCallMeTenant(
  tenantId: string | undefined | null,
  demoTenantId: string | undefined | null,
): boolean {
  const id = tenantId?.trim() ?? '';
  const demo = demoTenantId?.trim() ?? '';
  return Boolean(id && demo && isValidDemoTenantUuid(demo) && id === demo);
}

export function demoTenantSlug(tenantId: string, attempt: 0 | 1): string {
  if (attempt === 0) return DEMO_TENANT_SLUG;
  return `${DEMO_TENANT_SLUG}-${tenantId.replace(/-/g, '').slice(0, 8)}`;
}

const WEEKDAY_STREAM = { open: '00:00', close: '23:59' };
const WEEKDAY_DASHBOARD = { open: true, start: '00:00', end: '23:59' };

/**
 * Both key styles: media-stream uses ddd (mon/tue) + open/close strings;
 * signup/dashboard uses monday/… + {open:boolean, start, end}.
 * 24h open so homepage demo calls are never treated as after-hours.
 */
export const DEMO_OFFICE_HOURS = {
  mon: WEEKDAY_STREAM,
  tue: WEEKDAY_STREAM,
  wed: WEEKDAY_STREAM,
  thu: WEEKDAY_STREAM,
  fri: WEEKDAY_STREAM,
  sat: WEEKDAY_STREAM,
  sun: WEEKDAY_STREAM,
  monday: WEEKDAY_DASHBOARD,
  tuesday: WEEKDAY_DASHBOARD,
  wednesday: WEEKDAY_DASHBOARD,
  thursday: WEEKDAY_DASHBOARD,
  friday: WEEKDAY_DASHBOARD,
  saturday: WEEKDAY_DASHBOARD,
  sunday: WEEKDAY_DASHBOARD,
};

/** Generic slots so a missed isDemo flag still isn't a law-firm intake form. */
export const DEMO_APPOINTMENT_TYPES = [
  { id: 'product_walkthrough', name: 'Product Walkthrough', duration_min: 30, buffer_min: 5 },
  { id: 'onboarding_call', name: 'Onboarding Call', duration_min: 45, buffer_min: 10 },
];

/**
 * Fallback facts injected via tenant_settings.business_context.
 * The live call-me script lives in call-me-demo.prompt.ts (isDemo flag).
 * Keep this under the settings 4000-char cap and product-oriented so a
 * missed isDemo flag still does not role-play a fake dental/law office.
 */
export const DEMO_BUSINESS_CONTEXT = `This tenant is the public Telfin product demo (homepage "Hear it on your phone" / call-me), not a fake dental office or law firm.

You are an assistant from Telfin — Telfin's AI receptionist. Callers requested this one-time demo. Open casually: you know you sound realistic, but you are actually an AI that can answer their calls, book appointments, follow up with leads, and set things up. Then ask their name, then their business, soft-close to Try Free, and keep the whole call under about 2 minutes. Sound human — short turns, a light "hmm" or "okay" now and then, not a monologue. Never a hard close or a robotic feature dump unless they ask what you can do.

Always open 24/7. Never say you are closed or take an after-hours message.

If they are not ready to try free, thank them — we still save them as a follow-up lead. Pricing only if they ask: Growth $199, Scale $399, Business $599 per month.`;

export const DEMO_VOICE_NAME = 'aurora';
export const DEMO_VOICE_PROVIDER = 'grok';
export const DEMO_AFTER_HOURS_MODE = 'voicemail';

export interface DemoTenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  vertical: string;
  timezone: string;
  isActive: boolean;
  onboardingStep: number;
}

export interface DemoSettingsRow {
  tenantId: string;
  officeHours: typeof DEMO_OFFICE_HOURS;
  appointmentTypes: typeof DEMO_APPOINTMENT_TYPES;
  voiceName: string;
  voiceProvider: string;
  afterHoursMode: string;
  businessContext: string;
}

export interface DemoSettingsLookup {
  tenantId: string;
  officeHours?: unknown;
  businessContext?: string | null;
}

export interface DemoSettingsHealPatch {
  officeHours: typeof DEMO_OFFICE_HOURS;
  businessContext: string;
}

export interface DemoTenantStore {
  findTenantById(id: string): Promise<{ id: string } | null>;
  insertTenant(row: DemoTenantRow): Promise<void>;
  findSettingsByTenantId(tenantId: string): Promise<DemoSettingsLookup | null>;
  insertSettings(row: DemoSettingsRow): Promise<void>;
  updateSettings(tenantId: string, patch: DemoSettingsHealPatch): Promise<void>;
}

export type EnsureDemoTenantOutcome = 'exists' | 'inserted' | 'healed' | 'skipped' | 'failed';

/** Stale 9–5 hours or a pre-product-demo business_context need a boot heal. */
export function demoSettingsNeedHeal(row: DemoSettingsLookup): boolean {
  if (!hasAlwaysOpenStreamHours(row.officeHours)) return true;
  const ctx = (row.businessContext ?? '').trim();
  return ctx !== DEMO_BUSINESS_CONTEXT.trim();
}

export interface EnsureDemoTenantResult {
  tenant: EnsureDemoTenantOutcome;
  settings: EnsureDemoTenantOutcome;
}

export function buildDemoTenantRow(tenantId: string, slug: string): DemoTenantRow {
  return {
    id: tenantId,
    name: DEMO_TENANT_NAME,
    slug,
    plan: DEMO_TENANT_PLAN,
    vertical: DEMO_TENANT_VERTICAL,
    timezone: DEMO_TENANT_TIMEZONE,
    isActive: true,
    onboardingStep: 5,
  };
}

export function buildDemoSettingsRow(tenantId: string): DemoSettingsRow {
  return {
    tenantId,
    officeHours: DEMO_OFFICE_HOURS,
    appointmentTypes: DEMO_APPOINTMENT_TYPES,
    voiceName: DEMO_VOICE_NAME,
    voiceProvider: DEMO_VOICE_PROVIDER,
    afterHoursMode: DEMO_AFTER_HOURS_MODE,
    businessContext: DEMO_BUSINESS_CONTEXT,
  };
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

export async function ensureDemoTenant(
  store: DemoTenantStore,
  tenantId: string,
  log?: DemoCallMeBootLog,
): Promise<EnsureDemoTenantResult> {
  const id = tenantId.trim();
  if (!isValidDemoTenantUuid(id)) {
    log?.warn({ tenantId }, 'DEMO_ENSURE_TENANT skipped — DEMO_TENANT_ID is not a UUID');
    return { tenant: 'skipped', settings: 'skipped' };
  }

  const existing = await store.findTenantById(id);
  let tenant: EnsureDemoTenantOutcome = 'exists';

  if (!existing) {
    tenant = await insertTenantWithSlugFallback(store, id);
  }

  const existingSettings = await store.findSettingsByTenantId(id);
  let settings: EnsureDemoTenantOutcome = 'exists';
  if (!existingSettings) {
    try {
      await store.insertSettings(buildDemoSettingsRow(id));
      settings = 'inserted';
    } catch (err) {
      if (isUniqueViolation(err)) {
        const raced = await store.findSettingsByTenantId(id);
        settings = raced && demoSettingsNeedHeal(raced) ? await healDemoSettings(store, id) : 'exists';
      } else {
        throw err;
      }
    }
  } else if (demoSettingsNeedHeal(existingSettings)) {
    settings = await healDemoSettings(store, id);
  }

  return { tenant, settings };
}

async function healDemoSettings(
  store: DemoTenantStore,
  tenantId: string,
): Promise<'healed' | 'exists'> {
  await store.updateSettings(tenantId, {
    officeHours: DEMO_OFFICE_HOURS,
    businessContext: DEMO_BUSINESS_CONTEXT,
  });
  return 'healed';
}

async function insertTenantWithSlugFallback(
  store: DemoTenantStore,
  id: string,
): Promise<'exists' | 'inserted'> {
  try {
    await store.insertTenant(buildDemoTenantRow(id, demoTenantSlug(id, 0)));
    return 'inserted';
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const raced = await store.findTenantById(id);
    if (raced) return 'exists';
    await store.insertTenant(buildDemoTenantRow(id, demoTenantSlug(id, 1)));
    return 'inserted';
  }
}

/**
 * When gated on, insert the demo tenant/settings if missing and heal
 * stale 9–5 hours / old personas to 24/7 product-demo settings.
 * Never throws — boot must continue if the DB is empty or down.
 */
export async function maybeEnsureDemoTenantOnBoot(
  opts: { tenantId: string; ensureFlag: string; nodeEnv: string },
  store: DemoTenantStore,
  log?: DemoCallMeBootLog,
): Promise<EnsureDemoTenantResult | null> {
  if (!shouldEnsureDemoTenant(opts)) return null;
  try {
    const result = await ensureDemoTenant(store, opts.tenantId, log);
    log?.info(
      { ...result, tenantId: opts.tenantId.trim() },
      'DEMO_ENSURE_TENANT completed',
    );
    return result;
  } catch (err) {
    log?.warn({ err }, 'DEMO_ENSURE_TENANT failed — call-me will 503 until the demo tenant exists');
    return { tenant: 'failed', settings: 'failed' };
  }
}
