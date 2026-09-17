// ============================================================
// Place a single "Ask your AI" / dashboard-chat outbound call.
//
// Reuses dialDirect + the rotating outbound pool. Creates or
// links a CRM contact so Calls / Contacts stay in sync.
// Demo gating lives in the router (402 upgrade_required).
// ============================================================
import { db } from '../../db/client.js';
import { calls, contacts } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { auditLog } from '../../audit/audit-logger.js';
import { createContact, identifyCaller } from '../crm/crm.service.js';
import { normalizeNanp } from '@ai-receptionist/shared';

export interface PlaceAiTaskInput {
  tenantId: string;
  actorId: string;
  to?: string;
  contactId?: string;
  task: string;
  firstName?: string;
  lastName?: string;
}

export interface PlaceAiTaskResult {
  ok: true;
  callId: string;
  contactId: string;
  contactCreated: boolean;
  toNumber: string;
}

const NANP_RE = /^\+1[2-9]\d{9}$/;

async function resolveDestination(input: PlaceAiTaskInput): Promise<string> {
  let toNumber = (input.to ?? '').trim();
  if (!toNumber && input.contactId) {
    const [contact] = await db
      .select({ phoneE164: contacts.phoneE164 })
      .from(contacts)
      .where(and(eq(contacts.tenantId, input.tenantId), eq(contacts.id, input.contactId)))
      .limit(1);
    if (!contact) throw new NotFoundError('Contact not found');
    toNumber = contact.phoneE164;
  }
  const e164 = normalizeNanp(toNumber) ?? toNumber;
  if (!NANP_RE.test(e164)) {
    throw new ValidationError('Enter a valid US/Canada phone number, like +15551234567.');
  }
  return e164;
}

async function ensureContactForNumber(params: {
  tenantId: string;
  toNumber: string;
  task: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ id: string; created: boolean }> {
  const existing = await identifyCaller(params.toNumber, params.tenantId);
  if (existing) return { id: existing.id, created: false };

  try {
    const created = await createContact(
      {
        firstName: params.firstName?.trim() || 'Contact',
        lastName: params.lastName?.trim() || '',
        phoneE164: params.toNumber,
        contactType: 'new',
        source: 'call',
        notes: params.task,
      },
      params.tenantId,
    );
    return { id: created.id, created: true };
  } catch (err) {
    if (err instanceof ConflictError) {
      const raced = await identifyCaller(params.toNumber, params.tenantId);
      if (raced) return { id: raced.id, created: false };
    }
    throw err;
  }
}

/**
 * Dial one outbound AI-task call from the tenant's rotating pool.
 * Caller must already have refused unpaid demo accounts.
 */
export async function placeAiTaskCall(input: PlaceAiTaskInput): Promise<PlaceAiTaskResult> {
  const task = input.task.trim();
  if (!task) throw new ValidationError('Tell your AI what to do on the call (task is required).');
  if (task.length > 500) throw new ValidationError('Keep the task under 500 characters.');

  const toNumber = await resolveDestination(input);
  const contact = await ensureContactForNumber({
    tenantId: input.tenantId,
    toNumber,
    task,
    ...(input.firstName ? { firstName: input.firstName } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {}),
  });

  const { selectPoolNumberForDial, recordPoolDialOutcome } = await import(
    '../outbound-pool/pool.service.js'
  );
  let fromNumber: string;
  try {
    fromNumber = await selectPoolNumberForDial(input.tenantId);
  } catch {
    throw new AppError(
      503,
      'Outbound lines are not ready yet. Try again in a moment, or check Phone Numbers in Settings.',
    );
  }

  const [callRecord] = await db
    .insert(calls)
    .values({
      tenantId: input.tenantId,
      contactId: contact.id,
      rcCallId: `pending-aitask-${Date.now()}`,
      direction: 'outbound',
      fromNumber,
      toNumber,
      status: 'active',
      startedAt: new Date(),
    })
    .returning({ id: calls.id });
  const callId = callRecord!.id;

  const { dialDirect } = await import('../campaigns/telnyx-dialer.service.js');
  let callSid: string;
  try {
    const result = await dialDirect({
      to: toNumber,
      from: fromNumber,
      callId,
      tenantId: input.tenantId,
      fromNumber: toNumber,
      mode: 'ai_task',
      adHocTask: task,
    });
    callSid = result.callSid;
    await recordPoolDialOutcome({
      tenantId: input.tenantId,
      phoneE164: fromNumber,
      outcome: 'success',
    }).catch(() => undefined);
  } catch {
    await recordPoolDialOutcome({
      tenantId: input.tenantId,
      phoneE164: fromNumber,
      outcome: 'failure',
      reason: 'dial_error',
    }).catch(() => undefined);
    await db
      .update(calls)
      .set({ status: 'failed', outcome: 'dial_error', updatedAt: new Date() })
      .where(eq(calls.id, callId));
    throw new AppError(502, "Couldn't place the call right now. Please try again.");
  }

  await db.update(calls).set({ rcCallId: callSid, updatedAt: new Date() }).where(eq(calls.id, callId));

  auditLog({
    tenantId: input.tenantId,
    actorType: 'admin_user',
    actorId: input.actorId,
    action: 'call.ai_task_placed',
    entityType: 'call',
    entityId: callId,
    metadata: {
      toNumber,
      fromNumber,
      task,
      callSid,
      contactId: contact.id,
      contactCreated: contact.created,
      source: 'dashboard_chat',
    },
  });

  return {
    ok: true,
    callId,
    contactId: contact.id,
    contactCreated: contact.created,
    toNumber,
  };
}
