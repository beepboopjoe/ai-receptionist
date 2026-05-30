-- ============================================================
-- Phase 22 — heal schema drift on `escalations`.
--
-- Background: 0001_initial.sql created `escalations` with no
-- `updated_at` column and a NOT NULL FK on `call_id` that
-- cascade-deleted when the parent call went away. The Drizzle
-- schema (apps/api/src/db/schema.ts) was later updated to
-- declare `updated_at` as NOT NULL DEFAULT NOW() and to soften
-- `call_id` to nullable with ON DELETE SET NULL — but no
-- corresponding migration shipped, so prod drifted.
--
-- Symptom: PATCH /api/v1/escalations and /escalations both
-- 500'd with `column "updated_at" does not exist` because the
-- handlers (admin/router.ts:1022 + public-api/public.router.ts:716)
-- start their patch object with `{ updatedAt: new Date() }`.
--
-- This migration catches the live DB up to schema.ts.
-- ============================================================

-- 1. Add the missing updated_at column. Defense in depth: also
--    attach the BEFORE UPDATE trigger so any code path that
--    forgets to set updatedAt still gets a fresh timestamp.
ALTER TABLE escalations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The trigger function `update_updated_at()` was created in
-- 0001_initial.sql (line ~192) and is reused by tenants,
-- tenant_settings, integrations, contacts, calls, appointments.
DROP TRIGGER IF EXISTS escalations_updated_at ON escalations;
CREATE TRIGGER escalations_updated_at
  BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Allow call_id to be NULL. The schema.ts definition is
--    `callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' })`
--    — no .notNull(). The original migration had NOT NULL.
ALTER TABLE escalations
  ALTER COLUMN call_id DROP NOT NULL;

-- 3. Recreate the FK with ON DELETE SET NULL (was CASCADE).
--    Postgres auto-named the original constraint
--    `escalations_call_id_fkey` per its standard naming rule.
ALTER TABLE escalations
  DROP CONSTRAINT IF EXISTS escalations_call_id_fkey;
ALTER TABLE escalations
  ADD CONSTRAINT escalations_call_id_fkey
  FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE SET NULL;
