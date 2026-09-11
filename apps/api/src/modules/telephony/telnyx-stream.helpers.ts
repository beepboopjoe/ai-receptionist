// ============================================================
// Telnyx media-stream helpers (pure — no DB / config).
//
// Telnyx Call Control streams audio over WebSocket. The command is
// `streaming_start` (NOT `stream_start`, which 404s). Bidirectional
// Grok audio requires RTP + PCMU; the default MP3 playback mode
// cannot play g711_ulaw frames from xAI.
// ============================================================
import type { WebSocket } from 'ws';
import {
  clipXaiLogBody,
  httpStatusFromWsConnectError,
  type XaiApiKeyLogFields,
} from '../../lib/xai-auth.js';

/** Official Call Control action. `stream_start` is not a Telnyx route. */
export const TELNYX_STREAMING_START_ACTION = 'streaming_start';

export function telnyxStreamingStartPath(callControlId: string): string {
  return `/calls/${callControlId}/actions/${TELNYX_STREAMING_START_ACTION}`;
}

export interface StreamingStartBody {
  stream_url: string;
  /**
   * Receive only the far-end (callee/caller) mic. `both_tracks` echoes our
   * own Grok audio back as `outbound`, which server_vad treats as barge-in
   * and cancels the greeting — the phone stays silent.
   */
  stream_track: 'inbound_track';
  stream_codec: 'PCMU';
  stream_bidirectional_mode: 'rtp';
  stream_bidirectional_codec: 'PCMU';
  stream_bidirectional_sampling_rate: 8000;
  stream_bidirectional_target_legs: 'both';
  enable_dialogflow: false;
  client_state?: string;
}

/**
 * Body for POST /v2/calls/{id}/actions/streaming_start.
 * PCMU + RTP so Grok's g711_ulaw frames play on the call.
 */
export function buildStreamingStartBody(
  streamUrl: string,
  clientState?: string,
): StreamingStartBody {
  return {
    stream_url: streamUrl,
    stream_track: 'inbound_track',
    stream_codec: 'PCMU',
    stream_bidirectional_mode: 'rtp',
    stream_bidirectional_codec: 'PCMU',
    stream_bidirectional_sampling_rate: 8000,
    stream_bidirectional_target_legs: 'both',
    enable_dialogflow: false,
    ...(clientState ? { client_state: clientState } : {}),
  };
}

/**
 * Same media-stream fields on POST /v2/calls so dialDirect can attach
 * the stream at dial time. Telnyx opens the WS when the callee answers.
 */
export function buildDialMediaStreamFields(streamUrl: string): Omit<StreamingStartBody, 'enable_dialogflow' | 'client_state'> {
  const { enable_dialogflow: _df, client_state: _cs, ...fields } = buildStreamingStartBody(streamUrl);
  return fields;
}

/** Telnyx 422 when a second bidirectional RTP stream fights the first (account limit = 1). */
export const TELNYX_CONCURRENT_STREAM_LIMIT_CODE = '90046';

/**
 * dialDirect / inbound encode isOutbound:false — start stream on answer, skip AMD.
 * Forward / overflow hold the inbound leg for staff first — do not attach Grok.
 */
export function shouldStartStreamOnAnswer(state: {
  isOutbound?: boolean;
  awaitingStaff?: boolean;
  routing?: string;
}): boolean {
  if (state.isOutbound === true) return false;
  if (state.awaitingStaff === true) return false;
  if (state.routing === 'forward' || state.routing === 'overflow') return false;
  return true;
}

/**
 * dialDirect attaches stream_url on POST /v2/calls. That call owns the single
 * bidirectional RTP slot — call.answered / call.bridged must NOT streaming_start.
 */
export function streamAlreadyOwnedByDial(state: { streamAttachedAtDial?: boolean }): boolean {
  return state.streamAttachedAtDial === true;
}

export function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export type MediaStreamCallSidSource =
  | 'client_state'
  | 'start.call_control_id'
  | 'event.call_control_id'
  | 'missing';

/**
 * Resolve Telnyx call_control_id for the media-stream handler.
 * Empty-string callSid in client_state (dialDirect used to encode `callSid:''`)
 * must NOT win over start.call_control_id — `??` does not fall through `''`.
 */
