'use client';
// Prerequisite-aware go-live status for Home, sidebar, and Workflows.
import useSWR from 'swr';
import {
  settingsApi,
  phoneNumbersApi,
  integrationsApi,
  type PortRequestRow,
} from './api';
import {
  ALL_GROK_VOICES,
  DEFAULT_PUBLIC_GROK_VOICE,
} from '@ai-receptionist/shared';

/** Public + legacy — a saved Eve/Ara/etc. still counts as a picked Grok voice. */
export const GROK_VOICE_IDS = ALL_GROK_VOICES;

export type GoLiveStepId =
  | 'phone'
  | 'voice'
  | 'hours'
  | 'transfer'
  | 'calendar';

export interface GoLiveStep {
  id: GoLiveStepId;
  title: string;
  desc: string;
  href: string;
  cta: string;
  done: boolean;
}

export interface GoLiveStatus {
  loading: boolean;
  /** All hard prerequisites (phone, voice, hours, transfer). Calendar is OR hours. */
  ready: boolean;
  hasPhone: boolean;
  hasPendingPort: boolean;
  hasGrokVoice: boolean;
  hasOpenHours: boolean;
  hasTransfer: boolean;
  hasCalendar: boolean;
  transferNumber: string;
  voiceName: string;
  /** Required setup cards — phone, voice, hours, transfer. */
  steps: GoLiveStep[];
  /** Calendar is optional; hours alone is enough to go live. */
  optionalStep: GoLiveStep;
  completedCount: number;
  requiredCount: number;
}

function hasOpenOfficeHours(hours: unknown): boolean {
  if (!hours || typeof hours !== 'object') return false;
  return Object.entries(hours as Record<string, unknown>).some(([key, value]) => {
    if (key === 'holidays') return false;
    if (!value || typeof value !== 'object') return false;
    const day = value as Record<string, unknown>;
    if (day.open === false) return false;
    if (typeof day.open === 'string' && day.open && typeof day.close === 'string' && day.close) {
      return true;
    }
    if (day.open === true && (day.start || day.end || day.close)) return true;
    return false;
  });
}

export function useGoLive(): GoLiveStatus {
  const { data: settingsPayload, isLoading: settingsLoading } = useSWR('settings', () =>
    settingsApi.get()
  );
  const { data: phonesPayload, isLoading: phonesLoading } = useSWR('phone-numbers', () =>
    phoneNumbersApi.list()
  );
  const { data: portsPayload, isLoading: portsLoading } = useSWR('port-requests', () =>
    phoneNumbersApi.listPortRequests()
  );
  const { data: hoursPayload, isLoading: hoursLoading } = useSWR('office-hours', () =>
    settingsApi.getOfficeHours()
  );
  const { data: integrationsPayload, isLoading: integrationsLoading } = useSWR(
    'integrations',
    () => integrationsApi.list()
  );

  const loading =
    settingsLoading || phonesLoading || portsLoading || hoursLoading || integrationsLoading;

  const settings = (settingsPayload as { settings?: Record<string, unknown> } | undefined)?.settings;
  const numbers = (phonesPayload as { data?: Array<{ phoneE164?: string; provisionStatus?: string }> } | undefined)?.data ?? [];
  const ports = ((portsPayload as { data?: PortRequestRow[] } | undefined)?.data ??
    []) as PortRequestRow[];
  const integrations = ((integrationsPayload as { data?: Array<{ provider: string; status: string }> } | undefined)
    ?.data ?? []) as Array<{ provider: string; status: string }>;

  const hasPhone = numbers.some(
    (n) =>
      typeof n.phoneE164 === 'string' &&
      n.phoneE164.startsWith('+') &&
      (n.provisionStatus ?? 'active') === 'active'
  );
  const hasPendingPort = ports.some((p) =>
    ['pending', 'submitted', 'in_progress'].includes(p.status)
  );
  const phoneReady = hasPhone || hasPendingPort;

  const voiceName = String(settings?.voiceName ?? DEFAULT_PUBLIC_GROK_VOICE).toLowerCase();
  const hasGrokVoice = (GROK_VOICE_IDS as readonly string[]).includes(voiceName);

  const hasOpenHours = hasOpenOfficeHours(hoursPayload);
  const transferNumber = String(settings?.transferNumber ?? '').trim();
  const hasTransfer = transferNumber.length > 0;

  const hasCalendar = integrations.some(
    (i) =>
      i.status === 'connected' &&
      (i.provider === 'google_calendar' || i.provider === 'microsoft_calendar')
  );

  const steps: GoLiveStep[] = [
    {
      id: 'phone',
      title: 'Get a phone number',
      desc: hasPendingPort
        ? 'A port request is in progress — your existing number is on the way.'
        : 'We’ll auto-assign a US inbound DID on go-live, or buy/port one here.',
      href: '/settings/phone-numbers',
      cta: hasPendingPort ? 'View port status' : 'Get a number',
      done: phoneReady,
    },
    {
      id: 'voice',
      title: 'Pick a Grok voice',
      desc: 'Choose Aurora, Castor, Cosmo, or Zenith — xAI Grok voices used on every live call.',
      href: '/settings/voice-agent',
      cta: 'Choose a voice',
      done: hasGrokVoice,
    },
    {
      id: 'hours',
      title: 'Set office hours',
      desc: 'Open at least one weekday so the AI knows when you are in and when to take a message.',
      href: '/settings/office-hours',
      cta: 'Set hours',
      done: hasOpenHours,
    },
    {
      id: 'transfer',
      title: 'Add a staff transfer number',
      desc: 'Required for escalations, Join call (you ring in on a live AI call), and your own test call.',
      href: '/settings/voice-agent',
      cta: 'Add transfer number',
      done: hasTransfer,
    },
  ];

  const optionalStep: GoLiveStep = {
    id: 'calendar',
    title: 'Connect a calendar (optional)',
    desc: hasCalendar
      ? 'Calendar is connected — the AI can book live.'
      : 'Hours are enough to go live. Connect a calendar later if you want the AI to book on the call.',
    href: '/settings/integrations',
    cta: 'Connect calendar',
    done: hasCalendar,
  };

  const hardReady = phoneReady && hasGrokVoice && hasOpenHours && hasTransfer;
  const completedCount = steps.filter((s) => s.done).length;

  return {
    loading,
    ready: hardReady,
    hasPhone,
    hasPendingPort,
    hasGrokVoice,
    hasOpenHours,
    hasTransfer,
    hasCalendar,
    transferNumber,
    voiceName,
    steps,
    optionalStep,
    completedCount,
    requiredCount: steps.length,
  };
}
