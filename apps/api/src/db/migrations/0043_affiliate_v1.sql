-- Affiliate v1: lean referral payouts (not a partner portal, not white-label).
-- Default remains 20% of paid invoices for the first 12 months.
-- Optional flat bounty on the first paid conversion; 0 months = lifetime %.

ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS flat_bounty_cents integer,
  ADD COLUMN IF NOT EXISTS commission_months integer NOT NULL DEFAULT 12;

COMMENT ON COLUMN affiliates.flat_bounty_cents IS
  'Optional cents paid on the first invoice.paid with amount_paid > 0. NULL = percentage only.';

COMMENT ON COLUMN affiliates.commission_months IS
  'Window from tenants.attribution_signed_at. 12 = first year (default). 0 = lifetime.';