export function resolveMediaStreamCallSid(params: {
  stateCallSid?: string | null;
  startCallControlId?: string | null;
  topLevelCallControlId?: string | null;
}): { callSid: string; source: MediaStreamCallSidSource } {
  const stateCallSid = firstNonEmpty(params.stateCallSid);
  if (stateCallSid) return { callSid: stateCallSid, source: 'client_state' };
  const startId = firstNonEmpty(params.startCallControlId);
  if (startId) return { callSid: startId, source: 'start.call_control_id' };
  const topId = firstNonEmpty(params.topLevelCallControlId);
  if (topId) return { callSid: topId, source: 'event.call_control_id' };
  return { callSid: '', source: 'missing' };
}

export interface TelnyxMediaStartMessage {
  event?: string;
  call_control_id?: string;
  start?: {
    call_control_id?: string;
    stream_id?: string;
    client_state?: string;
  };
}

export function decodeTelnyxClientState(encoded?: string): Record<string, unknown> {
  if (!encoded) return {};
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export interface ResolvedMediaStreamParams {
  callId: string;
  tenantId: string;
  fromNumber: string;
  callSid: string;
  callSidSource: MediaStreamCallSidSource;
  campaignContactId?: string;
  campaignId?: string;
  adHocTask?: string;
  mode?: string;
  language?: string;
  voice?: string;
  missingFields: string[];
}

/** Decode a Telnyx WS `start` event into media-stream handler params. */
export function resolveMediaStreamParams(msg: TelnyxMediaStartMessage): ResolvedMediaStreamParams {
  const state = decodeTelnyxClientState(msg.start?.client_state);
  const { callSid, source } = resolveMediaStreamCallSid({
    stateCallSid: typeof state['callSid'] === 'string' ? state['callSid'] : undefined,
    startCallControlId: msg.start?.call_control_id,
    topLevelCallControlId: msg.call_control_id,
  });

  const callId = firstNonEmpty(typeof state['callId'] === 'string' ? state['callId'] : undefined);
  const tenantId = firstNonEmpty(typeof state['tenantId'] === 'string' ? state['tenantId'] : undefined);
  const fromNumber = firstNonEmpty(typeof state['fromNumber'] === 'string' ? state['fromNumber'] : undefined);

  const missing = (['callId', 'tenantId', 'fromNumber', 'callSid'] as const)
    .filter((key) => {
      if (key === 'callId') return !callId;
      if (key === 'tenantId') return !tenantId;
      if (key === 'fromNumber') return !fromNumber;
      return !callSid;
    });

  return {
    callId,
    tenantId,
    fromNumber,
    callSid,
    callSidSource: source,
    ...(asOptionalString(state['campaignContactId']) && {
      campaignContactId: asOptionalString(state['campaignContactId']),
    }),
    ...(asOptionalString(state['campaignId']) && {
      campaignId: asOptionalString(state['campaignId']),
    }),
    ...(asOptionalString(state['adHocTask']) && {
      adHocTask: asOptionalString(state['adHocTask']),
    }),
    ...(asOptionalString(state['mode']) && {
      mode: asOptionalString(state['mode']),
    }),
    ...(asOptionalString(state['language']) && {
      language: asOptionalString(state['language']),
    }),
    ...(asOptionalString(state['voice']) && {
      voice: asOptionalString(state['voice']),
    }),
    missingFields: [...missing],
  };
}

/**
 * 422s that mean "the dial-time (or prior) stream is already the owner".
 * Includes Telnyx 90046 — concurrent bidirectional RTP limit (1).
 */
export function isAlreadyStreamingError(err: unknown): boolean {
  const parts: string[] = [];
  if (err instanceof Error) parts.push(err.message);
  else parts.push(String(err ?? ''));
  if (err && typeof err === 'object') {
    const rec = err as { bodyClipped?: unknown; httpStatus?: unknown };
    if (typeof rec.bodyClipped === 'string') parts.push(rec.bodyClipped);
    if (rec.httpStatus != null) parts.push(String(rec.httpStatus));
  }
  const text = parts.join(' ');
  if (new RegExp(`\\b${TELNYX_CONCURRENT_STREAM_LIMIT_CODE}\\b`).test(text)) return true;
  if (/already\s+(been\s+)?stream/i.test(text)) return true;
  if (/streaming.*already/i.test(text)) return true;
  if (/concurrent bidirectional RTP streaming/i.test(text)) return true;
  if (/maximum concurrent.*stream/i.test(text)) return true;
  return false;
}

export function errMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Railway MCP/dashboard filter only keeps pino `msg` — put eventType + err in it. */
export function formatUnhandledTelnyxEventLog(eventType: string, err: unknown): string {
  return `Unhandled Telnyx event error eventType=${eventType || 'unknown'} err=${errMessageOf(err) || 'empty'}`;
}

export function formatTelnyxEventLog(params: {
  eventType: string;
  callControlId: string;
  isOutbound?: boolean;
  streamAttachedAtDial?: boolean;
}): string {
  return `Telnyx event eventType=${params.eventType || 'unknown'} callControlId=${params.callControlId || 'unset'} isOutbound=${params.isOutbound === true} streamAttachedAtDial=${params.streamAttachedAtDial === true}`;
}

export function formatStreamingStartLog(params: {
  callControlId: string;
  streamUrl: string;
}): string {
  return `Telnyx streaming_start requested callControlId=${params.callControlId || 'unset'} streamUrl=${params.streamUrl || 'unset'}`;
}

export function formatStreamingStartSuccessLog(params: {
  callControlId: string;
  streamUrl: string;
}): string {
  return `Media stream started callControlId=${params.callControlId || 'unset'} streamUrl=${params.streamUrl || 'unset'}`;
}

export function formatStreamingStartFailureLog(params: {
  callControlId: string;
  streamUrl: string;
  err: unknown;
}): string {
  return `Telnyx streaming_start failed callControlId=${params.callControlId || 'unset'} streamUrl=${params.streamUrl || 'unset'} err=${errMessageOf(params.err) || 'empty'}`;
}

export function formatStreamingStartSkippedLog(params: {
  reason: string;
  callControlId: string;
  streamUrl?: string;
}): string {
  return `Telnyx streaming_start skipped reason=${params.reason || 'unknown'} callControlId=${params.callControlId || 'unset'} streamUrl=${params.streamUrl || 'unset'}`;
}

export function formatAlreadyStreamingTreatedAsSuccessLog(params: {
  callControlId: string;
  streamUrl: string;
  err?: unknown;
}): string {
  return `Telnyx streaming_start already-active treated as success callControlId=${params.callControlId || 'unset'} streamUrl=${params.streamUrl || 'unset'} err=${errMessageOf(params.err) || 'empty'}`;
}

export function formatMediaStreamCallSidResolvedLog(params: {
  callSid: string;
  source: MediaStreamCallSidSource;
}): string {
  return `Telnyx media-stream callSid resolved callSid=${params.callSid || 'unset'} source=${params.source || 'missing'}`;
}

export function formatStreamingFailedEventLog(params: {
  callControlId: string;
  streamUrl?: string;
  failureReason?: string;
}): string {
  return `Telnyx streaming.failed callControlId=${params.callControlId || 'unset'} streamUrl=${params.streamUrl || 'unset'} reason=${params.failureReason || 'empty'}`;
}

export function formatStreamingStoppedEventLog(params: {
  callControlId: string;
  streamUrl?: string;
}): string {
  return `Telnyx streaming.stopped callControlId=${params.callControlId || 'unset'} streamUrl=${params.streamUrl || 'unset'}`;
}

export interface GrokConnectFailureLogFields extends Partial<XaiApiKeyLogFields> {
  callSid: string;
  tenantId?: string;
  err: unknown;
  httpStatus?: number | null;
  bodyClipped?: string;
  authHeaderPresent?: boolean;
  model?: string;
  wsUrl?: string;
}

/**
 * Railway MCP/dashboard filter only keeps pino `msg`. Put handshake
 * status, clipped body, and key presence (never the secret) in the
 * message so a 403 is diagnosable without opening structured fields.
 */
export function formatGrokConnectFailureLog(params: GrokConnectFailureLogFields): string {
  const status = params.httpStatus ?? httpStatusFromWsConnectError(params.err);
  const body = params.bodyClipped ? clipXaiLogBody(params.bodyClipped) : 'none';
  const prefix = params.apiKeyPrefix || 'none';
  const present = params.apiKeyPresent == null ? 'unknown' : String(params.apiKeyPresent);
  const len = params.apiKeyLen == null ? 'unknown' : String(params.apiKeyLen);
  const auth = params.authHeaderPresent == null ? 'unknown' : String(params.authHeaderPresent);
  const model = params.model || 'unset';
  const wsUrl = params.wsUrl || 'unset';
  return [
    'Grok realtime connect failed',
    `callSid=${params.callSid || 'unset'}`,
    `tenantId=${params.tenantId || 'unset'}`,
    `err=${errMessageOf(params.err) || 'empty'}`,
    `httpStatus=${status ?? 'unset'}`,
    `body=${body || 'empty'}`,
    `apiKeyPresent=${present}`,
    `apiKeyLen=${len}`,
    `apiKeyPrefix=${prefix}`,
    `authHeader=${auth}`,
    `model=${model}`,
    `wsUrl=${wsUrl}`,
    `keySanitized=${params.keySanitized === true}`,
    `placeholder=${params.placeholder === true}`,
  ].join(' ');
}

export function formatGrokGreetingLog(params: {
  callSid: string;
  grokSessionId?: string;
  method?: string;
  ms?: number;
}): string {
  const method = params.method || 'force_message';
  const ms = typeof params.ms === 'number' ? ` ms=${params.ms}` : '';
  return `Grok greeting sent method=${method} callSid=${params.callSid || 'unset'} grokSessionId=${params.grokSessionId || 'unset'}${ms}`;
}

export function formatMediaStreamStartLog(params: {
  callId: string;
  tenantId: string;
  callSid: string;
  missingFields?: string[];
}): string {
  const missing = params.missingFields?.length
    ? ` missing=${params.missingFields.join(',')}`
    : '';
  return `Telnyx media stream start callId=${params.callId || 'unset'} tenantId=${params.tenantId || 'unset'} callSid=${params.callSid || 'unset'}${missing}`;
}

export function formatMediaStreamWsConnectedLog(): string {
  return 'Telnyx media-stream WebSocket connected';
}

export function formatMediaStreamHandlerFailureLog(params: {
  callSid: string;
  tenantId?: string;
  err: unknown;
}): string {
  return `Media stream handler failed callSid=${params.callSid || 'unset'} tenantId=${params.tenantId || 'unset'} err=${errMessageOf(params.err) || 'empty'}`;
}

function isWsLike(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { on?: unknown }).on === 'function' &&
    typeof (value as { send?: unknown }).send === 'function'
  );
}

