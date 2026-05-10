// ============================================================
// RingCentral REST API client
// ============================================================
import { config } from '../../config.js';
import { IntegrationError } from '../../lib/errors.js';

const RC_BASE = config.RINGCENTRAL_SERVER_URL;

interface RcTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface RcCallParty {
  extensionNumber?: string;
  phoneNumber?: string;
  name?: string;
}

// ---- OAuth ----
export async function getRcAuthUrl(state: string): Promise<string> {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.RINGCENTRAL_CLIENT_ID,
    redirect_uri: config.RINGCENTRAL_REDIRECT_URI,
    state,
  });
  return `${RC_BASE}/restapi/oauth/authorize?${params.toString()}`;
}

export async function exchangeRcCode(code: string): Promise<RcTokens> {
  const res = await fetch(`${RC_BASE}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(
          `${config.RINGCENTRAL_CLIENT_ID}:${config.RINGCENTRAL_CLIENT_SECRET}`
        ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.RINGCENTRAL_REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new IntegrationError('ringcentral', `Token exchange failed: ${err}`);
  }
  return res.json() as Promise<RcTokens>;
}

export async function refreshRcToken(refreshToken: string): Promise<RcTokens> {
  const res = await fetch(`${RC_BASE}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(
          `${config.RINGCENTRAL_CLIENT_ID}:${config.RINGCENTRAL_CLIENT_SECRET}`
        ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new IntegrationError('ringcentral', 'Token refresh failed');
  }
  return res.json() as Promise<RcTokens>;
}

// ---- Webhook subscription management ----
export async function registerWebhook(
  accessToken: string,
  webhookUrl: string
): Promise<{ id: string }> {
  const res = await fetch(`${RC_BASE}/restapi/v1.0/subscription`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eventFilters: [
        '/restapi/v1.0/account/~/extension/~/telephony/sessions',
        '/restapi/v1.0/account/~/telephony/sessions',
      ],
      deliveryMode: {
        transportType: 'WebHook',
        address: webhookUrl,
        verificationToken: config.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN || undefined,
      },
      expiresIn: 604800, // 7 days
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new IntegrationError('ringcentral', `Webhook registration failed: ${err}`);
  }
  return res.json() as Promise<{ id: string }>;
}

export async function renewWebhook(
  accessToken: string,
  subscriptionId: string
): Promise<void> {
  const res = await fetch(
    `${RC_BASE}/restapi/v1.0/subscription/${subscriptionId}/renew`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new IntegrationError('ringcentral', 'Webhook renewal failed');
  }
}

// ---- Call control ----
export async function transferCall(
  accessToken: string,
  callId: string,
  toNumber: string
): Promise<void> {
  // RingCentral call control API — warm transfer to a phone number
  const res = await fetch(
    `${RC_BASE}/restapi/v1.0/account/~/telephony/sessions/${callId}/parties/~`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        party: {
          transfers: [
            {
              type: 'Blind',
              phoneNumber: toNumber,
            },
          ],
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new IntegrationError('ringcentral', `Call transfer failed: ${err}`);
  }
}

export async function hangupCall(accessToken: string, callId: string): Promise<void> {
  await fetch(`${RC_BASE}/restapi/v1.0/account/~/telephony/sessions/${callId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ---- Account info ----
export async function getExtensionInfo(
  accessToken: string
): Promise<{ phoneNumbers: RcCallParty[] }> {
  const res = await fetch(
    `${RC_BASE}/restapi/v1.0/account/~/extension/~/phone-number`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new IntegrationError('ringcentral', 'Failed to fetch extension info');
  }
  return res.json() as Promise<{ phoneNumbers: RcCallParty[] }>;
}
