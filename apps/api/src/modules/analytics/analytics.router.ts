// ============================================================
// Analytics router — Phase 12.6.
//
// Single endpoint, single round-trip per page render:
//   GET /analytics/overview?days=N
//
// Returns aggregated metrics for the requested window:
//   - totals (calls, answered, missed, bookings, escalations, duration)
//   - daily breakdown (for the SVG bar chart)
//   - peak hour
//   - rough ROI estimates (calls recovered, money saved)
//
// All computed with one round-trip per metric — no LLM, no fan-out
// joins. Cached per (tenant, days) for 5 minutes in Redis so heavy
// dashboard refreshes don't pound the DB.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { calls, appointments, escalations } from '../../db/schema.js';
import { and, eq, gte, count, sql } from 'drizzle-orm';
import { redis } from '../../db/redis.js';
import { ValidationError } from '../../lib/errors.js';

// Rough heuristic for "money saved" — average booking value per industry
// is wildly variable, so we expose a per-tenant override via tenant_settings
// later. For V1 we use a single platform-wide $200 figure tuned to the
// dental/insurance/legal averages.
const AVG_BOOKING_VALUE_USD = 200;
// Human receptionist cost reference for the "vs. hiring" pitch.
const HUMAN_RECEPTIONIST_HOURLY = 22;

