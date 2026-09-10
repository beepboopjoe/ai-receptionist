'use client';
import useSWR, { mutate } from 'swr';
import { integrationsApi } from '@/lib/api';
import { CheckCircle, ExternalLink, Trash2, Mail, RefreshCw, KeyRound } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';
import type { Vertical } from '@/lib/verticals';
import { useState } from 'react';
import { FilevineCredentialsModal } from '@/components/integrations/filevine-credentials-modal';
import { BRAND_SUPPORT_EMAIL } from '@/lib/brand';

// Beta: only list providers whose Connect URL exists on the API.
// Google Calendar has a booking adapter but no OAuth routes — Connect 404s
// in production. Hours alone is enough to go live (see useGoLive).
const CALENDAR_COMING_SOON = [
  {
    id: 'google_calendar',
    label: 'Google Calendar',
    description: 'Live booking is not connectable yet. Set office hours to go live without a calendar.',
    icon: '📅',
  },
];

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
  const { data } = useSWR('integrations', () => integrationsApi.list());
  const connected = ((data as any)?.data ?? []) as {
    provider: string;
    status: string;
    lastSyncedAt?: string;
    errorMessage?: string | null;
  }[];
  const connectedMap = Object.fromEntries(connected.map((i) => [i.provider, i]));
  const [syncing, setSyncing] = useState(false);
  const [filevineModalOpen, setFilevineModalOpen] = useState(false);

  // Beta: only CRMs with a real connect path (OAuth or Filevine PAT).
  const WIRED_CRM_IDS = new Set(['hubspot', 'salesforce', 'clio', 'filevine', 'zoho']);
  const visibleCrmProviders = CRM_PROVIDERS.filter(
    (p) =>
      WIRED_CRM_IDS.has(p.id) &&
      (p.verticals === 'all' || p.verticals.includes(vertical.id))
  );

  async function handleDisconnect(provider: string) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    await integrationsApi.disconnect(provider);
    await mutate('integrations');
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
        <p className="text-gray-500 mt-1">Connect the tools that are live in beta — HubSpot and a few CRMs</p>
      </div>

      {/* ── Calendar — honest about the missing OAuth routes ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Calendar</p>
        <div className="space-y-4">
          {CALENDAR_COMING_SOON.map((provider) => {
            const integration = connectedMap[provider.id];
            const isConnected = integration?.status === 'connected';

            return (
              <div key={provider.id} className="card p-5 flex items-center gap-5">
                <div className="text-3xl">{provider.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{provider.label}</p>
                    {isConnected ? (
                      <span className="badge badge-green flex items-center gap-1">
                        <CheckCircle size={11} /> Connected
                      </span>
                    ) : (
                      <span className="badge badge-gray">Coming soon</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{provider.description}</p>
                </div>
                {isConnected ? (
                  <button
                    onClick={() => handleDisconnect(provider.id)}
                    className="btn-danger text-sm shrink-0"
                  >
                    <Trash2 size={14} /> Disconnect
                  </button>
                ) : null}
              </div>
            );
          })}
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
