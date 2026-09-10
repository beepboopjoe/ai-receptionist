// Shared go-live / billing labels for the platform clients list.
// Mirrors apps/dashboard/src/lib/useGoLive.ts hard prerequisites
// (phone or pending port, Grok voice, open hours, transfer number).
import {
  ALL_GROK_VOICES,
  getPlan,
  resolvePlanLimits,
} from '@ai-receptionist/shared';

export type GoLiveBlocker = 'phone' | 'voice' | 'hours' | 'transfer';

export type BillingKind = 'promo' | 'trial' | 'paid' | 'suspended' | 'canceled' | 'unknown';

export function hasOpenOfficeHours(hours: unknown): boolean {
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

export function hasGrokVoice(voiceName: unknown): boolean {
  const name = String(voiceName ?? '').toLowerCase();
  return (ALL_GROK_VOICES as readonly string[]).includes(name);
}

export function computeGoLiveBlockers(input: {
  hasInboundPhone: boolean;
  hasPendingPort: boolean;
  voiceName: unknown;
  officeHours: unknown;
  transferNumber: unknown;
}): GoLiveBlocker[] {
  const blockers: GoLiveBlocker[] = [];
  if (!input.hasInboundPhone && !input.hasPendingPort) blockers.push('phone');
  if (!hasGrokVoice(input.voiceName)) blockers.push('voice');
  if (!hasOpenOfficeHours(input.officeHours)) blockers.push('hours');
  if (!String(input.transferNumber ?? '').trim()) blockers.push('transfer');
  return blockers;
}

export function billingKind(input: {
  plan: string;
  subscriptionStatus: string | null;
  promoTrial: boolean;
}): BillingKind {
  if (input.subscriptionStatus === 'suspended') return 'suspended';
  if (input.subscriptionStatus === 'canceled') return 'canceled';
  if (input.promoTrial) return 'promo';
  if (input.plan === 'trial' || input.subscriptionStatus === 'trialing') return 'trial';
  if (input.subscriptionStatus === 'active') return 'paid';
  return 'unknown';
}

/** Monthly list price in cents — sourced from shared PLANS, not a stale copy. */
export function planPriceCents(planKey: string): number {
  return Math.round((getPlan(planKey)?.monthlyPrice ?? 0) * 100);
}

/**
 * Promo trials are complimentary — they must not inflate founder MRR.
 * Only Stripe-active / trialing paid rows count.
 */
export function countsTowardMrr(input: {
  subscriptionStatus: string | null;
  promoTrial: boolean;
}): boolean {
  if (input.promoTrial) return false;
  return input.subscriptionStatus === 'active' || input.subscriptionStatus === 'trialing';
}

export function resolveIncludedMinutes(input: {
  plan: string;
  minutesOverride: number | null;
  legacyPricing?: boolean | null;
}): { minutesIncluded: number; unlimited: boolean } {
  if (input.minutesOverride != null) {
    return {
      minutesIncluded: input.minutesOverride,
      unlimited: input.minutesOverride < 0,
    };
  }
  const plan = getPlan(input.plan);
  if (!plan) return { minutesIncluded: 0, unlimited: false };
  const { minutes } = resolvePlanLimits(
    plan,
    input.legacyPricing == null ? {} : { legacyPricing: input.legacyPricing },
  );
  if (minutes < 0) return { minutesIncluded: 0, unlimited: true };
  return { minutesIncluded: minutes, unlimited: false };
}
