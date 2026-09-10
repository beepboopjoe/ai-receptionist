// ============================================================
// Telnyx Dialer Service
//
// Wraps the Telnyx Call Control REST API (v2).
// Auth: Bearer token in every request (TELNYX_API_KEY).
// All call actions are fire-and-forget REST POSTs.
// ============================================================
import { config } from '../../config.js';
import { telnyxWebhookUrl, telnyxMediaStreamUrl } from '../../lib/public-url.js';
import { telnyxAuthorizationHeader, TelnyxHttpError } from '../../lib/telnyx-auth.js';
import {
  buildDialMediaStreamFields,
  buildStreamingStartBody,
  formatAlreadyStreamingTreatedAsSuccessLog,
  formatStreamingStartFailureLog,
  formatStreamingStartSuccessLog,
  isAlreadyStreamingError,
  telnyxStreamingStartPath,
} from '../telephony/telnyx-stream.helpers.js';
import pino from 'pino';

const logger = pino({ name: 'telnyx-dialer' });
const TELNYX_API = 'https://api.telnyx.com/v2';

// ---- Public interfaces ----

export interface DialLeadParams {
  to: string;
  from: string;
  campaignContactId: string;
  tenantId: string;
  campaignId: string;
  /** Our internal calls.id — encoded in client_state so the WS handler can key DB updates */
  callId: string;
}

export interface DialResult {
  /** Telnyx call_control_id — used everywhere the old CallSid was used */
  callSid: string;
}

// ---- Internal REST helper ----

async function post(path: string, body: object): Promise<unknown> {
  const authorization = telnyxAuthorizationHeader(config.TELNYX_API_KEY);
  if (!authorization) {
    throw new TelnyxHttpError(path, 401, 'TELNYX_API_KEY is empty');
  }

  const url = `${TELNYX_API}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new TelnyxHttpError(path, res.status, await res.text());
  }

  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? res.json() : null;
}

// ---- Public API ----

/**
 * Initiate an outbound call for a campaign lead.
 *
 * AMD mode: 'detect_beep' — Telnyx fires call.machine.detection.ended once it
 * knows the result (human / machine_end_beep / etc.).  The webhook handler
 * starts the media stream only after a 'human' result, so we never waste a
 * Grok session on a voicemail greeting.
 *
 * All params including callId are encoded into client_state (base64 JSON) because
 * Telnyx echoes client_state back in every subsequent event for the call lifecycle.
 * This means the media stream WS handler gets callId without a DB lookup.
 */
export async function dialLead(params: DialLeadParams): Promise<DialResult> {
  const { to, from, campaignContactId, tenantId, campaignId, callId } = params;

  const clientState = Buffer.from(
    JSON.stringify({ campaignContactId, tenantId, campaignId, callId, isOutbound: true })
  ).toString('base64');

  const body: Record<string, unknown> = {
    connection_id: config.TELNYX_APP_ID,
    to,
    from,
    answering_machine_detection: 'detect_beep',
    answering_machine_detection_config: {
      // Silence after which Telnyx concludes it's a human (ms)
      after_silence_millis: 800,
      // Max time to run AMD before giving up
      total_analysis_time_millis: 30_000,
    },
    // All events for this call come to our single webhook endpoint
    webhook_url: telnyxWebhookUrl(config.APP_URL),
    webhook_url_method: 'POST',
    client_state: clientState,
    // Ring for up to 30 s before no-answer
    timeout_secs: 30,
  };

  const result = (await post('/calls', body)) as { data: { call_control_id: string } };
  const callControlId = result.data.call_control_id;

  logger.info({ callControlId, to }, 'Outbound call initiated via Telnyx');
  return { callSid: callControlId };
}

export interface DialDirectParams {
  to: string;
  from: string;
  /** Our internal calls.id — encoded in client_state for downstream handlers. */
  callId: string;
  /** Tenant whose AI config drives the call (demo tenant for /public/call-me,
   *  the owner's own tenant for /calls/test-call). */
  tenantId: string;
  /** Phone number presented to media-stream.handler as the "caller" — for
   *  call-me widgets this is the visitor's number, for test-calls this is the
   *  owner's cell. Treated as inbound from the AI's perspective. */
  fromNumber: string;
  /** Why this call exists. Stamped into the audit log + the call record. */
  mode: 'demo' | 'self_test' | 'ai_task';
  /**
   * Phase 29b — plain-English task for an "Ask your AI" single-task call.
   * Rides in client_state; the prompt-builder injects it as a
   * `# Your Task This Call` section.
   */
  adHocTask?: string;
  /**
   * Optional leftover call-me language. Live public call-me omits this so
   * the prompt detects language from speech (English fallback).
   * Omit for test-call / ask-your-AI.
   */
  language?: string;
  /**
   * Homepage call-me Grok voice. Public dials pin aurora. Encoded in
   * client_state; media-stream uses it only when mode is demo.
   * Omit for test-call / ask-your-AI so the tenant's saved voice is used.
   */
  voice?: string;
}

