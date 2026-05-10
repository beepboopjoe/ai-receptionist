-- ============================================================
-- Migration 0007: Password reset tokens
--
-- Replaces the in-memory Map in admin/router.ts. Persists across
-- restarts and scales horizontally. We store a SHA-256 hash of the
-- token; the raw value is only ever in the email link.
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_user_idx
  ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_token_idx
  ON password_reset_tokens (token_hash);