/**
 * @fastify/websocket v10 passes the WebSocket as the first handler arg.
 * Older versions passed `{ socket }`. Prefer an object with `.send` so we
 * do not unwrap `ws.WebSocket.socket` (the raw TCP socket).
 */
export function resolveFastifyWebsocket(connection: unknown): WebSocket {
  if (isWsLike(connection)) {
    return connection as WebSocket;
  }
  if (connection && typeof connection === 'object' && 'socket' in connection) {
    const inner = (connection as { socket?: unknown }).socket;
    if (isWsLike(inner)) {
      return inner as WebSocket;
    }
  }
  return connection as WebSocket;
}

/** Fallback only — live greeting is force_message (see grok-first-turn.ts). */
export const GROK_GREETING_CREATE = { type: 'response.create' } as const;

/** Current xAI name; `response.audio.delta` is the OpenAI-compat alias. */
export const GROK_AUDIO_DELTA_TYPES = [
  'response.output_audio.delta',
  'response.audio.delta',
] as const;

export const GROK_TRANSCRIPT_DELTA_TYPES = [
  'response.output_audio_transcript.delta',
  'response.audio_transcript.delta',
] as const;

/** Wait this long after session.update if session.updated never arrives. */
export const GROK_GREETING_FALLBACK_MS = 1500;

