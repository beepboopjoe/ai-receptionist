// ============================================================
// Legal-vertical default email templates (Phase 26c-1).
//
// Seeded into a tenant's email_templates table on demand via
// seedDefaults(). Each one pairs with an event the workflow engine
// already emits (or will emit in 26c-2):
//
//   intake.completed      → "Intake confirmation" (to prospect)
//   consult.reminder.24h  → "Consult prep — tomorrow" (to prospect)
//   court_date.reminder   → "Court date reminder" (to client)
//   document.request      → "Documents we still need from you" (to client)
//   settlement.funds_available → "Your settlement is ready" (to client)
//
// Variables are documented in `bodyVariables` for the dashboard UI;
// substitution is best-effort at render time (missing var = empty string).
// ============================================================

export interface DefaultTemplate {
  triggerEvent: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyVariables: string[];
}

export const LEGAL_DEFAULT_TEMPLATES: readonly DefaultTemplate[] = [
  {
    triggerEvent: 'intake.completed',
    name: 'Intake confirmation',
    subject: 'We received your inquiry — {{firm.name}}',
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>Thank you for reaching out to {{firm.name}}. We received your inquiry about your {{matter.type}} matter and one of our intake attorneys will review it within the next business day.</p>
<p>Here's what happens next:</p>
<ol>
  <li>An attorney reviews the facts you shared with our AI receptionist.</li>
  <li>If we can help, we'll call you to schedule a no-cost consultation.</li>
  <li>If your matter isn't a fit for our practice, we'll tell you so promptly and (when possible) refer you to a firm that can.</li>
</ol>
<p>If your situation is time-sensitive (a court date, an arrest, a deadline), please call us back at {{firm.phone}} — say "this is urgent" and you'll be routed to an on-call attorney.</p>
<p>Talk soon,<br>The {{firm.name}} team</p>`,
    bodyVariables: ['contact.firstName', 'firm.name', 'firm.phone', 'matter.type'],
  },
  {
    triggerEvent: 'consult.reminder.24h',
    name: 'Consult prep — tomorrow',
    subject: 'Reminder: your consultation with {{firm.name}} is tomorrow',
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>This is a friendly reminder that your consultation with {{firm.name}} is scheduled for <strong>{{consult.dateTime}}</strong>.</p>
<p>To make the most of the time:</p>
<ul>
  <li>Have any relevant documents handy (police report, contract, court papers, correspondence).</li>
  <li>Write down the 2–3 questions you most want answered.</li>
  <li>Be ready to share dates and names of anyone else involved.</li>
</ul>
<p>If something has come up and you need to reschedule, please call us at {{firm.phone}} as soon as possible. We hold consultation slots for clients and a quick heads-up lets us offer that time to someone who needs it.</p>
<p>Looking forward to speaking with you,<br>The {{firm.name}} team</p>`,
    bodyVariables: ['contact.firstName', 'firm.name', 'firm.phone', 'consult.dateTime'],
  },
  {
    triggerEvent: 'court_date.reminder',
    name: 'Court date reminder',
    subject: 'Court date reminder: {{court.date}} — {{matter.shortName}}',
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>This is a reminder that you have a court appearance on <strong>{{court.date}} at {{court.time}}</strong> for your matter <em>{{matter.shortName}}</em>.</p>
<p><strong>Where:</strong> {{court.location}}, Courtroom {{court.room}}<br>
<strong>Judge:</strong> {{court.judge}}<br>
<strong>What to bring:</strong> Photo ID, any documents your attorney specified.</p>
<p>Please plan to arrive at least 30 minutes early — courthouse security can have a line. Dress in business-appropriate attire (no shorts, no tank tops, no logos). Silence your phone before entering the courtroom.</p>
<p>If you have any questions about what to expect, call us at {{firm.phone}}.</p>
<p>Best,<br>{{attorney.fullName}}<br>{{firm.name}}</p>`,
    bodyVariables: [
      'contact.firstName',
      'firm.name',
      'firm.phone',
      'matter.shortName',
      'court.date',
      'court.time',
      'court.location',
      'court.room',
      'court.judge',
      'attorney.fullName',
    ],
  },
  {
    triggerEvent: 'document.request',
    name: 'Documents we still need from you',
    subject: 'Documents we still need — {{matter.shortName}}',
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>Quick check-in on your {{matter.shortName}} matter. We're still waiting on a few items from you before we can move to the next step. Could you send the following at your earliest convenience?</p>
<ul>
  {{documents.requestedList}}
</ul>
<p>You can reply to this email with the documents attached, or use the secure upload link our office sent you. If you've already sent some of these and we missed them, please let us know and we'll re-check our records.</p>
<p>If you have questions about why we need any of these or what they should look like, call your case manager at {{firm.phone}}.</p>
<p>Thanks for your help moving this forward,<br>The {{firm.name}} team</p>`,
    bodyVariables: [
      'contact.firstName',
      'firm.name',
      'firm.phone',
      'matter.shortName',
      'documents.requestedList',
    ],
  },
  {
    triggerEvent: 'settlement.funds_available',
    name: 'Your settlement is ready',
    subject: 'Good news: your settlement funds are ready — {{firm.name}}',
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>Good news — the settlement funds for your {{matter.shortName}} matter have cleared our trust account. Here's what happens next:</p>
<ol>
  <li><strong>Final accounting.</strong> We've attached a settlement statement showing the gross recovery, attorney's fees per your retainer, case costs we advanced, any liens (medical, subrogation), and the net amount payable to you.</li>
  <li><strong>Pickup or wire.</strong> Please call us at {{firm.phone}} to schedule a brief in-office signing, or let us know if you'd prefer a wire transfer (we'll need your bank routing + account info, sent via a secure form — never email or text).</li>
  <li><strong>Tax letter.</strong> Some portions of a settlement are taxable, some aren't. We'll include a letter explaining what to share with your accountant.</li>
</ol>
<p>Congratulations on closing this chapter. Thank you for trusting {{firm.name}} with your matter.</p>
<p>Best,<br>{{attorney.fullName}}<br>{{firm.name}}</p>`,
    bodyVariables: [
      'contact.firstName',
      'firm.name',
      'firm.phone',
      'matter.shortName',
      'attorney.fullName',
    ],
  },
];
