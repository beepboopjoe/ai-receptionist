// ============================================================
// Database client — pg pool singleton + Drizzle ORM
// ============================================================
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;

export async function closeDb(): Promise<void> {
  await pool.end();
}

// Helper: every query MUST include tenant_id. This is enforced at the module
// level, not here, but it's documented as an architecture invariant.
export function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId) throw new Error('tenantId is required for all queries');
  return tenantId;
}
