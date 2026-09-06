// ============================================================
// Apply hand-written SQL migrations from the adjacent migrations/
// directory. Used by the CLI (migrate.ts) and by API boot so the
// HTTP server can bind before (or even if) migrate finishes.
// ============================================================
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type MigrationResult =
  | { ok: true; applied: string[] }
  | { ok: false; reason: string };

export async function runMigrations(databaseUrl?: string): Promise<MigrationResult> {
  const url = databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) {
    return { ok: false, reason: 'DATABASE_URL is not set' };
  }

  const pool = new pg.Pool({ connectionString: url });
  const appliedNow: string[] = [];
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      return { ok: false, reason: `migrations directory missing: ${migrationsDir}` };
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows } = await client.query<{ name: string }>('SELECT name FROM _migrations');
    const applied = new Set(rows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ⏭  ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`  ▶  ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedNow.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    return { ok: true, applied: appliedNow };
  } finally {
    client.release();
    await pool.end();
  }
}
