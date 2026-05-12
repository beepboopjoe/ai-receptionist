// ============================================================
// Telnyx Number Search + Order REST wrapper.
//
// Telnyx exposes:
//   GET    /v2/available_phone_numbers?filter[...]=  → search
//   POST   /v2/number_orders  → buy
//   DELETE /v2/phone_numbers/{id}  → release
//
// All calls use the existing TELNYX_API_KEY env var. Returns thin
// typed shapes — we don't model every Telnyx field, only what the
// dashboard surface needs.
// ============================================================
import { config } from '../../config.js';
import { IntegrationError } from '../../lib/errors.js';

const TELNYX_BASE = 'https://api.telnyx.com/v2';

function requireKey(): string {
  if (!config.TELNYX_API_KEY) {
    throw new IntegrationError('telnyx', 'TELNYX_API_KEY is not configured');
  }
  return config.TELNYX_API_KEY;
}

async function tx<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new IntegrationError('telnyx', `${res.status} ${res.statusText}: ${errText.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface AvailableNumber {
  phoneE164: string;
  /** Telnyx's internal identifier — pass back to purchase(). */
  telnyxId: string;
  region: string | null;
  locality: string | null;
  numberType: 'local' | 'toll_free';
  monthlyCostCents: number;
}

interface TelnyxAvailableResponse {
  data: Array<{
    phone_number: string;
    record_type?: string;
    region_information?: Array<{ region_type: string; region_name: string }>;
    cost_information?: { monthly_cost?: string; upfront_cost?: string; currency?: string };
    best_effort?: boolean;
    phone_number_type?: 'local' | 'toll-free' | 'mobile' | string;
  }>;
}

interface SearchParams {
  areaCode?: string;
  /** ISO country code, default US. */
  country?: string;
  /** "local" or "toll_free". Default local. */
  type?: 'local' | 'toll_free';
  /** Locality (city). Optional — Telnyx may ignore for some area codes. */
  locality?: string;
  /** Max results, 1-30. Default 10. */
  limit?: number;
}

/**
 * Search Telnyx's catalog for available numbers. Filters out
 * unavailable rows, normalizes the shape, and limits the result.
 */
export async function searchAvailableNumbers(params: SearchParams): Promise<AvailableNumber[]> {
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 30);
  const country = params.country ?? 'US';

  const qs = new URLSearchParams();
  qs.set('filter[country_code]', country);
  qs.set('filter[limit]', String(limit));
  qs.set('filter[features][]', 'voice');
  if (params.areaCode) qs.set('filter[national_destination_code]', params.areaCode);
  if (params.locality) qs.set('filter[locality]', params.locality);
  if (params.type === 'toll_free') {
    qs.set('filter[phone_number_type]', 'toll-free');
  } else {
    qs.set('filter[phone_number_type]', 'local');
  }

  const data = await tx<TelnyxAvailableResponse>(`/available_phone_numbers?${qs.toString()}`);

  return data.data.map((n) => ({
    phoneE164: n.phone_number,
    // Telnyx's available_phone_numbers doesn't carry a stable id —
    // we pass the E.164 itself back as the "id" for ordering since
    // /v2/number_orders accepts phone_number as the only field needed.
    telnyxId: n.phone_number,
    region:
      n.region_information?.find((r) => r.region_type === 'state')?.region_name ?? null,
    locality:
      n.region_information?.find((r) => r.region_type === 'locality')?.region_name ?? null,
    numberType: n.phone_number_type === 'toll-free' ? 'toll_free' : 'local',
    monthlyCostCents:
      Math.round(Number(n.cost_information?.monthly_cost ?? '1.00') * 100) || 100,
  }));
}

interface OrderResponse {
  data: {
    id: string;
    phone_numbers: Array<{ id: string; phone_number: string; status: string }>;
    status: string;
  };
}

/**
 * Order a single phone number. Returns Telnyx's order id + the
 * resulting phone number id (we store the latter for releases).
 */
export async function purchaseNumber(phoneE164: string): Promise<{
  orderId: string;
  telnyxPhoneId: string;
  status: string;
}> {
  const body = { phone_numbers: [{ phone_number: phoneE164 }] };
  const res = await tx<OrderResponse>('/number_orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const order = res.data;
  const purchased = order.phone_numbers[0];
  if (!purchased) {
    throw new IntegrationError('telnyx', `Order ${order.id} returned no phone numbers`);
  }
  return {
    orderId: order.id,
    telnyxPhoneId: purchased.id,
    status: order.status,
  };
}

/**
 * Release (delete) a previously-purchased number. Telnyx stops
 * billing immediately. We soft-delete our row in the same transaction.
 */
export async function releaseNumber(telnyxPhoneId: string): Promise<void> {
  await tx(`/phone_numbers/${telnyxPhoneId}`, { method: 'DELETE' });
}
