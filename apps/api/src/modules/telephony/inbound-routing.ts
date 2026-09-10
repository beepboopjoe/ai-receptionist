// ============================================================
// Inbound DID routing — pure helpers (no DB / Telnyx).
//
// Modes (tenant_settings.inbound_routing_mode):
//   ai_always       — AI answers every inbound call (default, new paid)
//   after_hours_ai  — during office hours ring/forward staff; after hours AI
//   overflow_ai     — try staff first; AI on no-answer / busy / dial failure
//
// Staff destination is the existing Staff Transfer Number (E.164).
// Missing / invalid dest falls back to AI so callers are never dropped.
// ============================================================
import type { InboundRoutingMode } from '@ai-receptionist/shared';

export const INBOUND_ROUTING_MODES = ['ai_always', 'after_hours_ai', 'overflow_ai'] as const;
export type { InboundRoutingMode };
export type InboundRoutingAction = 'ai' | 'forward_staff' | 'overflow_try_staff';

const E164 = /^\+[1-9]\d{7,14}$/;

export function isInboundRoutingMode(value: unknown): value is InboundRoutingMode {
  return typeof value === 'string' && (INBOUND_ROUTING_MODES as readonly string[]).includes(value);
}

export function normalizeInboundRoutingMode(raw: unknown): InboundRoutingMode {
  return isInboundRoutingMode(raw) ? raw : 'ai_always';
}

/** True when the configured staff / business-line dest is dialable E.164. */
export function hasStaffDestination(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  return E164.test(raw.trim());
}

export function resolveInboundRoutingAction(opts: {
  mode: InboundRoutingMode | string | null | undefined;
  isAfterHours: boolean;
  staffNumber: string | null | undefined;
}): InboundRoutingAction {
  const mode = normalizeInboundRoutingMode(opts.mode);
  const hasDest = hasStaffDestination(opts.staffNumber);

  if (mode === 'after_hours_ai') {
    if (!opts.isAfterHours && hasDest) return 'forward_staff';
    return 'ai';
  }

  if (mode === 'overflow_ai') {
    return hasDest ? 'overflow_try_staff' : 'ai';
  }

  return 'ai';
}
