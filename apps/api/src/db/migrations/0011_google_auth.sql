-- Add Google OAuth identity column on admin_users so we can:
--   1. Look up a user by their Google sub (no password needed)
--   2. Link an existing email-based account to a Google identity on first
--      Google sign-in
--
-- password_hash becomes nullable: Google-only users won't have one.

ALTER TABLE admin_users
  ADD COLUMN google_id TEXT;

-- Unique partial index — null googleIds don't conflict with each other
-- (multiple users can have null), but two non-null googleIds must differ.
CREATE UNIQUE INDEX admin_users_google_id_uniq
  ON admin_users (google_id)
  WHERE google_id IS NOT NULL;

ALTER TABLE admin_users
  ALTER COLUMN password_hash DROP NOT NULL;