/**
 * Initiate a direct outbound call — no campaign, no AMD, no machine detection.
 * Used by the call-me-now widget (visitor's phone) and the test-call button
 * (owner's cell). When the callee answers we want the media stream to start
 * immediately and behave like an inbound call — the AI greets the callee as
 * if they had called us.
 *
 * Stream ownership: THIS dial owns the single bidirectional RTP slot.
 * We attach stream_url on POST /v2/calls (Telnyx opens the WS at answer).
 * client_state.streamAttachedAtDial=true tells call.answered / call.bridged
 * to skip a second streaming_start — Telnyx 90046 (concurrency=1) otherwise
 * fights the dial-time stream and the callee hears silence.
 *
 * Do NOT encode an empty callSid — empty string blocks `??` fallback in the WS
 * start handler. Omit callSid here; enrich it after Telnyx returns the id.
 */
export async function dialDirect(params: DialDirectParams): Promise<DialResult> {
  const { to, from, callId, tenantId, fromNumber, mode, adHocTask, language, voice } = params;

  const state: Record<string, unknown> = {
    callId,
    tenantId,
    fromNumber, // the visitor / owner — the "caller" from the AI's POV
    isOutbound: false, // skip AMD; treat as inbound-style for greeting
    streamAttachedAtDial: true, // dial owns RTP — do not streaming_start again
    mode, // surfaces in dispatched events for analytics
    ...(adHocTask && { adHocTask }), // Phase 29b — Ask-your-AI task text
    ...(language && { language }),
    ...(voice && { voice }),
  };

  const clientState = Buffer.from(JSON.stringify(state)).toString('base64');

  // Telnyx requires `from` to be a number owned by `connection_id`
  // (TELNYX_APP_ID). A DEMO_FROM_NUMBER on another Call Control app → 422.
  const streamUrl = telnyxMediaStreamUrl(config.APP_URL);
  const body: Record<string, unknown> = {
    connection_id: config.TELNYX_APP_ID,
    to,
    from,
    // Intentionally no answering_machine_detection — the callee is the demo
    // visitor or the owner themselves, we know it's a human.
    webhook_url: telnyxWebhookUrl(config.APP_URL),
    webhook_url_method: 'POST',
    client_state: clientState,
    timeout_secs: 30,
    ...buildDialMediaStreamFields(streamUrl),
  };

  const result = (await post('/calls', body)) as { data: { call_control_id: string } };
  const callControlId = result.data.call_control_id;

  logger.info(
    { callControlId, to, mode, streamUrl, streamOwner: 'dial' },
    `Direct outbound call initiated via Telnyx callControlId=${callControlId} mode=${mode} streamUrl=${streamUrl} streamOwner=dial`,
  );

  // Best-effort: stamp callSid now so later events / a late WS start have it.
  // The WS handler still falls back to start.call_control_id if this races.
  void updateCallClientState(
    callControlId,
    Buffer.from(JSON.stringify({ ...state, callSid: callControlId })).toString('base64'),
  );

  return { callSid: callControlId };
}

