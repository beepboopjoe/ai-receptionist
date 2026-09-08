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
  TELNYX_CONCURRENT_STREAM_LIMIT_CODE,
  telnyxStreamingStartPath,
  buildStreamingStartBody,
  buildDialMediaStreamFields,
  shouldStartStreamOnAnswer,
  streamAlreadyOwnedByDial,
  firstNonEmpty,
  resolveMediaStreamCallSid,
  resolveMediaStreamParams,
  isAlreadyStreamingError,
  formatUnhandledTelnyxEventLog,
  formatTelnyxEventLog,
  formatStreamingStartLog,
  formatStreamingStartSuccessLog,
  formatStreamingStartFailureLog,
  formatStreamingStartSkippedLog,
  formatAlreadyStreamingTreatedAsSuccessLog,
  formatStreamingFailedEventLog,
  formatStreamingStoppedEventLog,
  formatGrokConnectFailureLog,
  formatGrokGreetingLog,
  formatMediaStreamStartLog,
  formatMediaStreamCallSidResolvedLog,
  formatMediaStreamHandlerFailureLog,
  formatFirstTelnyxInboundMediaLog,
  formatFirstGrokAudioEventLog,
  formatFirstGrokAudioToTelnyxLog,
  formatGrokEmptyResponseLog,
  formatGrokAudioDroppedLog,
  formatGrokSessionUpdateLog,
  formatGrokGreetingFallbackLog,
  formatGrokNoAudioWatchdogLog,
  formatGrokRelaySummaryLog,
  formatGrokUnexpectedBinaryLog,
  resolveFastifyWebsocket,
  GROK_GREETING_CREATE,
  GROK_GREETING_FALLBACK_MS,
  GROK_AUDIO_DELTA_TYPES,
  isGrokAudioDeltaType,
  isGrokTranscriptDeltaType,
  extractGrokAudioPayload,
  extractTelnyxInboundAudioPayload,
  isTelnyxInboundMediaTrack,
  buildTelnyxOutboundMediaMessage,
  base64PayloadBytes,
  summarizeEventCounts,
} from '../modules/telephony/telnyx-stream.helpers.js';
import {
  GrokVoiceAdapter,
  toXaiCodec,
  toLegacyXaiFormat,
} from '../modules/voice-agent/adapters/grok.adapter.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('streaming_start action', () => {
  it('uses the official Telnyx Call Control path', () => {
    expect(TELNYX_STREAMING_START_ACTION).toBe('streaming_start');
    expect(telnyxStreamingStartPath('v2:abc')).toBe('/calls/v2:abc/actions/streaming_start');
  });

  it('requests bidirectional PCMU RTP so Grok audio can play', () => {
    const body = buildStreamingStartBody('wss://api.example.com/api/v1/webhooks/telnyx/stream', 'c3RhdGU=');
    expect(body.stream_url).toBe('wss://api.example.com/api/v1/webhooks/telnyx/stream');
    expect(body.stream_track).toBe('inbound_track');
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
  it('starts immediately for inbound (isOutbound false or missing)', () => {
    expect(shouldStartStreamOnAnswer({ isOutbound: false })).toBe(true);
    expect(shouldStartStreamOnAnswer({})).toBe(true);
  });

  it('waits for AMD on campaign outbound', () => {
    expect(shouldStartStreamOnAnswer({ isOutbound: true })).toBe(false);
  });
});

describe('streamAlreadyOwnedByDial', () => {
  it('is true only when dialDirect stamped streamAttachedAtDial', () => {
    expect(streamAlreadyOwnedByDial({ streamAttachedAtDial: true })).toBe(true);
    expect(streamAlreadyOwnedByDial({ streamAttachedAtDial: false })).toBe(false);
    expect(streamAlreadyOwnedByDial({})).toBe(false);
  });
});

