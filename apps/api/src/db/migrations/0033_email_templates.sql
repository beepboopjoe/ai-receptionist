-- ============================================================
-- Phase 26c — Email template library.
--
-- Per-tenant email templates that fire on call events (intake.completed,
-- consult.scheduled, court_date.reminder, etc). Renders mustache-style
-- {{variable}} substitutions from the event payload, sends via the
-- existing Resend adapter (apps/api/src/modules/notifications/adapters/
-- email.adapter.ts).
--
-- V1 (this migration): table + seed for legal vertical defaults.
-- V2 (Phase 26c-2): wire event-based auto-send from the workflow engine.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Vertical scope. NULL = applies to any tenant's vertical.
  -- Templates seeded by seedDefaults() carry their vertical so the dashboard
  -- can show only the templates relevant to the tenant's industry.
  vertical TEXT,
  -- Event that triggers the send. Free-form so tenants can wire custom
  -- events from webhooks too. Common values:
  --   intake.completed | consult.scheduled | consult.reminder.24h |
  --   consult.reminder.2h | court_date.reminder | settlement.funds_available |
  --   document.request | manual.test_send
  trigger_event TEXT NOT NULL,
  -- Short admin-facing name shown in /settings/email-templates list.
  name TEXT NOT NULL,
  -- Email subject. Supports {{var}} substitutions.
  subject TEXT NOT NULL,
  -- HTML body. Supports {{var}} substitutions.
  body_html TEXT NOT NULL,
  -- Available variable names as a JSON array of strings — purely informational
  -- (the UI uses this to render a help block of "what you can put in this
  -- template"). Actual substitution is best-effort: missing vars render as empty.
  body_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_templates_tenant_idx
  ON email_templates(tenant_id, trigger_event);

CREATE INDEX IF NOT EXISTS email_templates_enabled_idx
  ON email_templates(tenant_id, enabled)
  WHERE enabled = TRUE;

-- Reuse the existing updated_at trigger function from 0001_initial.sql.
DROP TRIGGER IF EXISTS email_templates_updated_at ON email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
