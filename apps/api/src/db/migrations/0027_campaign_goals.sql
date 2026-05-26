-- ============================================================
-- Phase 12.4 — Goal-driven campaign templates.
--
-- Adds two nullable columns to outbound_campaigns so we can mark
-- campaigns created from a goal template (vs. manually). Both
-- columns are pure analytics/UX — no downstream behavior gates
-- on them. Existing campaigns stay NULL implicitly.
-- ============================================================

ALTER TABLE outbound_campaigns
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS goal_source text;

COMMENT ON COLUMN outbound_campaigns.goal IS
  'Goal slug (e.g. dental_recall, generic_stale_lead) when this campaign was created from a template. NULL for manually-created campaigns.';

COMMENT ON COLUMN outbound_campaigns.goal_source IS
  'Provenance: template | manual. NULL on legacy rows; treated as ''manual''.';