describe('resolveMediaStreamCallSid', () => {
  it('does not let empty-string client_state callSid win over start.call_control_id', () => {
    // Production bug after PR #11: dialDirect encoded callSid:'' and `??` kept it.
    const resolved = resolveMediaStreamCallSid({
      stateCallSid: '',
      startCallControlId: 'v2:real-ccid',
    });
    expect(resolved.callSid).toBe('v2:real-ccid');
    expect(resolved.source).toBe('start.call_control_id');
  });

  it('prefers a real client_state callSid', () => {
    const resolved = resolveMediaStreamCallSid({
      stateCallSid: 'v2:from-state',
      startCallControlId: 'v2:from-start',
    });
    expect(resolved.callSid).toBe('v2:from-state');
    expect(resolved.source).toBe('client_state');
  });

  it('falls back to top-level event call_control_id', () => {
    const resolved = resolveMediaStreamCallSid({
      stateCallSid: '   ',
      startCallControlId: undefined,
      topLevelCallControlId: 'v2:top',
    });
    expect(resolved.callSid).toBe('v2:top');
    expect(resolved.source).toBe('event.call_control_id');
  });

  it('reports missing when nothing is present', () => {
    expect(resolveMediaStreamCallSid({})).toEqual({ callSid: '', source: 'missing' });
  });
});

describe('resolveMediaStreamParams', () => {
  it('recovers callSid from the Telnyx start event when client_state has callSid:""', () => {
    const clientState = Buffer.from(JSON.stringify({
      callId: 'call-1',
      tenantId: 'tenant-1',
      fromNumber: '+15551212',
      callSid: '',
      isOutbound: false,
    })).toString('base64');

    const params = resolveMediaStreamParams({
      event: 'start',
      start: {
        call_control_id: 'v2:from-telnyx',
        client_state: clientState,
      },
    });

    expect(params.callSid).toBe('v2:from-telnyx');
    expect(params.callSidSource).toBe('start.call_control_id');
    expect(params.callId).toBe('call-1');
    expect(params.tenantId).toBe('tenant-1');
    expect(params.fromNumber).toBe('+15551212');
    expect(params.missingFields).toEqual([]);
  });

  it('forwards dialDirect mode so call-me can use the Telfin persona', () => {
    const clientState = Buffer.from(JSON.stringify({
      callId: 'call-demo',
      tenantId: 'tenant-demo',
      fromNumber: '+14153211212',
      callSid: 'v2:demo',
      isOutbound: false,
      mode: 'demo',
    })).toString('base64');

    const params = resolveMediaStreamParams({
      event: 'start',
      start: {
        call_control_id: 'v2:demo',
        client_state: clientState,
      },
    });

    expect(params.mode).toBe('demo');
    expect(params.missingFields).toEqual([]);
  });
});

describe('firstNonEmpty', () => {
  it('skips empty / whitespace / nullish', () => {
    expect(firstNonEmpty('', '  ', undefined, null, 'v2:ok')).toBe('v2:ok');
    expect(firstNonEmpty()).toBe('');
  });
});

