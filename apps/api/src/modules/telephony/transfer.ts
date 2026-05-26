// ============================================================
// Human handoff / transfer logic
// ============================================================
import { db } from '../../db/client.js';
import { integrations, tenantSettings } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { decryptCredentials } from '../../lib/encryption.js';
import { transferCall } from './ringcentral-client.js';
import { TelnyxAdapter } from './adapters/telnyx.adapter.js';
import { auditLog } from '../../audit/audit-logger.js';
import { pushActivity } from '../activity/activity.service.js';

export interface TransferResult {
  success: boolean;
  method: 'transfer' | 'callback_promised';
  toNumber?: string;
}

/**
 * Attempt to transfer an active call to the practice's human staff.
 * Falls back to "callback promised" if no transfer number is configured.
 */
export async function initiateHumanTransfer(params: {
  tenantId: string;
  callId: string;  // Our internal call UUID
  rcCallId: string;
  reason: string;
}): Promise<TransferResult> {
  const { tenantId, callId, rcCallId, reason } = params;

  // Get transfer number from tenant settings
  const [settings] = await db
    .select({ transferNumber: tenantSettings.transferNumber })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const transferNumber = settings?.transferNumber;

  if (!transferNumber) {
    // No transfer number configured — promise a callback
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

  // Get RingCentral credentials for this tenant
  const [integration] = await db
    .select({ credentials: integrations.credentials })
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.provider, 'ringcentral')
      )
    )
    .limit(1);

  if (!integration) {
    return { success: false, method: 'callback_promised' };
  }

  const creds = decryptCredentials(integration.credentials as Record<string, string>);
  const accessToken = creds['access_token'] ?? '';

  try {
    await transferCall(accessToken, rcCallId, transferNumber);

    auditLog({
      tenantId,
      actorType: 'system',
      action: 'call.transferred',
      entityType: 'call',
      entityId: callId,
      metadata: { toNumber: transferNumber, reason },
    });

    return { success: true, method: 'transfer', toNumber: transferNumber };
  } catch (err) {
    console.error('[transfer] Transfer failed:', err);
    return { success: false, method: 'callback_promised' };
  }
}

export type TakeoverProvider = 'telnyx' | 'ringcentral';

export interface ManualTakeoverParams {
  tenantId: string;
  /** Internal call UUID. */
  callId: string;
  /** Telnyx call_control_id or RingCentral call id. */
  rcCallId: string;
  /** Which telephony provider owns the active call leg. */
  provider: TakeoverProvider;
  /** Admin user who clicked the take-over button. */
  actorId: string;
}

export interface ManualTakeoverResult {
  success: boolean;
  toNumber?: string;
  error?: 'no_transfer_number_configured' | 'transfer_failed' | 'no_credentials';
}

/**
 * Manually take over a live AI call — bridge the caller to the configured
 * staff number. Triggered by an admin clicking "Take over" in the dashboard
 * live-call monitor. Distinct from `initiateHumanTransfer`, which is called
 * by the AI orchestrator mid-conversation when it decides to escalate.
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
      // Telnyx Call Control transfer — uses the platform-wide TELNYX_API_KEY,
      // no per-tenant credentials needed.
      const telnyx = new TelnyxAdapter();
      await telnyx.transferCall(rcCallId, transferNumber);
    } else {
      const [integration] = await db
        .select({ credentials: integrations.credentials })
        .from(integrations)
        .where(
          and(
            eq(integrations.tenantId, tenantId),
            eq(integrations.provider, 'ringcentral')
          )
        )
        .limit(1);
      if (!integration) {
        return { success: false, error: 'no_credentials' };
      }
      const creds = decryptCredentials(integration.credentials as Record<string, string>);
      const accessToken = creds['access_token'] ?? '';
      await transferCall(accessToken, rcCallId, transferNumber);
    }
  } catch (err) {
    console.error('[takeover] Transfer failed:', err);
    return { success: false, error: 'transfer_failed' };
  }

  auditLog({
    tenantId,
    actorType: 'admin_user',
    actorId,
    action: 'call.taken_over',
    entityType: 'call',
    entityId: callId,
    metadata: { toNumber: transferNumber, provider },
  });

  pushActivity(tenantId, 'call_taken_over', {
    callId,
    toNumber: transferNumber,
  });

  return { success: true, toNumber: transferNumber };
}
