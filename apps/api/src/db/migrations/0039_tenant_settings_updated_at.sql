-- ============================================================
-- Heal schema drift on tenant_settings.updated_at.
--
-- 0001_initial.sql created tenant_settings WITHOUT updated_at, then
-- attached trigger tenant_settings_updated_at that runs
-- update_updated_at() (NEW.updated_at = NOW()) on every UPDATE.
-- INSERT succeeds; UPDATE fails with:
--   record "new" has no field "updated_at"
--
-- That is why DEMO_ENSURE_TENANT completed on first boot (#8 insert)
-- then failed on every later boot once #16 started HEALing existing
-- demo settings (office hours / business_context UPDATE). Call-me
-- still works because it only needs the tenants row.
-- The same trigger also 500s dashboard Settings saves (UPDATE).
-- ============================================================

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Recreate the trigger so a DB that skipped 0001's trigger (or used
-- EXECUTE FUNCTION on an older Postgres) still heals. EXECUTE PROCEDURE
-- is valid on PG11+; EXECUTE FUNCTION is PG14+ only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    DROP TRIGGER IF EXISTS tenant_settings_updated_at ON tenant_settings;
    CREATE TRIGGER tenant_settings_updated_at
      BEFORE UPDATE ON tenant_settings
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
  END IF;
END $$;
