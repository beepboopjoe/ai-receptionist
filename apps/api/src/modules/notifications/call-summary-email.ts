// ============================================================
// Per-call summary email — fired after every completed call when
// the tenant has notificationPreferences.emailOnEveryCall enabled.
//
// Fire-and-forget; never throws. Email failures shouldn't affect
// the call's orchestration. Resend is the transport.
// ============================================================
import { db } from '../../db/client.js';
import { calls, tenantSettings, tenants, adminUsers, contacts } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { sendEmail } from './adapters/email.adapter.js';
import { config } from '../../config.js';

/** Best-effort: send the call-summary email if the tenant opted in. */
export async function sendCallSummaryEmail(callId: string): Promise<void> {
  try {
    if (!config.RESEND_API_KEY) return;

    const [row] = await db
      .select({
        callId: calls.id,
        tenantId: calls.tenantId,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        outcome: calls.outcome,
        summary: calls.summary,
        direction: calls.direction,
        recordingUrl: calls.recordingUrl,
        contactId: calls.contactId,
        prefs: tenantSettings.notificationPreferences,
        recipient: tenantSettings.callSummaryEmail,
        tenantName: tenants.name,
      })
      .from(calls)
      .innerJoin(tenants, eq(calls.tenantId, tenants.id))
      .leftJoin(tenantSettings, eq(tenantSettings.tenantId, calls.tenantId))
      .where(eq(calls.id, callId))
      .limit(1);
    if (!row) return;

    const prefs = (row.prefs as Record<string, boolean> | null) ?? {};
    if (!prefs['emailOnEveryCall']) return;

    // Fall back to the owner's email if no explicit recipient was set.
    let to = row.recipient?.trim();
    if (!to) {
      const [owner] = await db
        .select({ email: adminUsers.email })
        .from(adminUsers)
        .where(and(eq(adminUsers.tenantId, row.tenantId), eq(adminUsers.role, 'owner')))
        .limit(1);
      to = owner?.email;
    }
    if (!to) return;

    // Best-effort caller name lookup.
    let callerName: string | null = null;
    if (row.contactId) {
      const [c] = await db
        .select({ firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(eq(contacts.id, row.contactId))
        .limit(1);
      if (c) callerName = `${c.firstName} ${c.lastName}`.trim();
    }

    const duration = row.durationSeconds
      ? `${Math.floor(row.durationSeconds / 60)}m ${row.durationSeconds % 60}s`
      : '—';
    const startedAt = row.startedAt
      ? new Date(row.startedAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '—';
    const subject = `📞 ${row.direction === 'outbound' ? 'Outbound' : 'Inbound'} call — ${callerName ?? row.fromNumber}`;
    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="font-family: Georgia, serif; color: #1a1a1a; margin: 0 0 4px 0;">${row.tenantName}</h2>
  <p style="color: #666; font-size: 13px; margin: 0 0 24px 0;">Telfin · ${startedAt}</p>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1a1a1a;">
    <tr>
      <td style="padding: 8px 0; color: #666;">Caller</td>
      <td style="padding: 8px 0; text-align: right;"><strong>${callerName ?? row.fromNumber}</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">From</td>
      <td style="padding: 8px 0; text-align: right;">${row.fromNumber}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Duration</td>
      <td style="padding: 8px 0; text-align: right;">${duration}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Outcome</td>
      <td style="padding: 8px 0; text-align: right;"><strong>${row.outcome ?? 'completed'}</strong></td>
    </tr>
  </table>

  ${row.summary ? `
    <div style="margin-top: 20px; padding: 16px; background: #f5f0e8; border-radius: 12px; font-size: 14px; line-height: 1.5; color: #3a3a3a;">
      ${row.summary}
    </div>
  ` : ''}

  <p style="margin: 24px 0 0 0; font-size: 13px;">
    <a href="${config.DASHBOARD_URL}/calls/${row.callId}" style="color: #c96442; text-decoration: none; font-weight: 600;">
      Open in dashboard →
    </a>
    ${row.recordingUrl ? `
      &nbsp;·&nbsp;
      <a href="${row.recordingUrl}" style="color: #c96442; text-decoration: none; font-weight: 600;">Listen to recording</a>
    ` : ''}
  </p>

  <p style="margin: 32px 0 0 0; color: #999; font-size: 11px;">
    You're receiving this because "Email me after every call" is enabled.
    <a href="${config.DASHBOARD_URL}/settings/notifications" style="color: #999;">Manage notifications →</a>
  </p>
</div>`.trim();

    await sendEmail({ to, subject, html });
  } catch (err) {
    console.error('[notifications] sendCallSummaryEmail failed:', err);
  }
}
