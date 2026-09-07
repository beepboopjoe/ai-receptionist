// ============================================================
// Pure-function + source-scan tests for outbound call-me media stream.
// No Telnyx / Fastify / DB — those paths are env-gated in production.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import {
  TELNYX_STREAMING_START_ACTION,
  telnyxStreamingStartPath,
  buildStreamingStartBody,
  buildDialMediaStreamFields,
  shouldStartStreamOnAnswer,
  isAlreadyStreamingError,
  formatUnhandledTelnyxEventLog,
  formatTelnyxEventLog,
  formatStreamingStartLog,
  formatStreamingStartSuccessLog,
  formatStreamingStartFailureLog,
  formatStreamingFailedEventLog,
  formatGrokConnectFailureLog,
  formatGrokGreetingLog,
  formatMediaStreamStartLog,
  formatMediaStreamHandlerFailureLog,
  resolveFastifyWebsocket,
  GROK_GREETING_CREATE,
} from '../modules/telephony/telnyx-stream.helpers.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('streaming_start action', () => {
  it('uses the official Telnyx Call Control path', () => {
    expect(TELNYX_STREAMING_START_ACTION).toBe('streaming_start');
    expect(telnyxStreamingStartPath('v2:abc')).toBe('/calls/v2:abc/actions/streaming_start');
  });

  it('requests bidirectional PCMU RTP so Grok audio can play', () => {
    const body = buildStreamingStartBody('wss://api.example.com/api/v1/webhooks/telnyx/stream', 'c3RhdGU=');
    expect(body.stream_url).toBe('wss://api.example.com/api/v1/webhooks/telnyx/stream');
    expect(body.stream_track).toBe('both_tracks');
    expect(body.stream_codec).toBe('PCMU');
    expect(body.stream_bidirectional_mode).toBe('rtp');
    expect(body.stream_bidirectional_codec).toBe('PCMU');
    expect(body.stream_bidirectional_sampling_rate).toBe(8000);
    expect(body.stream_bidirectional_target_legs).toBe('both');
    expect(body.enable_dialogflow).toBe(false);
    expect(body.client_state).toBe('c3RhdGU=');
  });

  it('omits client_state when empty and exposes the same fields on dial', () => {
    const body = buildStreamingStartBody('wss://host/stream');
    expect(body).not.toHaveProperty('client_state');
    const dial = buildDialMediaStreamFields('wss://host/stream');
    expect(dial.stream_url).toBe('wss://host/stream');
    expect(dial.stream_bidirectional_mode).toBe('rtp');
    expect(dial).not.toHaveProperty('enable_dialogflow');
    expect(dial).not.toHaveProperty('client_state');
  });
});

describe('shouldStartStreamOnAnswer', () => {
  it('starts immediately for dialDirect / inbound (isOutbound false or missing)', () => {
    expect(shouldStartStreamOnAnswer({ isOutbound: false })).toBe(true);
    expect(shouldStartStreamOnAnswer({})).toBe(true);
  });

  it('waits for AMD on campaign outbound', () => {
    expect(shouldStartStreamOnAnswer({ isOutbound: true })).toBe(false);
  });
});

describe('isAlreadyStreamingError', () => {
  it('treats already-streaming 422s as idempotent', () => {
    expect(isAlreadyStreamingError(new Error('Carrier /calls/x/actions/streaming_start → 422: already streaming'))).toBe(true);
    expect(isAlreadyStreamingError('Streaming has already been started')).toBe(true);
    expect(isAlreadyStreamingError(new Error('404 not found'))).toBe(false);
  });
});

