-- ============================================================
-- Phase 12.7 — Lead Discovery (Apify Google Maps Scraper).
--
-- Tracks scrape jobs from creation → Apify run → ingestion →
-- import into campaign_contacts. Margin tracking via the
-- {cost_cents, apify_cost_cents} pair so we can spot any
-- actor pricing changes that compress unit economics.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  apify_run_id TEXT,
  -- pending | running | succeeded | failed | imported
  status TEXT NOT NULL DEFAULT 'pending',
  search_params JSONB NOT NULL,
  raw_results JSONB,
  leads_found INTEGER NOT NULL DEFAULT 0,
  leads_imported INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  apify_cost_cents INTEGER NOT NULL DEFAULT 0,
  imported_campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE SET NULL,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_discovery_jobs_tenant_idx
  ON lead_discovery_jobs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_discovery_jobs_status_idx
  ON lead_discovery_jobs(status)
  WHERE status IN ('pending', 'running');

COMMENT ON COLUMN lead_discovery_jobs.cost_cents IS
  'What we charged the tenant via Stripe metered billing.';
COMMENT ON COLUMN lead_discovery_jobs.apify_cost_cents IS
  'What Apify actually charged us (margin tracking).';