describe('isAlreadyStreamingError', () => {
  it('treats already-streaming 422s as idempotent', () => {
    expect(isAlreadyStreamingError(new Error('Carrier /calls/x/actions/streaming_start → 422: already streaming'))).toBe(true);
    expect(isAlreadyStreamingError('Streaming has already been started')).toBe(true);
    expect(isAlreadyStreamingError(new Error('404 not found'))).toBe(false);
  });

  it('treats Telnyx 90046 concurrent bidirectional RTP limit as success', () => {
    expect(TELNYX_CONCURRENT_STREAM_LIMIT_CODE).toBe('90046');
    const production = new Error(
      'Carrier /calls/v2:x/actions/streaming_start → 422: {"errors":[{"code":"90046","title":"Limit of maximum concurrent bidirectional RTP streaming session reached","detail":"Limit of maximum concurrent bidirectional RTP streaming session reached (1)"}]}',
    );
    expect(isAlreadyStreamingError(production)).toBe(true);
    expect(isAlreadyStreamingError({
      message: 'Carrier /calls/x/actions/streaming_start → 422',
      bodyClipped: 'Limit of maximum concurrent bidirectional RTP streaming session reached (1)',
      httpStatus: 422,
    })).toBe(true);
    expect(isAlreadyStreamingError(new Error('422 code 90046'))).toBe(true);
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
    expect(formatTelnyxEventLog({
      eventType: 'call.answered',
      callControlId: 'v2:abc',
      isOutbound: false,
      streamAttachedAtDial: true,
    })).toContain('streamAttachedAtDial=true');
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
    expect(grok).toContain('httpStatus=unset');
    expect(grok).toContain('apiKeyPresent=unknown');

    const grok403 = formatGrokConnectFailureLog({
      callSid: 'v2:abc',
      tenantId: 'tenant-1',
      err: new Error('Unexpected server response: 403'),
      httpStatus: 403,
      bodyClipped: 'permission denied for model grok-voice-think-fast-1.0 Bearer xai-supersecret',
      apiKeyPresent: true,
      apiKeyLen: 48,
      apiKeyPrefix: 'xai-',
      authHeaderPresent: true,
      model: 'grok-voice-think-fast-1.0',
      wsUrl: 'wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0',
      keySanitized: false,
      placeholder: false,
    });
    expect(grok403).toContain('httpStatus=403');
    expect(grok403).toContain('apiKeyPresent=true');
    expect(grok403).toContain('apiKeyLen=48');
    expect(grok403).toContain('apiKeyPrefix=xai-');
    expect(grok403).toContain('authHeader=true');
    expect(grok403).toContain('model=grok-voice-think-fast-1.0');
    expect(grok403).toContain('body=');
    expect(grok403).not.toContain('xai-supersecret');
    expect(grok403).toContain('Bearer [redacted]');

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

    const skipped = formatStreamingStartSkippedLog({
      reason: 'stream_attached_at_dial',
      callControlId: 'v2:abc',
      streamUrl: 'wss://host/stream',
    });
    expect(skipped).toContain('Telnyx streaming_start skipped');
    expect(skipped).toContain('reason=stream_attached_at_dial');
    expect(skipped).toContain('callControlId=v2:abc');

    const already = formatAlreadyStreamingTreatedAsSuccessLog({
      callControlId: 'v2:abc',
      streamUrl: 'wss://host/stream',
      err: new Error('422 code 90046'),
    });
    expect(already).toContain('Telnyx streaming_start already-active treated as success');
    expect(already).toContain('err=422 code 90046');

    expect(formatStreamingStoppedEventLog({
      callControlId: 'v2:abc',
      streamUrl: 'wss://host/stream',
    })).toContain('Telnyx streaming.stopped');

    expect(formatMediaStreamCallSidResolvedLog({
      callSid: 'v2:abc',
      source: 'start.call_control_id',
    })).toContain('source=start.call_control_id');
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
    expect(src).toContain('streamAlreadyOwnedByDial');
    expect(src).toContain('formatStreamingStartSkippedLog');
    expect(src).toContain('formatUnhandledTelnyxEventLog');
    expect(src).toContain('formatStreamingStartFailureLog');
    expect(src).toContain("case 'streaming.failed'");
    expect(src).toContain("case 'streaming.stopped'");
    expect(src).toContain("reason: 'stream_attached_at_dial'");
  });

  it('dialDirect owns the RTP slot and never encodes empty callSid', () => {
    const src = readFileSync(join(srcRoot, 'modules/campaigns/telnyx-dialer.service.ts'), 'utf8');
    expect(src).toContain('streamAttachedAtDial: true');
    expect(src).toContain('streamOwner=dial');
    expect(src).toContain('isAlreadyStreamingError');
    expect(src).toContain('formatAlreadyStreamingTreatedAsSuccessLog');
    expect(src).not.toMatch(/callSid:\s*['"]{2}/);
    expect(src).not.toMatch(/callSid:\s*''/);
  });

  it('media WS handler uses the v10 socket and greets via response.create', () => {
    const router = readFileSync(join(srcRoot, 'modules/telephony/router.ts'), 'utf8');
    expect(router).toContain('resolveFastifyWebsocket');
    expect(router).toContain('resolveMediaStreamParams');
    expect(router).toContain('formatMediaStreamCallSidResolvedLog');
    expect(router).not.toMatch(/connection\.socket as unknown as WebSocket/);
    expect(router).not.toMatch(/state\['callSid'\] \?\? start\?\.call_control_id/);

    const adapter = readFileSync(join(srcRoot, 'modules/voice-agent/adapters/grok.adapter.ts'), 'utf8');
    expect(adapter).toContain("type: 'audio/pcmu'");
    expect(adapter).toContain('buildGrokRealtimeUrl');
    expect(adapter).toContain('xaiAuthorizationHeader');
    expect(adapter).not.toMatch(/model:\s*'whisper-1'/);

    const media = readFileSync(join(srcRoot, 'modules/telephony/media-stream.handler.ts'), 'utf8');
    expect(media).toContain('GROK_GREETING_CREATE');
    expect(media).toContain('formatGrokConnectFailureLog');
    expect(media).toContain("on('unexpected-response'");
    expect(media).toContain('collectLimitedHttpBody');
    expect(media).toContain('xaiApiKeyLogFields');
    expect(media).toContain('isGrokAudioDeltaType');
    expect(media).toContain('extractGrokAudioPayload');
    expect(media).toContain('extractTelnyxInboundAudioPayload');
    expect(media).toContain("eventType === 'session.updated'");
    expect(media).toContain('formatFirstTelnyxInboundMediaLog');
    expect(media).toContain('formatFirstGrokAudioToTelnyxLog');
    expect(media).toContain('formatGrokEmptyResponseLog');
    expect(media).not.toMatch(/eventType === 'response\.audio\.delta'/);
    expect(media).toContain('resolveDemoAgentName');
    expect(media).toContain('buildDemoCloserPrompt');
    expect(media).toContain('resolveDemoVoice');
    expect(media).toContain('upsertDemoCallMeLead');
    expect(media).not.toMatch(/Math\.random\(\).*voice/);
    expect(router).toContain('resolved.mode');
  });
});

describe('Grok audio delta event types (xAI 2026)', () => {
  it('accepts both current and OpenAI-compat names', () => {
    expect(GROK_AUDIO_DELTA_TYPES).toContain('response.output_audio.delta');
    expect(GROK_AUDIO_DELTA_TYPES).toContain('response.audio.delta');
    expect(isGrokAudioDeltaType('response.output_audio.delta')).toBe(true);
    expect(isGrokAudioDeltaType('response.audio.delta')).toBe(true);
    expect(isGrokAudioDeltaType('response.done')).toBe(false);
    expect(isGrokTranscriptDeltaType('response.output_audio_transcript.delta')).toBe(true);
    expect(isGrokTranscriptDeltaType('response.audio_transcript.delta')).toBe(true);
  });

  it('reads audio from delta or audio and skips empty payloads', () => {
    expect(extractGrokAudioPayload({ delta: 'YWJj' })).toBe('YWJj');
    expect(extractGrokAudioPayload({ audio: 'ZGVm' })).toBe('ZGVm');
    expect(extractGrokAudioPayload({ delta: '  ', audio: 'ZGVm' })).toBe('ZGVm');
    expect(extractGrokAudioPayload({ delta: '', audio: '' })).toBeUndefined();
    expect(extractGrokAudioPayload({})).toBeUndefined();
  });
});

describe('Telnyx inbound-only media filter', () => {
  it('treats missing track as inbound and drops outbound echo', () => {
    expect(isTelnyxInboundMediaTrack(undefined)).toBe(true);
    expect(isTelnyxInboundMediaTrack('')).toBe(true);
    expect(isTelnyxInboundMediaTrack('inbound')).toBe(true);
    expect(isTelnyxInboundMediaTrack('inbound_track')).toBe(true);
    expect(isTelnyxInboundMediaTrack('outbound')).toBe(false);
    expect(isTelnyxInboundMediaTrack('outbound_track')).toBe(false);
  });

  it('extracts inbound PCMU and ignores outbound / empty', () => {
    const inbound = extractTelnyxInboundAudioPayload({
      event: 'media',
      media: { track: 'inbound', payload: 'YWJj' },
    });
    expect(inbound?.payload).toBe('YWJj');
    expect(inbound?.track).toBe('inbound');
    expect(inbound?.bytes).toBe(3);

    expect(extractTelnyxInboundAudioPayload({
      event: 'media',
      media: { track: 'outbound', payload: 'YWJj' },
    })).toBeUndefined();

    expect(extractTelnyxInboundAudioPayload({
      event: 'start',
      media: { payload: 'YWJj' },
    })).toBeUndefined();
  });
});

describe('Telnyx outbound media frame', () => {
  it('matches the official Client Media Frame (event + media.payload)', () => {
    expect(buildTelnyxOutboundMediaMessage('YWJj')).toEqual({
      event: 'media',
      media: { payload: 'YWJj' },
    });
    expect(buildTelnyxOutboundMediaMessage('YWJj', 'sid-1')).toEqual({
      event: 'media',
      streamSid: 'sid-1',
      media: { payload: 'YWJj' },
    });
  });

  it('counts decoded bytes not base64 string length', () => {
    expect(base64PayloadBytes('YWJj')).toBe(3);
    expect(summarizeEventCounts({ 'response.output_audio.delta': 4, 'session.updated': 1 }))
      .toBe('response.output_audio.delta:4,session.updated:1');
    expect(summarizeEventCounts({})).toBe('none');
  });
});

describe('Grok session.update uses audio/pcmu for Telnyx', () => {
  it('maps pcmu to nested audio/pcmu plus legacy g711_ulaw', () => {
    expect(toXaiCodec('pcmu')).toEqual({ type: 'audio/pcmu' });
    expect(toXaiCodec('pcma')).toEqual({ type: 'audio/pcma' });
    expect(toXaiCodec('pcm')).toEqual({ type: 'audio/pcm', rate: 24000 });
    expect(toLegacyXaiFormat('pcmu')).toBe('g711_ulaw');

    const update = GrokVoiceAdapter.buildSessionUpdate({
      sessionId: 'grok_1',
      systemPrompt: 'You are Aria.',
      voice: 'Eve',
      audioInputFormat: 'pcmu',
      audioOutputFormat: 'pcmu',
    });

    expect(update.type).toBe('session.update');
    expect(update.session.voice).toBe('eve');
    expect(update.session.audio.input.format).toEqual({ type: 'audio/pcmu' });
    expect(update.session.audio.output.format).toEqual({ type: 'audio/pcmu' });
    expect(update.session.audio.input.transport).toBe('json');
    expect(update.session.input_audio_format).toBe('g711_ulaw');
    expect(update.session).not.toHaveProperty('input_audio_transcription');
    expect(JSON.stringify(update)).not.toContain('whisper-1');
  });

  it('flushes agent transcript from the current xAI delta name', () => {
    const sessionId = 'grok_transcript_test';
    GrokVoiceAdapter.processEvent(sessionId, {
      type: 'response.output_audio_transcript.delta',
      delta: 'Hello there',
    });
    const done = GrokVoiceAdapter.processEvent(sessionId, { type: 'response.done' });
    expect(done.flushedAgentText).toBe('Hello there');
  });
});

describe('Railway-visible audio-path log messages', () => {
  it('puts byte counts and event types on first-frame / empty-response lines', () => {
    expect(formatFirstTelnyxInboundMediaLog({
      callSid: 'v2:abc',
      track: 'inbound',
      payloadBytes: 160,
    })).toContain('Telnyx first inbound media frame');
    expect(formatFirstTelnyxInboundMediaLog({
      callSid: 'v2:abc',
      track: 'inbound',
      payloadBytes: 160,
    })).toContain('payloadBytes=160');

    expect(formatFirstGrokAudioEventLog({
      callSid: 'v2:abc',
      eventType: 'response.output_audio.delta',
      payloadBytes: 320,
      field: 'delta',
    })).toContain('Grok first audio delta received');

    expect(formatFirstGrokAudioToTelnyxLog({
      callSid: 'v2:abc',
      eventType: 'response.output_audio.delta',
      payloadBytes: 320,
    })).toContain('Grok first audio frame sent to Telnyx');

    expect(formatGrokEmptyResponseLog({
      callSid: 'v2:abc',
      audioDeltasReceived: 0,
      audioBytesToTelnyx: 0,
      eventCounts: 'session.updated:1,response.done:1',
    })).toContain('Grok empty-response warning');

    expect(formatGrokAudioDroppedLog({
      callSid: 'v2:abc',
      reason: 'telnyx_ws_not_open',
      payloadBytes: 80,
    })).toContain('reason=telnyx_ws_not_open');

    expect(formatGrokSessionUpdateLog({ callSid: 'v2:abc', grokSessionId: 'grok_1' }))
      .toContain('codec=audio/pcmu');
    expect(formatGrokGreetingFallbackLog({ callSid: 'v2:abc' }))
      .toContain('Grok greeting fallback');
    expect(formatGrokNoAudioWatchdogLog({
      callSid: 'v2:abc',
      audioDeltasReceived: 0,
      audioBytesToTelnyx: 0,
      eventCounts: 'none',
    })).toContain('Grok no-audio watchdog');
    expect(formatGrokRelaySummaryLog({
      callSid: 'v2:abc',
      inboundFrames: 12,
      inboundBytes: 1920,
      audioDeltasReceived: 8,
      audioBytesToTelnyx: 2560,
      eventCounts: 'response.output_audio.delta:8',
    })).toContain('inboundFrames=12');
    expect(formatGrokUnexpectedBinaryLog({ callSid: 'v2:abc', bytes: 40 }))
      .toContain('Grok unexpected binary frame');
    expect(GROK_GREETING_FALLBACK_MS).toBe(1500);
  });
});
