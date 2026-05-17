// ============================================================
// Telnyx SMS Adapter — sends SMS via Telnyx Messages API v2
// Docs: https://developers.telnyx.com/docs/api/v2/messaging
// ============================================================
import { config } from '../../../config.js';
import { IntegrationError } from '../../../lib/errors.js';

interface TelnyxMessageResponse {
  data: {
    id: string;
    to: Array<{ phone_number: string; status: string }>;
  };
}

/**
 * Send an SMS via Telnyx.
 *
 * @param to    Destination phone number in E.164 format (e.g. +12125551234)
 * @param body  SMS body text
 * @param from  Optional E.164 sender number. When omitted, falls back to the
 *              global TELNYX_FROM_NUMBER env var (single-tenant / dev mode).
 *              Pass the tenant's provisioned number for multi-tenant routing.
 * @returns     Telnyx message UUID
 */
export async function sendSms(to: string, body: string, from?: string): Promise<string> {
  if (!config.TELNYX_API_KEY) {
    throw new IntegrationError('telnyx', 'TELNYX_API_KEY is not configured');
  }
  const fromNumber = from ?? config.TELNYX_FROM_NUMBER;
  if (!fromNumber) {
    throw new IntegrationError('telnyx', 'No sender number provided and TELNYX_FROM_NUMBER is not configured');
  }

  const payload: Record<string, string> = {
    from: fromNumber,
    to,
    text: body,
  };

  // If a messaging profile is configured, attach it for routing / compliance
  if (config.TELNYX_MESSAGING_PROFILE_ID) {
    payload['messaging_profile_id'] = config.TELNYX_MESSAGING_PROFILE_ID;
  }

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.TELNYX_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new IntegrationError(
      'telnyx',
      `SMS send failed (${response.status}): ${errText}`
    );
  }

  const json = (await response.json()) as TelnyxMessageResponse;
  return json.data.id;
}
