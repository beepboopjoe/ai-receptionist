-- ============================================================
-- Migration 0005: Outbound webhooks
--
-- Customers register a URL + signing secret; whenever an interesting
-- event fires (call.completed, appointment.booked, escalation.created)
-- we POST a signed payload. webhook_deliveries records each attempt
-- so we can retry, audit, and surface failures.
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,
  events          TEXT NOT NULL DEFAULT '*',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  description     TEXT,
  last_delivered_at TIMESTAMPTZ,
  last_failed_at  TIMESTAMPTZ,
  failure_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_tenant_idx ON webhook_endpoints (tenant_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | delivered | failed | dead_letter
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  http_status     INTEGER,
  response_body   TEXT,
  error_message   TEXT,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx ON webhook_deliveries (endpoint_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_status_next_idx ON webhook_deliveries (status, next_attempt_at);