export async function analyticsPlugin(app: FastifyInstance): Promise<void> {
  app.get('/analytics/overview', {
    preHandler: [app.requireRole('staff')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const q = request.query as { days?: string };
      const days = Math.min(Math.max(parseInt(q.days ?? '30', 10), 1), 365);
      if (!Number.isFinite(days)) {
        throw new ValidationError('days must be a positive integer');
      }

      const cacheKey = `analytics:${tenantId}:${days}`;
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) {
        return reply.send(JSON.parse(cached));
      }

      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();

      // Run the aggregations in parallel — each is a single SELECT,
      // safe to fan out. Promise.all gives us the wall-clock win.
      const [
        totalsRows,
        bookingRows,
        escalationRows,
        dailyRows,
        peakHourRows,
      ] = await Promise.all([
        // ── 1. Call totals + duration sum
        db
          .select({
            total: count(),
            answered: sql<number>`COUNT(*) FILTER (WHERE ${calls.status} != 'missed')`,
            missed: sql<number>`COUNT(*) FILTER (WHERE ${calls.status} = 'missed')`,
            totalDuration: sql<number>`COALESCE(SUM(${calls.durationSeconds}), 0)`,
          })
          .from(calls)
          .where(and(eq(calls.tenantId, tenantId), gte(calls.startedAt, since))),

        // ── 2. Appointments booked in window
        db
          .select({ value: count() })
          .from(appointments)
          .where(
            and(
              eq(appointments.tenantId, tenantId),
              gte(appointments.createdAt, since)
            )
          ),

        // ── 3. Escalations in window
        db
          .select({ value: count() })
          .from(escalations)
          .where(
            and(
              eq(escalations.tenantId, tenantId),
              gte(escalations.createdAt, since)
            )
          ),

        // ── 4. Daily breakdown for the bar chart
        db.execute<{
          day: string;
          calls: string;
          missed: string;
          bookings: string;
        }>(sql`
          WITH days AS (
            SELECT generate_series(${sinceIso}::date, CURRENT_DATE, '1 day'::interval)::date AS day
          ),
          calls_by_day AS (
            SELECT
              date_trunc('day', ${calls.startedAt})::date AS day,
              COUNT(*)                                         AS calls,
              COUNT(*) FILTER (WHERE ${calls.status} = 'missed') AS missed
            FROM ${calls}
            WHERE ${calls.tenantId} = ${tenantId}
              AND ${calls.startedAt} >= ${sinceIso}
            GROUP BY 1
          ),
          bookings_by_day AS (
            SELECT
              date_trunc('day', ${appointments.createdAt})::date AS day,
              COUNT(*)                                                 AS bookings
            FROM ${appointments}
            WHERE ${appointments.tenantId} = ${tenantId}
              AND ${appointments.createdAt} >= ${sinceIso}
            GROUP BY 1
          )
          SELECT
            to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(c.calls, 0)         AS calls,
            COALESCE(c.missed, 0)        AS missed,
            COALESCE(b.bookings, 0)      AS bookings
          FROM days d
          LEFT JOIN calls_by_day    c ON c.day = d.day
          LEFT JOIN bookings_by_day b ON b.day = d.day
          ORDER BY d.day ASC
        `),

        // ── 5. Peak inbound hour (0-23) by call count
        db.execute<{ hour: string; count: string }>(sql`
          SELECT
            EXTRACT(HOUR FROM ${calls.startedAt})::text AS hour,
            COUNT(*)::text                              AS count
          FROM ${calls}
          WHERE ${calls.tenantId} = ${tenantId}
            AND ${calls.startedAt} >= ${sinceIso}
            AND ${calls.direction} = 'inbound'
          GROUP BY 1
          ORDER BY COUNT(*) DESC
          LIMIT 1
        `),
      ]);

      const totalsRow = totalsRows[0] ?? { total: 0, answered: 0, missed: 0, totalDuration: 0 };
      const bookingsCount = Number(bookingRows[0]?.value ?? 0);
      const escalationsCount = Number(escalationRows[0]?.value ?? 0);
      const callsTotal = Number(totalsRow.total ?? 0);
      const answered = Number(totalsRow.answered ?? 0);
      const missed = Number(totalsRow.missed ?? 0);
      const totalDuration = Number(totalsRow.totalDuration ?? 0);

      const dailyRowsArr =
        ('rows' in dailyRows ? (dailyRows as any).rows : dailyRows) as Array<{
          day: string;
          calls: string;
          missed: string;
          bookings: string;
        }>;
      const daily = dailyRowsArr.map((r) => ({
        date: r.day,
        calls: Number(r.calls ?? 0),
        missed: Number(r.missed ?? 0),
        bookings: Number(r.bookings ?? 0),
      }));

      const peakRowsArr =
        ('rows' in peakHourRows ? (peakHourRows as any).rows : peakHourRows) as Array<{
          hour: string;
          count: string;
        }>;
      const peakHour = peakRowsArr[0]
        ? { hour: Number(peakRowsArr[0].hour), count: Number(peakRowsArr[0].count) }
        : null;

      // ROI heuristics — intentionally simple. The "calls you would have missed"
      // is anchored at answered count: every one is a call that would have
      // ended at voicemail without the AI. Money figure compounds bookings.
      const callsRecovered = answered;
      const moneySaved = bookingsCount * AVG_BOOKING_VALUE_USD;
      // Hours of receptionist work avoided (1.5 min average call → human hours).
      const hoursOfStaffWork = Math.round((totalDuration / 60 / 60) * 10) / 10;
      const humanCostAvoided = Math.round(hoursOfStaffWork * HUMAN_RECEPTIONIST_HOURLY);

      const payload = {
        period: { days, from: sinceIso, to: new Date().toISOString() },
        totals: {
          calls: callsTotal,
          answered,
          missed,
          bookings: bookingsCount,
          escalations: escalationsCount,
          totalDurationSeconds: totalDuration,
          answerRate: callsTotal > 0 ? Math.round((answered / callsTotal) * 100) : 0,
        },
        daily,
        peakHour,
        roi: {
          callsRecovered,
          moneySaved,
          hoursOfStaffWork,
          humanCostAvoided,
          avgBookingValueUsd: AVG_BOOKING_VALUE_USD,
        },
      };

      // 5-minute cache. Data is read-only and doesn't need to be live.
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', 300).catch(() => null);
      return reply.send(payload);
    },
  });
}
