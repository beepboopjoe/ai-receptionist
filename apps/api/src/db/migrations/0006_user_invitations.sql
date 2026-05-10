-- ============================================================
-- Migration 0006: User invitations
--
-- Tenant owners invite teammates via email. Each invitation gets a
-- random token; the accept-invite page redeems it for a new user
-- account at the embedded role.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'staff',
  token        TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  accepted_at  TIMESTAMPTZ,
  invited_by   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invitations_tenant_email_idx
  ON user_invitations (tenant_id, email);
CREATE INDEX IF NOT EXISTS invitations_token_idx
  ON user_invitations (token);

ALTER TABLE user_invitations
  ADD CONSTRAINT chk_invitation_role
  CHECK (role IN ('owner', 'admin', 'staff'));
