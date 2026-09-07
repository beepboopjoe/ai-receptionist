import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  inspectXaiApiKey,
  xaiApiKeyLogFields,
  xaiAuthorizationHeader,
  clipXaiLogBody,
  redactXaiSecrets,
  resolveGrokRealtimeModel,
  buildGrokRealtimeUrl,
  httpStatusFromWsConnectError,
  collectLimitedHttpBody,
  DEFAULT_GROK_REALTIME_MODEL,
  GROK_REALTIME_BASE,
  XAI_PLACEHOLDER_KEY,
  XAI_LOG_BODY_MAX_CHARS,
} from './xai-auth.js';

const SAMPLE = 'xai-abcdefghijklmnopqrstuvwxyz0123456789';

describe('inspectXaiApiKey', () => {
  it('keeps a plain xai-… value as-is', () => {
    const d = inspectXaiApiKey(SAMPLE);
    expect(d.key).toBe(SAMPLE);
    expect(d.apiKeyPresent).toBe(true);
    expect(d.apiKeyLen).toBe(SAMPLE.length);
    expect(d.apiKeyPrefix).toBe('xai-');
    expect(d.placeholder).toBe(false);
    expect(d.strippedWhitespace).toBe(false);
    expect(d.strippedQuotes).toBe(false);
    expect(d.strippedBearerPrefix).toBe(false);
  });

  it('trims surrounding whitespace and newlines', () => {
    const d = inspectXaiApiKey(`  ${SAMPLE}\n`);
    expect(d.key).toBe(SAMPLE);
    expect(d.strippedWhitespace).toBe(true);
  });

  it('strips surrounding quotes and a Bearer prefix', () => {
    expect(inspectXaiApiKey(`"${SAMPLE}"`).key).toBe(SAMPLE);
    expect(inspectXaiApiKey(`Bearer ${SAMPLE}`).key).toBe(SAMPLE);
    expect(inspectXaiApiKey(`Bearer "${SAMPLE}"`).strippedQuotes).toBe(true);
    expect(inspectXaiApiKey(`Bearer "${SAMPLE}"`).strippedBearerPrefix).toBe(true);
  });

  it('treats empty / placeholder as not present', () => {
    expect(inspectXaiApiKey('').apiKeyPresent).toBe(false);
    expect(inspectXaiApiKey('   \n').apiKeyPresent).toBe(false);
    expect(inspectXaiApiKey(null).apiKeyPresent).toBe(false);
    const placeholder = inspectXaiApiKey(XAI_PLACEHOLDER_KEY);
    expect(placeholder.apiKeyPresent).toBe(false);
    expect(placeholder.placeholder).toBe(true);
    expect(placeholder.apiKeyPrefix).toBe('unco');
  });

  it('does not expose the secret on the log-safe projection', () => {
    const fields = xaiApiKeyLogFields(` "${SAMPLE}" `);
    expect(fields).not.toHaveProperty('key');
    expect(fields.apiKeyPresent).toBe(true);
    expect(fields.apiKeyLen).toBe(SAMPLE.length);
    expect(fields.apiKeyPrefix).toBe('xai-');
    expect(fields.keySanitized).toBe(true);
    expect(JSON.stringify(fields)).not.toContain(SAMPLE);
  });
});

describe('xaiAuthorizationHeader', () => {
  it('prefixes a sanitized key with Bearer once', () => {
    expect(xaiAuthorizationHeader(`Bearer "${SAMPLE}"`)).toBe(`Bearer ${SAMPLE}`);
  });

  it('returns empty for missing or placeholder keys', () => {
    expect(xaiAuthorizationHeader('')).toBe('');
    expect(xaiAuthorizationHeader(XAI_PLACEHOLDER_KEY)).toBe('');
  });
});

describe('clip / redact handshake bodies', () => {
  it('redacts Bearer tokens and xai- secrets', () => {
    const raw = `denied Authorization: Bearer ${SAMPLE} leftover xai-othersecret99`;
    expect(redactXaiSecrets(raw)).not.toContain(SAMPLE);
    expect(redactXaiSecrets(raw)).toContain('Bearer [redacted]');
    expect(redactXaiSecrets(raw)).toContain('xai-[redacted]');
  });

  it('clips long bodies', () => {
    const long = 'e'.repeat(XAI_LOG_BODY_MAX_CHARS + 40);
    const clipped = clipXaiLogBody(long);
    expect(clipped.endsWith('…')).toBe(true);
    expect(clipped.length).toBe(XAI_LOG_BODY_MAX_CHARS + 1);
  });
});

describe('Grok realtime URL / model', () => {
  it('defaults to the pinned think-fast 1.0 model', () => {
    expect(resolveGrokRealtimeModel()).toBe(DEFAULT_GROK_REALTIME_MODEL);
    expect(resolveGrokRealtimeModel('  ')).toBe(DEFAULT_GROK_REALTIME_MODEL);
    expect(buildGrokRealtimeUrl()).toBe(
      `${GROK_REALTIME_BASE}?model=${DEFAULT_GROK_REALTIME_MODEL}`,
    );
  });

  it('honors an override and encodes it', () => {
    expect(resolveGrokRealtimeModel('grok-voice-think-fast-2.0')).toBe(
      'grok-voice-think-fast-2.0',
    );
    expect(buildGrokRealtimeUrl('grok-voice-latest')).toBe(
      `${GROK_REALTIME_BASE}?model=grok-voice-latest`,
    );
  });
});

describe('httpStatusFromWsConnectError', () => {
  it('parses the ws unexpected-response message', () => {
    expect(httpStatusFromWsConnectError(new Error('Unexpected server response: 403'))).toBe(403);
    expect(httpStatusFromWsConnectError(new Error('Unexpected server response: 401'))).toBe(401);
    expect(httpStatusFromWsConnectError(new Error('socket hang up'))).toBeNull();
  });
});

describe('collectLimitedHttpBody', () => {
  it('concatenates chunks and ignores data after the cap', async () => {
    const res = new EventEmitter();
    const pending = collectLimitedHttpBody(res, 8, 2_000);
    res.emit('data', Buffer.from('hello '));
    res.emit('data', Buffer.from('world extra'));
    res.emit('end');
    await expect(pending).resolves.toBe('hello wo');
  });
});
