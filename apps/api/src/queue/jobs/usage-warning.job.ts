// ============================================================
// Usage-warning job — runs hourly via node-cron in worker.ts.
//
// Scans `minute_usage` for rows where the tenant has crossed 80%
// of their plan's monthly minutes and we haven't sent a warning
// for this period yet. Sends one email + sets warning_sent_at so
// subsequent ticks within the same period skip the row.
// ============================================================
import { db } from '../../db/client.js';
import { tenants, adminUsers, minuteUsage } from '../../db/schema.js';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getPlan } from '@ai-receptionist/shared';
import { sendEmail } from '../../modules/notifications/adapters/email.adapter.js';
import { config } from '../../config.js';

const WARNING_THRESHOLD = 0.80;

export async function runUsageWarningSweep(): Promise<{ checked: number; sent: number }> {
  // Pull every (tenant, period) row where no warning has gone out yet.
  // We compute the threshold in the app rather than in SQL because the
  // plan's included-minutes value lives in the shared catalog, not the DB.
  const rows = await db
    .select({
      tenantId: minuteUsage.tenantId,
      periodStart: minuteUsage.periodStart,
      minutesUsed: minuteUsage.minutesUsed,
      plan: tenants.plan,
      tenantName: tenants.name,
    })
    .from(minuteUsage)
    .innerJoin(tenants, eq(minuteUsage.tenantId, tenants.id))
    .where(isNull(minuteUsage.warningSentAt));

  let sent = 0;
  for (const row of rows) {
    const plan = getPlan(row.plan);
    if (!plan || plan.monthlyMinutes < 0) continue; // unlimited / unknown — skip
    const used = Number(row.minutesUsed);
    if (used / plan.monthlyMinutes < WARNING_THRESHOLD) continue;

    // Look up the tenant owner's email.
    const [owner] = await db
      .select({ email: adminUsers.email, firstName: adminUsers.firstName })
      .from(adminUsers)
      .where(and(eq(adminUsers.tenantId, row.tenantId), eq(adminUsers.role, 'owner')))
      .limit(1);
    if (!owner) continue;

    if (!config.RESEND_API_KEY) {
      console.warn(`[usage-warning] RESEND_API_KEY unset — skipping ${row.tenantId}`);
      continue;
    }

    const pct = Math.round((used / plan.monthlyMinutes) * 100);
    const remaining = Math.max(0, plan.monthlyMinutes - used);
    const greeting = owner.firstName ? `Hi ${owner.firstName},` : 'Hi,';
    const html = `<p>${greeting}</p>
<p>Heads up — <strong>${row.tenantName}</strong> has used <strong>${Math.round(used)} of your plan's ${plan.monthlyMinutes} included AI minutes</strong> this billing period (about ${pct}%).</p>
<p>You have roughly <strong>${Math.round(remaining)} minutes</strong> left before overage charges of $${plan.overagePerMin.toFixed(2)}/min kick in. Calls won't be cut off — they keep working — but the difference will appear on your next invoice.</p>
<p>If you're consistently hitting your cap, the next tier up usually pays for itself. <a href="${config.DASHBOARD_URL}/billing">Manage your plan →</a></p>
<p>— The Telfin team</p>`;
    try {
      await sendEmail({
        to: owner.email,
        subject: `You've used ${pct}% of your AI minutes this period`,
        html,
      });

      await db
        .update(minuteUsage)
        .set({ warningSentAt: new Date(), updatedAt: new Date() })
        .where(and(eq(minuteUsage.tenantId, row.tenantId), eq(minuteUsage.periodStart, row.periodStart)));

      sent += 1;
    } catch (err) {
      console.error(`[usage-warning] Failed to send to ${row.tenantId}:`, err);
    }
  }

  return { checked: rows.length, sent };
}
