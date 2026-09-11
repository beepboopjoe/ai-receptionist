// ============================================================
// Media Stream Handler — provider-agnostic WebSocket audio relay
//
// Bridges a Telnyx (or RC) WebSocket audio stream to the Grok
// Voice WebSocket and back.
//
// Time-to-first-audio: Grok WS opens immediately (handshake overlaps
// DB). Greeting is xAI force_message (TTS, no think loop) after
// session.updated applies PCMU. reasoning.effort=none on session.update.
// Railway logs: `TTFA <stage> callSid=… ms=…`
//   provider → server: { event: 'media', media: { payload: '<base64>' } }
//   server → provider: same shape (Telnyx) or with streamSid (Twilio legacy)
// ============================================================
import { WebSocket } from 'ws';
import { db } from '../../db/client.js';
import { calls, tenants, tenantSettings, campaignContacts } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { GrokVoiceAdapter } from '../voice-agent/adapters/grok.adapter.js';
import { createVoiceAdapter } from '../voice-agent/adapters/voice.factory.js';
import { buildSystemPrompt, type Vertical } from '../voice-agent/prompt-builder.js';
import { buildOutboundQualificationPrompt } from '../campaigns/outbound-qualification.prompt.js';
import { identifyCaller } from '../crm/crm.service.js';
import { saveCallState } from '../voice-agent/session-manager.js';
import { emitWebhook } from '../webhooks/webhook.service.js';
import { pushActivity } from '../activity/activity.service.js';
import { isPromoTrialCapped } from '../billing/usage.service.js';
import type { AppointmentType, OfficeHours, Contact } from '@ai-receptionist/shared';
import { resolveSessionGrokVoice } from '@ai-receptionist/shared';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { config } from '../../config.js';
import { isDemoCallMeTenant } from '../public-api/ensure-demo-tenant.js';
import { isAfterHoursCall } from './office-hours.js';
import {
  base64PayloadBytes,
  buildTelnyxOutboundMediaMessage,
  extractGrokAudioPayload,
  extractTelnyxInboundAudioPayload,
  formatFirstGrokAudioEventLog,
  formatFirstGrokAudioToTelnyxLog,
  formatFirstTelnyxInboundMediaLog,
  formatGrokAudioDroppedLog,
  formatGrokConnectFailureLog,
  formatGrokEmptyResponseLog,
  formatGrokGreetingFallbackLog,
  formatGrokGreetingLog,
  formatGrokNoAudioWatchdogLog,
  formatGrokRelaySummaryLog,
  formatGrokSessionUpdateLog,
  formatGrokUnexpectedBinaryLog,
  GROK_GREETING_FALLBACK_MS,
  isGrokAudioDeltaType,
  summarizeEventCounts,
} from './telnyx-stream.helpers.js';
import {
  clipXaiLogBody,
  collectLimitedHttpBody,
  xaiApiKeyLogFields,
} from '../../lib/xai-auth.js';
import {
  alreadySpokenPromptSection,
  buildGrokForceMessage,
  buildGrokGreetingFallbackCreate,
  firstTurnGreetingText,
  formatTtfaLog,
  GROK_FORCE_MESSAGE_AUDIO_FALLBACK_MS,
} from './grok-first-turn.js';
import pino from 'pino';

dayjs.extend(utc);
dayjs.extend(timezone);

const logger = pino({ name: 'media-stream' });

export interface MediaStreamParams {
  callId: string;
  tenantId: string;
  fromNumber: string;
  /** call_control_id (Telnyx) or CallSid — used as the Redis call-state key */
  callSid: string;
  /** Outbound campaign params — omit for inbound calls */
  campaignContactId?: string;
  campaignId?: string;
  /** Phase 29b — Ask-your-AI plain-English task for single-task calls.
   *  When present, the prompt-builder renders a `# Your Task This Call`
   *  section so the AI opens by stating its purpose and works the task. */
  adHocTask?: string;
  /**
   * From dialDirect client_state. `demo` is the homepage call-me widget.
   * Combined with DEMO_TENANT_ID so inbound calls to the demo number also
   * get the product-demo prompt (inbound webhooks do not set mode).
   */
  mode?: string;
  /**
   * Optional leftover call-me language. Live public dials omit this so the
   * demo prompt auto-detects from speech. Ignored for paying-tenant inbound.
   */
  language?: string;
  /**
   * Homepage call-me Grok voice (aurora/castor/cosmo/zenith). Only applied
   * when this is a demo call; paying tenants keep tenant_settings.voice_name
   * (including legacy IDs).
   */
  voice?: string;
  /**
   * Telnyx does NOT require this. Set it only for legacy Twilio paths where
   * the streamSid must appear in every outbound audio message.
   */
  streamSid?: string;
}

