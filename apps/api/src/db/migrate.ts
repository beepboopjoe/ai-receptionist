// ============================================================
// CLI: node dist/migrate.js
// ============================================================
import { runMigrations } from './run-migrations.js';

async function main() {
  console.log('🔄 Running migrations...');
  const result = await runMigrations();
  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }
  console.log('✅ Migrations complete', result.applied.length ? `(applied: ${result.applied.join(', ')})` : '(none pending)');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
