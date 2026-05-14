// ============================================================
// HubSpot CRM adapter — OAuth token exchange + contact sync
// ============================================================
import { config } from '../../../config.js';

const HS_BASE = 'https://api.hubapi.com';
const HS_AUTH = 'https://app.hubspot.com/oauth/authorize';
const HS_TOKEN = 'https://api.hubapi.com/oauth/v1/token';

export interface HubSpotTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
}

export interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    hs_object_id?: string;
  };
}

// ── OAuth ──────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.HUBSPOT_CLIENT_ID,
    redirect_uri: config.HUBSPOT_REDIRECT_URI,
    scope: 'crm.objects.contacts.read crm.objects.contacts.write',
    state,
  });
  return `${HS_AUTH}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<HubSpotTokens> {
  const res = await fetch(HS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.HUBSPOT_CLIENT_ID,
      client_secret: config.HUBSPOT_CLIENT_SECRET,
      redirect_uri: config.HUBSPOT_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot token exchange failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshTokens(refreshToken: string): Promise<HubSpotTokens> {
  const res = await fetch(HS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.HUBSPOT_CLIENT_ID,
      client_secret: config.HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot token refresh failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

// ── Contact API ────────────────────────────────────────────

export async function listContacts(
  accessToken: string,
  after?: string
): Promise<{ results: HubSpotContact[]; paging?: { next?: { after: string } } }> {
  const params = new URLSearchParams({
    limit: '100',
    properties: 'firstname,lastname,email,phone',
  });
  if (after) params.set('after', after);

  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`HubSpot listContacts failed: ${res.status}`);
  return res.json() as Promise<{ results: HubSpotContact[]; paging?: { next?: { after: string } } }>;
}

export async function createContact(
  accessToken: string,
  props: { firstname?: string; lastname?: string; email?: string; phone?: string }
): Promise<HubSpotContact> {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: props }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot createContact failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<HubSpotContact>;
}

export async function updateContact(
  accessToken: string,
  hsId: string,
  props: { firstname?: string; lastname?: string; email?: string; phone?: string }
): Promise<void> {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/${hsId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: props }),
  });
  if (!res.ok) throw new Error(`HubSpot updateContact failed: ${res.status}`);
}
