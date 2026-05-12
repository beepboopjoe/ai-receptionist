-- Reseller / affiliate MVP — tracks signup attribution and
-- commission events. No payouts in v1 (manual via CSV).
--
-- Adding affiliate_id to tenants captures the attribution at signup.
-- commission_events is append-only — one row per Stripe invoice.paid
-- for an affiliated tenant.

CREATE TABLE IF NOT EXISTS affiliates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        TEXT NOT NULL UNIQUE,
  name                        TEXT NOT NULL,
  email                       TEXT NOT NULL,
  /** 0–100. e.g. 20.00 = 20%. */
  commission_pct              NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
  /** Reserved for future Stripe Connect payouts — manual for v1. */
  stripe_connect_account_id   TEXT,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX affiliates_email_idx ON affiliates (LOWER(email));

ALTER TABLE tenants
  ADD COLUMN affiliate_id           UUID REFERENCES affiliates (id) ON DELETE SET NULL,
  ADD COLUMN attribution_signed_at  TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS commission_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id         UUID NOT NULL REFERENCES affiliates (id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  stripe_invoice_id    TEXT NOT NULL,
  invoice_amount_cents INTEGER NOT NULL,
  commission_cents     INTEGER NOT NULL,
  commission_pct       NUMERIC(5, 2) NOT NULL,
  /** "pending" → "paid_out" once we manually mark it as Venmo'd. */
  payout_status        TEXT NOT NULL DEFAULT 'pending',
  paid_out_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One commission event per (invoice, affiliate). Stripe webhooks
-- are at-least-once; this guards against double-counting.
CREATE UNIQUE INDEX commission_events_invoice_uniq
  ON commission_events (stripe_invoice_id, affiliate_id);

CREATE INDEX commission_events_affiliate_idx
  ON commission_events (affiliate_id, created_at DESC);
