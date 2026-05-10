-- ============================================================
-- Migration 0002: Twilio telephony + Grok Voice provider columns
-- ============================================================

-- Add voice and telephony provider selection to tenant_settings
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS voice_provider TEXT NOT NULL DEFAULT 'grok',
  ADD COLUMN IF NOT EXISTS telephony_provider TEXT NOT NULL DEFAULT 'twilio';

-- Constraint: only supported providers
ALTER TABLE tenant_settings
  ADD CONSTRAINT chk_voice_provider CHECK (voice_provider IN ('grok', 'elevenlabs')),
  ADD CONSTRAINT chk_telephony_provider CHECK (telephony_provider IN ('twilio', 'ringcentral'));

-- Store the provisioned Twilio phone number per tenant (filled during onboarding)
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS twilio_number TEXT,
  ADD COLUMN IF NOT EXISTS twilio_number_sid TEXT;

-- calls table: store the Twilio stream SID separately from rc_call_id
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS stream_sid TEXT;

-- Index so we can look up calls by stream_sid during MediaStream events
CREATE INDEX IF NOT EXISTS idx_calls_stream_sid ON calls (stream_sid) WHERE stream_sid IS NOT NULL;
