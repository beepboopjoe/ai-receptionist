// ============================================================
// Recurring goal-driven campaigns — Phase 18.
//
// Takes a one-shot campaign created from a Phase 12.4 goal
// template and turns it into a daily/weekly/monthly recurring
// run. A worker that fires every minute scans for due rows
// (next_run_at <= NOW() WHERE is_recurring) and:
//   1. Re-runs the goal's findCandidates query for fresh leads
//   2. Skips candidates whose phone is already in this campaign
//   3. Inserts the new contacts with status='pending'
//   4. Updates last_run_at + recurring_run_count + next_run_at
//
// The existing dialer worker picks up the new pending rows
// automatically — no extra plumbing required there.
//
// V1 limit: only goal-based campaigns can be made recurring.
// Manual campaigns have no candidate query to re-run.
// ============================================================
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { and, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { outboundCampaigns, campaignContacts } from '../../db/schema.js';
import { findGoal } from './campaign-goals.service.js';
import pino from 'pino';

dayjs.extend(utc);
dayjs.extend(timezone);

const logger = pino({ name: 'recurring-campaigns' });

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceParams {
  frequency: RecurrenceFrequency;
  dayOfWeek?: number;    // 0=Sun..6=Sat, required when frequency='weekly'
  dayOfMonth?: number;   // 1..28, required when frequency='monthly'
  time: string;          // 'HH:MM' 24-hour
  timezone: string;      // IANA tz, e.g. 'America/Los_Angeles'
}

/**
 * Compute the next scheduled run datetime (in UTC) after a given starting
 * point, for a given recurrence config interpreted in the tenant's tz.
 *
 * Examples (with `from = 2026-05-27 14:00 UTC`, tz = 'America/Los_Angeles'):
 *   - daily at 09:00 → next 09:00 PST after `from`
 *   - weekly Monday at 09:00 → next Monday at 09:00 PST after `from`
 *   - monthly on day 15 at 09:00 → next 15th at 09:00 PST after `from`
 */
export function computeNextRun(params: RecurrenceParams, from: Date = new Date()): Date {
  const [h, m] = params.time.split(':').map(Number);
  const hour = h ?? 9;
  const minute = m ?? 0;

  // Start "today" in the tenant's tz at the configured time.
  let candidate = dayjs.tz(from, params.timezone).hour(hour).minute(minute).second(0).millisecond(0);

  switch (params.frequency) {
    case 'daily': {
      // If today's run already passed, push to tomorrow.
      if (!candidate.isAfter(dayjs.tz(from, params.timezone))) {
        candidate = candidate.add(1, 'day');
      }
      break;
    }
    case 'weekly': {
      const targetDow = params.dayOfWeek ?? 1; // default Monday
      // Move candidate to the target day of week.
      const currentDow = candidate.day();
      let diff = targetDow - currentDow;
      if (diff < 0) diff += 7;
      candidate = candidate.add(diff, 'day');
      // If still in the past after adjusting, push another week.
      if (!candidate.isAfter(dayjs.tz(from, params.timezone))) {
        candidate = candidate.add(7, 'day');
      }
      break;
    }
    case 'monthly': {
      const targetDom = params.dayOfMonth ?? 1;
      candidate = candidate.date(targetDom);
      // If this month's run already passed, push to next month.
      if (!candidate.isAfter(dayjs.tz(from, params.timezone))) {
        candidate = candidate.add(1, 'month').date(targetDom);
      }
      break;
    }
  }

  return candidate.utc().toDate();
}

/**
 * Mark a campaign as recurring. Validates that it has a `goal` (only
 * goal-based campaigns can be recurring in V1) and that the recurrence
 * params are coherent for the chosen frequency.
 */
export async function markCampaignRecurring(
  tenantId: string,
  campaignId: string,
  params: RecurrenceParams
): Promise<{ ok: true; nextRunAt: Date } | { ok: false; reason: string }> {
  const [campaign] = await db
    .select({ id: outboundCampaigns.id, goal: outboundCampaigns.goal })
    .from(outboundCampaigns)
    .where(and(eq(outboundCampaigns.id, campaignId), eq(outboundCampaigns.tenantId, tenantId)))
    .limit(1);

  if (!campaign) return { ok: false, reason: 'not_found' };
  if (!campaign.goal) {
    return { ok: false, reason: 'manual_campaigns_cannot_recur' };
  }
  if (params.frequency === 'weekly' && (params.dayOfWeek === undefined || params.dayOfWeek < 0 || params.dayOfWeek > 6)) {
    return { ok: false, reason: 'invalid_day_of_week' };
  }
  if (params.frequency === 'monthly' && (params.dayOfMonth === undefined || params.dayOfMonth < 1 || params.dayOfMonth > 28)) {
    return { ok: false, reason: 'invalid_day_of_month' };
  }
  if (!/^\d{1,2}:\d{2}$/.test(params.time)) {
    return { ok: false, reason: 'invalid_time' };
  }

  const nextRunAt = computeNextRun(params);

  await db
    .update(outboundCampaigns)
    .set({
      isRecurring: true,
      recurrenceFrequency: params.frequency,
      recurrenceDayOfWeek: params.dayOfWeek ?? null,
      recurrenceDayOfMonth: params.dayOfMonth ?? null,
      recurrenceTime: params.time,
      recurrenceTimezone: params.timezone,
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(outboundCampaigns.id, campaignId));

  return { ok: true, nextRunAt };
}

export async function clearRecurrence(tenantId: string, campaignId: string): Promise<void> {
  await db
    .update(outboundCampaigns)
    .set({
      isRecurring: false,
      nextRunAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(outboundCampaigns.id, campaignId), eq(outboundCampaigns.tenantId, tenantId)));
}

/**
 * Scan-and-run. Called every minute by the BullMQ repeatable worker.
 * For each due recurring campaign:
 *   1. Look up the goal
 *   2. Re-run findCandidates(tenantId)
 *   3. Filter out phones already in this campaign
 *   4. Insert the new ones as pending
 *   5. Update last_run_at + next_run_at + recurring_run_count
 *
 * Failures on one campaign don't block the others.
 */
export async function runDueRecurringCampaigns(): Promise<{ scanned: number; ran: number }> {
  const dueCampaigns = await db
    .select({
      id: outboundCampaigns.id,
      tenantId: outboundCampaigns.tenantId,
      goal: outboundCampaigns.goal,
      recurrenceFrequency: outboundCampaigns.recurrenceFrequency,
      recurrenceDayOfWeek: outboundCampaigns.recurrenceDayOfWeek,
      recurrenceDayOfMonth: outboundCampaigns.recurrenceDayOfMonth,
      recurrenceTime: outboundCampaigns.recurrenceTime,
      recurrenceTimezone: outboundCampaigns.recurrenceTimezone,
    })
    .from(outboundCampaigns)
    .where(
      and(
        eq(outboundCampaigns.isRecurring, true),
        isNotNull(outboundCampaigns.nextRunAt),
        lte(outboundCampaigns.nextRunAt, new Date())
      )
    )
    .limit(50);

  if (dueCampaigns.length === 0) return { scanned: 0, ran: 0 };

  let ran = 0;

  for (const c of dueCampaigns) {
    try {
      if (!c.goal || !c.recurrenceFrequency || !c.recurrenceTime || !c.recurrenceTimezone) {
        logger.warn({ campaignId: c.id }, 'Recurring campaign missing required fields — skipping');
        continue;
      }

      const goal = findGoal(c.goal);
      if (!goal) {
        logger.warn({ campaignId: c.id, goal: c.goal }, 'Goal slug not found — clearing recurrence');
        await clearRecurrence(c.tenantId, c.id);
        continue;
      }

      const candidates = await goal.findCandidates(c.tenantId);

      // Skip phones already in this campaign — recurring runs should add NEW
      // contacts, not redial the same ones.
      const existing = await db
        .select({ phoneE164: campaignContacts.phoneE164 })
        .from(campaignContacts)
        .where(eq(campaignContacts.campaignId, c.id));
      const seen = new Set(existing.map((r) => r.phoneE164));

      const fresh = candidates.filter((cand) => !seen.has(cand.phoneE164));

      if (fresh.length > 0) {
        await db.insert(campaignContacts).values(
          fresh.map((cand) => ({
            campaignId: c.id,
            tenantId: c.tenantId,
            contactId: cand.contactId && cand.contactId.length > 0 ? cand.contactId : null,
            phoneE164: cand.phoneE164,
            firstName: cand.firstName,
            lastName: cand.lastName,
            email: cand.email,
            status: 'pending' as const,
          }))
        );

        // Bump totalLeads + ensure status is 'running' so the dialer picks them up.
        await db
          .update(outboundCampaigns)
          .set({
            totalLeads: sql`${outboundCampaigns.totalLeads} + ${fresh.length}`,
            status: 'running',
            updatedAt: new Date(),
          })
          .where(eq(outboundCampaigns.id, c.id));
      } else {
        logger.info({ campaignId: c.id }, 'Recurring run produced no NEW candidates — skipping insert');
      }

      const nextRunAt = computeNextRun({
        frequency: c.recurrenceFrequency as RecurrenceFrequency,
        ...(c.recurrenceDayOfWeek !== null ? { dayOfWeek: c.recurrenceDayOfWeek } : {}),
        ...(c.recurrenceDayOfMonth !== null ? { dayOfMonth: c.recurrenceDayOfMonth } : {}),
        time: c.recurrenceTime,
        timezone: c.recurrenceTimezone,
      });

      await db
        .update(outboundCampaigns)
        .set({
          lastRunAt: new Date(),
          nextRunAt,
          recurringRunCount: sql`${outboundCampaigns.recurringRunCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(outboundCampaigns.id, c.id));

      ran++;
      logger.info(
        { campaignId: c.id, tenantId: c.tenantId, freshContacts: fresh.length, nextRunAt },
        'Recurring campaign run complete'
      );
    } catch (err) {
      logger.error({ err, campaignId: c.id }, 'Recurring campaign run failed');
    }
  }

  return { scanned: dueCampaigns.length, ran };
}
