// ============================================================
// RingCentral Telephony Adapter — wraps existing RC client
// Enterprise path for practices already using RingCentral
// ============================================================
import type { ITelephonyAdapter, ProvisionedNumber } from '@ai-receptionist/shared';
import { transferCall, hangupCall } from '../ringcentral-client.js';
import { IntegrationError } from '../../../lib/errors.js';
import { db } from '../../../db/client.js';
import { integrations } from '../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { decryptCredentials } from '../../../lib/encryption.js';

export class RingCentralAdapter implements ITelephonyAdapter {
  readonly provider = 'ringcentral' as const;

  constructor(private tenantId: string) {}

  private async getAccessToken(): Promise<string> {
    const [integration] = await db
      .select({ credentials: integrations.credentials })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, this.tenantId),
          eq(integrations.provider, 'ringcentral')
        )
      )
      .limit(1);

    if (!integration) {
      throw new IntegrationError('ringcentral', 'No connected RingCentral integration');
    }

    const creds = decryptCredentials(integration.credentials as Record<string, string>);
    return creds['access_token'] ?? '';
  }

  async provisionNumber(_tenantId: string, _areaCode?: string): Promise<ProvisionedNumber> {
    // RingCentral doesn't provision numbers via API in the same way.
    // The practice's existing RC number is linked via OAuth.
    // Return the number from the integration metadata.
    const [integration] = await db
      .select({ metadata: integrations.metadata })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, this.tenantId),
          eq(integrations.provider, 'ringcentral')
        )
      )
      .limit(1);

    const meta = integration?.metadata as Record<string, unknown> | undefined;
    const phoneNumbers = meta?.['phoneNumbers'] as string[] | undefined;
    const number = phoneNumbers?.[0];

    if (!number) {
      throw new IntegrationError('ringcentral', 'No phone number found in RingCentral integration');
    }

    return {
      phoneNumber: number,
      sid: meta?.['webhookSubscriptionId'] as string ?? '',
      provider: 'ringcentral',
    };
  }

  async transferCall(callSid: string, toNumber: string): Promise<void> {
    const token = await this.getAccessToken();
    await transferCall(token, callSid, toNumber);
  }

  async hangupCall(callSid: string): Promise<void> {
    const token = await this.getAccessToken();
    await hangupCall(token, callSid);
  }

  async getCallRecording(_callSid: string): Promise<string | null> {
    // RingCentral recordings are accessed via the RC API
    // For V1, recording URLs are stored on the call record when RC sends completion events
    return null;
  }
}
