-- ============================================================
-- 0020_voice_clone_addon — Stripe add-on flag per tenant
--
-- voice_clone_addon: true when the tenant has an active Stripe
-- subscription for the Voice Clone add-on ($49/mo). Set by the
-- Stripe webhook on subscription activation; cleared on cancellation.
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS voice_clone_addon         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_clone_stripe_sub_id text;
