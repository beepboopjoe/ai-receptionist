// ============================================================
// BullMQ Worker Bootstrap
// Processes all queues: notifications, reminders, crm-sync, outbound-dialer.
// Also runs the usage-warning cron (hourly) so the worker is the single
// long-lived process responsible for both queue work and scheduled tasks.
// Run as a separate process: node dist/queue/worker.js
// ============================================================
import { Worker, type Job } from 'bullmq';
import cron from 'node-cron';
import { redis } from '../db/redis.js';
import { runUsageWarningSweep } from './jobs/usage-warning.job.js';
import { runAppointmentReminderSweep } from './jobs/appointment-reminder.job.js';
import { processSendNotification, type SendNotificationJobData } from './jobs/send-reminder.job.js';
import { processMissedCallRecovery, type MissedCallRecoveryJobData } from './jobs/missed-call-recovery.job.js';
import { processCrmSync, type CrmSyncJobData } from './jobs/crm-sync.job.js';
import { processHubSpotSync, type HubSpotSyncJobData } from './jobs/hubspot-sync.job.js';
import { processRecallReminder, type RecallReminderJobData } from './jobs/recall-reminder.job.js';
import {
  processOutboundDial,
  processVoicemailDrop,
  processDialTimeout,
  type OutboundDialJobData,
  type OutboundVoicemailDropJobData,
  type OutboundDialTimeoutJobData,
} from './jobs/outbound-dial.job.js';

// Re-export the shared queue instances so modules can import from here for backward compatibility
export { outboundDialerQueue } from './queues.js';

// ---- Notifications queue ----
const notificationsWorker = new Worker<SendNotificationJobData>(
  'notifications',
  async (job: Job<SendNotificationJobData>) => {
    await processSendNotification(job);
  },
  {
    connection: redis,
    concurrency: 10,
  }
);

notificationsWorker.on('completed', (job) => {
  console.log(`[worker:notifications] ✅ job ${job.id} (${job.name}) completed`);
});
notificationsWorker.on('failed', (job, err) => {
  console.error(`[worker:notifications] ❌ job ${job?.id} failed:`, err.message);
});

// ---- Reminders queue (missed call recovery) ----
const remindersWorker = new Worker<MissedCallRecoveryJobData>(
  'reminders',
  async (job: Job<MissedCallRecoveryJobData>) => {
    if (job.name === 'missed-call-recovery') {
      await processMissedCallRecovery(job);
    } else if (job.name === 'recall-reminder') {
      await processRecallReminder(job as unknown as Job<RecallReminderJobData>);
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

remindersWorker.on('completed', (job) => {
  console.log(`[worker:reminders] ✅ job ${job.id} (${job.name}) completed`);
});
remindersWorker.on('failed', (job, err) => {
  console.error(`[worker:reminders] ❌ job ${job?.id} failed:`, err.message);
});

// ---- CRM sync queue ----
const crmSyncWorker = new Worker<CrmSyncJobData>(
  'crm-sync',
  async (job: Job<CrmSyncJobData>) => {
    await processCrmSync(job);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

crmSyncWorker.on('completed', (job) => {
  console.log(`[worker:crm-sync] ✅ job ${job.id} completed`);
});
crmSyncWorker.on('failed', (job, err) => {
  console.error(`[worker:crm-sync] ❌ job ${job?.id} failed:`, err.message);
});

// ---- HubSpot sync worker ----
const hubspotSyncWorker = new Worker<HubSpotSyncJobData>(
  'hubspot-sync',
  async (job: Job<HubSpotSyncJobData>) => {
    await processHubSpotSync(job);
  },
  { connection: redis, concurrency: 3 }
);

hubspotSyncWorker.on('completed', (job) => {
  console.log(`[worker:hubspot-sync] ✅ job ${job.id} completed`);
});
hubspotSyncWorker.on('failed', (job, err) => {
  console.error(`[worker:hubspot-sync] ❌ job ${job?.id} failed:`, err.message);
});

// ---- Outbound dialer worker ----
type OutboundDialerJobData = OutboundDialJobData | OutboundVoicemailDropJobData | OutboundDialTimeoutJobData;

const outboundDialerWorker = new Worker<OutboundDialerJobData>(
  'outbound-dialer',
  async (job: Job<OutboundDialerJobData>) => {
    if (job.name === 'outbound-dial') {
      await processOutboundDial(job as Job<OutboundDialJobData>);
    } else if (job.name === 'outbound-voicemail-drop') {
      await processVoicemailDrop(job as Job<OutboundVoicemailDropJobData>);
    } else if (job.name === 'outbound-dial-timeout') {
      await processDialTimeout(job as Job<OutboundDialTimeoutJobData>);
    }
  },
  {
    connection: redis,
    concurrency: 10,
  }
);

outboundDialerWorker.on('completed', (job) => {
  console.log(`[worker:outbound-dialer] ✅ job ${job.id} (${job.name}) completed`);
});
outboundDialerWorker.on('failed', (job, err) => {
  console.error(`[worker:outbound-dialer] ❌ job ${job?.id} (${job?.name}) failed:`, err.message);
});

// ---- Scheduled tasks (node-cron) ----
// Hourly sweep of minute_usage rows looking for tenants who crossed
// 80% of their plan's included minutes — sends a one-time warning
// email per period. Idempotent via the warning_sent_at column.
const usageWarningTask = cron.schedule('17 * * * *', async () => {
  try {
    const result = await runUsageWarningSweep();
    if (result.sent > 0) {
      console.log(`[cron:usage-warning] checked ${result.checked}, sent ${result.sent} warnings`);
    }
  } catch (err) {
    console.error('[cron:usage-warning] sweep failed:', err);
  }
});

// Every 15 min — send 24h and 2h appointment SMS reminders.
// Idempotent: the reminder_24h_sent / reminder_2h_sent boolean flags
// on the appointments table prevent double-sends.
const appointmentReminderTask = cron.schedule('*/15 * * * *', async () => {
  try {
    const result = await runAppointmentReminderSweep();
    if (result.sent > 0) {
      console.log(`[cron:appointment-reminder] sent ${result.sent} SMS reminders`);
    }
    if (result.errors > 0) {
      console.warn(`[cron:appointment-reminder] ${result.errors} errors`);
    }
  } catch (err) {
    console.error('[cron:appointment-reminder] sweep failed:', err);
  }
});

// ---- Graceful shutdown ----
async function shutdown() {
  console.log('[worker] Shutting down workers...');
  usageWarningTask.stop();
  appointmentReminderTask.stop();
  await Promise.all([
    notificationsWorker.close(),
    remindersWorker.close(),
    crmSyncWorker.close(),
    hubspotSyncWorker.close(),
    outboundDialerWorker.close(),
  ]);
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker] 🚀 BullMQ workers started — listening on queues: notifications, reminders, crm-sync, outbound-dialer');
