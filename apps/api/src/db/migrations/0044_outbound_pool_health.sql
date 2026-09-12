-- ============================================================
-- Outbound pool health (lean v1).
--
-- Rotation already picks least-recently-dialed pool CLIs. This
-- adds simple health so repeated dial / provision failures can
-- pull a number out of rotation:
--   active  — eligible for the next dial
--   cooling — temporarily skipped (auto-returns after cooling_until)
--   bad     — excluded until a human re-enables
--
-- Inbound DIDs are unchanged (purpose='inbound').
-- ============================================================

ALTER TABLE outbound_pool_number_stats
  ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE outbound_pool_number_stats
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;

ALTER TABLE outbound_pool_number_stats
  ADD COLUMN IF NOT EXISTS cooling_until TIMESTAMPTZ;

ALTER TABLE outbound_pool_number_stats
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ;

ALTER TABLE outbound_pool_number_stats
  ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;
