// ============================================================
// Human handoff / transfer / live-join logic
// ============================================================
import { db } from '../../db/client.js';
import { calls, integrations, tenantSettings } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { decryptCredentials } from '../../lib/encryption.js';
import { transferCall } from './ringcentral-client.js';
import { TelnyxAdapter } from './adapters/telnyx.adapter.js';
import { auditLog } from '../../audit/audit-logger.js';
import { pushActivity } from '../activity/activity.service.js';
import { getTenantFromNumber } from '../sms/tenant-from-number.js';
import { dialStaffJoin } from '../campaigns/telnyx-dialer.service.js';

export interface TransferResult {
  success: boolean;
  method: 'transfer' | 'callback_promised';
  toNumber?: string;
}

/**
 * Attempt to transfer an active call to the practice's human staff.
 * Telnyx is the production path; RingCentral is the legacy fallback.
 */
export async function initiateHumanTransfer(params: {
  tenantId: string;
  callId: string;
  rcCallId: string;
  reason: string;
}): Promise<TransferResult> {
  const { tenantId, callId, rcCallId, reason } = params;

  const [settings] = await db
    .select({ transferNumber: tenantSettings.transferNumber })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const transferNumber = settings?.transferNumber;

  if (!transferNumber) {
    auditLog({
      tenantId,
      actorType: 'system',
      action: 'call.callback_promised',
      entityType: 'call',
      entityId: callId,
      metadata: { reason },
    });
    return { success: true, method: 'callback_promised' };
  }

  try {
    const telnyx = new TelnyxAdapter();
    await telnyx.transferCall(rcCallId, transferNumber);
  } catch (telnyxErr) {
    const [integration] = await db
      .select({ credentials: integrations.credentials })
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'ringcentral')))
      .limit(1);
    if (!integration) {
      console.error('[transfer] Telnyx transfer failed and no RingCentral integration:', telnyxErr);
      return { success: false, method: 'callback_promised' };
    }
    try {
      const creds = decryptCredentials(integration.credentials as Record<string, string>);
      await transferCall(creds['access_token'] ?? '', rcCallId, transferNumber);
    } catch (err) {
      console.error('[transfer] Transfer failed:', err);
      return { success: false, method: 'callback_promised' };
    }
  }

  auditLog({
    tenantId,
    actorType: 'system',
    action: 'call.transferred',
    entityType: 'call',
    entityId: callId,
    metadata: { toNumber: transferNumber, reason },
  });

  return { success: true, method: 'transfer', toNumber: transferNumber };
}

export type TakeoverProvider = 'telnyx' | 'ringcentral';

export interface ManualTakeoverParams {
  tenantId: string;
  callId: string;
  rcCallId: string;
  provider: TakeoverProvider;
  actorId: string;
}

export interface ManualTakeoverResult {
  success: boolean;
  toNumber?: string;
  method?: 'transfer' | 'join';
  error?:
    | 'no_transfer_number_configured'
    | 'transfer_failed'
    | 'no_credentials'
    | 'no_from_number';
}

/**
 * Warm-transfer the caller to the staff transfer number. The AI stream
 * drops when Telnyx completes the transfer.
 */
export async function initiateManualTakeover(
  params: ManualTakeoverParams
): Promise<ManualTakeoverResult> {
  const { tenantId, callId, rcCallId, provider, actorId } = params;

  const [settings] = await db
    .select({ transferNumber: tenantSettings.transferNumber })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const transferNumber = settings?.transferNumber;
  if (!transferNumber) {
    return { success: false, error: 'no_transfer_number_configured' };
  }

  try {
    if (provider === 'telnyx') {
      const telnyx = new TelnyxAdapter();
      await telnyx.transferCall(rcCallId, transferNumber);
    } else {
      const [integration] = await db
        .select({ credentials: integrations.credentials })
        .from(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'ringcentral')))
        .limit(1);
      if (!integration) {
        return { success: false, error: 'no_credentials' };
      }
      const creds = decryptCredentials(integration.credentials as Record<string, string>);
      await transferCall(creds['access_token'] ?? '', rcCallId, transferNumber);
    }
  } catch (err) {
    console.error('[takeover] Transfer failed:', err);
    return { success: false, error: 'transfer_failed' };
  }

  await db
    .update(calls)
    .set({ status: 'transferred', outcome: 'escalated', updatedAt: new Date() })
    .where(eq(calls.id, callId));

  auditLog({
    tenantId,
    actorType: 'admin_user',
    actorId,
    action: 'call.taken_over',
    entityType: 'call',
    entityId: callId,
    metadata: { toNumber: transferNumber, provider, method: 'transfer' },
  });

  pushActivity(tenantId, 'call_taken_over', {
    callId,
    toNumber: transferNumber,
    method: 'transfer',
  });

  return { success: true, toNumber: transferNumber, method: 'transfer' };
}

/**
 * Join the owner's phone into the live call via a Telnyx conference.
 * Staff is dialed immediately; when they answer, the webhook conferences
 * both legs and stops the AI stream.
 */
export async function initiateLiveJoin(
  params: ManualTakeoverParams
): Promise<ManualTakeoverResult> {
  const { tenantId, callId, rcCallId, actorId } = params;

  const [settings] = await db
    .select({ transferNumber: tenantSettings.transferNumber })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const transferNumber = settings?.transferNumber;
  if (!transferNumber) {
    return { success: false, error: 'no_transfer_number_configured' };
  }

  const fromNumber = await getTenantFromNumber(tenantId);
  if (!fromNumber) {
    return { success: false, error: 'no_from_number' };
  }

  const conferenceName = `telfin-join-${callId.replace(/-/g, '').slice(0, 24)}`;

  try {
    await dialStaffJoin({
      to: transferNumber,
      from: fromNumber,
      originalCallId: callId,
      originalCallControlId: rcCallId,
      conferenceName,
      tenantId,
    });
  } catch (err) {
    console.error('[join] Staff dial failed:', err);
    return { success: false, error: 'transfer_failed' };
  }

  auditLog({
    tenantId,
    actorType: 'admin_user',
    actorId,
    action: 'call.joined',
    entityType: 'call',
    entityId: callId,
    metadata: { toNumber: transferNumber, conferenceName, method: 'join' },
  });

  return { success: true, toNumber: transferNumber, method: 'join' };
}
