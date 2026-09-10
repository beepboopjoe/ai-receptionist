'use client';
import useSWR, { mutate } from 'swr';
import { ApiError, integrationsApi } from '@/lib/api';
import { CheckCircle, ExternalLink, Trash2, Mail, RefreshCw, KeyRound } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';
import type { Vertical } from '@/lib/verticals';
import { useEffect, useState } from 'react';
import { FilevineCredentialsModal } from '@/components/integrations/filevine-credentials-modal';
import { BRAND_SUPPORT_EMAIL } from '@/lib/brand';
import { useToast } from '@/components/ui/toast';

function googleOAuthErrorMessage(code: string): string {
  switch (code) {
    case 'access_denied':
      return 'Google access was denied. You can try connecting again.';
    case 'missing_code':
      return 'Google did not return an authorization code. Try Connect again.';
    case 'invalid_state':
    case 'invalid_nonce':
      return 'That Google sign-in expired. Click Connect and try again.';
    case 'token_exchange_failed':
      return 'Could not finish Google authorization. Check GOOGLE_CLIENT_ID / redirect URI, then retry.';
    case 'persist_failed':
      return 'Authorized with Google, but we could not save the connection. Try again or contact support.';
    default:
      return `Google Calendar connect failed (${code}).`;
  }
}

interface CrmProvider {
  id: string;
  label: string;
  description: string;
  icon: string;
  badge: string | null;
  /** Verticals where this provider is industry-relevant. 'all' = always show. */
  verticals: Vertical[] | 'all';
}

const CRM_PROVIDERS: CrmProvider[] = [
  // Universal CRMs — show for every vertical
  { id: 'hubspot',        label: 'HubSpot',        description: 'CRM sync — contacts, leads, and call activity',          icon: '🔗',  badge: 'Popular', verticals: 'all' },
  { id: 'salesforce',     label: 'Salesforce',     description: 'Enterprise CRM — contacts, calls, appointments, escalations', icon: '☁️',  badge: null,      verticals: 'all' },
  { id: 'zoho',           label: 'Zoho CRM',       description: 'International SMB CRM — calls, events, and tasks sync',     icon: '🟧',  badge: null,      verticals: 'all' },
  // Vertical-specific
  { id: 'clio',           label: 'Clio',           description: 'Legal practice management — calls logged as Communications', icon: '⚖️',  badge: null,      verticals: ['legal'] },
  { id: 'filevine',       label: 'Filevine',       description: 'Personal-injury legal CRM — calls logged as Notes on matters', icon: '📁',  badge: null,      verticals: ['legal'] },
  { id: 'mycase',         label: 'MyCase',         description: 'Legal practice management — case and document sync',      icon: '📂',  badge: null,      verticals: ['legal'] },
  { id: 'follow_up_boss', label: 'Follow Up Boss', description: 'Real estate CRM — lead routing and follow-up sync',       icon: '🏠',  badge: null,      verticals: ['real_estate'] },
  { id: 'servicetitan',   label: 'ServiceTitan',   description: 'Home services — job booking and dispatch sync',           icon: '🔧',  badge: null,      verticals: ['home_services'] },
  { id: 'jobber',         label: 'Jobber',         description: 'Home services — quoting, scheduling, invoicing',          icon: '🛠️',  badge: null,      verticals: ['home_services'] },
  { id: 'dentrix',        label: 'Dentrix',        description: 'Dental PMS — two-way appointment and patient record sync', icon: '🦷', badge: null,     verticals: ['dental'] },
  { id: 'eaglesoft',      label: 'Eaglesoft',      description: 'Dental PMS — patient and treatment plan sync',            icon: '🪺',  badge: null,      verticals: ['dental'] },
  { id: 'open_dental',    label: 'Open Dental',    description: 'Dental PMS — open-source records sync',                   icon: '🦷',  badge: null,      verticals: ['dental'] },
  { id: 'applied_epic',   label: 'Applied Epic',   description: 'Insurance agency management — policy and client sync',    icon: '📋',  badge: null,      verticals: ['insurance'] },
];

