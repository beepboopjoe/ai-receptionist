// ============================================================
// Lean SMS agent — keywords, 10DLC error mapping, prompt JSON,
// inbound webhook wiring, Ask Telfin send path. No live carrier.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEBHOOK_EVENT_TYPES } from '@ai-receptionist/shared';
import {
  isSmsHelpKeyword,
  isSmsStopKeyword,
  inboundMatchesEscalationVocab,
  notesHaveSmsOptOut,
  withSmsOptOutNotes,
} from '../modules/sms/sms-keywords.js';
import { classifySmsSendError } from '../modules/sms/sms-send-error.js';
import {
  afterHoursHoldReply,
  parseSmsAgentDecision,
  buildSmsSystemPrompt,
} from '../modules/sms/sms-agent.prompt.js';
import { VERTICAL_ESCALATION_VOCAB } from '../modules/voice-agent/prompt-builder.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

describe('SMS keywords', () => {
  it('detects STOP / HELP as whole-message keywords', () => {
    expect(isSmsStopKeyword('STOP')).toBe(true);
    expect(isSmsStopKeyword('stopall')).toBe(true);
    expect(isSmsStopKeyword('Please stop texting me about the quote')).toBe(false);
    expect(isSmsHelpKeyword('HELP')).toBe(true);
    expect(isSmsHelpKeyword('info')).toBe(true);
    expect(isSmsHelpKeyword('I need help with my appointment')).toBe(false);
  });

  it('matches voice escalation vocab on inbound text', () => {
    expect(inboundMatchesEscalationVocab('I am in severe pain', VERTICAL_ESCALATION_VOCAB.dental)).toBe(
      true,
    );
    expect(inboundMatchesEscalationVocab('What time are you open?', VERTICAL_ESCALATION_VOCAB.dental)).toBe(
      false,
    );
  });

  it('persists an opt-out marker in contact notes', () => {
    expect(notesHaveSmsOptOut(null)).toBe(false);
    const marked = withSmsOptOutNotes('Existing note');
    expect(notesHaveSmsOptOut(marked)).toBe(true);
    expect(withSmsOptOutNotes(marked)).toBe(marked);
  });
});

describe('SMS carrier error mapping', () => {
  it('soft-fails honestly on A2P / 10DLC rejection without claiming registration', () => {
    const classified = classifySmsSendError(
      new Error('403 Forbidden: 10DLC campaign not registered for this brand'),
    );
    expect(classified.code).toBe('SmsCarrierRejected');
    expect(classified.message).toMatch(/A2P \/ 10DLC/i);
    expect(classified.message).toMatch(/not completed that registration/i);
    expect(classified.message).not.toMatch(/Telnyx|Grok|xAI/);
  });

  it('uses a generic send failure when the carrier error is unrelated', () => {
    const classified = classifySmsSendError(new Error('timeout'));
    expect(classified.code).toBe('SmsSendFailed');
    expect(classified.message).not.toMatch(/Telnyx|registered|TCPA/);
  });
});

describe('SMS agent prompt', () => {
  it('asks for JSON actions and reuses vertical escalation vocab', () => {
    const prompt = buildSmsSystemPrompt({
      practiceName: 'Bright Smile',
      vertical: 'dental',
      timezone: 'America/New_York',
      officeHours: { monday: { open: '09:00', close: '17:00' } },
      transferNumber: '+15551230000',
      businessContext: 'We are a family dental office.',
      contact: null,
      afterHours: false,
      thread: [{ direction: 'inbound', body: 'Hi, do you take new patients?' }],
      inboundBody: 'Hi, do you take new patients?',
    });
    expect(prompt).toMatch(/SMS receptionist/);
    expect(prompt).toMatch(/dental practice/i);
    expect(prompt).toMatch(/pain/);
    expect(prompt).toMatch(/"action":"reply"|"escalate"|"lead"|"hold"/);
    expect(prompt).not.toMatch(/Grok|Telnyx|xAI/);
    expect(afterHoursHoldReply('Bright Smile')).toMatch(/closed/i);
  });

  it('parses model JSON even with markdown fences', () => {
    const decided = parseSmsAgentDecision(
      '```json\n{"reply":"We are open until 5.","action":"lead","firstName":"Sam"}\n```',
    );
    expect(decided).toMatchObject({
      reply: 'We are open until 5.',
      action: 'lead',
      firstName: 'Sam',
    });
  });
});

