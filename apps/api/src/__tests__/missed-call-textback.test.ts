// ============================================================
// Missed-call SMS text-back — decision helpers, copy, wiring.
// No live carrier / DB.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMissedCallTextBackBody,
  callHasConversationTranscript,
  evaluateMissedCallTextBack,
  formatPublicNumberForSms,
  hangupShouldAttemptTextBack,
  isMissedCallTextBackEnabled,
  MISSED_CALL_SMS_TEMPLATE,
  MISSED_CALL_SMS_TYPE,
  MISSED_CALL_TEXTBACK_PREF,
} from '../modules/sms/missed-call-textback.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

function dash(rel: string): string {
  return readFileSync(join(dashboardRoot, rel), 'utf8');
}

describe('missed-call text-back toggle', () => {
  it('defaults ON when prefs are missing or omitted', () => {
    expect(isMissedCallTextBackEnabled(undefined)).toBe(true);
    expect(isMissedCallTextBackEnabled(null)).toBe(true);
    expect(isMissedCallTextBackEnabled({})).toBe(true);
    expect(isMissedCallTextBackEnabled({ appointmentConfirmation: true })).toBe(true);
    expect(isMissedCallTextBackEnabled({ [MISSED_CALL_TEXTBACK_PREF]: true })).toBe(true);
  });

  it('turns off only when explicitly false', () => {
    expect(isMissedCallTextBackEnabled({ [MISSED_CALL_TEXTBACK_PREF]: false })).toBe(false);
  });
});

describe('missed-call text-back decision', () => {
  const base = {
    hasTranscript: false,
    enabled: true,
    callerPhone: '+15551234567',
    alreadyClaimed: false,
    recentTextBack: false,
  };

  it('sends for a real inbound miss', () => {
    expect(evaluateMissedCallTextBack({ ...base, direction: 'inbound', status: 'missed' })).toEqual({
      ok: true,
    });
    expect(evaluateMissedCallTextBack({ ...base, status: 'completed' })).toEqual({ ok: true });
    expect(evaluateMissedCallTextBack({ ...base, status: 'active' })).toEqual({ ok: true });
  });

  it('skips outbound, test dials, and staff-answered transfers', () => {
    expect(evaluateMissedCallTextBack({ ...base, isOutbound: true })).toEqual({
      ok: false,
      reason: 'outbound',
    });
    expect(evaluateMissedCallTextBack({ ...base, direction: 'outbound' })).toEqual({
      ok: false,
      reason: 'outbound',
    });
    expect(evaluateMissedCallTextBack({ ...base, direction: 'test' })).toEqual({
      ok: false,
      reason: 'outbound',
    });
    expect(evaluateMissedCallTextBack({ ...base, status: 'transferred' })).toEqual({
      ok: false,
      reason: 'staff_answered',
    });
  });

  it('skips conversations, opt-out toggle, missing caller, and dedup', () => {
    expect(evaluateMissedCallTextBack({ ...base, hasTranscript: true })).toEqual({
      ok: false,
      reason: 'had_conversation',
    });
    expect(evaluateMissedCallTextBack({ ...base, enabled: false })).toEqual({
      ok: false,
      reason: 'disabled',
    });
    expect(evaluateMissedCallTextBack({ ...base, callerPhone: '  ' })).toEqual({
      ok: false,
      reason: 'no_caller',
    });
    expect(evaluateMissedCallTextBack({ ...base, alreadyClaimed: true })).toEqual({
      ok: false,
      reason: 'already_sent',
    });
    expect(evaluateMissedCallTextBack({ ...base, recentTextBack: true })).toEqual({
      ok: false,
      reason: 'recent_textback',
    });
  });

  it('texts on staff-first / overflow hangup, not on the AI-answered hangup', () => {
    expect(hangupShouldAttemptTextBack('overflow')).toBe(true);
    expect(hangupShouldAttemptTextBack('forward')).toBe(true);
    expect(hangupShouldAttemptTextBack('ai')).toBe(false);
    expect(hangupShouldAttemptTextBack(undefined)).toBe(false);
  });
});

