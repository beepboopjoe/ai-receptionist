// ============================================================
// Telnyx Webhook Handler
//
// Telnyx sends ALL call lifecycle events to a single POST endpoint
// (unlike Twilio's separate status-callback + TwiML URLs).
//
// Event routing:
//   call.initiated   (inbound) → answer call
//   call.answered    (inbound) → start media stream immediately
//                   (outbound) → wait for AMD result
//   call.machine.detection.ended → if human: start stream + mark connected
//                                  if machine: handle voicemail
//   call.speak.ended             → hang up (voicemail message finished)
//   call.hangup                  → update DB call record
//
// Custom params travel through the call in base64-encoded `client_state`
// which Telnyx echoes back in every event payload.
// ============================================================
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { calls, tenants, campaignContacts, outboundCampaigns } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import {
  answerCall,
  startMediaStream,
  hangupCall,
  dropVoicemail,
} from '../campaigns/telnyx-dialer.service.js';
import { outboundDialerQueue } from '../../queue/queues.js';
import { config } from '../../config.js';
import pino from 'pino';

const logger = pino({ name: 'telnyx-webhook' });

// ---- Telnyx event shape ----

interface TelnyxEventPayload {
  call_control_id: string;
  call_leg_id?: string;
  call_session_id?: string;
  client_state?: string;
  connection_id?: string;
  direction?: 'incoming' | 'outgoing';
  from?: string;
  to?: string;
  /** AMD result — present on call.machine.detection.ended */
  result?: string;
  hangup_cause?: string;
  hangup_source?: string;
}

interface TelnyxEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: TelnyxEventPayload;
  };
}

// ---- client_state shape (what we encode when initiating / answering) ----

interface TelnyxCallState {
  /** Our internal calls.id */
  callId?: string;
  tenantId?: string;
  fromNumber?: string;
  /** call_control_id — echoed here so the WS handler has it from client_state */
  callSid?: string;
  /** Outbound campaign params */
  campaignContactId?: string;
  campaignId?: string;
  isOutbound?: boolean;
}

function encodeState(state: TelnyxCallState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

function decodeState(encoded?: string): TelnyxCallState {
  if (!encoded) return {};
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString()) as TelnyxCallState;
  } catch {
    return {};
  }
}

// ---- Main entry point ----

/**
 * Single handler for all Telnyx call events.
 * Responds with 200 immediately, processes asynchronously.
 */
export async function handleTelnyxWebhook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const event = request.body as TelnyxEvent;
  const eventType = event?.data?.event_type;
  const payload = event?.data?.payload;

  if (!eventType || !payload) {
    logger.warn({ body: request.body }, 'Malformed Telnyx webhook');
    return reply.status(400).send({ error: 'Invalid event body' });
  }

  // Acknowledge immediately — Telnyx expects a sub-second 200
  reply.status(200).send({ ok: true });

  // Process the event asynchronously so we never time out
  void dispatch(eventType, payload).catch((err) => {
    logger.error({ err, eventType, callControlId: payload.call_control_id }, 'Unhandled Telnyx event error');
  });
}

// ---- Event dispatcher ----

async function dispatch(
  eventType: string,
  payload: TelnyxEventPayload
): Promise<void> {
  const { call_control_id, client_state } = payload;
  const state = decodeState(client_state);

  logger.info({ eventType, callControlId: call_control_id, isOutbound: state.isOutbound }, 'Telnyx event');

  switch (eventType) {
    case 'call.initiated':
      await onCallInitiated(call_control_id, payload);
      break;

    case 'call.answered':
      await onCallAnswered(call_control_id, state, payload);
      break;

    case 'call.machine.detection.ended':
      await onAmdResult(call_control_id, state, payload.result ?? 'not_sure');
      break;

    case 'call.speak.ended':
      // Voicemail TTS finished — hang up gracefully
      await onSpeakEnded(call_control_id, state);
      break;

    case 'call.hangup':
      await onCallHangup(call_control_id, state, payload);
      break;

    default:
      logger.debug({ eventType }, 'Telnyx event type not handled');
  }
}

// ---- Event handlers ----

/**
 * Inbound call arrived — create DB record and answer.
 * Outbound calls never fire call.initiated (we initiated them).
 */
