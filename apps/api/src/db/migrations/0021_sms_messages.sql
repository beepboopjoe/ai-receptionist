-- 0021: Two-way SMS inbox
-- Stores both inbound and outbound SMS messages per tenant.
-- direction: 'inbound'  = external phone → tenant number
--            'outbound' = tenant number   → external phone (reminders, text-backs, staff replies)
--
-- contact_id is nullable; matched at write-time by phone lookup.
-- telnyx_message_id links back to the Telnyx message UUID for debugging.

CREATE TABLE sms_messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  direction          TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_number        TEXT        NOT NULL,
  to_number          TEXT        NOT NULL,
  body               TEXT        NOT NULL,
  telnyx_message_id  TEXT,
  status             TEXT        NOT NULL DEFAULT 'delivered',
  contact_id         UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sms_messages_tenant_created_idx ON sms_messages (tenant_id, created_at DESC);
CREATE INDEX sms_messages_tenant_from_idx    ON sms_messages (tenant_id, from_number);
CREATE INDEX sms_messages_tenant_to_idx      ON sms_messages (tenant_id, to_number);
