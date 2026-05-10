// ============================================================
// Human handoff / transfer logic
// ============================================================
import { db } from '../../db/client.js';
import { integrations, tenantSettings } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { decryptCredentials } from '../../lib/encryption.js';
import { transferCall } from './ringcentral-client.js';
import { auditLog } from '../../audit/audit-logger.js';

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
