// ============================================================
// Drizzle adapter for ensureDemoTenant. Imported only from boot
// (main.ts) so helper unit tests never load config/DB.
// ============================================================
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { tenants, tenantSettings } from '../../db/schema.js';
import type {
  DemoSettingsHealPatch,
  DemoSettingsLookup,
  DemoSettingsRow,
  DemoTenantRow,
  DemoTenantStore,
} from './ensure-demo-tenant.js';

export function createDrizzleDemoTenantStore(db: Db): DemoTenantStore {
  return {
    async findTenantById(id: string) {
      const [row] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);
      return row ?? null;
    },
    async insertTenant(row: DemoTenantRow) {
      await db.insert(tenants).values({
        id: row.id,
        name: row.name,
        slug: row.slug,
        plan: row.plan,
        vertical: row.vertical,
        timezone: row.timezone,
        isActive: row.isActive,
        onboardingStep: row.onboardingStep,
      });
    },
    async findSettingsByTenantId(tenantId: string): Promise<DemoSettingsLookup | null> {
      const [row] = await db
        .select({
          tenantId: tenantSettings.tenantId,
          officeHours: tenantSettings.officeHours,
          businessContext: tenantSettings.businessContext,
        })
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, tenantId))
        .limit(1);
      return row ?? null;
    },
    async insertSettings(row: DemoSettingsRow) {
      await db.insert(tenantSettings).values({
        tenantId: row.tenantId,
        officeHours: row.officeHours,
        appointmentTypes: row.appointmentTypes,
        voiceName: row.voiceName,
        voiceProvider: row.voiceProvider,
        afterHoursMode: row.afterHoursMode,
        businessContext: row.businessContext,
      });
    },
    async updateSettings(tenantId: string, patch: DemoSettingsHealPatch) {
      await db
        .update(tenantSettings)
        .set({
          officeHours: patch.officeHours,
          businessContext: patch.businessContext,
        })
        .where(eq(tenantSettings.tenantId, tenantId));
    },
  };
}
