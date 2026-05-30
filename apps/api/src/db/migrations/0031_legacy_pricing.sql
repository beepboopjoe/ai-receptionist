-- ============================================================
-- Phase 20 — pricing restructure.
--
-- Adds tenants.legacy_pricing flag so every subscriber who was
-- on the pre-2026-05-28 plan caps keeps their original cap +
-- overage rate forever. New signups land on the new caps:
--
--   Starter: 200 → 100 min  |  overage 0.29 → 0.39
--   Growth:  750 → 300 min  |  overage 0.25 → 0.35
--   Scale:   1500 → 750 min |  overage 0.19 → 0.29
--
-- Stripe Price IDs are unchanged (sticker $79/$199/$399 unchanged),
-- so grandfathering lives purely in our app code via
-- `resolvePlanLimits(plan, tenant)` in @ai-receptionist/shared.
--
-- Backfill rule: any tenant currently on a paid plan with an
-- active/trialing/past_due Stripe subscription is grandfathered.
-- Trial-only tenants and unsubscribed tenants are NOT grandfathered
-- — when they upgrade they'll hit the new caps.
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS legacy_pricing BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tenants
   SET legacy_pricing = TRUE
 WHERE plan IN ('starter', 'growth', 'scale')
   AND subscription_status IN ('active', 'trialing', 'past_due');
