// ============================================================
// Workflow Orchestrator — Central Call Routing Brain
// ============================================================
// Called by both telephony handlers after a call concludes.
// Reads accumulated CallState from Redis, determines which flow
// to run, executes it, and writes the final outcome to the DB.
// ============================================================
import { getCallState, deleteCallState } from '../voice-agent/session-manager.js';
import { db } from '../../db/client.js';
import { calls } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { auditLog } from '../../audit/audit-logger.js';
import type { FlowResult } from '@ai-receptionist/shared';

// ────────────────────────────────────────────────────────────
// Flow registry
//
// Per-vertical flow variants are looked up through this registry. The
// resolution rule is: try `<workflow>__<vertical>` first, fall back to
// the generic `<workflow>` flow.
//
// To add a vertical variant, drop a file in flows/ named e.g.
// `legal-new-client.flow.ts` exporting a class with the same shape, then
// add an entry under VERTICAL_FLOW_OVERRIDES below. No callsites change.
// ────────────────────────────────────────────────────────────

type FlowExecutor = { execute: (state: any) => Promise<FlowResult> };

/**
 * Optional per-vertical overrides. Key shape: `<workflow>__<vertical>`.
 * Empty today — every vertical uses the generic flow. Add entries when a
 * vertical genuinely needs different post-call logic (e.g. legal new-client
 * intake might trigger a conflict-of-interest check that dental doesn't).
 */
const VERTICAL_FLOW_OVERRIDES: Record<string, () => Promise<FlowExecutor>> = {
  // Example shape — uncomment when a real variant ships:
  // 'new_contact__legal': async () => {
  //   const { LegalNewClientFlow } = await import('./flows/legal-new-client.flow.js');
  //   return new LegalNewClientFlow();
  // },
};

/** Generic, vertical-agnostic flow loaders. */
async function loadGenericFlow(workflow: string): Promise<FlowExecutor | null> {
  switch (workflow) {
    case 'new_contact': {
      const { NewContactFlow } = await import('./flows/new-contact.flow.js');
      return new NewContactFlow();
    }
    case 'existing_contact': {
      const { ExistingContactFlow } = await import('./flows/existing-contact.flow.js');
      return new ExistingContactFlow();
    }
    case 'reschedule': {
      const { RescheduleFlow } = await import('./flows/reschedule.flow.js');
      return new RescheduleFlow();
    }
    case 'cancellation': {
      const { CancellationFlow } = await import('./flows/cancellation.flow.js');
      return new CancellationFlow();
    }
    case 'escalation': {
      const { EscalationFlow } = await import('./flows/escalation.flow.js');
      return new EscalationFlow();
    }
    case 'after_hours': {
      const { AfterHoursFlow } = await import('./flows/after-hours.flow.js');
      return new AfterHoursFlow();
    }
    case 'outbound_qualification': {
      return {
        execute: async (state: any) => {
          const { runOutboundQualificationFlow } = await import('./flows/outbound-qualification.flow.js');
          return runOutboundQualificationFlow(state);
        },
      };
    }
    default:
      return null;
  }
}

async function getFlow(workflow: string, vertical?: string): Promise<FlowExecutor | null> {
  // Try the vertical-specific override first.
  if (vertical) {
    const override = VERTICAL_FLOW_OVERRIDES[`${workflow}__${vertical}`];
    if (override) return override();
  }
  return loadGenericFlow(workflow);
}

export interface OrchestrateParams {
  callId: string;
  tenantId: string;
  fromNumber: string;
  rcCallId: string;
  /** When true, skip the pre-call orchestration and jump straight to post-call flows */
  postCallOnly?: boolean;
}

/**
 * Main entry point.
 * Called after the voice conversation ends — processes collected call state
 * and runs the appropriate business workflow.
 */
export async function orchestrate(params: OrchestrateParams): Promise<FlowResult> {
  const { callId, tenantId, fromNumber, rcCallId, postCallOnly = false } = params;

  // Retrieve call state from Redis
  // The key may be stored under rcCallId (RC path) or callId (Twilio path)
  let state = await getCallState(rcCallId);
  if (!state) {
    state = await getCallState(callId);
  }

  if (!state) {
    // Graceful no-op — state may have expired or never been saved
    console.warn(`[orchestrator] No call state found for rcCallId=${rcCallId} callId=${callId}`);
    await markCallCompleted(callId, {
      outcome: 'no_action',
      summary: 'Call state not found in Redis; no workflow executed.',
    });
    return { outcome: 'no_action', summary: 'Call state not found.' };
  }

  const workflow = state.workflow ?? 'new_contact';
  // Vertical is stashed in collectedData by the media-stream handler so it
  // travels with the call without needing a CallState schema change. Best-
  // effort: getFlow accepts undefined.
  const vertical = (state.collectedData as { vertical?: string } | undefined)?.vertical;

  // Update call record: mark workflow triggered
  await db
    .update(calls)
    .set({ workflowTriggered: workflow, updatedAt: new Date() })
    .where(eq(calls.id, callId));

  let result: FlowResult;

  try {
    const flow = await getFlow(workflow, vertical);

    if (!flow) {
      console.warn(`[orchestrator] Unknown workflow "${workflow}" for call ${callId}`);
      result = { outcome: 'no_action', summary: `Unknown workflow: ${workflow}` };
    } else {
      result = await flow.execute({ ...state, callId });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[orchestrator] Flow "${workflow}" failed for call ${callId}:`, err);
    result = {
      outcome: 'no_action',
      summary: `Workflow error: ${msg}`,
    };
  }

  // Persist final outcome to DB
  await markCallCompleted(callId, result);

  // Audit
  auditLog({
    tenantId,
    actorType: 'system',
    action: 'call.workflow_completed',
    entityType: 'call',
    entityId: callId,
    metadata: {
      workflow,
      outcome: result.outcome,
      appointmentId: result.appointmentId,
    },
  });

  // Clean up Redis state (keeps DB as source of truth post-call)
  await deleteCallState(rcCallId).catch(() => {});
  await deleteCallState(callId).catch(() => {});

  return result;
}

// ---- Helpers ----

async function markCallCompleted(callId: string, result: FlowResult): Promise<void> {
  if (!callId) return;
  await db
    .update(calls)
    .set({
      status: 'completed',
      outcome: result.outcome,
      summary: result.summary ?? null,
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(calls.id, callId));

  // Fire-and-forget per-call summary email — gated by the tenant's
  // notificationPreferences.emailOnEveryCall toggle. Lazy import keeps
  // the orchestrator's hot path free of SendGrid initialization.
  void import('../notifications/call-summary-email.js').then(({ sendCallSummaryEmail }) =>
    sendCallSummaryEmail(callId).catch((err) => {
      console.error('[orchestrator] sendCallSummaryEmail failed:', err);
    })
  );
}
