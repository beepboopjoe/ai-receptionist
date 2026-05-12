-- Customer-purchased phone numbers. Each tenant can own multiple
-- numbers; the assigned `primary` number is where inbound traffic
-- defaults to. Released numbers are kept (released_at IS NOT NULL)
-- so we don't lose history when a tenant downsizes.

CREATE TABLE IF NOT EXISTS tenant_phone_numbers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  phone_e164           TEXT NOT NULL,
  telnyx_phone_id      TEXT,
  country              TEXT NOT NULL DEFAULT 'US',
  region               TEXT,
  /** "local" or "toll_free" — drives the monthly rate and the dialing prefix. */
  number_type          TEXT NOT NULL DEFAULT 'local',
  monthly_cost_cents   INTEGER NOT NULL DEFAULT 500,
  is_primary           BOOLEAN NOT NULL DEFAULT false,
  purchased_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at          TIMESTAMPTZ,
  /** Stripe SKU id of the recurring add-on charge (one per number). */
  stripe_subscription_item_id TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phone numbers are globally unique across all tenants; the same
-- E.164 can be re-used by another tenant only after the previous
-- owner releases it. Unique partial index ignores released rows.
CREATE UNIQUE INDEX tenant_phone_numbers_active_e164_uniq
  ON tenant_phone_numbers (phone_e164)
  WHERE released_at IS NULL;

CREATE INDEX tenant_phone_numbers_tenant_idx
  ON tenant_phone_numbers (tenant_id, released_at);