describe('missed-call text-back copy', () => {
  it('names the business and public number without vendor claims', () => {
    const body = buildMissedCallTextBackBody({
      businessName: 'Downtown Dental',
      publicNumber: '+14155551234',
    });
    expect(body).toContain('Sorry we missed you');
    expect(buildMissedCallTextBackBody({
      businessName: 'Downtown Dental',
      publicNumber: '+14155551234',
      language: 'es',
    })).toMatch(/Perdón que no pudimos atenderle/);
    expect(body).toContain('Downtown Dental');
    expect(body).toContain('(415) 555-1234');
    expect(body).toMatch(/callback/i);
    expect(body).not.toMatch(/Grok|Telnyx|xAI|10DLC registered/i);
    expect(formatPublicNumberForSms('+14155551234')).toBe('(415) 555-1234');
    expect(formatPublicNumberForSms(null)).toBeNull();
  });

  it('treats empty or missing transcript as a miss', () => {
    expect(callHasConversationTranscript(null)).toBe(false);
    expect(callHasConversationTranscript([])).toBe(false);
    expect(callHasConversationTranscript([{ role: 'agent', text: '' }])).toBe(false);
    expect(callHasConversationTranscript([{ role: 'agent', text: 'Hi, thanks for calling.' }])).toBe(
      true,
    );
  });
});

describe('missed-call text-back wiring (source)', () => {
  it('sends through sendTenantSms and claims one notification per call', () => {
    const service = read('modules/sms/missed-call-textback.ts');
    expect(service).toContain('sendTenantSms');
    expect(service).toContain("source: 'missed_call_textback'");
    expect(service).toContain('cacheSetNx');
    expect(service).toContain('isUniqueViolation');
    expect(service).toContain(MISSED_CALL_SMS_TYPE);
    expect(service).toContain(MISSED_CALL_SMS_TEMPLATE);
    expect(service).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);

    const send = read('modules/sms/send-tenant-sms.ts');
    expect(send).toContain("'missed_call_textback'");
    expect(send).toContain('getTenantDemoFlags');
    expect(send).toContain('notesHaveSmsOptOut');
    expect(send).toContain("code: 'upgrade_required'");
    expect(send).toContain("pushActivity(params.tenantId, 'sms_sent'");

    const sql = read('db/migrations/0046_missed_call_textback.sql');
    expect(sql).toContain('notifications_missed_call_sms_call_uniq');
    expect(sql).toContain("type = 'missed_call_sms'");
  });

  it('hooks call.missed and inbound hangup including staff-first overflow', () => {
    const stream = read('modules/telephony/media-stream.handler.ts');
    expect(stream).toContain("emitWebhook(tenantId, 'call.missed'");
    expect(stream).toContain('maybeSendMissedCallTextBack');
    expect(stream).toContain("reason: 'missed'");
    expect(stream).toContain('!isOutbound');

    const hook = read('modules/telephony/telnyx-webhook.handler.ts');
    expect(hook).toContain('scheduleMissedCallTextBackOnHangup');
    expect(hook).toContain('routing: state.routing');
    expect(hook).toContain('staff-first / overflow');
    expect(hook).not.toContain('durationMs >= 15_000');
    expect(hook).not.toMatch(/sendSms\(/);
  });

  it('merges the settings toggle and shows plain-language UI', () => {
    const settings = read('modules/admin/settings.service.ts');
    expect(settings).toContain('notificationPreferences');
    expect(settings).toContain('...prior, ...input.notificationPreferences');

    const card = dash('components/settings/inbound-routing-card.tsx');
    expect(card).toContain('Text callers back when you miss a call');
    expect(card).toContain('missedCallTextBack');
    expect(card).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
    expect(card).not.toMatch(/10DLC registered/i);

    const notes = dash('app/(app)/settings/notifications/page.tsx');
    expect(notes).toContain('missedCallTextBack');
    expect(notes).toContain('Text callers back when you miss a call');

    const section = dash('lib/section-meta.ts');
    expect(section).toContain("href: '/settings/phone-numbers'");
  });
});