async function onCallInitiated(
  callControlId: string,
  payload: TelnyxEventPayload
): Promise<void> {
  if (payload.direction !== 'incoming') return;

  const fromNumber = payload.from ?? '';
  const toNumber = payload.to ?? '';

  // Resolve tenant from the Telnyx number
  // TODO: query integrations table WHERE provider='telnyx' AND metadata->>'phone_number' = toNumber
  const [tenant] = await db
    .select({ id: tenants.id, timezone: tenants.timezone })
    .from(tenants)
    .limit(1);

  if (!tenant) {
    logger.warn({ toNumber }, 'No tenant found for inbound call — hanging up');
    try { await hangupCall(callControlId); } catch { /* ignore */ }
    return;
  }

  // Create call record (rcCallId = call_control_id, same role as Twilio's CallSid)
  const [call] = await db
    .insert(calls)
    .values({
      tenantId: tenant.id,
      rcCallId: callControlId,
      direction: 'inbound',
      fromNumber,
      toNumber,
      status: 'active',
      startedAt: new Date(),
    })
    .returning({ id: calls.id });

  // Encode our params into client_state so they travel with the call
  const clientState = encodeState({
    callId: call?.id,
    tenantId: tenant.id,
    fromNumber,
    callSid: callControlId,
    isOutbound: false,
  });

  await answerCall(callControlId, clientState);
  logger.info({ callControlId, callId: call?.id, tenantId: tenant.id }, 'Inbound call answered');
}

/**
 * Call was answered.
 * - Inbound: start media stream immediately (no AMD).
 * - Outbound: AMD is running — wait for call.machine.detection.ended.
 */
async function onCallAnswered(
  callControlId: string,
  state: TelnyxCallState,
  payload: TelnyxEventPayload
): Promise<void> {
  if (state.isOutbound) {
    // Update dialed count on campaign
    if (state.campaignId) {
      await db
        .update(outboundCampaigns)
        .set({
          dialedCount: sql`${outboundCampaigns.dialedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(outboundCampaigns.id, state.campaignId));
    }
    logger.info({ callControlId }, 'Outbound call answered — awaiting AMD result');
  } else {
    // Inbound — start stream straight away
    await startStream(callControlId, state);
  }
}

/**
 * AMD result received for an outbound call.
 *
 * result values from Telnyx:
 *   'human'              — live human answered
 *   'machine_start'      — machine greeting has begun (not done yet)
 *   'machine_end_beep'   — beep detected; ready to leave message
 *   'machine_end_silence'— machine stopped speaking (no beep)
 *   'not_sure'           — AMD couldn't decide; treat as human
 *   'fax'                — fax tone detected
 */
async function onAmdResult(
  callControlId: string,
  state: TelnyxCallState,
  result: string
): Promise<void> {
  logger.info({ callControlId, result }, 'AMD result');

  if (result === 'human' || result === 'not_sure') {
    // Mark as connected in DB
    if (state.campaignContactId) {
      await db
        .update(campaignContacts)
        .set({ status: 'connected', updatedAt: new Date() })
        .where(eq(campaignContacts.id, state.campaignContactId));
    }
    if (state.campaignId) {
      await db
        .update(outboundCampaigns)
        .set({
          connectedCount: sql`${outboundCampaigns.connectedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(outboundCampaigns.id, state.campaignId));
    }
    await startStream(callControlId, state);
  } else {
    // Machine / fax — handle voicemail
    await handleMachineDetected(callControlId, state);
  }
}

/**
 * TTS voicemail message finished playing — hang up the call.
 */
async function onSpeakEnded(
  callControlId: string,
  state: TelnyxCallState
): Promise<void> {
  if (!state.isOutbound) return; // only relevant for voicemail drops
  try {
    await hangupCall(callControlId);
    logger.info({ callControlId }, 'Hung up after voicemail drop');
  } catch (err) {
    logger.warn({ err, callControlId }, 'Hangup after speak.ended failed (call may have already ended)');
  }
}

/**
 * Call ended — update our calls record.
 * The media stream close event handles transcript / qualification flow.
 * This handler is a safety net for calls that end without going through
 * the stream (e.g. no-answer, early hangup).
 */
async function onCallHangup(
  callControlId: string,
  state: TelnyxCallState,
  payload: TelnyxEventPayload
): Promise<void> {
  if (state.callId) {
    // Only update if still active — the stream handler may have already set 'completed'
    await db
      .update(calls)
      .set({ status: 'completed', endedAt: new Date(), updatedAt: new Date() })
      .where(eq(calls.id, state.callId));
  }

  // If the outbound lead is still in 'dialing' state (call dropped before AMD fired),
  // treat it as a no-answer so retry logic runs.
  if (state.campaignContactId) {
    const [cc] = await db
      .select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, state.campaignContactId))
      .limit(1);

    if (cc && cc.status === 'dialing') {
      logger.warn({ callControlId, campaignContactId: state.campaignContactId, cause: payload.hangup_cause }, 'Call dropped while dialing — queuing retry');
      await handleNoAnswer(cc);
    }
  }

  logger.info({ callControlId, cause: payload.hangup_cause }, 'Call hung up');
}

