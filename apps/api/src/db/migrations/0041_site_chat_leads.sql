-- Site-chat / marketing FAQ widget leads reuse demo_leads.
-- Call-me rows stay phone-first; chat leads may be email-only
-- (phone_e164 nullable) and carry TCPA consent + a transcript snippet.

ALTER TABLE demo_leads
  ALTER COLUMN phone_e164 DROP NOT NULL;

ALTER TABLE demo_leads
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'call_me',
  ADD COLUMN IF NOT EXISTS email_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS conversation_id text,
  ADD COLUMN IF NOT EXISTS page_path text;

-- Multiple email-only rows may have NULL phone (Postgres UNIQUE allows that).
CREATE UNIQUE INDEX IF NOT EXISTS demo_leads_email_uniq
  ON demo_leads (lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS demo_leads_source_idx
  ON demo_leads (source, created_at DESC);

CREATE INDEX IF NOT EXISTS demo_leads_conversation_idx
  ON demo_leads (conversation_id)
  WHERE conversation_id IS NOT NULL;
