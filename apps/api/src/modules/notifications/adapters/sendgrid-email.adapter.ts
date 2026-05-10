// ============================================================
// SendGrid Email Adapter
// ============================================================
import sgMail from '@sendgrid/mail';
import { config } from '../../../config.js';
import { IntegrationError } from '../../../lib/errors.js';

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!config.SENDGRID_API_KEY) {
    throw new IntegrationError('sendgrid', 'SendGrid API key not configured');
  }

  sgMail.setApiKey(config.SENDGRID_API_KEY);

  try {
    await sgMail.send({
      to: params.to,
      from: {
        email: config.SENDGRID_FROM_EMAIL,
        name: config.SENDGRID_FROM_NAME,
      },
      subject: params.subject,
      html: params.html,
      text: params.text ?? params.html.replace(/<[^>]+>/g, ''),
    });
  } catch (err) {
    throw new IntegrationError('sendgrid', `Email send failed: ${String(err)}`);
  }
}