/**
 * Answer an inbound call.
 * client_state is our base64-encoded params that Telnyx will echo back in
 * every subsequent event (call.answered, call.hangup, etc.).
 */
export async function answerCall(
  callControlId: string,
  clientState: string
): Promise<void> {
  await post(`/calls/${callControlId}/actions/answer`, { client_state: clientState });
  logger.info({ callControlId }, 'Inbound call answered');
}

/**
 * Start a bidirectional media stream for an in-progress call.
 * Telnyx opens a WebSocket to streamUrl and begins streaming audio
 * (inbound_track = far-end mic only; we send Grok audio via bidirectional RTP).
 */
export async function updateCallClientState(
  callControlId: string,
  clientState: string,
): Promise<void> {
  try {
    await post(`/calls/${callControlId}/actions/client_state_update`, {
      client_state: clientState,
    });
  } catch (err) {
    // Non-blocking — the WS handler falls back to start.call_control_id
    logger.warn(
      { err, callControlId },
      `client_state_update failed (non-blocking) callControlId=${callControlId}`,
    );
  }
}

export async function startMediaStream(
  callControlId: string,
  streamUrl: string,
  clientState: string
): Promise<void> {
  const path = telnyxStreamingStartPath(callControlId);
  const body = buildStreamingStartBody(streamUrl, clientState);
  try {
    await post(path, body);
    logger.info(
      { callControlId, streamUrl },
      formatStreamingStartSuccessLog({ callControlId, streamUrl }),
    );
  } catch (err) {
    if (isAlreadyStreamingError(err)) {
      // Dial-time stream (or a prior start) already holds the RTP slot.
      // 90046 / already-streaming 422s are success — do not throw Unhandled.
      logger.info(
        { callControlId, streamUrl },
        formatAlreadyStreamingTreatedAsSuccessLog({ callControlId, streamUrl, err }),
      );
    } else {
      logger.error(
        { err, callControlId, streamUrl, path },
        formatStreamingStartFailureLog({ callControlId, streamUrl, err }),
      );
      throw err;
    }
  }

  // Enrich client_state (callSid) so a late WS start event has full context.
  await updateCallClientState(callControlId, clientState);
}

/**
 * Hang up a call immediately.
 */
export async function hangupCall(callControlId: string): Promise<void> {
  await post(`/calls/${callControlId}/actions/hangup`, {});
  logger.info({ callControlId }, 'Call hung up');
}

/**
 * Start an MP3 recording on an in-progress Call Control leg.
 * Failures are logged and ignored — never fail the live call.
 */
export async function startCallRecording(callControlId: string): Promise<void> {
  try {
    await post(`/calls/${callControlId}/actions/record_start`, {
      format: 'mp3',
      channels: 'single',
    });
    logger.info({ callControlId }, 'Call recording started');
  } catch (err) {
    logger.warn({ err, callControlId }, 'record_start failed (non-blocking)');
  }
}

export async function stopMediaStream(callControlId: string): Promise<void> {
  try {
    await post(`/calls/${callControlId}/actions/streaming_stop`, {});
  } catch (err) {
    logger.warn({ err, callControlId }, 'streaming_stop failed (non-blocking)');
  }
}

export async function joinCallToConference(
  callControlId: string,
  conferenceName: string,
  opts?: { startConferenceOnEnter?: boolean; endConferenceOnExit?: boolean }
): Promise<void> {
  await post(`/calls/${callControlId}/actions/join`, {
    conference_name: conferenceName,
    start_conference_on_enter: opts?.startConferenceOnEnter ?? true,
    end_conference_on_exit: opts?.endConferenceOnExit ?? false,
    beep_enabled: 'never',
  });
}

/**
 * Transfer an answered inbound call to a staff / business-line number.
 * Used by after_hours_ai (during hours) and as a fallback path.
 */
