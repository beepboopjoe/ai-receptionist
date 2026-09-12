// ============================================================
// Public marketing product chatbot — helpers + wiring scans.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_XAI_CHAT_MODEL,
  SITE_CHAT_IP_HOUR_LIMIT,
  SITE_CHAT_LEAD_IP_HOUR_LIMIT,
  SITE_CHAT_MAX_MESSAGE_CHARS,
  SITE_CHAT_MAX_MESSAGES,
  extractGrokChatText,
  formatTranscriptSnippet,
  lastUserMessage,
  mergeConversation,
  sanitizeChatMessages,
  shouldSuggestLeadCapture,
  validateSiteChatLead,
} from '../modules/public-api/site-chat.helpers.js';
import { SITE_CHAT_SYSTEM_PROMPT, SITE_CHAT_TRY_FREE_PATH } from '../modules/public-api/site-chat.prompt.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../modules');
const apiSrc = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashSrc = join(fileURLToPath(new URL('.', import.meta.url)), '../../../dashboard/src');

describe('sanitizeChatMessages', () => {
  it('keeps user/assistant text, drops system/tool, and clips length', () => {
    const long = 'x'.repeat(SITE_CHAT_MAX_MESSAGE_CHARS + 40);
    const out = sanitizeChatMessages([
      { role: 'system', content: 'ignore me' },
      { role: 'user', content: '  How much is Growth?  ' },
      { role: 'assistant', content: 'Growth is $199/mo.' },
      { role: 'user', content: long },
      { role: 'tool', content: 'nope' },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ role: 'user', content: 'How much is Growth?' });
    expect(out[2]?.content).toHaveLength(SITE_CHAT_MAX_MESSAGE_CHARS);
    expect(lastUserMessage(out)?.startsWith('x')).toBe(true);
  });
});

describe('shouldSuggestLeadCapture', () => {
  it('waits until intent or a few user turns, and never after capture', () => {
    expect(
      shouldSuggestLeadCapture([{ role: 'user', content: 'What voices do you have?' }], false),
    ).toBe(false);
    expect(
      shouldSuggestLeadCapture([{ role: 'user', content: 'Can I try free this week?' }], false),
    ).toBe(true);
    expect(
      shouldSuggestLeadCapture(
        [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'Hours?' },
          { role: 'assistant', content: '24/7' },
          { role: 'user', content: 'Nice' },
        ],
        false,
      ),
    ).toBe(true);
    expect(
      shouldSuggestLeadCapture([{ role: 'user', content: 'I want to sign up' }], true),
    ).toBe(false);
  });
});

describe('validateSiteChatLead', () => {
  it('requires name plus email or phone, with matching consent', () => {
    expect(validateSiteChatLead({ name: 'A' }).ok).toBe(false);
    expect(validateSiteChatLead({ name: 'Alex Rivera' }).ok).toBe(false);

    const emailOnly = validateSiteChatLead({
      name: 'Alex Rivera',
      email: 'alex@clinic.com',
      emailConsent: true,
      messages: [{ role: 'user', content: 'Growth vs Scale?' }],
    });
    expect(emailOnly.ok).toBe(true);
    if (emailOnly.ok) {
      expect(emailOnly.data.email).toBe('alex@clinic.com');
      expect(emailOnly.data.phoneE164).toBeNull();
      expect(emailOnly.data.emailConsent).toBe(true);
      expect(emailOnly.data.smsConsent).toBe(false);
    }

    expect(
      validateSiteChatLead({
        name: 'Alex Rivera',
        email: 'alex@clinic.com',
        emailConsent: false,
      }).ok,
    ).toBe(false);

    const phoneOnly = validateSiteChatLead({
      name: 'Alex Rivera',
      phone: '(415) 321-1212',
      smsConsent: true,
    });
    expect(phoneOnly.ok).toBe(true);
    if (phoneOnly.ok) {
      expect(phoneOnly.data.phoneE164).toBe('+14153211212');
      expect(phoneOnly.data.smsConsent).toBe(true);
    }

    expect(
      validateSiteChatLead({
        name: 'Alex Rivera',
        phone: '(415) 321-1212',
        smsConsent: false,
      }).ok,
    ).toBe(false);

    expect(
      validateSiteChatLead({
        name: 'Alex Rivera',
        phone: '5555555555',
        smsConsent: true,
      }).ok,
    ).toBe(false);
  });
});

