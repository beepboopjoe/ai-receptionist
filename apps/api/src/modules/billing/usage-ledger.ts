// ============================================================
// Usage ledger — pure estimate + event builders (no DB).
//
// Rates are documented estimates for internal COGS. Stripe remains
// the customer invoice. Do not treat these as live carrier quotes.
// ============================================================

export type UsageEventType =
  | 'ai_minutes'
  | 'telnyx_inbound'
  | 'telnyx_outbound'
  | 'telnyx_sms'
  | 'number_monthly'
  | 'grok_estimate';

export interface UsageRateConfig {
  /** Estimate. Telnyx US inbound voice is typically well under 1¢/min. */
  telnyxInboundCentsPerMin: number;
  /** Estimate. Telnyx US outbound voice is typically well under 1¢/min. */
  telnyxOutboundCentsPerMin: number;
  /** Estimate per SMS segment. */
  telnyxSmsCents: number;
  /** Estimate. Internal model in billing.types.ts uses ~$0.07 fully loaded. */
  grokCentsPerMin: number;
}

/** Defaults match apps/api config. Documented as estimates, not invoices. */
export const DEFAULT_USAGE_RATES: UsageRateConfig = {
  telnyxInboundCentsPerMin: 0.35,
  telnyxOutboundCentsPerMin: 0.7,
  telnyxSmsCents: 0.4,
  grokCentsPerMin: 6,
};

export function roundCents(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 10_000) / 10_000;
}

export function shouldRecordCallUsage(opts: {
  minutes: number;
  isDemo?: boolean;
  direction?: string;
  mode?: string;
}): boolean {
  if (!Number.isFinite(opts.minutes) || opts.minutes <= 0) return false;
  if (opts.isDemo) return false;
  if (opts.direction === 'test') return false;
  if (opts.mode === 'demo' || opts.mode === 'self_test') return false;
  return true;
}

export function estimateTelnyxCallCents(
  direction: 'inbound' | 'outbound',
  minutes: number,
  rates: UsageRateConfig,
): number {
  const rate =
    direction === 'outbound' ? rates.telnyxOutboundCentsPerMin : rates.telnyxInboundCentsPerMin;
  return roundCents(minutes * rate);
}

export function estimateGrokCents(minutes: number, rates: UsageRateConfig): number {
  return roundCents(minutes * rates.grokCentsPerMin);
}

export interface UsageEventWrite {
  eventType: UsageEventType;
  quantity: number;
  estimatedCents: number;
  direction?: string;
  callId?: string;
  metadata?: Record<string, unknown>;
}

export function buildCallUsageEvents(opts: {
  minutes: number;
  direction: 'inbound' | 'outbound';
  callId: string;
  rates: UsageRateConfig;
  /** When false, only Telnyx minutes are recorded (forward / overflow to staff). */
  aiHandled?: boolean;
  isDemo?: boolean;
  mode?: string;
  callDirection?: string;
}): UsageEventWrite[] | null {
  if (
    !shouldRecordCallUsage({
      minutes: opts.minutes,
      isDemo: opts.isDemo,
      direction: opts.callDirection,
      mode: opts.mode,
    })
  ) {
    return null;
  }

  const telnyxType: UsageEventType =
    opts.direction === 'outbound' ? 'telnyx_outbound' : 'telnyx_inbound';
  const telnyxCents = estimateTelnyxCallCents(opts.direction, opts.minutes, opts.rates);
  const events: UsageEventWrite[] = [
    {
      eventType: telnyxType,
      quantity: opts.minutes,
      estimatedCents: telnyxCents,
      callId: opts.callId,
      direction: opts.direction,
      metadata: { estimate: true, source: 'config_rate' },
    },
  ];

  if (opts.aiHandled !== false) {
    events.unshift({
      eventType: 'ai_minutes',
      quantity: opts.minutes,
      estimatedCents: 0,
      callId: opts.callId,
      direction: opts.direction,
    });
    events.push({
      eventType: 'grok_estimate',
      quantity: opts.minutes,
      estimatedCents: estimateGrokCents(opts.minutes, opts.rates),
      callId: opts.callId,
      direction: opts.direction,
      metadata: { estimate: true, source: 'config_rate' },
    });
  }

  return events;
}

export function buildSmsUsageEvent(
  direction: 'inbound' | 'outbound',
  rates: UsageRateConfig,
): UsageEventWrite {
  return {
    eventType: 'telnyx_sms',
    quantity: 1,
    estimatedCents: roundCents(rates.telnyxSmsCents),
    direction,
    metadata: { estimate: true, source: 'config_rate' },
  };
}

export function buildNumberMonthlyEvent(
  monthlyCostCents: number,
  phoneE164: string,
): UsageEventWrite | null {
  if (monthlyCostCents <= 0) return null;
  return {
    eventType: 'number_monthly',
    quantity: 1,
    estimatedCents: monthlyCostCents,
    metadata: { phoneE164 },
  };
}

export interface UsageLedgerSummary {
  aiMinutes: number;
  telnyxInboundCents: number;
  telnyxOutboundCents: number;
  telnyxSmsCents: number;
  telnyxSmsCount: number;
  grokEstimateCents: number;
  numberMonthlyCents: number;
  estimatedCogsCents: number;
}

/**
 * Aggregate persisted events + current inbound number monthly (from
 * tenant_phone_numbers). Does not invent rates at read time.
 */
export function summarizeUsageEvents(
  events: Array<{ eventType: string; quantity: number; estimatedCents: number }>,
  numberMonthlyCents: number,
): UsageLedgerSummary {
  let aiMinutes = 0;
  let telnyxInboundCents = 0;
  let telnyxOutboundCents = 0;
  let telnyxSmsCents = 0;
  let telnyxSmsCount = 0;
  let grokEstimateCents = 0;

  for (const e of events) {
    switch (e.eventType) {
      case 'ai_minutes':
        aiMinutes += e.quantity;
        break;
      case 'telnyx_inbound':
        telnyxInboundCents += e.estimatedCents;
        break;
      case 'telnyx_outbound':
        telnyxOutboundCents += e.estimatedCents;
        break;
      case 'telnyx_sms':
        telnyxSmsCents += e.estimatedCents;
        telnyxSmsCount += e.quantity;
        break;
      case 'grok_estimate':
        grokEstimateCents += e.estimatedCents;
        break;
      default:
        break;
    }
  }

  const numbers = Number.isFinite(numberMonthlyCents) ? Math.max(0, numberMonthlyCents) : 0;
  return {
    aiMinutes: roundCents(aiMinutes),
    telnyxInboundCents: roundCents(telnyxInboundCents),
    telnyxOutboundCents: roundCents(telnyxOutboundCents),
    telnyxSmsCents: roundCents(telnyxSmsCents),
    telnyxSmsCount: roundCents(telnyxSmsCount),
    grokEstimateCents: roundCents(grokEstimateCents),
    numberMonthlyCents: numbers,
    estimatedCogsCents: roundCents(
      telnyxInboundCents + telnyxOutboundCents + telnyxSmsCents + grokEstimateCents + numbers,
    ),
  };
}
