// ============================================================
// Unpaid Free / demo accounts may browse the dashboard but
// cannot provision a DID or activate the receptionist.
// Promo-trial tenants (platform-granted) are not demo.
// ============================================================
import { eq } from 'drizzle-orm';
import { isUnpaidDemoAccount } from '@ai-receptionist/shared';
import { db } from '../../db/client.js';
import { tenants } from '../../db/schema.js';

export const UPGRADE_TO_GO_LIVE_MESSAGE =
  'Upgrade to a paid plan to provision a phone number and activate your AI receptionist.';

export async function getTenantDemoFlags(tenantId: string): Promise<{
  plan: string | null;
  promoTrial: boolean;
  isDemo: boolean;
}> {
  const [tenant] = await db
    .select({ plan: tenants.plan, promoTrial: tenants.promoTrial })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const plan = tenant?.plan ?? 'trial';
  const promoTrial = Boolean(tenant?.promoTrial);
  return {
    plan,
    promoTrial,
    isDemo: isUnpaidDemoAccount(plan, promoTrial),
  };
}
