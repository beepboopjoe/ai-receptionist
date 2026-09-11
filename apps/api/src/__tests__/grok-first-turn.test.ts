import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_OPENING_EN } from '../modules/voice-agent/call-me-demo.prompt.js';
import {
  alreadySpokenPromptSection,
  buildGrokForceMessage,
  buildGrokGreetingFallbackCreate,
  firstTurnGreetingText,
  formatTtfaLog,
  GROK_FORCE_MESSAGE_AUDIO_FALLBACK_MS,
  GROK_REASONING_NONE,
} from '../modules/telephony/grok-first-turn.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('first-turn greeting text', () => {
  it('keeps the locked demo opener', () => {
    expect(firstTurnGreetingText({
      isDemo: true,
      isOutbound: false,
      practiceName: 'Acme Dental',
    })).toBe(DEMO_OPENING_EN);
    expect(DEMO_OPENING_EN).toBe('Hey, this is a representative of Telfin.');
  });

  it('uses a short inbound opener and names known callers', () => {
    expect(firstTurnGreetingText({
      isDemo: false,
      isOutbound: false,
      practiceName: 'Acme Dental',
    })).toBe('Thanks for calling Acme Dental.');
    expect(firstTurnGreetingText({
      isDemo: false,
      isOutbound: false,
      practiceName: 'Acme Dental',
      callerFirstName: 'Maria',
    })).toBe('Hi Maria, thanks for calling Acme Dental.');
  });

  it('uses a short outbound opener', () => {
    expect(firstTurnGreetingText({
      isDemo: false,
      isOutbound: true,
      practiceName: 'Acme Dental',
      leadFirstName: 'Sam',
    })).toBe('Hi, may I please speak with Sam?');
  });
});

describe('force_message greeting', () => {
  it('is an xAI force_message, not a thinking response.create', () => {
    const msg = buildGrokForceMessage(DEMO_OPENING_EN);
    expect(msg.type).toBe('conversation.item.create');
    expect(msg.item.type).toBe('force_message');
    expect(msg.item.interruptible).toBe(false);
    expect(msg.item.content[0]?.text).toBe(DEMO_OPENING_EN);
    expect(GROK_FORCE_MESSAGE_AUDIO_FALLBACK_MS).toBe(3_000);
    expect(GROK_REASONING_NONE).toEqual({ effort: 'none' });
  });

  it('falls back to a verbatim response.create if TTS never starts', () => {
    const fallback = buildGrokGreetingFallbackCreate(DEMO_OPENING_EN);
    expect(fallback.type).toBe('response.create');
    expect(fallback.response.instructions).toContain(DEMO_OPENING_EN);
  });

  it('tells the model not to repeat the opener', () => {
    expect(alreadySpokenPromptSection(DEMO_OPENING_EN)).toContain(DEMO_OPENING_EN);
    expect(alreadySpokenPromptSection(DEMO_OPENING_EN)).toContain('Do not repeat');
  });
});

describe('TTFA logs', () => {
  it('puts stage and milliseconds on the Railway msg line', () => {
    expect(formatTtfaLog({ callSid: 'v2:abc', stage: 'first_audio_to_telnyx', ms: 842 }))
      .toBe('TTFA first_audio_to_telnyx callSid=v2:abc ms=842');
  });
});

describe('live path disables thinking before first audio', () => {
  it('session.update pins reasoning.effort none and empty tools', () => {
    const adapter = readFileSync(join(srcRoot, 'modules/voice-agent/adapters/grok.adapter.ts'), 'utf8');
    expect(adapter).toContain("effort: 'none'");
    expect(adapter).toContain('tools: []');
  });

  it('media stream opens Grok before awaiting KB embeddings', () => {
    const media = readFileSync(join(srcRoot, 'modules/telephony/media-stream.handler.ts'), 'utf8');
    expect(media).toContain('buildGrokForceMessage');
    expect(media).toContain('formatTtfaLog');
    expect(media).toContain('prompt_ready');
    expect(media).toContain('first_audio_to_telnyx');
    expect(media).toContain('retrieveRelevantChunks');
    const grokOpenIdx = media.indexOf('new WebSocket(session.webSocketUrl');
    const kbIdx = media.indexOf('retrieveRelevantChunks');
    const promptReadyIdx = media.indexOf("ttfa('prompt_ready')");
    expect(grokOpenIdx).toBeGreaterThan(0);
    expect(kbIdx).toBeGreaterThan(grokOpenIdx);
    expect(promptReadyIdx).toBeGreaterThan(grokOpenIdx);
    expect(media).not.toContain('DEMO_SKIP_COOLDOWN');
  });
});