export function isGrokAudioDeltaType(type: unknown): boolean {
  return type === 'response.output_audio.delta' || type === 'response.audio.delta';
}

export function isGrokTranscriptDeltaType(type: unknown): boolean {
  return (
    type === 'response.output_audio_transcript.delta' ||
    type === 'response.audio_transcript.delta'
  );
}

/**
 * xAI puts the chunk in `delta` (quick-start) or `audio` (event reference).
 * Never return whitespace-only / empty — those would look like "audio sent".
 */
export function extractGrokAudioPayload(event: Record<string, unknown>): string | undefined {
  for (const key of ['delta', 'audio'] as const) {
    const value = event[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

export function base64PayloadBytes(payload: string): number {
  // Length of the decoded PCMU/RTP chunk — not the base64 string length.
  try {
    return Buffer.from(payload, 'base64').byteLength;
  } catch {
    return 0;
  }
}

/**
 * Telnyx `both_tracks` media frames include `track: "outbound"` (our own AI
 * audio). Forwarding those to Grok makes server_vad barge-in and mute the
 * greeting. Missing track = inbound (older payloads).
 */
export function isTelnyxInboundMediaTrack(track: unknown): boolean {
  if (track == null || track === '') return true;
  if (typeof track !== 'string') return true;
  const normalized = track.toLowerCase();
  if (normalized === 'outbound' || normalized === 'outbound_track') return false;
  return normalized === 'inbound' || normalized === 'inbound_track' || normalized.includes('inbound');
}

export function extractTelnyxInboundAudioPayload(
  msg: Record<string, unknown>,
): { payload: string; track: string; bytes: number } | undefined {
  if (msg['event'] !== 'media') return undefined;
  const media = msg['media'] as Record<string, unknown> | undefined;
  if (!media || typeof media !== 'object') return undefined;
  if (!isTelnyxInboundMediaTrack(media['track'])) return undefined;
  const payload = media['payload'];
  if (typeof payload !== 'string' || !payload.trim()) return undefined;
  const track = typeof media['track'] === 'string' && media['track'] ? media['track'] : 'inbound';
  return { payload, track, bytes: base64PayloadBytes(payload) };
}

export function buildTelnyxOutboundMediaMessage(
  payload: string,
  streamSid?: string,
): { event: 'media'; media: { payload: string }; streamSid?: string } {
  return streamSid
    ? { event: 'media', streamSid, media: { payload } }
    : { event: 'media', media: { payload } };
}

export function summarizeEventCounts(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, n]) => `${type}:${n}`);
  return parts.length ? parts.join(',') : 'none';
}

