-- Inbound routing mode (Telnyx call-control) + per-tenant usage ledger.
-- Stripe remains the invoice; this table is internal COGS truth.

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS inbound_routing_mode text NOT NULL DEFAULT 'ai_always';

ALTER TABLE tenant_settings
  DROP CONSTRAINT IF EXISTS tenant_settings_inbound_routing_mode_chk;

ALTER TABLE tenant_settings
  ADD CONSTRAINT tenant_settings_inbound_routing_mode_chk
  CHECK (inbound_routing_mode IN ('ai_always', 'after_hours_ai', 'overflow_ai'));

CREATE TABLE IF NOT EXISTS tenant_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  quantity numeric(12, 4) NOT NULL DEFAULT 0,
  estimated_cents numeric(12, 4) NOT NULL DEFAULT 0,
  direction text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_usage_events_tenant_occurred_idx
  ON tenant_usage_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS tenant_usage_events_type_idx
  ON tenant_usage_events (tenant_id, event_type, occurred_at DESC);

-- One row per (call, event type) so media-stream + hangup cannot double-write.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_usage_events_call_type_uniq
  ON tenant_usage_events (tenant_id, call_id, event_type)
  WHERE call_id IS NOT NULL;