describe('inbound SMS agent wiring (source)', () => {
  it('stores inbound SMS then runs the AI loop from the DID webhook', () => {
    const hook = readFileSync(join(srcRoot, 'modules/telephony/telnyx-webhook.handler.ts'), 'utf8');
    expect(hook).toContain("eventType === 'message.received'");
    expect(hook).toContain('handleInboundSmsAgent');
    expect(hook).toContain('ensureSmsContact');
    expect(hook).toContain("pushActivity(tenantId, 'sms_received'");
    expect(hook).toContain("emitWebhook(tenantId, 'sms.received'");
    expect(hook).toContain('telnyxMessageId');
  });

  it('gates demo accounts, respects STOP, quiet hours, and rate limits', () => {
    const agent = readFileSync(join(srcRoot, 'modules/sms/sms-agent.service.ts'), 'utf8');
    expect(agent).toContain('getTenantDemoFlags');
    expect(agent).toContain('isSmsStopKeyword');
    expect(agent).toContain('isAfterHoursCall');
    expect(agent).toContain('AI_REPLIES_PER_NUMBER_PER_HOUR');
    expect(agent).toContain("source: 'ai_inbound'");
    expect(agent).toContain('createSmsEscalation');
    expect(agent).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
  });

  it('sends Ask Telfin texts through sendTenantSms with contact upsert', () => {
    const send = readFileSync(join(srcRoot, 'modules/sms/send-tenant-sms.ts'), 'utf8');
    expect(send).toContain('ensureSmsContact');
    expect(send).toContain("code: 'upgrade_required'");
    expect(send).toContain('classifySmsSendError');
    expect(send).toContain("pushActivity(params.tenantId, 'sms_sent'");
    expect(send).toContain("emitWebhook(params.tenantId, 'sms.sent'");
    expect(send).not.toMatch(/\bTelnyx\b/);

    const router = readFileSync(join(srcRoot, 'modules/sms/sms.router.ts'), 'utf8');
    expect(router).toContain("source === 'ai_task'");
    expect(router).toContain('contactId');
  });

  it('exposes sms webhook + activity events and live-updates Messages', () => {
    expect(WEBHOOK_EVENT_TYPES).toContain('sms.received');
    expect(WEBHOOK_EVENT_TYPES).toContain('sms.sent');

    const activity = readFileSync(join(srcRoot, 'modules/activity/activity.service.ts'), 'utf8');
    expect(activity).toContain("'sms_received'");
    expect(activity).toContain("'sms_sent'");

    const feed = readFileSync(join(dashboardRoot, 'lib/useActivityFeed.ts'), 'utf8');
    expect(feed).toContain("'sms_received'");

    const inbox = readFileSync(join(dashboardRoot, 'app/(app)/messages/page.tsx'), 'utf8');
    expect(inbox).toContain('useSmsLiveSync');
    expect(inbox).toContain("'sms-conversations'");

    const thread = readFileSync(join(dashboardRoot, 'app/(app)/messages/[phone]/page.tsx'), 'utf8');
    expect(thread).toContain('useSmsLiveSync');
    expect(thread).toContain('/contacts/${thread.contactId}');

    const hooks = readFileSync(join(dashboardRoot, 'app/(app)/settings/webhooks/page.tsx'), 'utf8');
    expect(hooks).toContain("'sms.received'");
    expect(hooks).toContain("'sms.sent'");
  });
});
