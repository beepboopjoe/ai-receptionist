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
  takeover: (id: string) =>
    apiFetch<{ ok: boolean; toNumber?: string; error?: string; message?: string }>(
      `/calls/${id}/takeover`,
      { method: 'POST' }
    ),
  testCall: () =>
    apiFetch<{ ok: boolean; callId?: string; toNumber?: string; error?: string; message?: string }>(
      `/calls/test-call`,
      { method: 'POST' }
    ),
};

// ---- Campaign goal templates (Phase 12.4) ----
export interface CampaignGoalSuggestion {
  slug: string;
  vertical: string;
  title: string;
  description: string;
  candidateCount: number;
}

export const campaignGoalsApi = {
  suggestions: () =>
    apiFetch<{ suggestions: CampaignGoalSuggestion[] }>(`/campaigns/suggestions`),
  fromGoal: (goal: string) =>
    apiFetch<{ campaignId?: string; candidateCount?: number; error?: string; message?: string }>(
      `/campaigns/from-goal`,
      { method: 'POST', body: JSON.stringify({ goal }) }
    ),
};

// ---- Section agent (Phase 12.5) ----
export interface SectionLiveCount {
  label: string;
  value: number;
  severity: 'info' | 'warning' | 'success' | 'critical';
}

export interface SectionSuggestionsResponse {
  liveCounts: SectionLiveCount[];
  pendingSuggestionIds: string[];
}

export const sectionsApi = {
  suggestions: (section: string) =>
    apiFetch<SectionSuggestionsResponse>(`/sections/${section}/suggestions`),
};

// ---- Analytics (Phase 12.6) ----
export interface AnalyticsOverview {
  period: { days: number; from: string; to: string };
  totals: {
    calls: number;
    answered: number;
    missed: number;
    bookings: number;
    escalations: number;
    totalDurationSeconds: number;
    answerRate: number;
  };
  daily: Array<{ date: string; calls: number; missed: number; bookings: number }>;
  peakHour: { hour: number; count: number } | null;
  roi: {
    callsRecovered: number;
    moneySaved: number;
    hoursOfStaffWork: number;
    humanCostAvoided: number;
    avgBookingValueUsd: number;
  };
}

export const analyticsApi = {
  overview: (days: number = 30) =>
    apiFetch<AnalyticsOverview>(`/analytics/overview?days=${days}`),
};

// ---- Lead Discovery (Phase 12.7) ----
export interface LeadDiscoveryParams {
  query: string;
  locationQuery: string;
  radiusMiles?: number;
  minRating?: number;
  requirePhone?: boolean;
  maxResults: number;
}

export interface LeadDiscoveryJob {
  id: string;
  tenantId: string;
  actorId: string;
  apifyRunId: string | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'imported';
  searchParams: LeadDiscoveryParams;
  rawResults: Array<Record<string, unknown>> | null;
  leadsFound: number;
  leadsImported: number;
  costCents: number;
  importedCampaignId: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  importedAt: string | null;
  createdAt: string;
}

export const leadDiscoveryApi = {
  preview: (params: LeadDiscoveryParams) =>
    apiFetch<{ estimatedLeads: number; costCents: number; perLeadCents: number }>(
      `/leads/discover/preview`,
      { method: 'POST', body: JSON.stringify(params) }
    ),
  start: (params: LeadDiscoveryParams) =>
    apiFetch<{ jobId: string; apifyRunId: string; status: string }>(
      `/leads/discover/jobs`,
      { method: 'POST', body: JSON.stringify(params) }
    ),
  list: () => apiFetch<{ data: LeadDiscoveryJob[] }>(`/leads/discover/jobs`),
  get: (id: string) => apiFetch<LeadDiscoveryJob>(`/leads/discover/jobs/${id}`),
  import: (id: string, body: { selectedIndices?: number[]; campaignId?: string }) =>
    apiFetch<{ campaignId: string; leadsImported: number; costCents: number }>(
      `/leads/discover/jobs/${id}/import`,
      { method: 'POST', body: JSON.stringify(body) }
    ),
};

