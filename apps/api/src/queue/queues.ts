// ============================================================
// Shared BullMQ Queue instances
// Import from here whenever you need to ADD jobs to a queue.
// The worker process imports these too, to process them.
// ============================================================
import { Queue } from 'bullmq';
import { redis } from '../db/redis.js';

/** Notifications queue — SMS/email sending */
export const notificationsQueue = new Queue('notifications', { connection: redis });

/** Reminders queue — missed-call recovery, recall reminders */
export const remindersQueue = new Queue('reminders', { connection: redis });

/** CRM sync queue — async contact writes */
export const crmSyncQueue = new Queue('crm-sync', { connection: redis });

/** Outbound dialer queue — campaign dial jobs, voicemail drops, timeout guards */
export const outboundDialerQueue = new Queue('outbound-dialer', { connection: redis });

/** HubSpot sync queue — bidirectional contact sync per tenant */
export const hubspotSyncQueue = new Queue('hubspot-sync', { connection: redis });

/** Lead discovery queue (Phase 12.7) — Apify scrape poll-and-ingest jobs. */
export const leadDiscoveryQueue = new Queue('lead-discovery', { connection: redis });

/** Knowledge base queue (Phase 12.8) — parse + chunk + embed uploaded documents. */
export const kbQueue = new Queue('kb', { connection: redis });

/** CRM event sync queue (Phase 13) — fan out call/appointment/escalation events to connected CRMs. */
export const crmEventSyncQueue = new Queue('crm-event-sync', { connection: redis });

/** Recurring campaign scanner (Phase 18) — fires every minute to re-enqueue due recurring campaigns. */
export const recurringCampaignScanQueue = new Queue('recurring-campaign-scan', { connection: redis });

/** Outbound pool scaling sweep — grows per-tenant dialer pools when volume concentrates. */
export const outboundPoolScalingQueue = new Queue('outbound-pool-scaling', { connection: redis });