export async function transferInboundCall(
  callControlId: string,
  to: string,
  opts?: { from?: string; timeoutSecs?: number; clientState?: string }
): Promise<void> {
  const body: Record<string, unknown> = { to };
  if (opts?.from) body.from = opts.from;
  if (opts?.timeoutSecs != null) body.timeout_secs = opts.timeoutSecs;
  if (opts?.clientState) body.client_state = opts.clientState;
  await post(`/calls/${callControlId}/actions/transfer`, body);
  logger.info({ callControlId, to, timeoutSecs: opts?.timeoutSecs }, 'Inbound call transferred to staff');
}

export async function dialStaffJoin(params: {
  to: string;
  from: string;
  originalCallId: string;
  originalCallControlId: string;
  conferenceName: string;
  tenantId: string;
}): Promise<{ callControlId: string }> {
  const state = {
    kind: 'supervisor_join',
    isOutbound: true,
    originalCallId: params.originalCallId,
    originalCallControlId: params.originalCallControlId,
    conferenceName: params.conferenceName,
    tenantId: params.tenantId,
    callId: params.originalCallId,
  };
  const clientState = Buffer.from(JSON.stringify(state)).toString('base64');
  const body = {
    connection_id: config.TELNYX_APP_ID,
    to: params.to,
    from: params.from,
    webhook_url: telnyxWebhookUrl(config.APP_URL),
    webhook_url_method: 'POST',
    client_state: clientState,
    timeout_secs: 30,
  };
  const result = (await post('/calls', body)) as { data: { call_control_id: string } };
  const callControlId = result.data.call_control_id;
  logger.info(
    { callControlId, to: params.to, originalCallId: params.originalCallId },
    'Supervisor join dial initiated'
  );
  return { callControlId };
}

/**
 * Dial staff for overflow_ai. Same conference join as supervisor, but
 * call.hangup on this leg starts the AI on the original inbound if staff
 * never answered.
 */
export async function dialOverflowStaff(params: {
  to: string;
  from: string;
  originalCallId: string;
  originalCallControlId: string;
  conferenceName: string;
  tenantId: string;
}): Promise<{ callControlId: string }> {
  const state = {
    kind: 'overflow_staff',
    isOutbound: true,
    originalCallId: params.originalCallId,
    originalCallControlId: params.originalCallControlId,
    conferenceName: params.conferenceName,
    tenantId: params.tenantId,
    callId: params.originalCallId,
  };
  const clientState = Buffer.from(JSON.stringify(state)).toString('base64');
  const body = {
    connection_id: config.TELNYX_APP_ID,
    to: params.to,
    from: params.from,
    webhook_url: telnyxWebhookUrl(config.APP_URL),
    webhook_url_method: 'POST',
    client_state: clientState,
    timeout_secs: 25,
  };
  const result = (await post('/calls', body)) as { data: { call_control_id: string } };
  const callControlId = result.data.call_control_id;
  logger.info(
    { callControlId, to: params.to, originalCallId: params.originalCallId },
    'Overflow staff dial initiated'
  );
  return { callControlId };
}

/**
 * Drop a TTS voicemail message into an in-progress call.
 *
 * The call.speak.ended webhook event is handled in telnyx-webhook.handler.ts
 * and fires hangupCall() there. The setTimeout is a safety net in case that
 * event never arrives (e.g. network partition).
 */
export async function dropVoicemail(
  callControlId: string,
  message: string
): Promise<void> {
  // Telnyx Polly TTS — use Amazon Polly neural voice for natural sound
  await post(`/calls/${callControlId}/actions/speak`, {
    payload: message,
    voice: 'Polly.Joanna-Neural',
    language: 'en-US',
    payload_type: 'text',
    service_level: 'premium',
  });

  logger.info({ callControlId }, 'Voicemail TTS started');

  // Safety net: hang up after 60 s if call.speak.ended never fires
  setTimeout(async () => {
    try {
      await hangupCall(callControlId);
    } catch {
      // Call likely already ended — ignore
    }
  }, 60_000);
}
