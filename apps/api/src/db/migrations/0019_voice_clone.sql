-- ============================================================
-- 0019_voice_clone — Custom voice clone support per tenant
--
-- Adds three columns to tenant_settings:
--   voice_clone_id     — ElevenLabs voice_id after cloning succeeds
--   voice_clone_status — 'none' | 'uploading' | 'ready' | 'failed'
--   voice_clone_name   — human-readable label the tenant picked
-- ============================================================

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS voice_clone_id     text,
  ADD COLUMN IF NOT EXISTS voice_clone_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS voice_clone_name   text;
