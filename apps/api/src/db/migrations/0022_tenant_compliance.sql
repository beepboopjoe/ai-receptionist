-- 0022: Tenant HIPAA compliance
-- Adds BAA acceptance tracking, HIPAA mode flag, and data-retention setting
-- to tenants, plus a compliance_events audit table for an immutable log.
--
-- baa_accepted_at  — timestamp when the account owner signed the BAA
-- baa_accepted_by  — FK to admin_users; the person who clicked "I accept"
-- hipaa_mode       — when true: idle-timeout enforced, stricter audit requirements
-- data_retention_days — PHI data retention window (365–3650 days; default 2555 = 7yr)

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS baa_accepted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baa_accepted_by      UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hipaa_mode           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_retention_days  INTEGER NOT NULL DEFAULT 2555;

-- Immutable compliance event log (BAA history, mode changes, retention changes).
-- Separate from audit_log so it can be exported independently for compliance audits.
CREATE TABLE compliance_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL
                           CHECK (event_type IN (
                             'baa_accepted',
                             'hipaa_mode_enabled',
                             'hipaa_mode_disabled',
                             'retention_changed',
                             'settings_changed'
                           )),
  actor_id     UUID        REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_email  TEXT,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX compliance_events_tenant_idx ON compliance_events (tenant_id, created_at DESC);
