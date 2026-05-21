// ============================================================
// API Client — typed fetch wrapper for the backend REST API
// ============================================================
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * When the API returns 401, the user's token expired or is invalid. Clear
 * auth state and bounce to /login. Skips the redirect on the auth pages
 * themselves (login, signup, forgot-password) where a 401 is the expected
 * "wrong credentials" response and the page handles it locally.
 */
function handle401Redirect(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  // Auth screens own their own error UX — don't yank the user away from a
  // bad-password message into a half-loaded /login.
  if (path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/reset-password')) {
    return;
  }
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_refresh_token');
  } catch { /* ignore */ }
  // Preserve the original destination so the user lands back here after re-auth.
  const next = encodeURIComponent(path + window.location.search);
  window.location.replace(`/login?next=${next}`);
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    handle401Redirect();
    throw new ApiError(401, 'Session expired — redirecting to login');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? 'Request failed', data);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- Auth ----
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; refreshToken: string; user: { id: string; email: string; role: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  register: (body: { businessName: string; email: string; password: string; aiUseCase?: 'inbound' | 'outbound' | 'both'; vertical?: string }) =>
    apiFetch<{ token: string; refreshToken: string; user: { id: string; email: string; role: string }; tenant: { id: string; name: string; slug: string; plan: string; vertical?: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(body) }
    ),
  forgotPassword: (email: string) =>
    apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) =>
    apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  refresh: (refreshToken: string) =>
    apiFetch<{ token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  /** Attribute the signed-in tenant to an affiliate referral code. */
  attributeAffiliate: (code: string) =>
    apiFetch<{ ok: true; alreadyAttributed: boolean }>('/auth/attribute-affiliate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
};

// ---- Calls ----
export const callsApi = {
  list: (params?: { limit?: number; offset?: number; status?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<{ data: unknown[]; total: number }>(`/calls${q ? '?' + q : ''}`);
  },
  get: (id: string) => apiFetch<unknown>(`/calls/${id}`),
  getMissed: () => apiFetch<{ data: unknown[] }>('/calls/missed'),
  escalate: (id: string, reason: string) =>
    apiFetch(`/calls/${id}/escalate`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

// ---- Appointments ----
export const appointmentsApi = {
  list: (params?: { limit?: number; offset?: number; status?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<{ data: unknown[] }>(`/appointments${q ? '?' + q : ''}`);
  },
  get: (id: string) => apiFetch<unknown>(`/appointments/${id}`),
  update: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getAvailability: (date: string, duration: number, provider?: string) => {
    const q = new URLSearchParams({ date, duration: String(duration), ...(provider ? { provider } : {}) });
    return apiFetch<{ slots: unknown[] }>(`/appointments/availability?${q}`);
  },
};

// ---- Contacts ----
export const contactsApi = {
  list: (params?: { q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<{ data: unknown[]; total: number }>(`/contacts${q ? '?' + q : ''}`);
  },
  get: (id: string) => apiFetch<unknown>(`/contacts/${id}`),
  update: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  importCsv: (formData: FormData) =>
    fetch(`${API_URL}/contacts/import/csv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then((r) => r.json()),
  bulkDelete: (ids: string[]) =>
    apiFetch<{ deleted: number }>('/contacts/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
};

// ---- Escalations ----
export const escalationsApi = {
  list: () => apiFetch<{ data: unknown[] }>('/escalations'),
  update: (id: string, body: { status?: string; resolutionNote?: string; assignedTo?: string }) =>
    apiFetch(`/escalations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// ---- Team management ----
export interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'owner' | 'admin' | 'staff';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  invitedBy: string | null;
  createdAt: string;
}

export const teamApi = {
  members: () => apiFetch<{ data: TeamMember[] }>('/team/members'),
  invitations: () => apiFetch<{ data: TeamInvitation[] }>('/team/invitations'),
  invite: (body: { email: string; role: 'owner' | 'admin' | 'staff' }) =>
    apiFetch<{ id: string; email: string; role: string; expiresAt: string; inviteUrl: string; message: string }>(
      '/team/invitations',
      { method: 'POST', body: JSON.stringify(body) }
    ),
  revokeInvite: (id: string) =>
    apiFetch(`/team/invitations/${id}`, { method: 'DELETE' }),
  changeRole: (id: string, role: 'owner' | 'admin' | 'staff') =>
    apiFetch<{ id: string; role: string }>(`/team/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  removeMember: (id: string) =>
    apiFetch(`/team/members/${id}`, { method: 'DELETE' }),

  // Public (no auth) — token is the auth
  inviteInfo: (token: string) =>
    apiFetch<{ email: string; role: string; tenantName: string; expiresAt: string }>(
      `/auth/invite/${encodeURIComponent(token)}`
    ),
  acceptInvite: (body: { token: string; password: string; firstName?: string; lastName?: string }) =>
    apiFetch<{ token: string; refreshToken: string; user: { id: string; email: string; role: string } }>(
      '/auth/accept-invite',
      { method: 'POST', body: JSON.stringify(body) }
    ),
};

// ---- Public API keys ----
export interface ApiKey {
  id: string;
  prefix: string;
  name: string;
  scope: 'read' | 'write';
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export const apiKeysApi = {
  list: () => apiFetch<{ data: ApiKey[] }>('/api-keys'),
  create: (body: { name: string; scope?: 'read' | 'write'; expiresInDays?: number }) =>
    apiFetch<ApiKey & { rawToken: string; message: string }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revoke: (id: string) => apiFetch(`/api-keys/${id}`, { method: 'DELETE' }),
};

// ---- Webhooks ----
export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string;
  isActive: boolean;
  description: string | null;
  lastDeliveredAt: string | null;
  lastFailedAt: string | null;
  failureCount: number;
  createdAt: string;
}

export const webhooksApi = {
  list: () => apiFetch<{ data: WebhookEndpoint[] }>('/webhooks/endpoints'),
  create: (body: { url: string; events?: string; description?: string }) =>
    apiFetch<WebhookEndpoint & { secret: string; message: string }>(
      '/webhooks/endpoints',
      { method: 'POST', body: JSON.stringify(body) }
    ),
  update: (id: string, body: Partial<{ url: string; events: string; description: string; isActive: boolean }>) =>
    apiFetch<WebhookEndpoint>(`/webhooks/endpoints/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  rotate: (id: string) =>
    apiFetch<{ id: string; secret: string; message: string }>(`/webhooks/endpoints/${id}/rotate`, { method: 'POST' }),
  remove: (id: string) =>
    apiFetch(`/webhooks/endpoints/${id}`, { method: 'DELETE' }),
  test: (id: string) =>
    apiFetch<{ ok: boolean; message: string }>(`/webhooks/endpoints/${id}/test`, { method: 'POST' }),
  deliveries: (limit = 50) =>
    apiFetch<{ data: Array<{
      id: string; endpointId: string; eventType: string; status: string;
      attempts: number; httpStatus: number | null; deliveredAt: string | null;
      errorMessage: string | null; createdAt: string;
    }> }>(`/webhooks/deliveries?limit=${limit}`),
};

// ---- Tenant (current tenant info & vertical/industry update) ----
export const tenantsApi = {
  get: () => apiFetch<{ id: string; name: string; slug: string; plan: string; vertical: string; timezone: string; isActive: boolean; onboardingStep: number }>('/tenant'),
  updateVertical: (vertical: string) =>
    apiFetch<{ id: string; vertical: string }>('/tenant', {
      method: 'PATCH',
      body: JSON.stringify({ vertical }),
    }),
};

// ---- Settings ----
export const settingsApi = {
  get: () => apiFetch<{ settings: unknown; tenant: unknown }>('/settings'),
  update: (body: Record<string, unknown>) =>
    apiFetch('/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  getOfficeHours: () => apiFetch('/settings/office-hours'),
  updateOfficeHours: (body: unknown) =>
    apiFetch('/settings/office-hours', { method: 'PUT', body: JSON.stringify(body) }),
};

// ---- Integrations ----
export const integrationsApi = {
  list: () => apiFetch<{ data: unknown[] }>('/integrations'),
  disconnect: (provider: string) =>
    apiFetch(`/integrations/${provider}`, { method: 'DELETE' }),
  syncHubspot: () =>
    apiFetch<{ jobId: string; message: string }>('/integrations/hubspot/sync', { method: 'POST' }),
};

// ---- Onboarding ----
export const onboardingApi = {
  getStatus: () => apiFetch<{
    currentStep: number;
    isActive: boolean;
    stepsCompleted: Record<string, boolean>;
  }>('/onboarding/status'),
  completeStep: (step: number) =>
    apiFetch(`/onboarding/step/${step}/complete`, { method: 'POST' }),
  activate: () => apiFetch('/onboarding/activate', { method: 'POST' }),
  provisionNumber: (areaCode?: string) =>
    apiFetch<{ phoneNumber: string; sid: string; provider: string }>(
      '/onboarding/provision-number',
      { method: 'POST', body: JSON.stringify({ areaCode }) }
    ),
};

// ---- Notifications ----
export const notificationsApi = {
  list: () => apiFetch<{ data: unknown[] }>('/notifications'),
  resend: (id: string) => apiFetch(`/notifications/${id}/resend`, { method: 'POST' }),
};

// ---- Audit ----
export const auditApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<{ data: unknown[] }>(`/audit${q ? '?' + q : ''}`);
  },
};

// ---- Billing ----
export const billingApi = {
  get: () =>
    apiFetch<{
      plan: string;
      minutesUsed: number;
      minutesIncluded: number;
      usagePercent: number;
      callsThisMonth: number;
      appointmentsThisMonth: number;
      renewalDate: string;
      monthlyPrice: number;
      outboundEnabled: boolean;
      promoTrial: boolean;
      capReached: boolean;
    }>('/billing'),

  // Current Stripe subscription (plan, status, period end)
  getSubscription: () =>
    apiFetch<{
      planKey: string;
      plan: unknown;
      status: string | null;
      currentPeriodEnd: string | null;
      trialEnd: string | null;
      billingCycle: 'monthly' | 'annual' | null;
      isStripeCustomer: boolean;
    }>('/billing/subscription'),

  // Start Stripe Checkout — returns the URL to redirect to.
  // 503 if Stripe isn't configured on the API.
  checkout: (planKey: string, cycle: 'monthly' | 'annual') =>
    apiFetch<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planKey, cycle }),
    }),

  // Open the Stripe Customer Portal (manage card, view invoices, cancel)
  openPortal: () =>
    apiFetch<{ url: string }>('/billing/portal', { method: 'POST' }),

  // Current billing-period minute usage + overage
  getUsage: () =>
    apiFetch<{
      periodStart: string;
      periodEnd: string;
      minutesUsed: number;
      minutesIncluded: number;
      overageMinutes: number;
      overageChargedCents: number;
      pctUsed: number;
      warningSent: boolean;
    }>('/billing/usage'),
};

// ---- Phone numbers (Telnyx-backed) ----
export interface OwnedNumber {
  id: string;
  phoneE164: string;
  numberType: 'local' | 'toll_free';
  isPrimary: boolean;
  monthlyCostCents: number;
  purchasedAt: string;
  region: string | null;
}
export interface AvailableNumber {
  phoneE164: string;
  telnyxId: string;
  region: string | null;
  locality: string | null;
  numberType: 'local' | 'toll_free';
  monthlyCostCents: number;
}
export interface PortRequestInput {
  phoneE164: string;
  currentCarrier: string;
  accountNumber: string;
  accountPin?: string;
  authorizedName: string;
  authorizedTitle?: string;
  serviceAddress: string;
  serviceCity: string;
  serviceState: string;
  serviceZip: string;
  desiredCompleteDate?: string;
}
export interface PortRequestRow {
  id: string;
  phoneE164: string;
  currentCarrier: string;
  status: 'pending' | 'submitted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  desiredCompleteDate: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
export const phoneNumbersApi = {
  list: () => apiFetch<{ data: OwnedNumber[] }>('/phone-numbers'),
  search: (params: { areaCode?: string; locality?: string; type?: 'local' | 'toll_free' }) =>
    apiFetch<{ data: AvailableNumber[] }>('/phone-numbers/search', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  purchase: (phoneE164: string, numberType: 'local' | 'toll_free' = 'local') =>
    apiFetch<{ number: OwnedNumber; charged: boolean }>('/phone-numbers/purchase', {
      method: 'POST',
      body: JSON.stringify({ phoneE164, numberType }),
    }),
  release: (id: string) =>
    apiFetch<void>(`/phone-numbers/${id}`, { method: 'DELETE' }),

  // Number porting (LOA submission + tracking)
  port: (input: PortRequestInput) =>
    apiFetch<PortRequestRow>('/phone-numbers/port', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listPortRequests: () =>
    apiFetch<{ data: PortRequestRow[] }>('/phone-numbers/port-requests'),
  cancelPortRequest: (id: string) =>
    apiFetch<void>(`/phone-numbers/port-requests/${id}`, { method: 'DELETE' }),
};

// ---- Campaigns ----
export const campaignsApi = {
  list: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<{ data: unknown[] }>(`/campaigns${q}`);
  },
  get: (id: string) => apiFetch<unknown>(`/campaigns/${id}`),
  create: (body: {
    name: string;
    fromNumber: string;
    dialWindowStart?: string;
    dialWindowEnd?: string;
    maxRetries?: number;
    retryDelayMinutes?: number;
    maxConcurrentCalls?: number;
    voicemailMessage?: string;
  }) => apiFetch<unknown>('/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  start: (id: string) => apiFetch<unknown>(`/campaigns/${id}/start`, { method: 'POST' }),
  pause: (id: string) => apiFetch<unknown>(`/campaigns/${id}/pause`, { method: 'POST' }),
  cancel: (id: string) => apiFetch<unknown>(`/campaigns/${id}/cancel`, { method: 'POST' }),
  uploadLeads: (id: string, file: File) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_URL}/campaigns/${id}/leads/upload`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then((r) => r.json());
  },
  getContacts: (id: string, params?: { status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<{ data: unknown[]; total: number }>(
      `/campaigns/${id}/contacts${q ? '?' + q : ''}`
    );
  },
  getStats: (id: string) => apiFetch<unknown>(`/campaigns/${id}/stats`),
  updateContact: (
    campaignId: string,
    contactId: string,
    update: { status?: string; outcome?: string; qualificationNotes?: string }
  ) =>
    apiFetch<unknown>(`/campaigns/${campaignId}/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    }),
};

// ---- SMS (two-way inbox) ----
export interface SmsMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  body: string;
  status: string;
  contactId: string | null;
  createdAt: string;
}

export interface SmsConversation {
  externalPhone: string;
  lastMessage: string;
  lastDirection: string;
  lastAt: string;
  inboundCount: number;
  contactId: string | null;
  contactName: string | null;
}

export interface SmsThread {
  phone: string;
  contactId: string | null;
  contactName: string | null;
  messages: SmsMessage[];
}

// ---- Compliance (HIPAA) ----
export interface ComplianceStatus {
  baaAccepted: boolean;
  baaAcceptedAt: string | null;
  baaSignerEmail: string | null;
  hipaaMode: boolean;
  dataRetentionDays: number;
}

export interface ComplianceEventRecord {
  id: string;
  tenantId: string;
  eventType: string;
  actorId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const complianceApi = {
  getStatus: () => apiFetch<ComplianceStatus>('/compliance/status'),
  acceptBaa: () =>
    apiFetch<{ ok: boolean; acceptedAt: string }>('/compliance/baa/accept', {
      method: 'POST',
    }),
  updateSettings: (body: { hipaaMode?: boolean; dataRetentionDays?: number }) =>
    apiFetch<{ ok: boolean }>('/compliance/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getEvents: () => apiFetch<{ data: ComplianceEventRecord[] }>('/compliance/events'),
};

// ── Agent (suggestion queue) ────────────────────────────────────────────────

export type AgentSuggestionType =
  | 'missed_call_callback'
  | 'appointment_confirmation'
  | 'stale_lead_followup'
  | 'no_show_recapture';

export type AgentSuggestionStatus =
  | 'pending'
  | 'approved'
  | 'executed'
  | 'skipped'
  | 'expired'
  | 'failed';

export interface AgentSuggestion {
  id: string;
  tenantId: string;
  type: AgentSuggestionType;
  status: AgentSuggestionStatus;
  dedupeKey: string;
  payload: {
    contactName?: string;
    phone?: string;
    fromNumber?: string;
    phoneDisplay?: string;
    script?: string;
    callId?: string;
    appointmentId?: string;
    contactId?: string;
    missedAt?: string;
    startsAtDisplay?: string;
    appointmentType?: string;
    [key: string]: unknown;
  };
  suggestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  executedAt: string | null;
  executionResult: { ok: boolean; detail: string } | null;
  createdAt: string;
}

export interface AgentSettings {
  agentEnabled: boolean;
  agentAutoExecute: boolean;
  hipaaMode: boolean;
}

export const agentApi = {
  /** List suggestions for this tenant (default: pending). */
  listSuggestions: (status: AgentSuggestionStatus = 'pending') =>
    apiFetch<{ data: AgentSuggestion[] }>(`/agent/suggestions?status=${status}`),

  approve: (id: string) =>
    apiFetch<{ data: AgentSuggestion }>(`/agent/suggestions/${id}/approve`, {
      method: 'POST',
    }),

  skip: (id: string) =>
    apiFetch<{ data: AgentSuggestion }>(`/agent/suggestions/${id}/skip`, {
      method: 'POST',
    }),

  /** Force a fresh scanner run for this tenant — used by the "Refresh" button. */
  scan: () =>
    apiFetch<{
      data: {
        tenantId: string;
        detected: number;
        inserted: number;
        byType: Record<AgentSuggestionType, number>;
      };
    }>('/agent/scan', { method: 'POST' }),

  getSettings: () => apiFetch<AgentSettings>('/agent/settings'),

  updateSettings: (body: { agentEnabled?: boolean; agentAutoExecute?: boolean }) =>
    apiFetch<{ ok: boolean }>('/agent/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const smsApi = {
  /** List all conversation threads for the tenant, sorted by most recent. */
  listConversations: () =>
    apiFetch<{ data: SmsConversation[] }>('/sms/conversations'),

  /** Full message thread for a single external phone number. */
  getThread: (phone: string) =>
    apiFetch<SmsThread>(`/sms/conversations/${encodeURIComponent(phone)}`),

  /** Send an outbound SMS from the dashboard. */
  send: (to: string, body: string) =>
    apiFetch<{ ok: boolean; messageId: string }>('/sms/send', {
      method: 'POST',
      body: JSON.stringify({ to, body }),
    }),
};