describe('transcript + grok extract', () => {
  it('formats a short snippet and reads OpenAI-shaped content', () => {
    const snippet = formatTranscriptSnippet([
      { role: 'user', content: 'Pricing?' },
      { role: 'assistant', content: 'Growth is $199.' },
    ]);
    expect(snippet).toContain('Visitor: Pricing?');
    expect(snippet).toContain('Telfin: Growth is $199.');
    expect(
      extractGrokChatText({ choices: [{ message: { content: '  Hello from Telfin.  ' } }] }),
    ).toBe('Hello from Telfin.');
    expect(extractGrokChatText({})).toBe('');
  });

  it('merges stored history with the latest user turn', () => {
    const merged = mergeConversation(
      [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }],
      [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }, { role: 'user', content: 'Plans?' }],
    );
    expect(merged.at(-1)).toEqual({ role: 'user', content: 'Plans?' });
    expect(merged).toHaveLength(3);
  });
});

describe('system prompt stays on-product', () => {
  it('pins prices, voices, call-me, join, and refuse-off-topic', () => {
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('Growth $199');
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('Scale $399');
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('Business $599');
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('Aurora');
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('Castor');
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('Cosmo');
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('Zenith');
    expect(SITE_CHAT_SYSTEM_PROMPT).toMatch(/Staff Transfer Number/i);
    expect(SITE_CHAT_SYSTEM_PROMPT).toMatch(/Join call/i);
    expect(SITE_CHAT_SYSTEM_PROMPT).toMatch(/ANSWER ONLY/i);
    expect(SITE_CHAT_SYSTEM_PROMPT).toMatch(/explore the dashboard/i);
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('Do not say "free trial"');
    expect(SITE_CHAT_SYSTEM_PROMPT).toContain('What do you want your AI to do');
    expect(SITE_CHAT_SYSTEM_PROMPT).not.toMatch(/10 inbound minutes/);
    expect(SITE_CHAT_SYSTEM_PROMPT).not.toContain('$79');
    expect(SITE_CHAT_SYSTEM_PROMPT).not.toContain('$179');
    expect(SITE_CHAT_SYSTEM_PROMPT).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
    expect(SITE_CHAT_TRY_FREE_PATH).toBe('/signup?plan=trial');
    expect(DEFAULT_XAI_CHAT_MODEL).toBe('grok-4.3');
    expect(SITE_CHAT_MAX_MESSAGES).toBe(12);
    expect(SITE_CHAT_IP_HOUR_LIMIT).toBe(40);
    expect(SITE_CHAT_LEAD_IP_HOUR_LIMIT).toBe(8);
  });
});

describe('router wiring — no dials, no DEMO_SKIP_COOLDOWN', () => {
  it('registers public site-chat routes and never dials', () => {
    const router = readFileSync(join(srcRoot, 'public-api/site-chat.router.ts'), 'utf8');
    expect(router).toContain('/public/site-chat');
    expect(router).toContain('/public/site-chat/lead');
    expect(router).toContain('persistSiteChatLead');
    expect(router).not.toContain('dialDirect');
    expect(router).not.toContain('DEMO_SKIP_COOLDOWN');
    expect(router).not.toMatch(/auto-?redial/i);

    const main = readFileSync(join(apiSrc, 'main.ts'), 'utf8');
    expect(main).toContain('publicSiteChatPlugin');

    const platform = readFileSync(join(srcRoot, 'platform/platform.router.ts'), 'utf8');
    expect(platform).toContain('emailConsent');
    expect(platform).toContain('transcript');
    expect(platform).toContain('source');
  });

  it('dashboard widget is marketing-only and requires consent checkboxes', () => {
    const widget = readFileSync(join(dashSrc, 'components/ui/product-chat-widget.tsx'), 'utf8');
    expect(widget).toContain('/public/site-chat');
    expect(widget).toContain('emailConsent');
    expect(widget).toContain('smsConsent');
    expect(widget).toContain('Try Free');
    expect(widget).not.toContain('dialDirect');
    expect(widget).not.toContain('/public/call-me');

    const header = readFileSync(join(dashSrc, 'components/ui/marketing-header.tsx'), 'utf8');
    expect(header).toContain('ProductChatWidget');

    const goLive = readFileSync(join(dashSrc, 'lib/useGoLive.ts'), 'utf8');
    expect(goLive).toMatch(/Join call/);
    expect(goLive).toMatch(/Staff Transfer Number|staff transfer number/i);
  });
});
