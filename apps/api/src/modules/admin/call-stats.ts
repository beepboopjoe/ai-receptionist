// ============================================================
// Customer-facing call stats — exclude test/self-test dials
// from lists and aggregates. Shared by /calls, /billing,
// analytics, and SectionAgent.
// ============================================================
import { and, eq, gte, ne, sql, type SQL } from 'drizzle-orm';
import { calls } from '../../db/schema.js';

export const ANSWERED_CALL_STATUSES = ['completed', 'transferred'] as const;

export function answeredCallSql(): SQL {
  return sql`${calls.status} IN ('completed', 'transferred')`;
}

export function parseCallListQuery(query: Record<string, string | undefined>): {
  limit: number;
  offset: number;
  status?: string;
  includeTest: boolean;
} {
  const limit = Math.min(Math.max(parseInt(query.limit ?? '25', 10) || 25, 1), 100);
  const offset = Math.max(parseInt(query.offset ?? '0', 10) || 0, 0);
  const rawStatus = (query.status ?? '').trim();
  const status = rawStatus && rawStatus !== 'all' ? rawStatus : undefined;
  const includeTest = query.includeTest === '1' || query.includeTest === 'true';
  return { limit, offset, ...(status ? { status } : {}), includeTest };
}

export function customerCallsWhere(
  tenantId: string,
  opts?: { status?: string; includeTest?: boolean; since?: Date }
): SQL | undefined {
  const parts = [eq(calls.tenantId, tenantId)];
  if (!opts?.includeTest) {
    parts.push(ne(calls.direction, 'test'));
  }
  if (opts?.status) {
    parts.push(eq(calls.status, opts.status));
  }
  if (opts?.since) {
    parts.push(gte(calls.startedAt, opts.since));
  }
  return and(...parts);
}

