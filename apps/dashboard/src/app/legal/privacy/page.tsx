import Link from 'next/link';
import { LegalDocument } from '@/components/legal/legal-document';
import {
  BRAND_ADDRESS,
  BRAND_EIN_PLACEHOLDER,
  BRAND_LEGAL_ENTITY,
  BRAND_NAME,
  BRAND_OPERATOR,
  BRAND_SUPPORT_EMAIL,
} from '@/lib/brand';

export const metadata = {
  title: 'Privacy Policy — Telfin',
  description: 'How Telfin collects, uses, and shares personal information.',
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description={`${BRAND_NAME} is an AI phone receptionist. This policy explains what we collect on our marketing site, during signup, on demo “call me” requests, and when you use the product.`}
    >
      <h2>1. Who we are</h2>
      <p>
        {BRAND_NAME} is operated by {BRAND_OPERATOR}. Service address:{' '}
        <strong>{BRAND_ADDRESS}</strong>. Contact:{' '}
        <a href={`mailto:${BRAND_SUPPORT_EMAIL}`}>{BRAND_SUPPORT_EMAIL}</a>.
      </p>
      <p>
        Formal registered entity name and employer identification number are not published here
        yet: <strong>{BRAND_LEGAL_ENTITY}</strong>; EIN {BRAND_EIN_PLACEHOLDER}. The operator
        should replace those placeholders after counsel confirms the filing entity.
      </p>

      <h2>2. Scope</h2>
      <p>This policy covers:</p>
      <ul>
        <li>Visitors to telfin.ai and related marketing pages</li>
        <li>People who request a live demo call (“Hear it on your phone”)</li>
        <li>People who create an account, join a workspace, or apply as a partner</li>
        <li>Callers and contacts whose data customers process through the service</li>
      </ul>
      <p>
        If you are a customer’s caller or contact, your primary relationship is with that
        customer. We process that information as their service provider / processor (and, if a
        Business Associate Agreement is signed, as a business associate for PHI).
      </p>

      <h2>3. Information we collect</h2>
      <h3>You give us</h3>
      <ul>
        <li>
          <strong>Account:</strong> business name, email, password (hashed), optional Google
          sign-in identifiers, plan choice
        </li>
        <li>
          <strong>Demo call-me:</strong> the phone number you type so we can place one short AI
          demo call. We do not ask for name, email, or payment on that widget.
        </li>
        <li>
          <strong>Partner application:</strong> name, email, password
        </li>
        <li>
          <strong>Support:</strong> whatever you send to {BRAND_SUPPORT_EMAIL}
        </li>
        <li>
          <strong>Customer configuration:</strong> business context, voice settings, calendars you
          connect, uploaded knowledge, contact lists you import for campaigns
        </li>
      </ul>
      <h3>Collected automatically</h3>
      <ul>
        <li>IP address, user-agent, and basic request metadata (security, rate limits, abuse prevention)</li>
        <li>Authentication cookies / local storage tokens after you sign in</li>
        <li>Cookie-preference record after you use the consent banner</li>
      </ul>
      <h3>Created when the product runs</h3>
      <ul>
        <li>Call audio, transcripts, AI summaries, recordings (when enabled)</li>
        <li>SMS content sent or received on provisioned numbers</li>
        <li>Appointment, escalation, and campaign logs</li>
        <li>Billing metadata via Stripe (we do not store full card numbers)</li>
      </ul>
      <p>
        We do not need, and ask you not to paste, government ID numbers, payment card PAN, or
        unnecessary health details into marketing forms.
      </p>

      <h2>4. How we use information</h2>
      <ul>
        <li>Provide the AI receptionist (Grok / xAI voice over Telnyx telephony)</li>
        <li>Place the demo call you request, then apply per-number and per-IP limits</li>
        <li>Create accounts, bill subscriptions, and send transactional email</li>
        <li>Secure the service, prevent abuse, and comply with law</li>
        <li>Improve product reliability using aggregated or de-identified signals where feasible</li>
      </ul>
      <p>
        We do not sell personal information for money. We do not use customer call recordings to
        train a public foundation model. Optional website analytics load only after cookie
        consent (see the <Link href="/cookies">Cookie Policy</Link>).
      </p>

      <h2>5. “Hear it on your phone” demo (TCPA-relevant)</h2>
      <p>
        Submitting a number on the homepage demo asks us to place an automated / AI voice call
        to that number. We collect the number, your IP (rate limiting), and a timestamp. We
        store enough to enforce “one call per hour per number” and a daily cap. By submitting
        with the required checkbox, you request that call and agree this policy applies.
      </p>
      <p>
        Demo calls may be recorded or transcribed the same way product calls are, so we can
        operate and debug the demo. Do not enter someone else’s number without their permission.
      </p>

      <h2>6. Call recording, AI disclosure, and transcripts</h2>
      <p>
        The service is an AI, not a human receptionist. Customers should disclose that to
        callers. Recording and two-party consent rules vary by state (California is an
        all-party consent state). Customers configure opening disclosures; we provide tools,
        not a guarantee that every configuration is lawful in every jurisdiction.
      </p>
      <p>
        Voice audio is processed by our voice provider (xAI / Grok) and carried by our
        telephony carrier (Telnyx). See <Link href="/legal/subprocessors">Subprocessors</Link>.
      </p>

      <h2>7. Sharing</h2>
      <p>We share information with:</p>
      <ul>
        <li>Service providers listed on the subprocessors page (hosting, voice, carrier, email, payments)</li>
        <li>Integrations a customer explicitly connects (calendar, CRM)</li>
        <li>Authorities when legally required</li>
        <li>A buyer in a merger or asset sale, with notice where the law requires it</li>
      </ul>
      <p>We do not share demo phone numbers with advertisers.</p>

      <h2>8. California privacy (CCPA / CPRA)</h2>
      <p>
        If you are a California resident, you may have the right to know, access, correct,
        delete, and opt out of “sale” or “sharing” of personal information, and to limit use of
        sensitive personal information, subject to exceptions.
      </p>
      <p>
        <strong>Categories we may collect:</strong> identifiers (name, email, phone, IP);
        commercial information (plan, invoices); internet activity on our site; audio
        (call recordings); professional information (business name); inference-free operational
        logs. Sensitive information may include account credentials and, if a customer uploads
        or a caller states it, health-related content.
      </p>
      <p>
        <strong>Sale / share:</strong> We do not sell personal information. If we later use
        cross-context advertising cookies, that can be “sharing” under CPRA. Those would load
        only after you opt in via the cookie banner. You can reject non-essential cookies at
        any time (footer → Cookie settings).
      </p>
      <p>
        To exercise rights, email {BRAND_SUPPORT_EMAIL} from the address we have on file (or
        describe your relationship so we can verify). Authorized agents may contact us with
        proof of authority. We will not discriminate against you for exercising these rights.
      </p>
      <p>
        We keep personal information only as long as needed for the purposes above, customer
        retention settings, legal holds, and ordinary backup cycles. Customers can set
        retention and request erasure of a contact’s records in the dashboard when that feature
        is enabled.
      </p>

      <h2>9. Health information / HIPAA</h2>
      <p>
        {BRAND_NAME} is <strong>not HIPAA-certified</strong> and does not claim SOC 2 or similar
        certifications on this site. Healthcare customers who need a Business Associate
        Agreement should execute one in-product (Settings → Compliance) or by emailing us
        <em>before</em> processing PHI. Until a BAA is in place, do not use the service for PHI.
        See <Link href="/legal/hipaa">HIPAA / BAA</Link>.
      </p>

      <h2>10. Children</h2>
      <p>
        The service is for businesses, not for children under 16. We do not knowingly collect
        personal information from children through the marketing site.
      </p>

      <h2>11. Security</h2>
      <p>
        We use TLS in transit, encryption at rest at the database/infrastructure layer, access
        controls, and audit logging. No method of transmission or storage is 100% secure.
      </p>

      <h2>12. International visitors</h2>
      <p>
        We operate from California, United States. If you visit from the EEA/UK or elsewhere,
        your information is processed in the United States. Cookie consent is offered to all
        visitors so non-essential trackers can stay off by default.
      </p>

      <h2>13. Changes</h2>
      <p>
        We will update the “Last updated” date when this policy changes. Material changes may
        also be posted in the product or emailed to account owners.
      </p>

      <h2>14. Contact</h2>
      <p>
        Privacy requests: <a href={`mailto:${BRAND_SUPPORT_EMAIL}`}>{BRAND_SUPPORT_EMAIL}</a>
        <br />
        Mail: {BRAND_NAME}, {BRAND_ADDRESS}
      </p>
    </LegalDocument>
  );
}
