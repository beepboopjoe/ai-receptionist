-- Platform-admin list of homepage / call-me visitors.
-- One row per phone. Stubbed on submit, enriched from the demo transcript on hangup.

CREATE TABLE IF NOT EXISTS demo_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  name text,
  business text,
  language text NOT NULL DEFAULT 'en',
  voice text NOT NULL DEFAULT 'aurora',
  closed boolean NOT NULL DEFAULT false,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demo_leads_phone_uniq UNIQUE (phone_e164)
);

CREATE INDEX IF NOT EXISTS demo_leads_created_idx ON demo_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS demo_leads_closed_idx ON demo_leads (closed, created_at DESC);
