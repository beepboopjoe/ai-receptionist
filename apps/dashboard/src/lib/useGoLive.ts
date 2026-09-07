'use client';
// Prerequisite-aware go-live status for Home, sidebar, and Workflows.
import useSWR from 'swr';
import {
  settingsApi,
  phoneNumbersApi,
  integrationsApi,
  contactsApi,
  type PortRequestRow,
} from './api';
import { useVertical } from './useVertical';
import type { VerticalConfig } from './verticals';

export const GROK_VOICE_IDS = ['eve', 'ara', 'rex', 'sal', 'leo'] as const;

export type GoLiveStepId =
  | 'calendar'
  | 'contacts'
  | 'call_notes'
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
  /** Hard phone prerequisites (phone, voice, hours, transfer). Calendar is preferred, not required. */
  ready: boolean;
  /** Calendar + contact list + call-notes destination. */
  practiceReady: boolean;
  hasPhone: boolean;
  hasPendingPort: boolean;
  hasGrokVoice: boolean;
  hasOpenHours: boolean;
  hasTransfer: boolean;
  hasCalendar: boolean;
  hasContacts: boolean;
  hasCallNotes: boolean;
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

function hasCallNotesDestination(settings: Record<string, unknown> | undefined): boolean {
  if (!settings) return false;
  const email = String(settings.callSummaryEmail ?? '').trim();
  if (email.length > 0) return true;
  const prefs = settings.notificationPreferences;
  if (prefs && typeof prefs === 'object') {
    return Boolean((prefs as Record<string, unknown>).emailOnEveryCall);
  }
  return false;
}

export function buildGoLiveSteps(opts: {
  vertical: VerticalConfig;
  hasPendingPort: boolean;
  phoneReady: boolean;
  hasGrokVoice: boolean;
  hasOpenHours: boolean;
  hasTransfer: boolean;
  hasCalendar: boolean;
  hasContacts: boolean;
  hasCallNotes: boolean;
}): GoLiveStep[] {
  const { vertical } = opts;
  const contacts = vertical.contactNounPlural;
  const isDental = vertical.id === 'dental';
  const pmsHint =
    vertical.id === 'dental'
      ? 'CSV export from Dentrix or Open Dental works.'
      : vertical.id === 'legal'
        ? 'CSV export from Clio or your practice software works.'
        : `CSV export from your CRM works.`;

  return [
    {
      id: 'calendar',
      title: isDental ? 'Connect the practice calendar' : 'Connect a calendar',
      desc: isDental
        ? 'Share Google Calendar or Microsoft 365 so the front desk can book around real openings — hours alone can cover after-hours, but a live calendar is better.'
        : 'Google Calendar or Microsoft 365 lets the AI book live. Office hours alone is enough to answer calls without live booking.',
      href: '/settings/integrations#calendar',
      cta: 'Connect calendar',
      done: opts.hasCalendar,
    },
    {
      id: 'contacts',
      title: isDental ? 'Import your patient list' : `Import ${contacts}`,
      desc: isDental
        ? `Upload a patient CSV so returning callers are greeted by name. ${pmsHint}`
        : `Upload a CSV so the AI recognizes returning ${contacts}. ${pmsHint}`,
      href: '/contacts#import',
      cta: `Import ${contacts}`,
      done: opts.hasContacts,
    },
    {
      id: 'call_notes',
      title: isDental ? 'Where should call notes go?' : 'Where to send call notes',
      desc: isDental
        ? 'Pick the inbox that gets a summary after every call — same place a front desk would leave a sticky note.'
        : 'Set the email that receives a call summary after every conversation.',
      href: '/settings/notifications#call-notes',
      cta: 'Set call notes email',
      done: opts.hasCallNotes,
    },
    {
      id: 'phone',
      title: 'Get a phone number',
      desc: opts.hasPendingPort
        ? 'A port request is in progress — your existing number is on the way.'
        : 'Buy a local number or start a port so callers can reach your AI.',
      href: '/settings/phone-numbers',
      cta: opts.hasPendingPort ? 'View port status' : 'Get a number',
      done: opts.phoneReady,
    },
    {
      id: 'voice',
      title: 'Pick a Grok voice',
      desc: 'Choose Eve, Ara, Rex, Sal, or Leo — xAI Grok voices used on every live call.',
      href: '/settings/voice-agent',
      cta: 'Choose a voice',
      done: opts.hasGrokVoice,
    },
    {
      id: 'hours',
      title: 'Set office hours',
      desc: 'Open at least one weekday so the AI knows when you are in and when to take a message.',
      href: '/settings/office-hours',
      cta: 'Set hours',
      done: opts.hasOpenHours,
    },
    {
      id: 'transfer',
      title: 'Add a staff transfer number',
      desc: 'The number your AI rings for escalations — and for your own test call.',
      href: '/settings/voice-agent',
      cta: 'Add transfer number',
      done: opts.hasTransfer,
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
}

export function useGoLive(): GoLiveStatus {
  const vertical = useVertical();
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
  const { data: contactsPayload, isLoading: contactsLoading } = useSWR(
    'contacts-golive',
    () => contactsApi.list({ limit: 1 })
  );

  const loading =
    settingsLoading ||
    phonesLoading ||
    portsLoading ||
    hoursLoading ||
    integrationsLoading ||
    contactsLoading;

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

  const voiceName = String(settings?.voiceName ?? 'eve').toLowerCase();
  const hasGrokVoice = (GROK_VOICE_IDS as readonly string[]).includes(voiceName);

  const hasOpenHours = hasOpenOfficeHours(hoursPayload);
  const transferNumber = String(settings?.transferNumber ?? '').trim();
  const hasTransfer = transferNumber.length > 0;

  const hasCalendar = integrations.some(
    (i) =>
      i.status === 'connected' &&
      (i.provider === 'google_calendar' || i.provider === 'microsoft_calendar')
  );
  const hasContacts = ((contactsPayload as { total?: number } | undefined)?.total ?? 0) > 0;
  const hasCallNotes = hasCallNotesDestination(settings);

  const steps = buildGoLiveSteps({
    vertical,
    hasPendingPort,
    phoneReady,
    hasGrokVoice,
    hasOpenHours,
    hasTransfer,
    hasCalendar,
    hasContacts,
    hasCallNotes,
  });

  const hardReady = phoneReady && hasGrokVoice && hasOpenHours && hasTransfer;
  const practiceReady = hasCalendar && hasContacts && hasCallNotes;
  const completedCount = steps.filter((s) => s.id !== 'test_call' && s.done).length;

  return {
    loading,
    ready: hardReady,
    practiceReady,
    hasPhone,
    hasPendingPort,
    hasGrokVoice,
    hasOpenHours,
    hasTransfer,
    hasCalendar,
    hasContacts,
    hasCallNotes,
    transferNumber,
    voiceName,
    steps,
    completedCount,
  };
}
