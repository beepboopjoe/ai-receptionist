// ============================================================
// Media Stream Handler — provider-agnostic WebSocket audio relay
//
// Bridges a Telnyx (or RC) WebSocket audio stream to the Grok
// Voice WebSocket and back. Wire format is nearly identical
// across providers:
//   provider → server: { event: 'media', media: { payload: '<base64>' } }
//   server → provider: same shape (Telnyx) or with streamSid (Twilio legacy)
// ============================================================
import type { WebSocket } from 'ws';
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
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
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
  const { callId, tenantId, fromNumber, callSid, campaignContactId, campaignId, streamSid, adHocTask } = params;
  const isOutbound = !!campaignContactId;

  // 0. PROMO-TRIAL CAP CHECK — refuse to open the AI media stream if the
  //    tenant was granted a hands-on promo trial and has consumed all
  //    allotted minutes this month. Closes the inbound WS immediately so
  //    no minutes are billed, and the dashboard logs a "Call blocked" event.
  if (await isPromoTrialCapped(tenantId)) {
    logger.info({ tenantId, callId, callSid }, 'Promo-trial cap reached — refusing call');
    pushActivity(tenantId, 'call_blocked', {
      callId,
      callSid,
      fromNumber,
      reason: 'promo_trial_cap_reached',
    });
    try { providerSocket.close(1008, 'Promo trial cap reached'); } catch { /* socket may already be closed */ }
    return;
  }

  // 1. Identify caller (inbound only — outbound contacts are already known)
  const contact = isOutbound ? null : await identifyCaller(fromNumber, tenantId);

  // 2. Fetch tenant + settings in one parallel round-trip
  const [[tenantRow], [settingsRow]] = await Promise.all([
    db.select({ timezone: tenants.timezone, name: tenants.name, vertical: tenants.vertical })
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

  const tz = tenantRow?.timezone ?? 'America/New_York';
  // Use the actual tenant/business name — not a hardcoded placeholder
  const practiceName = tenantRow?.name ?? 'Our Office';
  const vertical = (tenantRow?.vertical ?? 'dental') as Vertical;
  const apptTypes    = (settingsRow?.appointmentTypes ?? []) as AppointmentType[];
  const officeHours  = (settingsRow?.officeHours ?? {}) as OfficeHours;

  // 3. Determine workflow + build system prompt
  let workflow: string;
  let systemPrompt: string;

  if (isOutbound && campaignContactId) {
    workflow = 'outbound_qualification';
    const [lead] = await db
      .select({ firstName: campaignContacts.firstName })
      .from(campaignContacts)
      .where(eq(campaignContacts.id, campaignContactId))
      .limit(1);

    // If this call belongs to a goal-driven campaign (Phase 12.4), use the
    // goal's pitch override so the AI opens with goal-specific context rather
    // than the generic vertical pitch.
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

    systemPrompt = buildOutboundQualificationPrompt({
      practiceName,
      vertical,
      leadFirstName: lead?.firstName ?? null,
      availableAppointmentTypes: apptTypes.map((t: AppointmentType) => t.name).join(', '),
      campaignId: campaignId ?? '',
      campaignContactId,
      ...(goalPitch && { goalPitch }),
    });
  } else {
    const now     = dayjs().tz(tz);
    const dayName = now.format('ddd').toLowerCase() as keyof OfficeHours;
    const todayHours = officeHours[dayName];
    const isAfterHours = !todayHours || isOutsideHours(now, todayHours.open, todayHours.close);
    workflow = isAfterHours ? 'after_hours' : contact ? 'existing_contact' : 'new_contact';

    // Phase 12.8 — pull top-K knowledge-base chunks for grounding. Synthetic
    // query because we have no caller utterance yet at call-start. Always
    // resolves to [] on any error (no OPENAI_API_KEY, no docs, embed failure)
    // so the prompt stays well-formed regardless.
    const { retrieveRelevantChunks } = await import('../knowledge-base/kb.service.js');
    const kbQuery = `${practiceName} ${vertical} ${apptTypes[0]?.name ?? ''}`.trim();
    const kbChunks = await retrieveRelevantChunks(tenantId, kbQuery, 4);

    systemPrompt = buildSystemPrompt({
      practiceName,
      vertical,
      timezone: tz,
      officeHours,
      appointmentTypes: apptTypes,
      providers: [],
      caller: contact,
      workflowHint: workflow === 'after_hours' ? 'after_hours' : (workflow as 'new_contact' | 'existing_contact'),
      transferNumber: settingsRow?.transferNumber ?? null,
      businessContext: settingsRow?.businessContext ?? null,
      ...(kbChunks.length > 0 && { kbChunks }),
      ...(adHocTask && { adHocTask }), // Phase 29b — Ask-your-AI single-task call
    });
  }

  // 4. Fire call.started immediately so the dashboard's live activity
  //    feed reflects the inbound call within ~1s of pickup. Both helpers
  //    are fire-and-forget — never throw.
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

  // 5. Save call state to Redis (vertical is included so the post-call
  //    orchestrator can route to vertical-specific flow variants later).
  await saveCallState({
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

  // 5. Create Grok Voice session (returns WS URL + auth headers)
  const voiceAdapter = createVoiceAdapter('grok');
  const session = await voiceAdapter.createSession({
    systemPrompt,
    voice: settingsRow?.voiceName ?? 'eve',
    audioInputFormat: 'pcmu',  // G.711 µ-law from Telnyx
    audioOutputFormat: 'pcmu',
    callMetadata: { callId, tenantId, fromNumber },
  });

  // 6. Open WebSocket to Grok Realtime API
  const { WebSocket: WS } = await import('ws');
  const grokSocket = new WS(session.webSocketUrl, {
    headers: session.headers ?? {},
  });

  let grokSessionId = session.sessionId; // may be updated when session.created fires

  // 7. Send session.update immediately after WS is open
  grokSocket.on('open', () => {
    const sessionUpdate = GrokVoiceAdapter.buildSessionUpdate({
      sessionId: grokSessionId,
      systemPrompt,
      voice: settingsRow?.voiceName ?? 'eve',
      audioInputFormat: 'pcmu',
      audioOutputFormat: 'pcmu',
    });
    grokSocket.send(JSON.stringify(sessionUpdate));
    logger.info({ callSid, grokSessionId }, 'Grok session.update sent');
  });

  // 8. Relay audio: Telnyx → Grok
  providerSocket.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString()) as Record<string, unknown>;

    if (msg['event'] === 'media') {
      const payload = (msg['media'] as Record<string, string> | undefined)?.['payload'];
      if (payload && grokSocket.readyState === WS.OPEN) {
        grokSocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: payload,
        }));
      }
    } else if (msg['event'] === 'stop') {
      grokSocket.close();
    }
  });

  // 9. Relay audio: Grok → Telnyx + accumulate transcript + fan out live deltas
  const liveStartedAt = Date.now();
  grokSocket.on('message', (data: Buffer) => {
    const event = JSON.parse(data.toString()) as Record<string, unknown>;
    const eventType = event['type'] as string;

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

    // Stream audio back to the caller
    if (eventType === 'response.audio.delta') {
      const audioPayload = event['delta'] as string | undefined;
      if (audioPayload && providerSocket.readyState === WS.OPEN) {
        // Telnyx: no streamSid needed. Twilio legacy: include it.
        const outMsg = streamSid
          ? { event: 'media', streamSid, media: { payload: audioPayload } }
          : { event: 'media', media: { payload: audioPayload } };
        providerSocket.send(JSON.stringify(outMsg));
      }
    }
  });

  // 10. Post-call: persist transcript + trigger workflow
  grokSocket.on('close', async () => {
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
      await db
        .update(calls)
        .set({
          status: 'completed',
          endedAt: new Date(),
          durationSeconds,
          summary,
          transcript: transcript as unknown as Record<string, unknown>[],
          updatedAt: new Date(),
        })
        .where(eq(calls.id, callId));
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
  });

  providerSocket.on('close', () => {
    if (grokSocket.readyState === WS.OPEN) grokSocket.close();
  });

  providerSocket.on('error', (err) => {
    logger.error({ err, callSid }, 'Provider WebSocket error');
    if (grokSocket.readyState === WS.OPEN) grokSocket.close();
  });
}

// ---- Helpers ----

function isOutsideHours(now: dayjs.Dayjs, open: string, close: string): boolean {
  const [openH = 9,  openM = 0]  = open.split(':').map(Number);
  const [closeH = 17, closeM = 0] = close.split(':').map(Number);
  const openMins  = openH  * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  const nowMins   = now.hour() * 60 + now.minute();
  return nowMins < openMins || nowMins >= closeMins;
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
