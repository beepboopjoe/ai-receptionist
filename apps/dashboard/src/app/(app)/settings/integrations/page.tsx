'use client';
import useSWR, { mutate } from 'swr';
import { integrationsApi } from '@/lib/api';
import { CheckCircle, ExternalLink, Trash2, Phone, Mail } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';
import type { Vertical } from '@/lib/verticals';

const PROVIDERS = [
  { id: 'telnyx', label: 'Telnyx (Phone)', description: 'AI-powered inbound and outbound calling', icon: '☎️' },
  { id: 'twilio', label: 'Twilio', description: 'Phone number provisioning and SMS notifications', icon: '📞' },
  { id: 'ringcentral', label: 'RingCentral', description: 'Enterprise phone integration', icon: '🔔' },
  { id: 'google_calendar', label: 'Google Calendar', description: 'Appointment scheduling', icon: '📅' },
  { id: 'microsoft_calendar', label: 'Microsoft 365', description: 'Outlook calendar integration', icon: '📆' },
  { id: 'sendgrid', label: 'SendGrid', description: 'Email notifications', icon: '✉️' },
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
  { id: 'hubspot',        label: 'HubSpot',        description: 'CRM sync — contacts, leads, and deal pipelines',          icon: '🔗',  badge: 'Popular', verticals: 'all' },
  { id: 'salesforce',     label: 'Salesforce',     description: 'Enterprise CRM — full contact and opportunity sync',      icon: '☁️',  badge: null,      verticals: 'all' },
  // Vertical-specific
  { id: 'clio',           label: 'Clio',           description: 'Legal practice management — matter and client sync',      icon: '⚖️',  badge: null,      verticals: ['legal'] },
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
  const connected = ((data as any)?.data ?? []) as { provider: string; status: string }[];
  const connectedMap = Object.fromEntries(connected.map((i) => [i.provider, i]));

  // Show universal CRMs always; vertical-specific only when relevant.
  const visibleCrmProviders = CRM_PROVIDERS.filter(
    (p) => p.verticals === 'all' || p.verticals.includes(vertical.id)
  );

  async function handleDisconnect(provider: string) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    await integrationsApi.disconnect(provider);
    await mutate('integrations');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Integrations</h1>
        <p className="text-gray-500 mt-1">Connect your phone, calendar, and communication providers</p>
      </div>

      {/* Phone system status banner */}
      {(() => {
        const telnyx = connectedMap['telnyx'];
        if (telnyx?.status === 'connected') {
          return (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Phone size={18} className="text-emerald-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">
                  AI receptionist is answering calls at +1 (626) 517-0214
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Telnyx is connected — every inbound call is routed to Aria.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
          );
        }
        return null;
      })()}

      {/* ── Phone / Calendar / Email providers ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Phone, Calendar & Messaging</p>
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
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
                      <span className="badge badge-gray">Not connected</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{provider.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(provider.id)}
                      className="btn-danger text-sm"
                    >
                      <Trash2 size={14} /> Disconnect
                    </button>
                  ) : (
                    <a
                      href={`/api/v1/integrations/${provider.id.replace('_', '-')}/connect`}
                      className="btn-primary text-sm"
                    >
                      <ExternalLink size={14} /> Connect
                    </a>
                  )}
                </div>
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
          {visibleCrmProviders.map((provider) => (
            <div key={provider.id} className="card p-5 flex items-center gap-5">
              <div className="text-3xl">{provider.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{provider.label}</p>
                  <span className="badge badge-gray">Custom setup</span>
                  {provider.badge && (
                    <span className={`badge ${provider.badge === 'Popular' ? 'badge-green' : 'badge-blue'}`}>
                      {provider.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{provider.description}</p>
              </div>
              <div className="shrink-0">
                <a
                  href={`mailto:hello@aireceptionist.ai?subject=EHR Integration — ${provider.label}`}
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  <Mail size={13} /> Request access
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
