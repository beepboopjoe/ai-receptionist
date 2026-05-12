-- Number porting requests. Customer fills out an LOA (Letter of
-- Authorization) form in the dashboard; we collect the carrier info
-- and Telnyx-required fields, then submit the port to Telnyx. The
-- port typically takes 5-14 business days and goes through statuses:
-- pending → submitted → in_progress → completed (or failed).

CREATE TABLE IF NOT EXISTS phone_port_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  phone_e164               TEXT NOT NULL,
  /** Carrier info the customer provides. */
  current_carrier          TEXT NOT NULL,
  account_number           TEXT NOT NULL,
  /** Account PIN/passcode — encrypted at rest in V2; plaintext for MVP. */
  account_pin              TEXT,
  authorized_name          TEXT NOT NULL,
  authorized_title         TEXT,
  service_address          TEXT NOT NULL,
  service_city             TEXT NOT NULL,
  service_state            TEXT NOT NULL,
  service_zip              TEXT NOT NULL,
  /** Date the customer wants the port to complete (best-effort). */
  desired_complete_date    DATE,
  /** Status: pending|submitted|in_progress|completed|failed|cancelled. */
  status                   TEXT NOT NULL DEFAULT 'pending',
  telnyx_port_request_id   TEXT,
  rejection_reason         TEXT,
  notes                    TEXT,
  submitted_at             TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX phone_port_requests_tenant_idx
  ON phone_port_requests (tenant_id, status);

-- Track that a tenant_phone_numbers row was acquired via porting (vs
-- bought new) so we can show the right badge in the UI.
ALTER TABLE tenant_phone_numbers
  ADD COLUMN is_ported BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN port_request_id UUID REFERENCES phone_port_requests (id) ON DELETE SET NULL;
