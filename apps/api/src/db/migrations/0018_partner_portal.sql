-- ============================================================
-- Migration 0018 — Partner Portal V2
--
-- 1. Extend `affiliates` with auth + payout columns so partners
--    can self-register, log in, and request payouts.
-- 2. Add `payout_requests` table for partner-initiated payout
--    requests (admin approves / pays manually for now).
-- ============================================================

-- ---- Affiliates: new columns --------------------------------
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS status        text    NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS payout_email  text,
  ADD COLUMN IF NOT EXISTS payout_method text    NOT NULL DEFAULT 'paypal';

-- Back-fill: active partners keep status='active' (was isActive=true)
UPDATE affiliates SET status = CASE WHEN is_active THEN 'active' ELSE 'suspended' END;

-- ---- Payout requests ----------------------------------------
CREATE TABLE IF NOT EXISTS payout_requests (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id           uuid        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  requested_amount_cents integer     NOT NULL,
  status                 text        NOT NULL DEFAULT 'pending',  -- pending | approved | paid | rejected
  note                   text,        -- partner's message to admin
  admin_note             text,        -- admin's reply
  created_at             timestamptz NOT NULL DEFAULT now(),
  processed_at           timestamptz
);

CREATE INDEX IF NOT EXISTS payout_requests_affiliate_idx ON payout_requests(affiliate_id);
CREATE INDEX IF NOT EXISTS payout_requests_status_idx   ON payout_requests(status);