// ---- Search (cmd-K palette) ----
// Shape mirrors apps/api/src/modules/admin/router.ts `GET /search`.
export interface SearchHits {
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phoneE164: string;
    email: string | null;
  }>;
  calls: Array<{
    id: string;
    fromNumber: string;
    summary: string | null;
    startedAt: string;
    status: string;
  }>;
  appointments: Array<{
    id: string;
    appointmentType: string;
    providerName: string | null;
    startsAt: string;
    status: string;
  }>;
  escalations: Array<{
    id: string;
    reason: string;
    priority: string;
    status: string;
  }>;
}

export const searchApi = {
  query: (q: string) => apiFetch<SearchHits>(`/search?q=${encodeURIComponent(q)}`),
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

  // Phase 13 — connect handlers per CRM. Each redirects the browser to the
  // server-side OAuth endpoint (which then redirects to the CRM consent page).
  // Returning the URL rather than top-level redirecting from React lets the
  // page show "Redirecting..." UI first if it wants to.
  connectHubspotUrl: () => apiUrl('/integrations/hubspot/connect'),
  connectSalesforceUrl: (opts?: { sandbox?: boolean }) =>
    apiUrl(`/integrations/salesforce/connect${opts?.sandbox ? '?sandbox=1' : ''}`),
  disconnectSalesforce: () =>
    apiFetch('/integrations/salesforce/disconnect', { method: 'POST' }),
  connectClioUrl: () => apiUrl('/integrations/clio/connect'),
  disconnectClio: () =>
    apiFetch('/integrations/clio/disconnect', { method: 'POST' }),
  connectFilevine: (body: { apiKey: string; apiSecret: string; orgId: string }) =>
    apiFetch<{ ok: boolean }>('/integrations/filevine/connect', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  disconnectFilevine: () =>
    apiFetch('/integrations/filevine/disconnect', { method: 'POST' }),
  connectZohoUrl: (dc: 'com' | 'eu' | 'in' | 'com.au' | 'jp' = 'com') =>
    apiUrl(`/integrations/zoho/connect?dc=${encodeURIComponent(dc)}`),
  disconnectZoho: () =>
    apiFetch('/integrations/zoho/disconnect', { method: 'POST' }),
};

// ---- Knowledge Base (Phase 12.8 / 14) ----

export interface KbDocument {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  processedAt: string | null;
}

export interface KbUsage {
  docCount: number;
  totalBytes: number;
  limits: { docs: number; bytes: number };
}

export const kbApi = {
  list: () => apiFetch<{ documents: KbDocument[] }>('/kb/documents'),
  get: (id: string) => apiFetch<KbDocument>(`/kb/documents/${id}`),
  usage: () => apiFetch<KbUsage>('/kb/usage'),
  delete: (id: string) => apiFetch(`/kb/documents/${id}`, { method: 'DELETE' }),
  reprocess: (id: string) =>
    apiFetch<{ ok: true }>(`/kb/documents/${id}/reprocess`, { method: 'POST' }),
  /** Upload a single file via multipart. Returns the new doc record. */
  upload: async (file: File): Promise<KbDocument> => {
    const form = new FormData();
    form.append('file', file);
    const base = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const res = await fetch(`${base}/kb/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Upload failed (${res.status}): ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<KbDocument>;
  },
};

/** Build a full URL to an API endpoint (for browser redirects / OAuth flows). */
function apiUrl(path: string): string {
  const base = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

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

  /**
   * Returns the active per-month price (in cents) for local + toll-free numbers
   * for the signed-in tenant. Promo-trial tenants get wholesale Telnyx rates;
   * everyone else gets the retail $5 / $10.
   */
  pricing: () =>
    apiFetch<{ localCents: number; tollFreeCents: number; isPromoPricing: boolean }>(
      '/phone-numbers/pricing'
    ),

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
  // Phase 18 — recurring schedule.
  setRecurring: (
    id: string,
    body: {
      frequency: 'daily' | 'weekly' | 'monthly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      time: string;
      timezone: string;
    }
  ) =>
    apiFetch<{ ok: true; nextRunAt: string }>(`/campaigns/${id}/recurring`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  clearRecurring: (id: string) =>
    apiFetch<{ ok: true }>(`/campaigns/${id}/recurring`, { method: 'DELETE' }),
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

// ---- Platform Admin ----
// Reserved for emails listed in ADMIN_EMAILS on the API. Lets you reach
// across every tenant in the system: list/search them, grant promo
// trials, view platform-wide stats. Used by /platform in the dashboard.
export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  vertical: string;
  isActive: boolean;
  subscriptionStatus: string | null;
  promoTrial: boolean;
  minutesOverride: number | null;
  createdAt: string;
  ownerEmail: string | null;
  minutesUsed: number;
  minutesIncluded: number;
  capReached: boolean;
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  promoTenants: number;
  signups7d: number;
  signups30d: number;
  mrrCents: number;
  churnedRecently: number;
  platformMinutesThisMonth: number;
  platformCallsThisMonth: number;
}

export const platformApi = {
  /**
   * Always returns 200 for authenticated users. `ok` is true only when the
   * caller's email is in ADMIN_EMAILS on the API. Used by the sidebar to
   * gate the Platform Admin link without triggering a 401-redirect on
   * non-admins.
   */
  whoami: () => apiFetch<{ ok: boolean; email: string }>('/platform/whoami'),
  stats: () => apiFetch<PlatformStats>('/platform/stats'),
  listTenants: (search?: string, sort?: 'created_desc' | 'minutes_desc' | 'name_asc') => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    const q = params.toString();
    return apiFetch<{ data: PlatformTenant[]; total: number }>(
      `/platform/tenants${q ? '?' + q : ''}`
    );
  },
  grantPromoTrial: (tenantId: string, plan: string, minutes: number) =>
    apiFetch<{ ok: true; tenantId: string; plan: string; minutesOverride: number; promoTrial: true }>(
      `/admin/tenants/${tenantId}/grant-promo-trial`,
      { method: 'POST', body: JSON.stringify({ plan, minutes }) }
    ),
  revokePromoTrial: (tenantId: string) =>
    apiFetch<{ ok: true; tenantId: string }>(
      `/admin/tenants/${tenantId}/revoke-promo-trial`,
      { method: 'POST' }
    ),

  /** List every support ticket across all tenants (platform-admin only). */
  listTickets: (filter?: { status?: SupportStatus; category?: SupportCategory }) => {
    const params = new URLSearchParams();
    if (filter?.status) params.set('status', filter.status);
    if (filter?.category) params.set('category', filter.category);
    const q = params.toString();
    return apiFetch<{ data: AdminSupportTicket[] }>(
      `/platform/support/tickets${q ? '?' + q : ''}`
    );
  },
  resolveTicket: (id: string) =>
    apiFetch<{ ok: true; ticket: SupportTicket }>(
      `/platform/support/tickets/${id}/resolve`,
      { method: 'POST' }
    ),
  reopenTicket: (id: string) =>
    apiFetch<{ ok: true; ticket: SupportTicket }>(
      `/platform/support/tickets/${id}/reopen`,
      { method: 'POST' }
    ),
};

// ---- Support ----
// Tenant-facing endpoints for submitting/listing support tickets. The
// platform-admin counterparts (cross-tenant list + resolve/reopen) live
// on `platformApi` above.
export type SupportCategory = 'bug' | 'question' | 'billing' | 'feature_request';
export type SupportStatus = 'open' | 'resolved';

export interface SupportTicket {
  id: string;
  tenantId: string;
  submittedBy: string | null;
  submitterEmail: string;
  submitterName: string | null;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface AdminSupportTicket extends SupportTicket {
  tenantName: string;
}

export const supportApi = {
  submit: (body: { category: SupportCategory; subject: string; message: string }) =>
    apiFetch<{ ok: true; ticket: SupportTicket }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  list: () => apiFetch<{ data: SupportTicket[] }>('/support/tickets'),
};
