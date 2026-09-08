'use client';
// Prerequisite-aware go-live status for Home, sidebar, and Workflows.
import useSWR from 'swr';
import {
  settingsApi,
  phoneNumbersApi,
  integrationsApi,
  type PortRequestRow,
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
  | 'calendar_or_hours'
  | 'test_call';

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
  steps: GoLiveStep[];
  completedCount: number;
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
  const numbers = (phonesPayload as { data?: unknown[] } | undefined)?.data ?? [];
  const ports = ((portsPayload as { data?: PortRequestRow[] } | undefined)?.data ??
    []) as PortRequestRow[];
  const integrations = ((integrationsPayload as { data?: Array<{ provider: string; status: string }> } | undefined)
    ?.data ?? []) as Array<{ provider: string; status: string }>;

  const hasPhone = numbers.length > 0;
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
        : 'Buy a local number or start a port so callers can reach your AI.',
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
      desc: 'The number your AI rings for escalations — and for your own test call.',
      href: '/settings/voice-agent',
      cta: 'Add transfer number',
      done: hasTransfer,
    },
    {
      id: 'calendar_or_hours',
      title: 'Connect a calendar (or keep hours)',
      desc: 'Calendar lets the AI book live. Hours alone is enough to go live without booking.',
      href: '/settings/integrations',
      cta: 'Connect calendar',
      done: hasCalendar || hasOpenHours,
    },
    {
      id: 'test_call',
      title: 'Call your AI',
      desc: 'Place a free test call — your AI rings the transfer number so you can hear it.',
      href: '/dashboard#test-call',
      cta: 'Make a test call',
      done: false,
    },
  ];

  const hardReady = phoneReady && hasGrokVoice && hasOpenHours && hasTransfer;
  const completedCount = steps.filter((s) => s.id !== 'test_call' && s.done).length;

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
    completedCount,
  };
}
