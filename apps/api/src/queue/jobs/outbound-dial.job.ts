import type { Job } from 'bullmq';
import { db } from '../../db/client.js';
import { campaignContacts, outboundCampaigns, calls, tenants } from '../../db/schema.js';
import { eq, and, sql, count } from 'drizzle-orm';
import { dialLead } from '../../modules/campaigns/telnyx-dialer.service.js';
import { outboundDialerQueue } from '../queues.js';
import { checkDialWindow } from '../../lib/dial-window.js';
import { isPromoTrialCapped } from '../../modules/billing/usage.service.js';
import pino from 'pino';

const logger = pino({ name: 'outbound-dial-job' });

export interface OutboundDialJobData {
  campaignContactId: string;
  campaignId: string;
  tenantId: string;
}

export interface OutboundVoicemailDropJobData {
  callSid: string;
  message: string;
  campaignContactId: string;
}

export interface OutboundDialTimeoutJobData {
  campaignContactId: string;
  callSid: string;
}

/**
 * Core dialer job — implements the full BullMQ algorithm:
 * dial-window check → concurrency guard → mark dialing → create call record → Telnyx dial
 */
export async function processOutboundDial(job: Job<OutboundDialJobData>): Promise<void> {
  const { campaignContactId, campaignId, tenantId } = job.data;

  logger.info({ campaignContactId, campaignId, attempt: job.attemptsMade }, 'Processing outbound-dial job');

  // 0. Promo-trial cap check — refuse to dial if the tenant was granted a
  //    hands-on trial and has consumed all allotted minutes. Marks the
  //    contact 'cap_reached' so the campaign doesn't keep retrying.
  if (await isPromoTrialCapped(tenantId)) {
    logger.info({ tenantId, campaignContactId }, 'Promo-trial cap reached — skipping dial');
    await db
      .update(campaignContacts)
      .set({ status: 'cap_reached', updatedAt: new Date() })
      .where(eq(campaignContacts.id, campaignContactId));
    return;
  }

  // 1. Fetch contact
  const [cc] = await db
    .select()
    .from(campaignContacts)
    .where(eq(campaignContacts.id, campaignContactId))
    .limit(1);

  if (!cc) {
    logger.warn({ campaignContactId }, 'Campaign contact not found — skipping');
    return;
  }

  const terminalStatuses = ['do_not_call', 'booked', 'qualified', 'not_qualified', 'dialing', 'connected', 'failed', 'voicemail'];
  if (terminalStatuses.includes(cc.status)) {
    logger.info({ campaignContactId, status: cc.status }, 'Contact already in terminal/active state — skipping');
    return;
  }

  // 1b. Cross-campaign DNC check
  const [dncRecord] = await db
    .select({ id: campaignContacts.id })
    .from(campaignContacts)
    .where(
      and(
        eq(campaignContacts.tenantId, tenantId),
        eq(campaignContacts.phoneE164, cc.phoneE164),
        eq(campaignContacts.status, 'do_not_call')
      )
    )
    .limit(1);

  if (dncRecord) {
    logger.info({ campaignContactId, phone: cc.phoneE164 }, 'Phone on DNC list — skipping');
    await db
      .update(campaignContacts)
      .set({ status: 'do_not_call', outcome: 'dnc_prior_campaign', updatedAt: new Date() })
      .where(eq(campaignContacts.id, campaignContactId));
    return;
  }

  const [campaign] = await db
    .select()
    .from(outboundCampaigns)
    .where(eq(outboundCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    logger.warn({ campaignId }, 'Campaign not found — skipping');
    return;
  }

  if (campaign.status === 'paused' || campaign.status === 'cancelled') {
    logger.info({ campaignId, status: campaign.status }, 'Campaign paused/cancelled — skipping');
    return;
  }

  // 2. Dial window check — use tenant's configured timezone
  const [tenantRow] = await db
    .select({ timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const tz = tenantRow?.timezone ?? 'America/New_York';

  const windowResult = checkDialWindow({
    now: new Date(),
    timezone: tz,
    windowStart: campaign.dialWindowStart,
    windowEnd: campaign.dialWindowEnd,
  });

  if (!windowResult.allowed) {
    logger.info({ campaignContactId, reason: windowResult.reason, delay: windowResult.msUntilOpen }, 'Outside dial window — re-enqueuing');
    await outboundDialerQueue.add('outbound-dial', job.data, { delay: windowResult.msUntilOpen });
    return;
  }

  // 3. Concurrency guard
  const [{ dialingCount }] = await db
    .select({ dialingCount: count() })
    .from(campaignContacts)
    .where(
      and(
        eq(campaignContacts.campaignId, campaignId),
        eq(campaignContacts.status, 'dialing')
      )
    );

  if (Number(dialingCount) >= campaign.maxConcurrentCalls) {
    logger.info({ campaignContactId, dialingCount, max: campaign.maxConcurrentCalls }, 'Concurrency cap reached — re-enqueuing in 30s');
    await outboundDialerQueue.add('outbound-dial', job.data, { delay: 30_000 });
    return;
  }

  // 4. Atomic mark as dialing
  await db
    .update(campaignContacts)
    .set({ status: 'dialing', lastDialedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaignContacts.id, campaignContactId));

  // 4b. Resolve the caller ID for THIS dial. Campaigns normally store
  //     fromNumber=NULL, meaning: rotate the tenant's outbound pool
  //     (least-recently-dialed) so no single number concentrates enough
  //     volume to get spam-flagged. A non-null fromNumber (legacy /
  //     explicit override) pins that fixed number, exactly as before.
  let fromNumber = campaign.fromNumber;
  if (!fromNumber) {
    const { selectPoolNumberForDial } = await import('../../modules/outbound-pool/pool.service.js');
    fromNumber = await selectPoolNumberForDial(tenantId);
  }

  // 5. Create call DB record — must happen BEFORE dialLead() so callId can
  //    be encoded into client_state and travel through the entire call lifecycle.
  const [callRecord] = await db
    .insert(calls)
    .values({
      tenantId,
      contactId: cc.contactId,
      rcCallId: `pending-${campaignContactId}`, // updated with real call_control_id after dial
      direction: 'outbound',
      fromNumber,
      toNumber: cc.phoneE164,
      status: 'active',
      startedAt: new Date(),
    })
    .returning({ id: calls.id });

  const callId = callRecord.id;

  // 6. Telnyx API call — callId is included so it travels in client_state
  let callSid: string;
  try {
    const result = await dialLead({
      to: cc.phoneE164,
      from: fromNumber,
      campaignContactId,
      tenantId,
      campaignId,
      callId,                   // ← critical: persists through call lifecycle via client_state
    });
    callSid = result.callSid;
  } catch (err) {
    logger.error({ err, campaignContactId }, 'Telnyx dial failed');
    await db
      .update(campaignContacts)
      .set({ status: 'failed', outcome: 'dial_error', updatedAt: new Date() })
      .where(eq(campaignContacts.id, campaignContactId));

    await db
      .update(outboundCampaigns)
      .set({
        failedCount: sql`${outboundCampaigns.failedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(outboundCampaigns.id, campaignId));

    throw err; // Let BullMQ retry if configured
  }

  // 7. Save callSid (call_control_id) back to contact + call record
  await db
    .update(campaignContacts)
    .set({ callSid, callId, updatedAt: new Date() })
    .where(eq(campaignContacts.id, campaignContactId));

  await db
    .update(calls)
    .set({ rcCallId: callSid, updatedAt: new Date() })
    .where(eq(calls.id, callId));

  // 8. Enqueue timeout guard (2 minutes)
  await outboundDialerQueue.add(
    'outbound-dial-timeout',
    { campaignContactId, callSid } satisfies OutboundDialTimeoutJobData,
    { delay: 120_000 }
  );

  logger.info({ campaignContactId, callSid, callId }, 'Outbound call initiated');
}

/**
 * Voicemail drop job — inject TTS message via telnyx-dialer.service.
 */
export async function processVoicemailDrop(job: Job<OutboundVoicemailDropJobData>): Promise<void> {
  const { callSid, message, campaignContactId } = job.data;
  logger.info({ callSid, campaignContactId }, 'Dropping voicemail');

  const { dropVoicemail } = await import('../../modules/campaigns/telnyx-dialer.service.js');
  await dropVoicemail(callSid, message);
}

/**
 * Timeout guard — if a contact is still 'dialing' 2 minutes after the call was initiated,
 * treat it as no-answer and trigger retry logic.
 */
export async function processDialTimeout(job: Job<OutboundDialTimeoutJobData>): Promise<void> {
  const { campaignContactId, callSid } = job.data;

  const [cc] = await db
    .select()
    .from(campaignContacts)
    .where(eq(campaignContacts.id, campaignContactId))
    .limit(1);

  if (!cc || cc.status !== 'dialing') {
    // Call was handled normally — nothing to do
    return;
  }

  logger.warn({ campaignContactId, callSid }, 'Dial timeout — treating as no-answer');

  // Fetch campaign for retry settings
  let maxRetries = 3;
  let retryDelayMinutes = 60; // default

  if (cc.campaignId) {
    const [campaign] = await db
      .select({ maxRetries: outboundCampaigns.maxRetries, retryDelayMinutes: outboundCampaigns.retryDelayMinutes })
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.id, cc.campaignId))
      .limit(1);
    if (campaign) {
      maxRetries = campaign.maxRetries;
      retryDelayMinutes = campaign.retryDelayMinutes; // use campaign setting, not hardcoded 60
    }
  }

  if (cc.retryCount < maxRetries) {
    const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60_000);
    await db
      .update(campaignContacts)
      .set({
        status: 'pending',
        retryCount: cc.retryCount + 1,
        nextRetryAt,
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, campaignContactId));

    await outboundDialerQueue.add(
      'outbound-dial',
      { campaignContactId: cc.id, campaignId: cc.campaignId, tenantId: cc.tenantId },
      { delay: retryDelayMinutes * 60_000 }
    );
  } else {
    await db
      .update(campaignContacts)
      .set({ status: 'failed', outcome: 'timeout', updatedAt: new Date() })
      .where(eq(campaignContacts.id, campaignContactId));

    await db
      .update(outboundCampaigns)
      .set({
        failedCount: sql`${outboundCampaigns.failedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(outboundCampaigns.id, cc.campaignId));
  }
}