// ---- Internal helpers ----

async function startStream(
  callControlId: string,
  state: TelnyxCallState
): Promise<void> {
  const host = new URL(config.APP_URL).host;
  const streamUrl = `wss://${host}/api/v1/webhooks/telnyx/stream`;

  // Re-encode so WS handler gets the full params from the start event
  const clientState = encodeState({ ...state, callSid: callControlId });

  await startMediaStream(callControlId, streamUrl, clientState);
}

async function handleMachineDetected(
  callControlId: string,
  state: TelnyxCallState
): Promise<void> {
  const { campaignContactId, campaignId } = state;

  let voicemailMessage: string | null = null;
  if (campaignId) {
    const [campaign] = await db
      .select({ voicemailMessage: outboundCampaigns.voicemailMessage })
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.id, campaignId))
      .limit(1);
    voicemailMessage = campaign?.voicemailMessage ?? null;
  }

  if (campaignContactId) {
    await db
      .update(campaignContacts)
      .set({ status: 'voicemail', callSid: callControlId, outcome: 'voicemail', updatedAt: new Date() })
      .where(eq(campaignContacts.id, campaignContactId));
  }
  if (campaignId) {
    await db
      .update(outboundCampaigns)
      .set({
        voicemailCount: sql`${outboundCampaigns.voicemailCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(outboundCampaigns.id, campaignId));
  }

  if (voicemailMessage && campaignContactId) {
    // Enqueue voicemail drop as a BullMQ job so it survives transient failures
    await outboundDialerQueue.add(
      'outbound-voicemail-drop',
      { callSid: callControlId, message: voicemailMessage, campaignContactId },
      { delay: 500 }
    );
  } else {
    try {
      await hangupCall(callControlId);
    } catch (err) {
      logger.warn({ err, callControlId }, 'Could not hang up voicemail call');
    }
  }
}

async function handleNoAnswer(
  cc: typeof campaignContacts.$inferSelect
): Promise<void> {
  let maxRetries = 3;
  let retryDelayMinutes = 60;

  if (cc.campaignId) {
    const [campaign] = await db
      .select({
        maxRetries: outboundCampaigns.maxRetries,
        retryDelayMinutes: outboundCampaigns.retryDelayMinutes,
      })
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.id, cc.campaignId))
      .limit(1);
    if (campaign) {
      maxRetries = campaign.maxRetries;
      retryDelayMinutes = campaign.retryDelayMinutes;
    }
  }

  if (cc.retryCount < maxRetries) {
    const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60_000);
    await db
      .update(campaignContacts)
      .set({ status: 'pending', retryCount: cc.retryCount + 1, nextRetryAt, updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));

    await outboundDialerQueue.add(
      'outbound-dial',
      { campaignContactId: cc.id, campaignId: cc.campaignId, tenantId: cc.tenantId },
      { delay: retryDelayMinutes * 60_000 }
    );
    logger.info({ campaignContactId: cc.id, retryCount: cc.retryCount + 1 }, 'Scheduled retry');
  } else {
    await db
      .update(campaignContacts)
      .set({ status: 'failed', outcome: 'no_answer', updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));

    if (cc.campaignId) {
      await db
        .update(outboundCampaigns)
        .set({
          failedCount: sql`${outboundCampaigns.failedCount} + 1`,
          dialedCount: sql`${outboundCampaigns.dialedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(outboundCampaigns.id, cc.campaignId));
    }
    logger.info({ campaignContactId: cc.id }, 'Max retries exhausted — marked failed');
  }
}
