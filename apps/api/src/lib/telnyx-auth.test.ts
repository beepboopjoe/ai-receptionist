import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  inspectTelnyxApiKey,
  telnyxApiKeyLogFields,
  telnyxAuthorizationHeader,
  clipTelnyxLogBody,
  TelnyxHttpError,
  telnyxFailureFields,
  probeTelnyxAuth,
  TELNYX_LOG_BODY_MAX_CHARS,
} from './telnyx-auth.js';

const SAMPLE = 'KEYabcdefghijklmnopqrstuvwxyz012345';

describe('inspectTelnyxApiKey', () => {
  it('keeps a plain KEY… value as-is', () => {
    const d = inspectTelnyxApiKey(SAMPLE);
    expect(d.key).toBe(SAMPLE);
    expect(d.apiKeyPresent).toBe(true);
    expect(d.apiKeyLen).toBe(SAMPLE.length);
    expect(d.apiKeyPrefix).toBe('KEY');
    expect(d.strippedWhitespace).toBe(false);
    expect(d.strippedQuotes).toBe(false);
    expect(d.strippedBearerPrefix).toBe(false);
  });

  it('trims surrounding whitespace and newlines', () => {
    const d = inspectTelnyxApiKey(`  ${SAMPLE}\n`);
    expect(d.key).toBe(SAMPLE);
    expect(d.strippedWhitespace).toBe(true);
    expect(d.strippedQuotes).toBe(false);
  });

  it('strips surrounding double or single quotes', () => {
    expect(inspectTelnyxApiKey(`"${SAMPLE}"`).key).toBe(SAMPLE);
    expect(inspectTelnyxApiKey(`'${SAMPLE}'`).key).toBe(SAMPLE);
    expect(inspectTelnyxApiKey(`"${SAMPLE}"`).strippedQuotes).toBe(true);
  });

  it('strips quotes after trim (Railway paste)', () => {
    const d = inspectTelnyxApiKey(`  "${SAMPLE}"\r\n`);
    expect(d.key).toBe(SAMPLE);
    expect(d.strippedQuotes).toBe(true);
    expect(d.strippedWhitespace).toBe(true);
  });

  it('strips a leading Bearer prefix so the header is not doubled', () => {
    const d = inspectTelnyxApiKey(`Bearer ${SAMPLE}`);
    expect(d.key).toBe(SAMPLE);
    expect(d.strippedBearerPrefix).toBe(true);
    expect(d.strippedQuotes).toBe(false);
  });

  it('handles Bearer + quoted key', () => {
    const d = inspectTelnyxApiKey(`Bearer "${SAMPLE}"`);
    expect(d.key).toBe(SAMPLE);
    expect(d.strippedBearerPrefix).toBe(true);
    expect(d.strippedQuotes).toBe(true);
  });

  it('keeps a non-KEY token as-is (no rewrite)', () => {
    const raw = 'sk_live_not_a_telnyx_shape';
    const d = inspectTelnyxApiKey(raw);
    expect(d.key).toBe(raw);
    expect(d.apiKeyPrefix).toBe('sk_');
    expect(d.strippedQuotes).toBe(false);
  });

  it('treats empty / whitespace-only as missing', () => {
    expect(inspectTelnyxApiKey('').apiKeyPresent).toBe(false);
    expect(inspectTelnyxApiKey('   \n').apiKeyPresent).toBe(false);
    expect(inspectTelnyxApiKey(null).apiKeyPresent).toBe(false);
    expect(inspectTelnyxApiKey(undefined).apiKeyLen).toBe(0);
    expect(inspectTelnyxApiKey('').apiKeyPrefix).toBe('');
  });

  it('does not expose the secret on the log-safe projection', () => {
    const fields = telnyxApiKeyLogFields(` "${SAMPLE}" `);
    expect(fields).not.toHaveProperty('key');
    expect(fields.apiKeyPresent).toBe(true);
    expect(fields.apiKeyLen).toBe(SAMPLE.length);
    expect(fields.apiKeyPrefix).toBe('KEY');
    expect(fields.keySanitized).toBe(true);
    expect(fields.strippedQuotes).toBe(true);
    expect(fields.strippedWhitespace).toBe(true);
    expect(JSON.stringify(fields)).not.toContain(SAMPLE);
  });
});

describe('telnyxAuthorizationHeader', () => {
  it('builds Bearer + sanitized key', () => {
    expect(telnyxAuthorizationHeader(SAMPLE)).toBe(`Bearer ${SAMPLE}`);
  });

  it('does not double Bearer', () => {
    expect(telnyxAuthorizationHeader(`Bearer ${SAMPLE}`)).toBe(`Bearer ${SAMPLE}`);
    expect(telnyxAuthorizationHeader(`bearer ${SAMPLE}`)).toBe(`Bearer ${SAMPLE}`);
  });

  it('strips quotes and whitespace before adding Bearer', () => {
    expect(telnyxAuthorizationHeader(`  "${SAMPLE}"\n`)).toBe(`Bearer ${SAMPLE}`);
  });

  it('returns empty when there is no key', () => {
    expect(telnyxAuthorizationHeader('')).toBe('');
    expect(telnyxAuthorizationHeader('   ')).toBe('');
    expect(telnyxAuthorizationHeader(undefined)).toBe('');
  });
});

describe('TelnyxHttpError + clip', () => {
  it('clips long bodies at ~500 chars', () => {
    const huge = 'x'.repeat(TELNYX_LOG_BODY_MAX_CHARS + 80);
    const clipped = clipTelnyxLogBody(huge);
    expect(clipped.length).toBe(TELNYX_LOG_BODY_MAX_CHARS + 1);
    expect(clipped.endsWith('…')).toBe(true);
  });

  it('puts status + clipped body on the error and in message', () => {
    const err = new TelnyxHttpError('/calls', 401, '{"errors":[{"detail":"Unauthorized"}]}');
    expect(err.httpStatus).toBe(401);
    expect(err.bodyClipped).toContain('Unauthorized');
    expect(err.message).toBe('Carrier /calls → 401: {"errors":[{"detail":"Unauthorized"}]}');
    expect(telnyxFailureFields(err)).toEqual({
      httpStatus: 401,
      bodyClipped: '{"errors":[{"detail":"Unauthorized"}]}',
    });
  });

  it('parses a legacy Carrier message when the class is not used', () => {
    expect(telnyxFailureFields(new Error('Carrier /calls → 403: forbidden'))).toEqual({
      httpStatus: 403,
      bodyClipped: 'forbidden',
    });
  });

  it('returns unset status for unrelated errors', () => {
    expect(telnyxFailureFields(new Error('socket hang up'))).toEqual({
      httpStatus: null,
      bodyClipped: '',
    });
  });
});

describe('probeTelnyxAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call Telnyx when the key is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await probeTelnyxAuth('  ', 'conn-1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBeNull();
    expect(result.apiKeyPresent).toBe(false);
    expect(result.connectionIdPresent).toBe(true);
    expect(result).not.toHaveProperty('key');
  });

  it('reports httpStatus from GET /v2/balance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"errors":[{"code":"10011","title":"Invalid API Key"}]}',
      }),
    );
    const result = await probeTelnyxAuth(` "${SAMPLE}" `, 'app-1');
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(401);
    expect(result.apiKeyPrefix).toBe('KEY');
    expect(result.keySanitized).toBe(true);
    expect(result.bodyClipped).toContain('Invalid API Key');
    expect(JSON.stringify(result)).not.toContain(SAMPLE);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telnyx.com/v2/balance');
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${SAMPLE}` });
  });
});
