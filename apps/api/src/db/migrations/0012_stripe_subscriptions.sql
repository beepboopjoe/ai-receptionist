-- Stripe subscription tracking on the tenants table.
-- Single-row-per-tenant model — sufficient until we sell add-on
-- subscriptions in addition to the main plan.
--
-- All columns are nullable so existing tenants (no Stripe customer
-- yet) keep working. The plan column already exists; we leave its
-- existing values alone but the new tier keys ('starter', 'growth',
-- 'scale', 'enterprise', 'payg') are now the canonical set.

ALTER TABLE tenants
  ADD COLUMN stripe_customer_id        TEXT,
  ADD COLUMN stripe_subscription_id    TEXT,
  ADD COLUMN stripe_price_id           TEXT,
  ADD COLUMN subscription_status       TEXT,
  ADD COLUMN current_period_end        TIMESTAMPTZ,
  ADD COLUMN trial_end                 TIMESTAMPTZ,
  ADD COLUMN billing_cycle             TEXT;  -- 'monthly' | 'annual'

CREATE UNIQUE INDEX tenants_stripe_customer_uniq
  ON tenants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX tenants_stripe_subscription_uniq
  ON tenants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Idempotency log for Stripe webhook events. Each event arrives at
-- /webhooks/stripe and we record its id BEFORE processing so retries
-- are no-ops. Stripe webhooks are at-least-once.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  payload      JSONB NOT NULL
);

-- Per-billing-period minute usage counter. We aggregate calls.duration_seconds
-- into this table at end-of-call so the dashboard can show usage without
-- scanning the calls table. Reset (or rather, append a new row) on each
-- subscription period start.
CREATE TABLE IF NOT EXISTS minute_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  minutes_used    NUMERIC(12, 4) NOT NULL DEFAULT 0,
  overage_minutes NUMERIC(12, 4) NOT NULL DEFAULT 0,
  overage_charged_cents INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX minute_usage_tenant_period_uniq
  ON minute_usage (tenant_id, period_start);
