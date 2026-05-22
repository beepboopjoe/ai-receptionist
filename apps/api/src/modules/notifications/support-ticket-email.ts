// ============================================================
// Support ticket — founder-notification email.
//
// Sent whenever a tenant submits a support ticket from /support.
// Routed to every address in ADMIN_EMAILS, with the submitter's
// email as Reply-To so the founder can hit reply in Gmail and the
// response goes back to the customer directly.
//
// Fire-and-forget — failures are logged but never propagate so a
// down email service doesn't break ticket submission.
// ============================================================
import { sendEmail } from './adapters/email.adapter.js';
import { config } from '../../config.js';

interface SupportTicketEmailInput {
  ticketId: string;
  tenantName: string;
  submitterEmail: string;
  submitterName: string | null;
  category: 'bug' | 'question' | 'billing' | 'feature_request';
  subject: string;
  message: string;
}

const CATEGORY_LABELS: Record<SupportTicketEmailInput['category'], string> = {
  bug: 'Bug',
  question: 'Question',
  billing: 'Billing',
  feature_request: 'Feature Request',
};

const CATEGORY_COLORS: Record<SupportTicketEmailInput['category'], string> = {
  bug: '#dc2626',          // red-600
  question: '#2563eb',     // blue-600
  billing: '#ca8a04',      // yellow-600
  feature_request: '#7c3aed', // violet-600
};

function adminRecipients(): string[] {
  return config.ADMIN_EMAILS
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

export async function sendSupportTicketEmail(input: SupportTicketEmailInput): Promise<void> {
  try {
    const recipients = adminRecipients();
    if (recipients.length === 0) {
      console.warn('[support] No ADMIN_EMAILS configured — skipping ticket notification');
      return;
    }
    if (!config.RESEND_API_KEY) {
      console.warn('[support] RESEND_API_KEY not configured — skipping ticket email');
      return;
    }

    const categoryLabel = CATEGORY_LABELS[input.category];
    const categoryColor = CATEGORY_COLORS[input.category];
    const fromName = input.submitterName?.trim() || input.submitterEmail;
    const ticketUrl = `${config.DASHBOARD_URL}/platform?ticket=${input.ticketId}`;

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
    <span style="display: inline-block; background: ${categoryColor}; color: white; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em;">${categoryLabel}</span>
    <span style="color: #666; font-size: 13px;">New support ticket</span>
  </div>
  <h2 style="font-family: Georgia, serif; margin: 8px 0 16px 0; color: #1a1a1a;">${escape(input.subject)}</h2>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
    <tr>
      <td style="padding: 6px 0; color: #666; width: 110px;">From</td>
      <td style="padding: 6px 0;"><strong>${escape(fromName)}</strong> &nbsp;<a href="mailto:${escape(input.submitterEmail)}" style="color: #c96442; text-decoration: none;">&lt;${escape(input.submitterEmail)}&gt;</a></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; color: #666;">Tenant</td>
      <td style="padding: 6px 0;">${escape(input.tenantName)}</td>
    </tr>
  </table>

  <div style="padding: 16px; background: #f5f0e8; border-radius: 12px; font-size: 14px; line-height: 1.6; color: #2a2a2a; white-space: pre-wrap;">
${escape(input.message)}
  </div>

  <p style="margin: 24px 0 12px 0; font-size: 13px; color: #666;">
    <strong>Reply directly to this email</strong> — it goes straight to ${escape(input.submitterEmail)}.
  </p>

  <p style="margin: 12px 0 0 0; font-size: 13px;">
    <a href="${ticketUrl}" style="color: #c96442; text-decoration: none; font-weight: 600;">View in Platform Admin →</a>
  </p>
</div>
`;

    await sendEmail({
      to: recipients,
      subject: `[${categoryLabel}] ${input.subject}`,
      html,
      replyTo: input.submitterEmail,
    });
  } catch (err) {
    // Fire-and-forget — never throw. Logged for ops visibility.
    console.error('[support] sendSupportTicketEmail failed:', err);
  }
}
