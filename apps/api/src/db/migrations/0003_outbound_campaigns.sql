-- ============================================================
-- Migration 0003: Outbound Campaigns Module
-- ============================================================

-- ---- Outbound Campaigns ----
CREATE TABLE outbound_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  from_number TEXT NOT NULL,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_delay_minutes INTEGER NOT NULL DEFAULT 60,
  max_concurrent_calls INTEGER NOT NULL DEFAULT 3,
  dial_window_start TEXT NOT NULL DEFAULT '09:00',
  dial_window_end TEXT NOT NULL DEFAULT '17:00',
  voicemail_message TEXT,
  total_leads INTEGER NOT NULL DEFAULT 0,
  dialed_count INTEGER NOT NULL DEFAULT 0,
  connected_count INTEGER NOT NULL DEFAULT 0,
  qualified_count INTEGER NOT NULL DEFAULT 0,
  booked_count INTEGER NOT NULL DEFAULT 0,
  voicemail_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX campaigns_tenant_status_idx ON outbound_campaigns(tenant_id, status);

-- ---- Campaign Contacts (Leads) ----
CREATE TABLE campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES outbound_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  phone_e164 TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_dialed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  call_sid TEXT,
  outcome TEXT,
  qualification_notes TEXT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  csv_row_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX campaign_contacts_campaign_status_idx ON campaign_contacts(campaign_id, status);
CREATE INDEX campaign_contacts_next_retry_idx ON campaign_contacts(campaign_id, next_retry_at);
CREATE INDEX campaign_contacts_tenant_phone_idx ON campaign_contacts(tenant_id, phone_e164);
