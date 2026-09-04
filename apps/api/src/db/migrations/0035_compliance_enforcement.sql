-- ============================================================
-- Compliance enforcement flags (Phase 1).
--
-- Two per-tenant switches that turn previously-cosmetic compliance
-- settings into real enforcement:
--
--   store_transcripts   — when false, the voice pipeline persists the
--                         call summary + duration but NOT the verbatim
--                         transcript (PHI minimization for privacy-max
--                         tenants). Default true = today's behavior.
--
--   retention_enforced  — when true, the daily data-retention job is
--                         allowed to delete this tenant's data older
--                         than data_retention_days. Default true, but a
--                         tenant can opt a hold if needed (e.g. legal
--                         hold). data_retention_days already exists.
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS store_transcripts BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS retention_enforced BOOLEAN NOT NULL DEFAULT TRUE;
