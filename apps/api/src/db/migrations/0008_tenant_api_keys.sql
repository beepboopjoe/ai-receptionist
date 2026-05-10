-- ============================================================
-- Migration 0008: Tenant API keys
--
-- Customers integrate against /api/v1/public/* using a key minted
-- in /settings/api-keys. We store only a SHA-256 hash of the raw
-- token; the secret value is shown once at creation.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prefix      TEXT NOT NULL,
  key_hash    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'read',  -- read | write
  created_by  UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_tenant_idx ON tenant_api_keys (tenant_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx   ON tenant_api_keys (key_hash);

ALTER TABLE tenant_api_keys
  ADD CONSTRAINT chk_api_key_scope CHECK (scope IN ('read', 'write'));
