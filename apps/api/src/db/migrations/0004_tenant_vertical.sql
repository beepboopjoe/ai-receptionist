-- ============================================================
-- Migration 0004: Multi-vertical SaaS — add tenants.vertical
--
-- Adds a `vertical` column to tenants so the platform can route
-- prompts, copy, and workflow logic by industry. Existing tenants
-- default to 'dental' to preserve current behavior; new tenants
-- default to 'generic' until they pick an industry in onboarding
-- step-0-industry.
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vertical TEXT NOT NULL DEFAULT 'dental';

-- Constraint: only supported verticals
ALTER TABLE tenants
  ADD CONSTRAINT chk_tenant_vertical
  CHECK (vertical IN ('dental', 'insurance', 'legal', 'real_estate', 'home_services', 'generic'));

-- Index for lookups (e.g. analytics by vertical)
CREATE INDEX IF NOT EXISTS idx_tenants_vertical ON tenants (vertical);

-- Going forward, new tenants default to 'generic' until step-0 sets it.
ALTER TABLE tenants
  ALTER COLUMN vertical SET DEFAULT 'generic';
