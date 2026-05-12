-- One-time warning email at 80% of plan minutes — this column lets the
-- usage-warning job stay idempotent: rows where warning_sent_at is set
-- are skipped on subsequent scans within the same period.

ALTER TABLE minute_usage
  ADD COLUMN warning_sent_at TIMESTAMPTZ;
