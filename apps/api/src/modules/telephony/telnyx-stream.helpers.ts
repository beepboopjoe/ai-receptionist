// ============================================================
// Telnyx media-stream helpers (pure — no DB / config).
//
// Telnyx Call Control streams audio over WebSocket. The command is
// `streaming_start` (NOT `stream_start`, which 404s). Bidirectional
// Grok audio requires RTP + PCMU; the default MP3 playback mode
// cannot play g711_ulaw frames from xAI.
// ============================================================
import type { WebSocket } from 'ws';

/** Official Call Control action. `stream_start` is not a Telnyx route. */
export const TELNYX_STREAMING_START_ACTION = 'streaming_start';

export function telnyxStreamingStartPath(callControlId: string): string {
  return `/calls/${callControlId}/actions/${TELNYX_STREAMING_START_ACTION}`;
}

export interface StreamingStartBody {
  stream_url: string;
  stream_track: 'both_tracks';
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
    stream_track: 'both_tracks',
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

/** dialDirect / inbound encode isOutbound:false — start stream on answer, skip AMD. */
export function shouldStartStreamOnAnswer(state: { isOutbound?: boolean }): boolean {
  return state.isOutbound !== true;
}

export function isAlreadyStreamingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /already\s+(been\s+)?stream/i.test(msg) || /streaming.*already/i.test(msg);
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
}): string {
  return `Telnyx event eventType=${params.eventType || 'unknown'} callControlId=${params.callControlId || 'unset'} isOutbound=${params.isOutbound === true}`;
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

export function formatStreamingFailedEventLog(params: {
  callControlId: string;
  streamUrl?: string;
  failureReason?: string;
}): string {
  return `Telnyx streaming.failed callControlId=${params.callControlId || 'unset'} streamUrl=${params.streamUrl || 'unset'} reason=${params.failureReason || 'empty'}`;
}

export function formatGrokConnectFailureLog(params: {
  callSid: string;
  tenantId?: string;
  err: unknown;
}): string {
  return `Grok realtime connect failed callSid=${params.callSid || 'unset'} tenantId=${params.tenantId || 'unset'} err=${errMessageOf(params.err) || 'empty'}`;
}

export function formatGrokGreetingLog(params: { callSid: string; grokSessionId?: string }): string {
  return `Grok session.update + greeting sent callSid=${params.callSid || 'unset'} grokSessionId=${params.grokSessionId || 'unset'}`;
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

export const GROK_GREETING_CREATE = { type: 'response.create' } as const;
