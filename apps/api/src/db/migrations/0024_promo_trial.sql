-- 0024_promo_trial.sql
-- Per-tenant minute cap override + promo-trial flag.
--
-- minutes_override:
--   NULL  → use the default monthly cap for tenants.plan (existing behavior)
--   value → hard cap. When promo_trial is true, both inbound and outbound
--           call paths refuse new calls once minutes_used >= minutes_override.
--
-- promo_trial:
--   false → normal billing tenant. minute usage just charges overage.
--   true  → trial mode. Calls are HARD-blocked at the cap and the dashboard
--           shows the promo-trial banner with an Upgrade CTA.

ALTER TABLE tenants
  ADD COLUMN minutes_override INTEGER,
  ADD COLUMN promo_trial      BOOLEAN NOT NULL DEFAULT false;

-- Optional sanity: the override only makes sense as a positive integer.
ALTER TABLE tenants
  ADD CONSTRAINT tenants_minutes_override_positive
  CHECK (minutes_override IS NULL OR minutes_override > 0);