describe('Railway-visible log messages', () => {
  it('puts eventType + error on Unhandled Telnyx event error', () => {
    const msg = formatUnhandledTelnyxEventLog(
      'call.answered',
      new Error('Carrier /calls/v2:x/actions/stream_start → 404: Not Found'),
    );
    expect(msg).toContain('Unhandled Telnyx event error');
    expect(msg).toContain('eventType=call.answered');
    expect(msg).toContain('err=Carrier /calls/v2:x/actions/stream_start → 404: Not Found');
  });

  it('puts eventType on the Telnyx event info line', () => {
    const msg = formatTelnyxEventLog({
      eventType: 'call.answered',
      callControlId: 'v2:abc',
      isOutbound: false,
    });
    expect(msg).toContain('Telnyx event');
    expect(msg).toContain('eventType=call.answered');
    expect(msg).toContain('callControlId=v2:abc');
    expect(msg).toContain('isOutbound=false');
  });

  it('puts streamUrl + err on streaming_start / Grok failure lines', () => {
    expect(formatStreamingStartLog({
      callControlId: 'v2:abc',
      streamUrl: 'wss://api.example.com/api/v1/webhooks/telnyx/stream',
    })).toContain('streamUrl=wss://api.example.com/api/v1/webhooks/telnyx/stream');

    expect(formatStreamingStartSuccessLog({
      callControlId: 'v2:abc',
      streamUrl: 'wss://host/stream',
    })).toContain('Media stream started');

    const fail = formatStreamingStartFailureLog({
      callControlId: 'v2:abc',
      streamUrl: 'wss://host/stream',
      err: new Error('422 unprocessable'),
    });
    expect(fail).toContain('Telnyx streaming_start failed');
    expect(fail).toContain('err=422 unprocessable');

    expect(formatStreamingFailedEventLog({
      callControlId: 'v2:abc',
      streamUrl: 'wss://host/stream',
      failureReason: 'websocket_connect_failed',
    })).toContain('reason=websocket_connect_failed');

    const grok = formatGrokConnectFailureLog({
      callSid: 'v2:abc',
      tenantId: 'tenant-1',
      err: new Error('XAI_API_KEY is required'),
    });
    expect(grok).toContain('Grok realtime connect failed');
    expect(grok).toContain('err=XAI_API_KEY is required');
    expect(grok).toContain('tenantId=tenant-1');

    expect(formatGrokGreetingLog({ callSid: 'v2:abc', grokSessionId: 'grok_1' })).toContain(
      'Grok session.update + greeting sent',
    );

    expect(formatMediaStreamStartLog({
      callId: '',
      tenantId: '',
      callSid: 'v2:abc',
      missingFields: ['callId', 'tenantId'],
    })).toContain('missing=callId,tenantId');

    expect(formatMediaStreamHandlerFailureLog({
      callSid: 'v2:abc',
      err: new Error('boom'),
    })).toContain('err=boom');
  });

  it('uses unset/unknown placeholders when values are missing', () => {
    expect(formatUnhandledTelnyxEventLog('', '')).toContain('eventType=unknown');
    expect(formatUnhandledTelnyxEventLog('', '')).toContain('err=empty');
    expect(formatGrokConnectFailureLog({ callSid: '', err: '' })).toContain('tenantId=unset');
  });
});

function fakeWs(): EventEmitter & { send: () => void } {
  const socket = new EventEmitter() as EventEmitter & { send: () => void };
  socket.send = () => undefined;
  return socket;
}

describe('resolveFastifyWebsocket', () => {
  it('unwraps the legacy { socket } shape', () => {
    const inner = fakeWs();
    expect(resolveFastifyWebsocket({ socket: inner })).toBe(inner);
  });

  it('returns the v10 socket even when it has a raw .socket (net.Socket)', () => {
    const socket = fakeWs() as EventEmitter & { send: () => void; socket: EventEmitter };
    socket.socket = new EventEmitter(); // raw TCP — has on() but not send()
    expect(resolveFastifyWebsocket(socket)).toBe(socket);
  });
});

describe('GROK_GREETING_CREATE', () => {
  it('is the Realtime response.create that makes Grok speak first', () => {
    expect(GROK_GREETING_CREATE).toEqual({ type: 'response.create' });
  });
});

describe('production sources use the working Telnyx + Grok path', () => {
  it('dialer posts streaming_start (not stream_start) with bidirectional RTP', () => {
    const src = readFileSync(join(srcRoot, 'modules/campaigns/telnyx-dialer.service.ts'), 'utf8');
    expect(src).toContain('telnyxStreamingStartPath');
    expect(src).toContain('buildStreamingStartBody');
    expect(src).toContain('buildDialMediaStreamFields');
    expect(src).not.toMatch(/actions\/stream_start/);
  });

  it('webhook starts the stream on answered when isOutbound is not true', () => {
    const src = readFileSync(join(srcRoot, 'modules/telephony/telnyx-webhook.handler.ts'), 'utf8');
    expect(src).toContain('shouldStartStreamOnAnswer');
    expect(src).toContain('formatUnhandledTelnyxEventLog');
    expect(src).toContain('formatStreamingStartFailureLog');
    expect(src).toContain("case 'streaming.failed'");
  });

  it('media WS handler uses the v10 socket and greets via response.create', () => {
    const router = readFileSync(join(srcRoot, 'modules/telephony/router.ts'), 'utf8');
    expect(router).toContain('resolveFastifyWebsocket');
    expect(router).not.toMatch(/connection\.socket as unknown as WebSocket/);

    const media = readFileSync(join(srcRoot, 'modules/telephony/media-stream.handler.ts'), 'utf8');
    expect(media).toContain('GROK_GREETING_CREATE');
    expect(media).toContain('formatGrokConnectFailureLog');
  });
});
