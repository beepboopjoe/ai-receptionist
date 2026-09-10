// ============================================================
// Telnyx Webhook Handler
//
// Telnyx sends ALL call lifecycle events to a single POST endpoint
// (unlike Twilio's separate status-callback + TwiML URLs).
//
// Event routing:
//   call.initiated   (inbound) → answer call
//   call.answered    (inbound, isOutbound≠true, no dial-time stream) → streaming_start
//                   (dialDirect: streamAttachedAtDial) → skip — dial owns RTP
//                   (campaign outbound) → wait for AMD result
//   call.bridged     (inbound only) → streaming_start fallback; skip if dial owns RTP
//   call.machine.detection.ended → if human: start stream + mark connected
//                                  if machine: handle voicemail
//   call.speak.ended             → hang up (voicemail message finished)
//   streaming.started / streaming.failed → Railway-visible status
//   call.hangup                  → update DB call record
//
// Custom params travel through the call in base64-encoded `client_state`
// which Telnyx echoes back in every event payload.
// ============================================================
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { calls, tenants, campaignContacts, outboundCampaigns, contacts, smsMessages, notifications } from '../../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import {
  answerCall,
  startMediaStream,
  hangupCall,
  dropVoicemail,
  updateCallClientState,
  startCallRecording,
  stopMediaStream,
  joinCallToConference,
} from '../campaigns/telnyx-dialer.service.js';
import { outboundDialerQueue } from '../../queue/queues.js';
import { sendSms } from '../notifications/adapters/telnyx-sms.adapter.js';
import { getTenantFromNumber } from '../sms/tenant-from-number.js';
import { lookupTenantByDid } from '../phone-numbers/inbound-did.js';
import { extractTelnyxRecordingMp3Url, persistRecordingUrl } from './recording.js';
import { pushActivity } from '../activity/activity.service.js';
import { config } from '../../config.js';
import { telnyxMediaStreamUrl } from '../../lib/public-url.js';
import {
  formatStreamingFailedEventLog,
  formatStreamingStartFailureLog,
  formatStreamingStartLog,
  formatStreamingStartSkippedLog,
  formatStreamingStoppedEventLog,
  formatTelnyxEventLog,
  formatUnhandledTelnyxEventLog,
  shouldStartStreamOnAnswer,
  streamAlreadyOwnedByDial,
} from './telnyx-stream.helpers.js';
import pino from 'pino';

const logger = pino({ name: 'telnyx-webhook' });

// ---- Telnyx message event shape (message.received) ----
// These payloads are structurally different from call payloads.

interface TelnyxMessagePayload {
  id?: string;
  direction?: string;
  from?: { phone_number?: string };
  to?: Array<{ phone_number?: string }>;
  text?: string;
  type?: string;
}

interface TelnyxMessageEventData {
  event_type: string;
  id: string;
  occurred_at: string;
  payload: TelnyxMessagePayload;
}

// ---- Telnyx call event shape ----

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
  stream_url?: string;
  failure_reason?: string;
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
  /**
   * True when dialDirect attached stream_url on POST /v2/calls.
   * That dial owns the single bidirectional RTP slot — do not streaming_start.
   */
  streamAttachedAtDial?: boolean;
  /** 'supervisor_join' = staff leg dialed from the live-call Join button. */
  kind?: 'supervisor_join';
  originalCallId?: string;
  originalCallControlId?: string;
  conferenceName?: string;
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

  // Route message events separately — they have a different payload structure
  if (eventType === 'message.received') {
    void onMessageReceived(event.data as unknown as TelnyxMessageEventData).catch((err) => {
      logger.error({ err, eventType }, 'Unhandled message.received error');
    });
    return;
  }

  // Process the call event asynchronously so we never time out
  void dispatch(eventType, payload).catch((err) => {
    logger.error(
      { err, eventType, callControlId: payload.call_control_id },
      formatUnhandledTelnyxEventLog(eventType, err),
    );
  });
}

