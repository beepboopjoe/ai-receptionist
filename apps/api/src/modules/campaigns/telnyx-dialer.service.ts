// ============================================================
// Telnyx Dialer Service
//
// Wraps the Telnyx Call Control REST API (v2).
// Auth: Bearer token in every request (TELNYX_API_KEY).
// All call actions are fire-and-forget REST POSTs.
// ============================================================
import { config } from '../../config.js';
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
  const url = `${TELNYX_API}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telnyx ${path} → ${res.status}: ${text}`);
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
    webhook_url: `${config.APP_URL}/api/v1/webhooks/telnyx`,
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
 * (both_tracks = inbound caller audio + outbound AI audio in one stream).
 */
export async function startMediaStream(
  callControlId: string,
  streamUrl: string,
  clientState: string
): Promise<void> {
  await post(`/calls/${callControlId}/actions/stream_start`, {
    stream_url: streamUrl,
    stream_track: 'both_tracks',
    enable_dialogflow: false,
    // Note: client_state is not a supported field on stream_start.
    // The client_state from the original dialLead() / answerCall() is automatically
    // echoed by Telnyx in the WS 'start' event — no need to re-send it here.
  });
  logger.info({ callControlId, streamUrl }, 'Media stream started');

  // Separately update client_state with enriched params (including callId)
  // via the 'client_state_update' action so the WS handler has full context.
  try {
    await post(`/calls/${callControlId}/actions/client_state_update`, {
      client_state: clientState,
    });
  } catch (err) {
    // Non-blocking — the WS handler will still function with the original client_state
    logger.warn({ err, callControlId }, 'client_state_update failed (non-blocking)');
  }
}

/**
 * Hang up a call immediately.
 */
export async function hangupCall(callControlId: string): Promise<void> {
  await post(`/calls/${callControlId}/actions/hangup`, {});
  logger.info({ callControlId }, 'Call hung up');
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
