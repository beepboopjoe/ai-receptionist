// ============================================================
// Telephony adapter factory
// ============================================================
import type { ITelephonyAdapter } from '@ai-receptionist/shared';
import { TelnyxAdapter } from './telnyx.adapter.js';
import { RingCentralAdapter } from './ringcentral.adapter.js';

export function createTelephonyAdapter(
  provider: string,
  tenantId: string
): ITelephonyAdapter {
  switch (provider) {
    case 'telnyx':
      return new TelnyxAdapter();
    case 'ringcentral':
      return new RingCentralAdapter(tenantId);
    default:
      throw new Error(
        `Unknown telephony provider: "${provider}". Supported: telnyx, ringcentral`
      );
  }
}
