-- 0026_support_tickets.sql
-- In-dashboard support channel. Tenants submit categorised messages
-- from /support which (a) get stored here, (b) email the founder
-- with Reply-To set to the submitter so replies land in their inbox
-- directly, and (c) show up in /platform admin queue.

CREATE TABLE support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submitted_by    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  -- Snapshotted submitter contact info so we can still Reply-To even
  -- after the admin_user row is later deleted/anonymised.
  submitter_email TEXT NOT NULL,
  submitter_name  TEXT,
  category        TEXT NOT NULL CHECK (category IN ('bug', 'question', 'billing', 'feature_request')),
  subject         TEXT NOT NULL,
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX support_tickets_tenant_status_idx ON support_tickets(tenant_id, status);
CREATE INDEX support_tickets_status_created_idx ON support_tickets(status, created_at DESC);
