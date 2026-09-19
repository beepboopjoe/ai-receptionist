-- ============================================================
-- Migration 0047: First-class English / Spanish for the AI.
-- English remains the default. Owner can lock Spanish or pick
-- bilingual auto-detect (English greeting, switch to Spanish).
-- ============================================================

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS spoken_language text NOT NULL DEFAULT 'en';