export default function IntegrationsPage() {
  const vertical = useVertical();
  const toast = useToast();
  const { data } = useSWR('integrations', () => integrationsApi.list());
  const { data: googleStatus, error: googleStatusError } = useSWR(
    'integrations/google-calendar/status',
    () => integrationsApi.googleCalendarStatus()
  );
  const connected = ((data as any)?.data ?? []) as {
    provider: string;
    status: string;
    lastSyncedAt?: string;
    errorMessage?: string | null;
    metadata?: { account_email?: string; calendar_id?: string };
  }[];
  const connectedMap = Object.fromEntries(connected.map((i) => [i.provider, i]));
  const [syncing, setSyncing] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null);
  const [filevineModalOpen, setFilevineModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('google_connected');
    const err = params.get('google_error');
    if (!ok && !err) return;
    if (ok) toast.success('Google Calendar connected');
    if (err) toast.error(googleOAuthErrorMessage(err));
    window.history.replaceState({}, '', window.location.pathname);
    void mutate('integrations');
    void mutate('integrations/google-calendar/status');
  }, [toast]);

  // Beta: only CRMs with a real connect path (OAuth or Filevine PAT).
  const WIRED_CRM_IDS = new Set(['hubspot', 'salesforce', 'clio', 'filevine', 'zoho']);
  const visibleCrmProviders = CRM_PROVIDERS.filter(
    (p) =>
      WIRED_CRM_IDS.has(p.id) &&
      (p.verticals === 'all' || p.verticals.includes(vertical.id))
  );

  async function handleDisconnect(provider: string) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    if (provider === 'google_calendar') {
      await integrationsApi.disconnectGoogleCalendar();
    } else {
      await integrationsApi.disconnect(provider);
    }
    await mutate('integrations');
    await mutate('integrations/google-calendar/status');
    toast.success('Disconnected');
  }

  async function handleConnectGoogle() {
    setConnectingGoogle(true);
    setGoogleConnectError(null);
    try {
      const { url } = await integrationsApi.connectGoogleCalendar('/settings/integrations');
      window.location.href = url;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not start Google Calendar connect. Try again.';
      setGoogleConnectError(message);
      toast.error(message);
      setConnectingGoogle(false);
    }
  }

  async function handleHubSpotSync() {
    setSyncing(true);
    try {
      await integrationsApi.syncHubspot();
      setTimeout(() => mutate('integrations'), 3000);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Integrations</h1>
        <p className="text-gray-500 mt-1">Connect Google Calendar to book appointments for real, plus the CRMs that are live in beta.</p>
      </div>

      {/* ── Calendar ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Calendar</p>
        <div className="space-y-4">
          <GoogleCalendarCard
            connecting={connectingGoogle}
            connectError={googleConnectError}
            onConnect={handleConnectGoogle}
            onDisconnect={() => handleDisconnect('google_calendar')}
            {...(connectedMap['google_calendar'] && { integration: connectedMap['google_calendar'] })}
            {...(googleStatus && { status: googleStatus })}
            {...(googleStatusError && { statusError: googleStatusError })}
          />
          <div className="card p-5 flex items-center gap-5">
            <div className="text-3xl">📆</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">Microsoft 365 / Outlook</p>
                <span className="badge badge-gray">Coming soon</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Outlook calendar OAuth is not available yet. Google Calendar or office hours is enough to go live.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CRM / Practice Management — filtered by vertical ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">CRM & {vertical.businessNoun.charAt(0).toUpperCase() + vertical.businessNoun.slice(1)} Management</p>
        <p className="text-sm text-gray-500 mb-3">
          Connect your CRM or {vertical.businessNoun} management system for two-way {vertical.contactNoun} and {vertical.appointmentNoun} sync.
        </p>
        <div className="space-y-4">
          {visibleCrmProviders.map((provider) => {
            const integration = connectedMap[provider.id];
            const isConnected = integration?.status === 'connected';
            const isHubSpot = provider.id === 'hubspot';
            const isSalesforce = provider.id === 'salesforce';
            const isClio = provider.id === 'clio';
            const isFilevine = provider.id === 'filevine';
            const isZoho = provider.id === 'zoho';
            // Phase 13 — CRMs with real backend adapters.
            const isWired = isHubSpot || isSalesforce || isClio || isFilevine || isZoho;
            // OAuth flow CRMs (vs API-key Filevine which uses a modal).
            const isOAuth = isHubSpot || isSalesforce || isClio || isZoho;

            return (
              <div key={provider.id} className="card p-5 flex items-center gap-5">
                <div className="text-3xl">{provider.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{provider.label}</p>
                    {isConnected ? (
                      <span className="badge badge-green flex items-center gap-1">
                        <CheckCircle size={11} /> Connected
                      </span>
                    ) : (
                      <span className="badge badge-gray">{isHubSpot ? 'Not connected' : 'Custom setup'}</span>
                    )}
                    {provider.badge && !isConnected && (
                      <span className={`badge ${provider.badge === 'Popular' ? 'badge-green' : 'badge-blue'}`}>
                        {provider.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{provider.description}</p>
                  {isConnected && integration?.lastSyncedAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last synced {new Date(integration.lastSyncedAt).toLocaleString()}
                    </p>
                  )}
                  {isConnected && integration?.errorMessage && (
                    <p className="text-xs text-red-600 mt-1 bg-red-50 border border-red-100 rounded px-2 py-1">
                      ⚠️ Last sync failed: {integration.errorMessage}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isWired ? (
                    isConnected ? (
                      <>
                        {isHubSpot && (
                          <button
                            onClick={handleHubSpotSync}
                            disabled={syncing}
                            className="btn-secondary text-sm flex items-center gap-1.5"
                          >
                            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing…' : 'Sync now'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnect(provider.id)}
                          className="btn-danger text-sm"
                        >
                          <Trash2 size={14} /> Disconnect
                        </button>
                      </>
                    ) : isOAuth ? (
                      <a
                        href={
                          provider.id === 'hubspot'
                            ? integrationsApi.connectHubspotUrl()
                            : provider.id === 'salesforce'
                              ? integrationsApi.connectSalesforceUrl()
                              : provider.id === 'clio'
                                ? integrationsApi.connectClioUrl()
                                : provider.id === 'zoho'
                                  ? integrationsApi.connectZohoUrl()
                                  : integrationsApi.connectUrl(provider.id)
                        }
                        className="btn-primary text-sm flex items-center gap-1.5"
                      >
                        <ExternalLink size={13} /> Connect {provider.label}
                      </a>
                    ) : isFilevine ? (
                      <button
                        onClick={() => setFilevineModalOpen(true)}
                        className="btn-primary text-sm flex items-center gap-1.5"
                      >
                        <KeyRound size={13} /> Connect Filevine
                      </button>
                    ) : null
                  ) : (
                    <a
                      href={`mailto:${BRAND_SUPPORT_EMAIL}?subject=Integration — ${provider.label}`}
                      className="btn-primary text-sm flex items-center gap-1.5"
                    >
                      <Mail size={13} /> Request access
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FilevineCredentialsModal
        open={filevineModalOpen}
        onClose={() => setFilevineModalOpen(false)}
        onSuccess={() => mutate('integrations')}
      />
    </div>
  );
}

function GoogleCalendarCard({
  integration,
  status,
  statusError,
  connecting,
  connectError,
  onConnect,
  onDisconnect,
}: {
  integration?: {
    status: string;
    errorMessage?: string | null;
    metadata?: { account_email?: string; calendar_id?: string };
  };
  status?: {
    configured: boolean;
    connected: boolean;
    accountEmail: string | null;
    calendarId: string | null;
    errorMessage: string | null;
  };
  statusError?: unknown;
  connecting: boolean;
  connectError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const isConnected = status?.connected || integration?.status === 'connected';
  const accountEmail =
    status?.accountEmail ?? integration?.metadata?.account_email ?? null;
  const errorMessage = status?.errorMessage ?? integration?.errorMessage ?? null;
  const configured = status?.configured;
  const statusFailed = Boolean(statusError);

  return (
    <div className="card p-5 flex items-start gap-5">
      <div className="text-3xl">📅</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900">Google Calendar</p>
          {isConnected ? (
            <span className="badge badge-green flex items-center gap-1">
              <CheckCircle size={11} /> Connected
            </span>
          ) : configured === false ? (
            <span className="badge badge-gray">Not configured</span>
          ) : (
            <span className="badge badge-gray">Not connected</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {isConnected
            ? 'The AI can check availability and book appointments on this calendar.'
            : 'Connect so the AI can offer live slots and write events when a caller books.'}
        </p>
        {isConnected && accountEmail && (
          <p className="text-xs text-gray-400 mt-1">Signed in as {accountEmail}</p>
        )}
        {errorMessage && (
          <p className="text-xs text-red-600 mt-1 bg-red-50 border border-red-100 rounded px-2 py-1">
            {isConnected ? 'Last calendar error: ' : 'Connection error: '}
            {errorMessage}
          </p>
        )}
        {!isConnected && configured === false && (
          <p className="text-sm text-amber-800 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Google Calendar OAuth is not set on this server yet. Add{' '}
            <code className="text-xs">GOOGLE_CLIENT_ID</code> /{' '}
            <code className="text-xs">GOOGLE_CLIENT_SECRET</code> on Railway and the
            redirect URI in Google Cloud Console (see{' '}
            <code className="text-xs">docs/GOOGLE_CALENDAR_SETUP.md</code>). Office hours
            still let you go live without booking.
          </p>
        )}
        {connectError && (
          <p className="text-sm text-red-700 mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {connectError}
          </p>
        )}
        {statusFailed && !connectError && configured === undefined && (
          <p className="text-sm text-red-700 mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            Could not load calendar status. Refresh the page, or try Connect — you&apos;ll
            see a clear error if Google isn&apos;t set up yet.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isConnected ? (
          <button onClick={onDisconnect} className="btn-danger text-sm">
            <Trash2 size={14} /> Disconnect
          </button>
        ) : configured === false ? (
          <button type="button" disabled className="btn-secondary text-sm opacity-60 cursor-not-allowed">
            Connect unavailable
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <ExternalLink size={13} />
            {connecting ? 'Redirecting to Google…' : 'Connect Google'}
          </button>
        )}
      </div>
    </div>
  );
}
