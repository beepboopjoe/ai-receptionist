-- ============================================================
-- Migration 0001: Initial schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---- Tenants ----
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  plan            TEXT NOT NULL DEFAULT 'trial',
  timezone        TEXT NOT NULL DEFAULT 'America/New_York',
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Tenant Settings ----
CREATE TABLE IF NOT EXISTS tenant_settings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  office_hours           JSONB NOT NULL DEFAULT '{}',
  after_hours_mode       TEXT NOT NULL DEFAULT 'voicemail',
  transfer_number        TEXT,
  max_hold_seconds       INTEGER NOT NULL DEFAULT 30,
  voice_agent_id         TEXT,
  voice_name             TEXT NOT NULL DEFAULT 'Rachel',
  appointment_types      JSONB NOT NULL DEFAULT '[]',
  recall_interval_months INTEGER NOT NULL DEFAULT 6
);

-- ---- Integrations ----
CREATE TABLE IF NOT EXISTS integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  credentials     JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  last_synced_at  TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- ---- Admin Users ----
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',
  first_name    TEXT,
  last_name     TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- ---- Contacts ----
CREATE TABLE IF NOT EXISTS contacts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  phone_e164         TEXT NOT NULL,
  email              TEXT,
  date_of_birth      DATE,
  patient_type       TEXT NOT NULL DEFAULT 'existing',
  insurance_provider TEXT,
  insurance_id       TEXT,
  recall_due_date    DATE,
  preferred_provider TEXT,
  notes              TEXT,
  source             TEXT NOT NULL DEFAULT 'manual',
  external_crm_id    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, phone_e164)
);
CREATE INDEX contacts_tenant_phone_idx ON contacts(tenant_id, phone_e164);
CREATE INDEX contacts_tenant_name_idx ON contacts(tenant_id, last_name, first_name);

-- ---- Calls ----
CREATE TABLE IF NOT EXISTS calls (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id         UUID REFERENCES contacts(id) ON DELETE SET NULL,
  rc_call_id         TEXT NOT NULL,
  rc_session_id      TEXT,
  direction          TEXT NOT NULL DEFAULT 'inbound',
  from_number        TEXT NOT NULL,
  to_number          TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active',
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  duration_seconds   INTEGER,
  workflow_triggered TEXT,
  escalation_reason  TEXT,
  outcome            TEXT,
  summary            TEXT,
  recording_url      TEXT,
  transcript         JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX calls_tenant_status_idx ON calls(tenant_id, status);
CREATE INDEX calls_tenant_started_idx ON calls(tenant_id, started_at DESC);
CREATE INDEX calls_rc_call_id_idx ON calls(rc_call_id);

-- ---- Appointments ----
CREATE TABLE IF NOT EXISTS appointments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id         UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  call_id            UUID REFERENCES calls(id) ON DELETE SET NULL,
  calendar_provider  TEXT NOT NULL,
  calendar_event_id  TEXT,
  calendar_id        TEXT,
  appointment_type   TEXT NOT NULL,
  provider_name      TEXT,
  starts_at          TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ NOT NULL,
  duration_minutes   INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'confirmed',
  notes              TEXT,
  reminder_24h_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_2h_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX appts_tenant_starts_idx ON appointments(tenant_id, starts_at);
CREATE INDEX appts_contact_idx ON appointments(contact_id);
CREATE INDEX appts_status_idx ON appointments(tenant_id, status);

-- ---- Audit Logs (append-only) ----
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_type  TEXT NOT NULL,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  before      JSONB,
  after       JSONB,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_tenant_created_idx ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX audit_entity_idx ON audit_logs(entity_type, entity_id);

-- ---- Notifications ----
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  call_id         UUID REFERENCES calls(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,
  channel         TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  template_id     TEXT NOT NULL,
  body            TEXT NOT NULL,
  provider_msg_id TEXT,
  sent_at         TIMESTAMPTZ,
  failed_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Escalations ----
CREATE TABLE IF NOT EXISTS escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id         UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'normal',
  status          TEXT NOT NULL DEFAULT 'open',
  assigned_to     UUID REFERENCES admin_users(id),
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- updated_at trigger function ----
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tenant_settings_updated_at BEFORE UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER calls_updated_at BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
