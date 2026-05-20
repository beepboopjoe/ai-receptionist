-- 0023: AI Agent suggestion queue
-- The dashboard agent surfaces actionable suggestions ("call back these 5
-- missed callers", "confirm tomorrow's appointments") that the operator
-- approves with one click. This table is the queue.
--
-- type ─────────────────────────────────────────────────────────────────────
--   missed_call_callback     — caller didn't reach a human; we should call back
--   appointment_confirmation — appointment tomorrow without confirmation yet
--   stale_lead_followup      — qualified lead never got a follow-up call
--   no_show_recapture        — no-show in last 72h; offer to reschedule
--
-- status ───────────────────────────────────────────────────────────────────
--   pending   — surfaced to operator, awaiting decision
--   approved  — operator clicked approve; worker will execute
--   executed  — action successfully fired (campaign created / SMS sent)
--   skipped   — operator dismissed it
--   expired   — went stale before decision (>48h old)
--
-- payload ──────────────────────────────────────────────────────────────────
-- JSON shape varies by type:
--   missed_call_callback:    { callId, fromNumber, contactName?, missedAt, script }
--   appointment_confirmation:{ appointmentId, contactName, phone, startsAt, script }
--   stale_lead_followup:     { contactId, contactName, phone, lastContactAt, script }
--   no_show_recapture:       { appointmentId, contactName, phone, missedAt, script }

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS agent_enabled       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agent_auto_execute  BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE agent_suggestions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL
                           CHECK (type IN (
                             'missed_call_callback',
                             'appointment_confirmation',
                             'stale_lead_followup',
                             'no_show_recapture'
                           )),
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN (
                             'pending', 'approved', 'executed', 'skipped', 'expired', 'failed'
                           )),
  -- dedupe_key: a deterministic hash of the source entity so we don't surface
  -- the same suggestion twice across scanner runs.
  dedupe_key   TEXT        NOT NULL,
  payload      JSONB       NOT NULL DEFAULT '{}',
  suggested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ,
  decided_by   UUID        REFERENCES admin_users(id) ON DELETE SET NULL,
  executed_at  TIMESTAMPTZ,
  execution_result JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedupe: one open suggestion per (tenant, type, source-entity).
CREATE UNIQUE INDEX agent_suggestions_dedupe_idx
  ON agent_suggestions (tenant_id, type, dedupe_key)
  WHERE status = 'pending';

CREATE INDEX agent_suggestions_tenant_status_idx
  ON agent_suggestions (tenant_id, status, suggested_at DESC);