export function formatFirstTelnyxInboundMediaLog(params: {
  callSid: string;
  track: string;
  payloadBytes: number;
}): string {
  return `Telnyx first inbound media frame callSid=${params.callSid || 'unset'} track=${params.track || 'unset'} payloadBytes=${params.payloadBytes}`;
}

export function formatFirstGrokAudioEventLog(params: {
  callSid: string;
  eventType: string;
  payloadBytes: number;
  field: string;
}): string {
  return `Grok first audio delta received callSid=${params.callSid || 'unset'} eventType=${params.eventType || 'unknown'} field=${params.field || 'unset'} payloadBytes=${params.payloadBytes}`;
}

export function formatFirstGrokAudioToTelnyxLog(params: {
  callSid: string;
  eventType: string;
  payloadBytes: number;
}): string {
  return `Grok first audio frame sent to Telnyx callSid=${params.callSid || 'unset'} eventType=${params.eventType || 'unknown'} payloadBytes=${params.payloadBytes}`;
}

export function formatGrokEmptyResponseLog(params: {
  callSid: string;
  audioDeltasReceived: number;
  audioBytesToTelnyx: number;
  eventCounts: string;
}): string {
  return `Grok empty-response warning callSid=${params.callSid || 'unset'} audioDeltasReceived=${params.audioDeltasReceived} audioBytesToTelnyx=${params.audioBytesToTelnyx} eventTypes=${params.eventCounts || 'none'}`;
}

export function formatGrokAudioDroppedLog(params: {
  callSid: string;
  reason: string;
  payloadBytes: number;
}): string {
  return `Grok audio dropped callSid=${params.callSid || 'unset'} reason=${params.reason || 'unknown'} payloadBytes=${params.payloadBytes}`;
}

export function formatGrokSessionUpdateLog(params: { callSid: string; grokSessionId?: string }): string {
  return `Grok session.update sent callSid=${params.callSid || 'unset'} grokSessionId=${params.grokSessionId || 'unset'} codec=audio/pcmu`;
}

export function formatGrokGreetingFallbackLog(params: { callSid: string }): string {
  return `Grok greeting fallback (no session.updated) callSid=${params.callSid || 'unset'}`;
}

export function formatGrokNoAudioWatchdogLog(params: {
  callSid: string;
  audioDeltasReceived: number;
  audioBytesToTelnyx: number;
  eventCounts: string;
}): string {
  return `Grok no-audio watchdog callSid=${params.callSid || 'unset'} audioDeltasReceived=${params.audioDeltasReceived} audioBytesToTelnyx=${params.audioBytesToTelnyx} eventTypes=${params.eventCounts || 'none'}`;
}

export function formatGrokRelaySummaryLog(params: {
  callSid: string;
  inboundFrames: number;
  inboundBytes: number;
  audioDeltasReceived: number;
  audioBytesToTelnyx: number;
  eventCounts: string;
}): string {
  return `Grok↔Telnyx relay closed callSid=${params.callSid || 'unset'} inboundFrames=${params.inboundFrames} inboundBytes=${params.inboundBytes} audioDeltasReceived=${params.audioDeltasReceived} audioBytesToTelnyx=${params.audioBytesToTelnyx} eventTypes=${params.eventCounts || 'none'}`;
}

export function formatGrokUnexpectedBinaryLog(params: { callSid: string; bytes: number }): string {
  return `Grok unexpected binary frame callSid=${params.callSid || 'unset'} bytes=${params.bytes}`;
}
