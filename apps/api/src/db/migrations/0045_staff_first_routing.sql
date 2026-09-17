-- Staff-first overflow: during office hours ring the team, then AI on
-- no-answer; after hours the AI answers. Extends the existing inbound
-- routing check — does not rewrite current tenants.

ALTER TABLE tenant_settings
  DROP CONSTRAINT IF EXISTS tenant_settings_inbound_routing_mode_chk;

ALTER TABLE tenant_settings
  ADD CONSTRAINT tenant_settings_inbound_routing_mode_chk
  CHECK (inbound_routing_mode IN ('ai_always', 'after_hours_ai', 'overflow_ai', 'staff_first'));
