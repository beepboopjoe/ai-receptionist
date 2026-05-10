// ============================================================
// Telnyx Telephony Adapter — implements ITelephonyAdapter
// Primary telephony path: Telnyx Call Control API v2
// Docs: https://developers.telnyx.com/docs/api/v2/call-control
// ============================================================
import type { ITelephonyAdapter, ProvisionedNumber } from '@ai-receptionist/shared';
import { config } from '../../../config.js';
import { IntegrationError } from '../../../lib/errors.js';

interface TelnyxApiResponse<T> {
  data: T;
}

interface TelnyxNumber {
  id: string;
  phone_number: string;
  status: string;
}

interface TelnyxNumberSearchResult {
  phone_number: string;
  region_information: Array<{ region_name: string; region_type: string }>;
}

export class TelnyxAdapter implements ITelephonyAdapter {
  readonly provider = 'telnyx' as const;

  // ---- Internal helpers ----

  private get headers(): HeadersInit {
    if (!config.TELNYX_API_KEY) {
      throw new IntegrationError('telnyx', 'TELNYX_API_KEY is not configured');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.TELNYX_API_KEY}`,
    };
  }

  private async callApi<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `https://api.telnyx.com/v2${path}`;
    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new IntegrationError(
        'telnyx',
        `Telnyx API error ${response.status} on ${method} ${path}: ${errText}`
      );
    }

    return response.json() as Promise<T>;
  }

  // ---- ITelephonyAdapter implementation ----

  /**
   * Search for and purchase a Telnyx phone number, then configure it to
   * point to our Call Control application (TELNYX_APP_ID).
   */
  async provisionNumber(tenantId: string, areaCode?: string): Promise<ProvisionedNumber> {
    try {
      // 1. Search for an available number
      const searchParams = new URLSearchParams({
        filter__features__voice: 'true',
        filter__limit: '1',
      });
      if (areaCode) {
        searchParams.set('filter__national_destination_code', areaCode);
      }

      const searchResult = await this.callApi<{ data: TelnyxNumberSearchResult[] }>(
        'GET',
        `/available_phone_numbers?${searchParams.toString()}`
      );

      const available = searchResult.data[0];
      if (!available) {
        throw new IntegrationError('telnyx', 'No available phone numbers found');
      }

      // 2. Order (purchase) the number
      const ordered = await this.callApi<TelnyxApiResponse<TelnyxNumber>>(
        'POST',
        '/number_orders',
        {
          phone_numbers: [{ phone_number: available.phone_number }],
          connection_id: config.TELNYX_APP_ID,
          // Tag with tenant for identification
          tags: [`tenant:${tenantId}`],
        }
      );

      return {
        phoneNumber: ordered.data.phone_number,
        sid: ordered.data.id,
        provider: 'telnyx',
      };
    } catch (err) {
      if (err instanceof IntegrationError) throw err;
      throw new IntegrationError('telnyx', `Number provisioning failed: ${String(err)}`);
    }
  }

  /**
   * Transfer an active call to a staff phone number using Telnyx Call Control.
   * Uses the `transfer` action which keeps the call in the same session.
   */
  async transferCall(callControlId: string, toNumber: string): Promise<void> {
    try {
      await this.callApi<unknown>(
        'POST',
        `/calls/${callControlId}/actions/transfer`,
        {
          to: toNumber,
          // Brief hold message while transfer connects
          audio_url: null,
        }
      );
    } catch (err) {
      throw new IntegrationError('telnyx', `Call transfer failed: ${String(err)}`);
    }
  }

  /**
   * Hang up an active Telnyx call.
   */
  async hangupCall(callControlId: string): Promise<void> {
    try {
      await this.callApi<unknown>(
        'POST',
        `/calls/${callControlId}/actions/hangup`,
        {}
      );
    } catch (err) {
      throw new IntegrationError('telnyx', `Hangup failed: ${String(err)}`);
    }
  }

  /**
   * Retrieve the recording URL for a completed Telnyx call.
   * Returns null if no recording is available.
   */
  async getCallRecording(callControlId: string): Promise<string | null> {
    try {
      const result = await this.callApi<{ data: Array<{ download_urls?: { mp3: string } }> }>(
        'GET',
        `/recordings?filter[call_control_id]=${callControlId}&page[size]=1`
      );
      const recording = result.data[0];
      return recording?.download_urls?.mp3 ?? null;
    } catch {
      return null;
    }
  }
}
