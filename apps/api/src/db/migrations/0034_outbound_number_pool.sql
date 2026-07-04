-- ============================================================
-- Per-tenant rotating outbound dialer number pool.
--
-- Numbers used to place outbound campaign calls are now
-- auto-provisioned by the platform and rotated per-call so no
-- single number dials often enough to get carrier spam-flagged.
-- Pool numbers live in tenant_phone_numbers alongside the
-- tenant's regular (inbound) numbers, discriminated by `purpose`,
-- and are NOT billed the per-number monthly Stripe fee — outbound
-- minutes bill through the existing minute_usage overage pipeline.
--
--   purpose = 'inbound'        tenant-managed, manually purchased (default —
--                              all pre-existing rows keep today's behavior)
--   purpose = 'outbound_pool'  platform-managed, auto-provisioned, rotated
--
-- pool_auto_managed is an explicit guard bit used by the release/
-- list endpoints so a tenant can never manually release a pool
-- number through the tenant-facing API.
-- ============================================================

ALTER TABLE tenant_phone_numbers
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'inbound';

ALTER TABLE tenant_phone_numbers
  ADD COLUMN IF NOT EXISTS pool_auto_managed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS tenant_phone_numbers_pool_idx
  ON tenant_phone_numbers (tenant_id, purpose, released_at);

-- Campaigns created after this feature ship store NULL here, meaning
-- "select a number from the tenant's outbound pool at dial time".
-- Legacy / in-flight campaigns keep their fixed number unchanged.
ALTER TABLE outbound_campaigns
  ALTER COLUMN from_number DROP NOT NULL;

-- Rotation-hot-path counters, one row per pool number. Kept out of
-- tenant_phone_numbers so the settings-page read patterns stay
-- untouched by per-dial writes.
CREATE TABLE IF NOT EXISTS outbound_pool_number_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id UUID NOT NULL UNIQUE REFERENCES tenant_phone_numbers(id) ON DELETE CASCADE,
  last_dialed_at TIMESTAMPTZ,
  -- Rolling dial count since the last scaling sweep (reset each sweep).
  dials_last_24h INTEGER NOT NULL DEFAULT 0,
  total_dials INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outbound_pool_stats_tenant_idx
  ON outbound_pool_number_stats (tenant_id, last_dialed_at);
