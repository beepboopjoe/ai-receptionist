-- Provision lifecycle on tenant_phone_numbers so the dashboard can show
-- provisioning / active / failed and offer retry when a Telnyx order fails.
-- Existing purchased rows stay 'active' (the default).

ALTER TABLE tenant_phone_numbers
  ADD COLUMN IF NOT EXISTS provision_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE tenant_phone_numbers
  ADD COLUMN IF NOT EXISTS provision_error TEXT;

ALTER TABLE tenant_phone_numbers
  ADD COLUMN IF NOT EXISTS telnyx_order_id TEXT;

CREATE INDEX IF NOT EXISTS tenant_phone_numbers_status_idx
  ON tenant_phone_numbers (tenant_id, purpose, provision_status)
  WHERE released_at IS NULL;
