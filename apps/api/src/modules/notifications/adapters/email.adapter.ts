// ============================================================
// Email Adapter — Resend
// Replaces the old SendGrid adapter. Same public surface:
//   sendEmail({ to, subject, html, text? })
// Config: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME
// ============================================================
import { Resend } from 'resend';
import { config } from '../../../config.js';
import { IntegrationError } from '../../../lib/errors.js';

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!config.RESEND_API_KEY) {
    throw new IntegrationError('resend', 'Resend API key not configured');
  }

  const resend = new Resend(config.RESEND_API_KEY);
  const from = `${config.RESEND_FROM_NAME} <${config.RESEND_FROM_EMAIL}>`;

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text ?? params.html.replace(/<[^>]+>/g, ''),
  });

  if (error) {
    throw new IntegrationError('resend', `Email send failed: ${error.message}`);
  }
}
