'use client';
// Prerequisite-aware go-live status for Home, sidebar, and Workflows.
import useSWR from 'swr';
import {
  settingsApi,
  phoneNumbersApi,
  integrationsApi,
  setupApi,
  type PortRequestRow,
} from './api';
import { usePlan } from './usePlan';
import {
  ALL_GROK_VOICES,
  DEFAULT_PUBLIC_GROK_VOICE,
} from '@ai-receptionist/shared';

/** Public + legacy — a saved Eve/Ara/etc. still counts as a picked Grok voice. */
export const GROK_VOICE_IDS = ALL_GROK_VOICES;

export type GoLiveStepId =
  | 'knowledge'
  | 'phone'
  | 'answering'
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
  const { data: setupStatus, isLoading: setupLoading } = useSWR('setup-status', () =>
    setupApi.status(),
  );
  const { plan } = usePlan();
  const isTrial = plan === 'trial';

  const loading =
    settingsLoading ||
    phonesLoading ||
    portsLoading ||
    hoursLoading ||
    integrationsLoading ||
    setupLoading;

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
  const phoneReady = hasPhone;

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

  const inboundMode = String(settings?.inboundRoutingMode ?? setupStatus?.inboundRoutingMode ?? 'ai_always');
  const hasKnowledge = Boolean(setupStatus?.hasWebsiteImport || setupStatus?.hasBusinessContext);
  const answeringDone = inboundMode === 'ai_always' || hasTransfer;

  const steps: GoLiveStep[] = [
    {
      id: 'knowledge',
      title: 'Tell Telfin about your business',
      desc: hasKnowledge
        ? 'Telfin already has notes to answer with. Add more any time.'
        : 'Paste your website — we pull services, hours, and FAQs. Or type a few facts. You can skip.',
      href: '/setup',
      cta: hasKnowledge ? 'Review what we know' : 'Paste your website',
      done: hasKnowledge,
    },
    {
      id: 'phone',
      title: 'Get your public number',
      desc: hasPhone
        ? 'This is the number callers dial. Forward your existing line to it if you already have one.'
        : hasPendingPort
          ? 'A port is in progress, but go-live uses the number we assign today — forwarding works now.'
          : isTrial
            ? 'Free does not include a public number. Upgrade (Starter includes 1) when you are ready to go live.'
            : 'Paid plans assign a public number the same day. Forward your existing line to it.',
      href: hasPhone ? '/settings/phone-numbers' : isTrial ? '/billing' : '/setup',
      cta: hasPhone ? 'See forwarding steps' : isTrial ? 'Upgrade to get a number' : 'Get your public number',
      done: phoneReady,
    },
    {
      id: 'answering',
      title: 'Who answers first?',
      desc:
        inboundMode === 'staff_first' || inboundMode === 'overflow_ai'
          ? 'Your team first, then Telfin if nobody picks up.'
          : inboundMode === 'after_hours_ai'
            ? 'Your team during hours; Telfin after hours.'
            : 'Telfin answers everything. Switch to team-first any time.',
      href: '/setup',
      cta: 'Choose who answers',
      done: answeringDone,
    },
    {
      id: 'voice',
      title: 'Pick a voice',
      desc: 'Choose Aurora, Castor, Cosmo, or Zenith — Telfin voices used on every live call.',
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
      title: 'Add your team phone number',
      desc: 'We ring this Staff Transfer Number when the team should answer first, for Join call, and for your own test call.',
      href: '/settings/voice-agent',
      cta: 'Add team number',
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
  const requiredSteps = steps.filter((s) => s.id !== 'knowledge');
  const completedCount = requiredSteps.filter((s) => s.done).length;

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
    requiredCount: requiredSteps.length,
  };
}
