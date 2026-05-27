-- ============================================================
-- Phase 18 — recurring goal-driven campaigns.
--
-- Turns one-shot campaigns into cron-style recurring jobs:
-- daily / weekly / monthly with a time-of-day + IANA timezone.
-- A worker that runs every minute scans for due rows
-- (next_run_at <= NOW() WHERE is_recurring) and re-enqueues
-- the campaign — re-running the goal candidate query for fresh
-- contacts, then dialing them.
-- ============================================================

ALTER TABLE outbound_campaigns
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT, -- 'daily' | 'weekly' | 'monthly'
  ADD COLUMN IF NOT EXISTS recurrence_day_of_week INTEGER, -- 0=Sun..6=Sat (weekly only)
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month INTEGER, -- 1..28 (monthly only)
  ADD COLUMN IF NOT EXISTS recurrence_time TEXT, -- 'HH:MM' 24h
  ADD COLUMN IF NOT EXISTS recurrence_timezone TEXT, -- IANA tz, e.g. 'America/Los_Angeles'
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurring_run_count INTEGER NOT NULL DEFAULT 0;

-- Partial index speeds the scan worker's `WHERE is_recurring AND next_run_at <= NOW()`.
CREATE INDEX IF NOT EXISTS campaigns_recurring_due_idx
  ON outbound_campaigns(next_run_at)
  WHERE is_recurring;
