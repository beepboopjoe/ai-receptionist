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
