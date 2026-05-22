-- 0025_business_context.sql
-- Free-text business description shown to the AI as a system-prompt
-- section on every call. Owner-edited from Settings → Voice Agent.
--
-- Nullable. No default. Empty/null skips the prompt section entirely.
-- Length capped at 4000 chars at the API layer (validation in the
-- /settings PATCH route).

ALTER TABLE tenant_settings
  ADD COLUMN business_context TEXT;