// ---- Event dispatcher ----

async function dispatch(
  eventType: string,
  payload: TelnyxEventPayload
): Promise<void> {
  const { call_control_id, client_state } = payload;
  const state = decodeState(client_state);

  logger.info(
    {
      eventType,
      callControlId: call_control_id,
      isOutbound: state.isOutbound,
      streamAttachedAtDial: state.streamAttachedAtDial,
    },
    formatTelnyxEventLog({
      eventType,
      callControlId: call_control_id,
      isOutbound: state.isOutbound,
      streamAttachedAtDial: state.streamAttachedAtDial,
    }),
  );

  switch (eventType) {
    case 'call.initiated':
      await onCallInitiated(call_control_id, payload);
      break;

    case 'call.answered':
      if (state.kind === 'supervisor_join') {
        await onSupervisorJoinAnswered(call_control_id, state);
        break;
      }
      await onCallAnswered(call_control_id, state, payload);
      break;

    case 'call.bridged':
      // Some outbound legs emit bridged instead of / in addition to answered.
      // Campaign outbound still waits for AMD. dialDirect already owns RTP.
      if (shouldStartStreamOnAnswer(state)) {
        await startStream(call_control_id, state);
      }
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

    case 'streaming.started':
      logger.info(
        { eventType, callControlId: call_control_id, streamUrl: payload.stream_url },
        `Telnyx streaming.started callControlId=${call_control_id} streamUrl=${payload.stream_url ?? 'unset'}`,
      );
      break;

    case 'streaming.failed':
      logger.error(
        { eventType, callControlId: call_control_id, streamUrl: payload.stream_url },
        formatStreamingFailedEventLog({
          callControlId: call_control_id,
          streamUrl: payload.stream_url,
          failureReason: payload.failure_reason ?? payload.hangup_cause,
        }),
      );
      break;

    case 'streaming.stopped':
      logger.info(
        { eventType, callControlId: call_control_id, streamUrl: payload.stream_url },
        formatStreamingStoppedEventLog({
          callControlId: call_control_id,
          streamUrl: payload.stream_url,
        }),
      );
      break;

    case 'call.recording.saved':
    case 'call.recording.transcription.saved':
      await onRecordingSaved(call_control_id, state, payload);
      break;

    default:
      logger.info({ eventType, callControlId: call_control_id }, `Telnyx event type not handled eventType=${eventType}`);
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

  const resolved = await lookupTenantByDid(toNumber);
  if (!resolved) {
    logger.warn({ toNumber }, 'No tenant found for inbound DID — hanging up');
    try { await hangupCall(callControlId); } catch { /* ignore */ }
    return;
  }

  const [tenant] = await db
    .select({ id: tenants.id, timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, resolved.tenantId))
    .limit(1);

  if (!tenant) {
    logger.warn({ toNumber, tenantId: resolved.tenantId }, 'Tenant row missing for inbound DID — hanging up');
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
  if (!shouldStartStreamOnAnswer(state)) {
    // Campaign outbound — AMD is running; wait for call.machine.detection.ended.
    if (state.campaignId) {
      await db
        .update(outboundCampaigns)
        .set({
          dialedCount: sql`${outboundCampaigns.dialedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(outboundCampaigns.id, state.campaignId));
    }
    logger.info({ callControlId }, `Outbound call answered — awaiting AMD result callControlId=${callControlId}`);
    return;
  }

  // Inbound — start stream immediately. dialDirect already attached the
  // stream on POST /v2/calls; a second streaming_start hits Telnyx 90046.
  await startStream(callControlId, state);
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
  if (state.kind === 'supervisor_join') {
    logger.info({ callControlId }, 'Supervisor join leg hung up');
    return;
  }

  if (state.callId) {
    // Don't clobber a live takeover/join — the stream handler persists
    // transcript after this webhook and should keep status=transferred.
    await db
      .update(calls)
      .set({ endedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(calls.id, state.callId), sql`${calls.status} NOT IN ('transferred', 'completed', 'missed')`));
    await db
      .update(calls)
      .set({ status: 'completed', endedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(calls.id, state.callId), sql`${calls.status} IN ('active', 'connected')`));
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

  // ── Missed-call text-back ─────────────────────────────────────────────────
  // Fire for inbound calls that ended quickly (< 15 s from creation), indicating
  // the caller hung up before the AI could help. Best-effort — never throws.
  // The text-back routes through the tenant's own provisioned number; the helper
  // skips if no number is provisioned.
  if (!state.isOutbound && state.callId && state.tenantId && state.fromNumber && config.TELNYX_API_KEY) {
    void sendMissedCallTextBack(state.callId, state.tenantId, state.fromNumber).catch((err) => {
      logger.warn({ err, callControlId }, 'Missed-call text-back failed');
    });
  }

  logger.info({ callControlId, cause: payload.hangup_cause }, 'Call hung up');
}

// ---- Internal helpers ----

async function startStream(
  callControlId: string,
  state: TelnyxCallState
): Promise<void> {
  const streamUrl = telnyxMediaStreamUrl(config.APP_URL);

  // Re-encode so WS handler gets the full params from the start event
  const clientState = encodeState({ ...state, callSid: callControlId });

  if (streamAlreadyOwnedByDial(state)) {
    logger.info(
      { callControlId, streamUrl, callId: state.callId, tenantId: state.tenantId, streamOwner: 'dial' },
      formatStreamingStartSkippedLog({
        reason: 'stream_attached_at_dial',
        callControlId,
        streamUrl,
      }),
    );
    // Still stamp callSid — the dial-time WS start may already have fired.
    await updateCallClientState(callControlId, clientState);
    void startCallRecording(callControlId);
    return;
  }

  logger.info(
    { callControlId, streamUrl, callId: state.callId, tenantId: state.tenantId, streamOwner: 'answer' },
    formatStreamingStartLog({ callControlId, streamUrl }),
  );

  try {
    await startMediaStream(callControlId, streamUrl, clientState);
  } catch (err) {
    logger.error(
      { err, callControlId, streamUrl, callId: state.callId, tenantId: state.tenantId },
      formatStreamingStartFailureLog({ callControlId, streamUrl, err }),
    );
    throw err;
  }

  void startCallRecording(callControlId);
}

async function onRecordingSaved(
  callControlId: string,
  state: TelnyxCallState,
  payload: TelnyxEventPayload
): Promise<void> {
  const url = extractTelnyxRecordingMp3Url(payload);
  if (!url) {
    logger.warn({ callControlId }, 'call.recording.saved without an MP3 URL');
    return;
  }
  const ok = await persistRecordingUrl({
    url,
    callId: state.callId,
    callControlId,
  });
  logger.info({ callControlId, callId: state.callId, persisted: ok }, 'Call recording URL saved');
}

/**
 * Staff answered the Join-call dial. Drop the AI stream, conference the
 * original caller with the staff leg. Same activity event as takeover so
 * the live drawer closes.
 */
async function onSupervisorJoinAnswered(
  staffCallControlId: string,
  state: TelnyxCallState
): Promise<void> {
  const originalId = state.originalCallControlId;
  const conferenceName = state.conferenceName;
  if (!originalId || !conferenceName) {
    logger.warn({ staffCallControlId, state }, 'supervisor join answered without conference context');
    return;
  }

  try {
    await stopMediaStream(originalId);
  } catch (err) {
    logger.warn({ err, originalId }, 'streaming_stop before join failed (continuing)');
  }

  try {
    await joinCallToConference(originalId, conferenceName, {
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
    });
    await joinCallToConference(staffCallControlId, conferenceName, {
      startConferenceOnEnter: true,
      endConferenceOnExit: true,
    });
  } catch (err) {
    logger.error({ err, originalId, staffCallControlId }, 'conference join failed');
    return;
  }

  if (state.originalCallId) {
    await db
      .update(calls)
      .set({ status: 'transferred', outcome: 'escalated', updatedAt: new Date() })
      .where(eq(calls.id, state.originalCallId));
  }

  if (state.tenantId && state.originalCallId) {
    pushActivity(state.tenantId, 'call_taken_over', {
      callId: state.originalCallId,
      conferenceName,
      method: 'join',
    });
  }

  logger.info(
    { originalId, staffCallControlId, conferenceName },
    'Supervisor joined live call via conference'
  );
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

// ── Missed-call text-back ──────────────────────────────────────────────────
// Checks whether the call was truly short (< 15 s) and, if so, sends
// a text to the caller so they know we'll follow up.
async function sendMissedCallTextBack(
  callId: string,
  tenantId: string,
  callerPhone: string
): Promise<void> {
  // Retrieve call record to check duration
  const [call] = await db
    .select({ startedAt: calls.startedAt })
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);

  if (!call?.startedAt) return; // no start time — can't determine duration

  const durationMs = Date.now() - call.startedAt.getTime();
  if (durationMs >= 15_000) return; // call lasted long enough — not a missed call

  // Look up tenant name for the message
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  // Resolve the tenant's own provisioned number — required to send and to
  // attribute the outbound thread to the right tenant inbox.
  const fromNumber = await getTenantFromNumber(tenantId);
  if (!fromNumber) {
    logger.info({ tenantId, callId }, 'Missed-call text-back skipped — tenant has no phone number');
    return;
  }

  const businessName = tenant?.name ?? 'our team';
  const body = `Hi! We missed your call at ${businessName}. How can we help? Reply here or call us back anytime.`;

  const msgId = await sendSms(callerPhone, body, fromNumber);
  logger.info({ tenantId, callerPhone, callId }, 'Missed-call text-back sent');

  // Match contact for the thread
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, callerPhone)))
    .limit(1);

  await db.insert(smsMessages).values({
    tenantId,
    direction:       'outbound',
    fromNumber,
    toNumber:        callerPhone,
    body,
    telnyxMessageId: msgId,
    status:          'delivered',
    contactId:       contact?.id ?? null,
  });

  await db.insert(notifications).values({
    tenantId,
    callId,
    contactId:  contact?.id ?? null,
    type:       'missed_call_sms',
    channel:    'sms',
    toAddress:  callerPhone,
    status:     'sent',
    templateId: 'missed-call-text-back',
    body,
    providerMsgId: msgId,
    sentAt:     new Date(),
  });
}

// ── Inbound SMS handler (message.received) ─────────────────────────────────
// Identifies tenant by the `to` number → tenant_phone_numbers lookup.
// Stores the message in sms_messages for the two-way inbox.
async function onMessageReceived(event: TelnyxMessageEventData): Promise<void> {
  const p = event.payload;
  const fromPhone = p.from?.phone_number ?? '';
  const toPhone   = p.to?.[0]?.phone_number ?? '';
  const body      = p.text ?? '';
  const msgId     = p.id ?? event.id;

  if (!fromPhone || !toPhone || !body) {
    logger.warn({ event }, 'message.received payload missing from/to/text — skipping');
    return;
  }

  // Resolve tenant from the destination (tenant's Telnyx number)
  const resolved = await lookupTenantByDid(toPhone);
  const tenantId = resolved?.tenantId ?? '';

  if (!tenantId) {
    logger.warn({ toPhone }, 'No tenant found for inbound SMS — discarding');
    return;
  }

  // Match contact by phone number
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, fromPhone)))
    .limit(1);

  await db.insert(smsMessages).values({
    tenantId,
    direction:       'inbound',
    fromNumber:      fromPhone,
    toNumber:        toPhone,
    body,
    telnyxMessageId: msgId,
    status:          'delivered',
    contactId:       contact?.id ?? null,
  });

  logger.info({ tenantId, fromPhone, toPhone, contactId: contact?.id }, 'Inbound SMS stored');
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