/**
 * Bidirectional audio relay between a telephony provider WebSocket
 * and the Grok Voice WebSocket.
 *
 * Call this once the media-stream WebSocket is established and the
 * 'start' event has been parsed (done by the provider-specific router handler).
 */
export async function handleMediaStream(
  providerSocket: WebSocket,
  params: MediaStreamParams
): Promise<void> {
  const { callId, tenantId, fromNumber, callSid, campaignContactId, campaignId, streamSid, adHocTask, mode, language, voice } = params;
  const isOutbound = !!campaignContactId;
  const isDemo = isDemoCallMeTenant(tenantId, config.DEMO_TENANT_ID) || mode === 'demo';
  const startedAt = Date.now();
  const ttfa = (stage: string) => {
    const ms = Date.now() - startedAt;
    logger.info({ callSid, tenantId, stage, ms }, formatTtfaLog({ callSid, stage, ms }));
  };

  // Open Grok immediately so TLS/handshake overlaps DB + prompt work.
  // session.update (codec, voice, prompt) waits until prep below finishes.
  const voiceAdapter = createVoiceAdapter('grok');
  const earlyVoice = resolveSessionGrokVoice({
    isDemo,
    ...(voice ? { demoVoice: voice } : {}),
  });
  let session;
  try {
    session = await voiceAdapter.createSession({
      systemPrompt: '',
      voice: earlyVoice,
      audioInputFormat: 'pcmu',
      audioOutputFormat: 'pcmu',
      callMetadata: { callId, tenantId, fromNumber },
    });
  } catch (err) {
    logger.error(
      { err, callSid, tenantId, callId },
      formatGrokConnectFailureLog({
        callSid,
        tenantId,
        err,
        ...grokConnectLogFields(),
      }),
    );
    try { providerSocket.close(1011, 'Grok session create failed'); } catch { /* ignore */ }
    throw err;
  }

  const grokSocket = new WebSocket(session.webSocketUrl, {
    headers: session.headers ?? {},
  });

  let grokSessionId = session.sessionId; // may be updated when session.created fires
  const connectLog = grokConnectLogFields(session);
  let grokHandshakeLogged = false;
  let grokHandshakeCapture = false;

  let contact: Contact | null = null;
  let vertical: Vertical = 'dental';
  let storeTranscripts = true;
  let workflow = 'new_contact';
  let systemPrompt = '';
  let sessionVoice = earlyVoice;
  let greetingText = firstTurnGreetingText({ isDemo, isOutbound, practiceName: 'Our Office' });
  let grokOpen = false;
  let promptReady = false;
  let sessionUpdateSent = false;
  let greetingAudioDone = false;
  let pendingKbPrompt: string | null = null;
  const inboundAudioQueue: string[] = [];
  const MAX_INBOUND_QUEUE = 80;

  const logGrokConnectFailure = (err: unknown, extras?: { httpStatus?: number | null; bodyClipped?: string }) => {
    if (grokHandshakeLogged) return;
    grokHandshakeLogged = true;
    logger.error(
      { err, callSid, tenantId, callId, httpStatus: extras?.httpStatus ?? null },
      formatGrokConnectFailureLog({
        callSid,
        tenantId,
        err,
        httpStatus: extras?.httpStatus,
        bodyClipped: extras?.bodyClipped,
        ...connectLog,
      }),
    );
  };

  // ws only puts "Unexpected server response: 403" on `error`. The body
  // (credits / ACL / model denial) lives on `unexpected-response`.
  grokSocket.on('unexpected-response', (req, res) => {
    grokHandshakeCapture = true;
    void (async () => {
      const rawBody = await collectLimitedHttpBody(res);
      logGrokConnectFailure(
        new Error(`Unexpected server response: ${res.statusCode ?? 'unknown'}`),
        {
          httpStatus: typeof res.statusCode === 'number' ? res.statusCode : null,
          bodyClipped: clipXaiLogBody(rawBody || ''),
        },
      );
    })();
    try { req.destroy(); } catch { /* ignore */ }
  });

  grokSocket.on('error', (err) => {
    if (grokHandshakeCapture) return;
    logGrokConnectFailure(err);
  });

  // Relay counters — Railway MCP only keeps pino `msg`, so every first-frame
  // / empty-response line embeds counts (never raw audio).
  const grokEventCounts: Record<string, number> = {};
  let telnyxInboundFrames = 0;
  let telnyxInboundBytes = 0;
  let grokAudioDeltasReceived = 0;
  let grokAudioBytesToTelnyx = 0;
  let loggedFirstTelnyxInbound = false;
  let loggedFirstGrokAudioEvent = false;
  let loggedFirstGrokToTelnyx = false;
  let loggedUnexpectedBinary = false;
  let greetingSent = false;
  let greetingFallbackTimer: ReturnType<typeof setTimeout> | undefined;
  let noAudioWatchdog: ReturnType<typeof setTimeout> | undefined;

  const noteGrokEvent = (type: string) => {
    grokEventCounts[type] = (grokEventCounts[type] ?? 0) + 1;
  };

  const trySendSessionUpdate = () => {
    if (sessionUpdateSent || !grokOpen || !promptReady) return;
    if (grokSocket.readyState !== WebSocket.OPEN) return;
    sessionUpdateSent = true;
    const sessionUpdate = GrokVoiceAdapter.buildSessionUpdate({
      sessionId: grokSessionId,
      systemPrompt,
      voice: sessionVoice,
      audioInputFormat: 'pcmu',
      audioOutputFormat: 'pcmu',
      ...(isDemo ? { silenceDurationMs: 700 } : {}),
    });
    grokSocket.send(JSON.stringify(sessionUpdate));
    ttfa('session_update');
    logger.info(
      { callSid, grokSessionId, tenantId },
      formatGrokSessionUpdateLog({ callSid, grokSessionId }),
    );
    greetingFallbackTimer = setTimeout(() => {
      logger.warn({ callSid, tenantId }, formatGrokGreetingFallbackLog({ callSid }));
      sendGreeting('fallback');
    }, GROK_GREETING_FALLBACK_MS);
  };

  const injectPendingKb = () => {
    if (!pendingKbPrompt || !greetingAudioDone) return;
    if (grokSocket.readyState !== WebSocket.OPEN) return;
    const kbPrompt = pendingKbPrompt;
    pendingKbPrompt = null;
    grokSocket.send(JSON.stringify(GrokVoiceAdapter.buildSessionUpdate({
      sessionId: grokSessionId,
      systemPrompt: kbPrompt,
      voice: sessionVoice,
      audioInputFormat: 'pcmu',
      audioOutputFormat: 'pcmu',
      ...(isDemo ? { silenceDurationMs: 700 } : {}),
    })));
    logger.info({ callSid, tenantId }, formatTtfaLog({
      callSid,
      stage: 'kb_injected',
      ms: Date.now() - startedAt,
    }));
  };

  const sendGreeting = (reason: 'session.updated' | 'fallback') => {
    if (greetingSent || grokSocket.readyState !== WebSocket.OPEN) return;
    if (!sessionUpdateSent && reason !== 'fallback') return;
    greetingSent = true;
    if (greetingFallbackTimer) {
      clearTimeout(greetingFallbackTimer);
      greetingFallbackTimer = undefined;
    }
    grokSocket.send(JSON.stringify(buildGrokForceMessage(greetingText)));
    ttfa('greeting_sent');
    logger.info(
      { callSid, grokSessionId, tenantId, reason, method: 'force_message' },
      formatGrokGreetingLog({
        callSid,
        grokSessionId,
        method: 'force_message',
        ms: Date.now() - startedAt,
      }),
    );
    noAudioWatchdog = setTimeout(() => {
      if (grokAudioBytesToTelnyx > 0) return;
      if (grokSocket.readyState === WebSocket.OPEN) {
        grokSocket.send(JSON.stringify(buildGrokGreetingFallbackCreate(greetingText)));
        logger.warn(
          { callSid, tenantId },
          formatTtfaLog({ callSid, stage: 'force_message_fallback_response_create', ms: Date.now() - startedAt }),
        );
      }
      logger.warn(
        { callSid, tenantId, grokEventCounts },
        formatGrokNoAudioWatchdogLog({
          callSid,
          audioDeltasReceived: grokAudioDeltasReceived,
          audioBytesToTelnyx: grokAudioBytesToTelnyx,
          eventCounts: summarizeEventCounts(grokEventCounts),
        }),
      );
    }, GROK_FORCE_MESSAGE_AUDIO_FALLBACK_MS);
  };

  // Codec is PCM until session.updated. Do not greet on WS open.
  grokSocket.on('open', () => {
    grokOpen = true;
    ttfa('grok_ws_open');
    trySendSessionUpdate();
  });

  // 8. Relay audio: Telnyx inbound track → Grok (never echo outbound)
  providerSocket.on('message', (data: Buffer) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data.toString()) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err, callSid }, 'Telnyx media-stream bad JSON');
      return;
    }

    if (msg['event'] === 'media') {
      const inbound = extractTelnyxInboundAudioPayload(msg);
      if (!inbound) return;
      telnyxInboundFrames += 1;
      telnyxInboundBytes += inbound.bytes;
      if (!loggedFirstTelnyxInbound) {
        loggedFirstTelnyxInbound = true;
        logger.info(
          { callSid, tenantId, track: inbound.track, payloadBytes: inbound.bytes },
          formatFirstTelnyxInboundMediaLog({
            callSid,
            track: inbound.track,
            payloadBytes: inbound.bytes,
          }),
        );
      }
      // Hold inbound until the opener is on the wire so line noise cannot
      // barge-in-cancel force_message. force_message is interruptible:false
      // as a second guard.
      if (grokSocket.readyState === WebSocket.OPEN && greetingSent) {
        grokSocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: inbound.payload,
        }));
      } else if (inboundAudioQueue.length < MAX_INBOUND_QUEUE) {
        inboundAudioQueue.push(inbound.payload);
      }
    } else if (msg['event'] === 'stop') {
      grokSocket.close();
    } else if (msg['event'] === 'error') {
      const payload = msg['payload'] as Record<string, unknown> | undefined;
      const detail = typeof payload?.['detail'] === 'string'
        ? payload['detail']
        : JSON.stringify(msg);
      logger.error(
        { msg, callSid, tenantId },
        `Telnyx media-stream error frame callSid=${callSid} err=${detail}`,
      );
    }
  });

  // 9. Relay audio: Grok → Telnyx + accumulate transcript + fan out live deltas
  const liveStartedAt = Date.now();
  grokSocket.on('message', (data: Buffer) => {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    const asText = raw.toString();
    if (!asText.startsWith('{') && !asText.startsWith('[')) {
      if (!loggedUnexpectedBinary) {
        loggedUnexpectedBinary = true;
        logger.warn(
          { callSid, tenantId, bytes: raw.byteLength },
          formatGrokUnexpectedBinaryLog({ callSid, bytes: raw.byteLength }),
        );
      }
      return;
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(asText) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err, callSid }, 'Grok media-stream bad JSON');
      return;
    }
    const eventType = typeof event['type'] === 'string' ? event['type'] : 'unknown';
    noteGrokEvent(eventType);

    // Capture the real Grok session ID when the server confirms it,
    // then announce the live call to the dashboard.
    if (eventType === 'session.created') {
      const serverSession = event['session'] as Record<string, string> | undefined;
      if (serverSession?.['id']) {
        grokSessionId = serverSession['id'];
      }
      pushActivity(tenantId, 'call_live_started', {
        callId,
        callSid,
        fromNumber,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
        vertical,
        startedAt: new Date(liveStartedAt).toISOString(),
      });
    }

    // Codec is applied on session.updated — greet only then (not on created).
    // Ignore later session.updated from a post-greeting KB prompt inject.
    if (eventType === 'session.updated' && sessionUpdateSent && !greetingSent) {
      sendGreeting('session.updated');
    }

    if (eventType === 'response.done' && greetingSent && !greetingAudioDone) {
      greetingAudioDone = true;
      injectPendingKb();
      while (inboundAudioQueue.length > 0) {
        const queued = inboundAudioQueue.shift();
        if (queued && grokSocket.readyState === WebSocket.OPEN) {
          grokSocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: queued,
          }));
        }
      }
    }

    // Let the adapter process transcript events and tell us what was finalized.
    const result = GrokVoiceAdapter.processEvent(grokSessionId, event);
    if (result.callerText) {
      pushActivity(tenantId, 'call_caller_said', {
        callId,
        role: 'caller',
        text: result.callerText,
        timestamp: new Date().toISOString(),
      });
    }
    if (result.flushedAgentText) {
      pushActivity(tenantId, 'call_agent_said', {
        callId,
        role: 'agent',
        text: result.flushedAgentText,
        timestamp: new Date().toISOString(),
      });
    }

    if (eventType === 'error') {
      const grokErr = event['error'] as Record<string, unknown> | undefined;
      const grokMsg = typeof grokErr?.['message'] === 'string' ? grokErr['message'] : JSON.stringify(event);
      logger.error(
        { event, callSid, tenantId },
        `Grok session error callSid=${callSid} tenantId=${tenantId} err=${grokMsg}`,
      );
      if (greetingSent && grokAudioBytesToTelnyx === 0 && grokSocket.readyState === WebSocket.OPEN) {
        grokSocket.send(JSON.stringify(buildGrokGreetingFallbackCreate(greetingText)));
        logger.warn(
          { callSid, tenantId },
          formatTtfaLog({ callSid, stage: 'force_message_error_fallback', ms: Date.now() - startedAt }),
        );
      }
    }

    if (eventType === 'response.done' && grokAudioBytesToTelnyx === 0) {
      logger.warn(
        { callSid, tenantId, grokEventCounts },
        formatGrokEmptyResponseLog({
          callSid,
          audioDeltasReceived: grokAudioDeltasReceived,
          audioBytesToTelnyx: grokAudioBytesToTelnyx,
          eventCounts: summarizeEventCounts(grokEventCounts),
        }),
      );
    }

    // Stream audio back to the callee — current xAI uses output_audio.delta.
    if (isGrokAudioDeltaType(eventType)) {
      const audioPayload = extractGrokAudioPayload(event);
      const payloadBytes = audioPayload ? base64PayloadBytes(audioPayload) : 0;
      if (audioPayload) {
        grokAudioDeltasReceived += 1;
        if (!loggedFirstGrokAudioEvent) {
          loggedFirstGrokAudioEvent = true;
          const field = typeof event['delta'] === 'string' && event['delta'] ? 'delta' : 'audio';
          logger.info(
            { callSid, tenantId, eventType, payloadBytes },
            formatFirstGrokAudioEventLog({
              callSid,
              eventType,
              payloadBytes,
              field,
            }),
          );
        }
        if (providerSocket.readyState === WebSocket.OPEN) {
          providerSocket.send(JSON.stringify(buildTelnyxOutboundMediaMessage(audioPayload, streamSid)));
          grokAudioBytesToTelnyx += payloadBytes;
          if (!loggedFirstGrokToTelnyx) {
            loggedFirstGrokToTelnyx = true;
            if (noAudioWatchdog) {
              clearTimeout(noAudioWatchdog);
              noAudioWatchdog = undefined;
            }
            ttfa('first_audio_to_telnyx');
            logger.info(
              { callSid, tenantId, eventType, payloadBytes },
              formatFirstGrokAudioToTelnyxLog({ callSid, eventType, payloadBytes }),
            );
          }
        } else {
          logger.warn(
            { callSid, tenantId, payloadBytes },
            formatGrokAudioDroppedLog({
              callSid,
              reason: 'telnyx_ws_not_open',
              payloadBytes,
            }),
          );
        }
      } else {
        logger.warn(
          { callSid, tenantId, eventType },
          formatGrokEmptyResponseLog({
            callSid,
            audioDeltasReceived: grokAudioDeltasReceived,
            audioBytesToTelnyx: grokAudioBytesToTelnyx,
            eventCounts: `${eventType}:empty-payload`,
          }),
        );
      }
    }
  });

  // 10. Post-call: persist transcript + trigger workflow
  grokSocket.on('close', async () => {
    if (greetingFallbackTimer) clearTimeout(greetingFallbackTimer);
    if (noAudioWatchdog) clearTimeout(noAudioWatchdog);
    logger.info(
      { callSid, tenantId, grokEventCounts },
      formatGrokRelaySummaryLog({
        callSid,
        inboundFrames: telnyxInboundFrames,
        inboundBytes: telnyxInboundBytes,
        audioDeltasReceived: grokAudioDeltasReceived,
        audioBytesToTelnyx: grokAudioBytesToTelnyx,
        eventCounts: summarizeEventCounts(grokEventCounts),
      }),
    );

    // Flush any buffered agent transcript with a synthetic 'response.done'
    GrokVoiceAdapter.processEvent(grokSessionId, { type: 'response.done' });

    let transcript: Awaited<ReturnType<typeof voiceAdapter.getTranscript>> = [];
    let summary = '';
    try {
      [transcript, summary] = await Promise.all([
        voiceAdapter.getTranscript(grokSessionId),
        voiceAdapter.getSummary(grokSessionId),
      ]);
    } catch (err) {
      logger.error({ err, callSid }, 'Failed to fetch transcript/summary from Grok');
    }

    // Conversation duration — measured from stream start, i.e. actual AI
    // talk-time, not ring time. Persisted on the call row so minute
    // billing, promo-trial caps, and analytics all see real durations
    // (previously only the RingCentral path ever wrote duration_seconds).
    const durationSeconds = Math.round((Date.now() - liveStartedAt) / 1000);

    // If the Grok session never produced a transcript, treat as missed.
    const isMissed = !transcript || transcript.length === 0;

    try {
      const [existing] = await db
        .select({ status: calls.status, recordingUrl: calls.recordingUrl })
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);
      const keepTransferred = existing?.status === 'transferred';
      const nextStatus = keepTransferred ? 'transferred' : isMissed ? 'missed' : 'completed';

      await db
        .update(calls)
        .set({
          status: nextStatus,
          endedAt: new Date(),
          durationSeconds,
          summary,
          transcript: storeTranscripts
            ? (transcript as unknown as Record<string, unknown>[])
            : null,
          updatedAt: new Date(),
        })
        .where(eq(calls.id, callId));

      if (!existing?.recordingUrl && callSid) {
        void import('./adapters/telnyx.adapter.js')
          .then(({ TelnyxAdapter }) => new TelnyxAdapter().getCallRecording(callSid))
          .then((url) => {
            if (!url) return;
            return import('./recording.js').then(({ persistRecordingUrl }) =>
              persistRecordingUrl({ url, callId, callControlId: callSid })
            );
          })
          .catch((err) => logger.warn({ err, callId }, 'backup recording fetch failed'));
      }
    } catch (err) {
      logger.error({ err, callId }, 'Failed to persist call record after Grok close');
    }

    // Track minute usage for billing — fire-and-forget (never blocks call
    // teardown). Fires for both inbound and outbound (pool or fixed-number)
    // calls; missed calls don't bill (no agent voice time), mirroring the
    // RingCentral handler's rule.
    if (!isMissed && durationSeconds > 0) {
      const minutes = durationSeconds / 60;
      void import('../billing/usage.service.js').then(({ incrementMinuteUsage }) =>
        incrementMinuteUsage(tenantId, minutes).catch((err) => {
          logger.error({ err, callId }, 'incrementMinuteUsage failed');
        })
      );
      void import('../billing/usage-ledger.service.js').then(({ recordCallUsage }) =>
        recordCallUsage({
          tenantId,
          callId,
          minutes,
          direction: isOutbound ? 'outbound' : 'inbound',
          isDemo,
          mode,
        }).catch((err) => {
          logger.error({ err, callId }, 'recordCallUsage failed');
        })
      );
    }

    // Clean up session memory
    await voiceAdapter.endSession(grokSessionId).catch(() => void 0);

    // Tell the live monitor the call has ended so it can close any open
    // viewer drawer. Sent before call_completed/call_missed so the dashboard
    // can transition state cleanly.
    pushActivity(tenantId, 'call_live_ended', {
      callId,
      durationSeconds,
    });

    // Fire webhooks + activity for call completion. Both helpers never throw.
    if (isMissed) {
      void emitWebhook(tenantId, 'call.missed', {
        callId, callSid, fromNumber, vertical,
      });
      pushActivity(tenantId, 'call_missed', { callId, fromNumber });
    } else {
      void emitWebhook(tenantId, 'call.completed', {
        callId,
        callSid,
        fromNumber,
        direction: isOutbound ? 'outbound' : 'inbound',
        durationSeconds,
        summary,
        vertical,
        ...(isOutbound ? { campaignContactId, campaignId } : {}),
      });
      pushActivity(tenantId, 'call_completed', {
        callId,
        fromNumber,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
        summary,
      });

      // Phase 13 — fan out to connected CRMs as a Note/Activity on the matched
      // contact. No-op when no contact was identified (anonymous caller).
      // Fire-and-forget; the helper never throws.
      if (contact) {
        const { syncCallNote } = await import('../crm/event-sync.service.js');
        syncCallNote(tenantId, {
          callId,
          summary: summary ?? '',
          outcome: isOutbound ? 'outbound_completed' : 'inbound_completed',
          transcript: transcript.map((t) => `${t.role}: ${t.text}`).join('\n').slice(0, 8000),
          direction: isOutbound ? 'outbound' : 'inbound',
          fromNumber,
          createdAt: new Date().toISOString(),
        });
      }
    }

    void triggerPostCallWorkflow({ callId, tenantId, workflow, contact, callSid });

    if (isDemo) {
      void import('../public-api/demo-lead.service.js')
        .then(({ enrichDemoLeadFromCall }) =>
          enrichDemoLeadFromCall({
            phoneE164: fromNumber,
            callId,
            transcript,
            summary,
            voice: sessionVoice,
            ...(language ? { language } : {}),
            log: {
              info: (obj, msg) => logger.info(obj, msg),
              warn: (obj, msg) => logger.warn(obj, msg),
            },
          }),
        )
        .catch((err) => {
          logger.warn({ err, callId }, 'Demo call-me lead enrich failed');
        });
    }
  });

  providerSocket.on('close', () => {
    if (grokSocket.readyState === WebSocket.OPEN) grokSocket.close();
  });

  providerSocket.on('error', (err) => {
    logger.error({ err, callSid }, 'Provider WebSocket error');
    if (grokSocket.readyState === WebSocket.OPEN) grokSocket.close();
  });

  // Prep overlaps the Grok TLS handshake. Do not await OpenAI embeddings
  // before the opener — KB is injected after the greeting response.done.
  const [capped, identified, tenantRows, settingsRows] = await Promise.all([
    isPromoTrialCapped(tenantId),
    isOutbound ? Promise.resolve(null) : identifyCaller(fromNumber, tenantId),
    db.select({ timezone: tenants.timezone, name: tenants.name, vertical: tenants.vertical, storeTranscripts: tenants.storeTranscripts })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1),
    db.select({
      officeHours:    tenantSettings.officeHours,
      appointmentTypes: tenantSettings.appointmentTypes,
      transferNumber: tenantSettings.transferNumber,
      voiceName:      tenantSettings.voiceName,
      businessContext: tenantSettings.businessContext,
    })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1),
  ]);

  if (capped) {
    logger.info({ tenantId, callId, callSid }, 'Promo-trial cap reached — refusing call');
    pushActivity(tenantId, 'call_blocked', {
      callId,
      callSid,
      fromNumber,
      reason: 'promo_trial_cap_reached',
    });
    try { grokSocket.close(); } catch { /* ignore */ }
    try { providerSocket.close(1008, 'Promo trial cap reached'); } catch { /* socket may already be closed */ }
    return;
  }

  contact = identified;
  const tenantRow = tenantRows[0];
  const settingsRow = settingsRows[0];
  const tz = tenantRow?.timezone ?? 'America/New_York';
  const practiceName = tenantRow?.name ?? 'Our Office';
  vertical = (tenantRow?.vertical ?? 'dental') as Vertical;
  storeTranscripts = tenantRow?.storeTranscripts ?? true;
  const apptTypes    = (settingsRow?.appointmentTypes ?? []) as AppointmentType[];
  const officeHours  = (settingsRow?.officeHours ?? {}) as OfficeHours;
  sessionVoice = resolveSessionGrokVoice({
    isDemo,
    ...(voice ? { demoVoice: voice } : {}),
    ...(settingsRow?.voiceName ? { tenantVoice: settingsRow.voiceName } : {}),
  });

  let leadFirstName: string | null = null;
  let inboundAfterHours = false;
  const inboundPromptArgs = {
    practiceName,
    vertical,
    timezone: tz,
    officeHours,
    appointmentTypes: apptTypes,
    providers: [] as string[],
    caller: isDemo ? null : contact,
    workflowHint: 'new_contact' as 'new_contact' | 'existing_contact' | 'after_hours',
    transferNumber: settingsRow?.transferNumber ?? null,
    businessContext: settingsRow?.businessContext ?? null,
    ...(adHocTask && { adHocTask }),
    ...(isDemo && { isDemo: true as const }),
    ...(isDemo && language && { demoLanguage: language }),
  };

  if (isOutbound && campaignContactId) {
    workflow = 'outbound_qualification';
    const [lead] = await db
      .select({ firstName: campaignContacts.firstName })
      .from(campaignContacts)
      .where(eq(campaignContacts.id, campaignContactId))
      .limit(1);
    leadFirstName = lead?.firstName ?? null;

    let goalPitch: string | undefined;
    if (campaignId) {
      const { outboundCampaigns } = await import('../../db/schema.js');
      const [c] = await db
        .select({ goal: outboundCampaigns.goal })
        .from(outboundCampaigns)
        .where(eq(outboundCampaigns.id, campaignId))
        .limit(1);
      if (c?.goal) {
        const { findGoal } = await import('../campaigns/campaign-goals.service.js');
        goalPitch = findGoal(c.goal)?.pitchOverride;
      }
    }

    const outboundPrompt = buildOutboundQualificationPrompt({
      practiceName,
      vertical,
      leadFirstName,
      availableAppointmentTypes: apptTypes.map((t: AppointmentType) => t.name).join(', '),
      campaignId: campaignId ?? '',
      campaignContactId,
      ...(goalPitch && { goalPitch }),
    });
    greetingText = firstTurnGreetingText({
      isDemo,
      isOutbound: true,
      practiceName,
      ...(leadFirstName ? { leadFirstName } : {}),
      ...(adHocTask ? { adHocTask } : {}),
    });
    systemPrompt = `${outboundPrompt}\n\n${alreadySpokenPromptSection(greetingText)}`;
  } else {
    const now     = dayjs().tz(tz);
    const dayName = now.format('ddd').toLowerCase();
    inboundAfterHours = isAfterHoursCall({
      now,
      officeHours,
      dayKey: dayName,
      isDemo,
    });
    workflow = isDemo
      ? 'new_contact'
      : inboundAfterHours
        ? 'after_hours'
        : contact
          ? 'existing_contact'
          : 'new_contact';
    inboundPromptArgs.workflowHint = workflow === 'after_hours'
      ? 'after_hours'
      : (workflow as 'new_contact' | 'existing_contact');

    greetingText = firstTurnGreetingText({
      isDemo,
      isOutbound: false,
      practiceName,
      isAfterHours: inboundAfterHours,
      ...(!isDemo && contact?.firstName ? { callerFirstName: contact.firstName } : {}),
      ...(adHocTask ? { adHocTask } : {}),
    });
    systemPrompt = `${buildSystemPrompt(inboundPromptArgs)}\n\n${alreadySpokenPromptSection(greetingText)}`;

    if (!isDemo) {
      void import('../knowledge-base/kb.service.js')
        .then(({ retrieveRelevantChunks }) => {
          const kbQuery = `${practiceName} ${vertical} ${apptTypes[0]?.name ?? ''}`.trim();
          return retrieveRelevantChunks(tenantId, kbQuery, 4);
        })
        .then((kbChunks) => {
          if (!kbChunks.length) return;
          pendingKbPrompt = `${buildSystemPrompt({
            ...inboundPromptArgs,
            kbChunks,
          })}\n\n${alreadySpokenPromptSection(greetingText)}`;
          injectPendingKb();
        })
        .catch((err) => {
          logger.warn({ err, callSid, tenantId }, 'KB retrieve deferred from greeting failed');
        });
    }
  }

  emitWebhook(tenantId, 'call.started', {
    callId,
    callSid,
    fromNumber,
    direction: isOutbound ? 'outbound' : 'inbound',
    vertical,
  });
  pushActivity(tenantId, 'call_started', {
    callId,
    fromNumber,
    contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
  });

  void saveCallState({
    callId,
    rcCallId: callSid,
    tenantId,
    fromNumber,
    toNumber: '',
    contact,
    workflow,
    currentStep: 'greeting',
    retryCount: 0,
    collectedData: isOutbound ? { campaignContactId, campaignId, vertical } : { vertical },
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    elevenLabsSessionId: null,
  });

  promptReady = true;
  ttfa('prompt_ready');
  trySendSessionUpdate();
}

// ---- Helpers ----

/** Log-safe Grok handshake fields. Inspects raw env so paste sanitization flags survive config cleanup. */
function grokConnectLogFields(session?: { webSocketUrl?: string; headers?: Record<string, string> }) {
  const wsUrl = session?.webSocketUrl ?? '';
  let model = 'unset';
  try {
    if (wsUrl) model = new URL(wsUrl).searchParams.get('model') || 'unset';
  } catch {
    model = 'unset';
  }
  return {
    ...xaiApiKeyLogFields(process.env['XAI_API_KEY']),
    authHeaderPresent: Boolean(session?.headers?.['Authorization']),
    model,
    wsUrl: wsUrl || 'unset',
  };
}

async function triggerPostCallWorkflow(params: {
  callId: string;
  tenantId: string;
  workflow: string;
  contact: Contact | null;
  callSid: string;
}): Promise<void> {
  try {
    const { orchestrate } = await import('../workflow-engine/orchestrator.js');
    await orchestrate({
      callId: params.callId,
      tenantId: params.tenantId,
      fromNumber: '',
      rcCallId: params.callSid,
      postCallOnly: true,
    });
  } catch (err) {
    logger.error({ err, callId: params.callId }, 'Post-call workflow failed');
  }
}
