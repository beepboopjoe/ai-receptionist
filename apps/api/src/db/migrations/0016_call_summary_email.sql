-- Two related additions:
--
-- 1. notification_preferences: the dashboard has had a /settings/notifications
--    page for a while, but the column to persist its toggles was never added.
--    PATCH /settings was silently dropping the field. Add it as JSONB so each
--    toggle is a top-level boolean and we can grow it without further migrations.
--
-- 2. call_summary_email: optional address where call-summary emails go when
--    notification_preferences.emailOnEveryCall is true. NULL = fall back to
--    the owner's email.

ALTER TABLE tenant_settings
  ADD COLUMN notification_preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN call_summary_email TEXT;
