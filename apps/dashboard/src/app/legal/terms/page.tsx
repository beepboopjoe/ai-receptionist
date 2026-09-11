import Link from 'next/link';
import { LegalDocument } from '@/components/legal/legal-document';
import {
  BRAND_ADDRESS,
  BRAND_LEGAL_ENTITY,
  BRAND_NAME,
  BRAND_OPERATOR,
  BRAND_SUPPORT_EMAIL,
} from '@/lib/brand';
import { PUBLISHED_PLAN_PRICES } from '@/lib/legal';

export const metadata = {
  title: 'Terms of Service — Telfin',
  description: 'Terms that govern use of the Telfin AI receptionist service.',
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description={`These Terms govern access to ${BRAND_NAME} websites, accounts, and the AI phone receptionist. By creating an account or using the service, you agree to them.`}
    >
      <h2>1. The service</h2>
      <p>
        {BRAND_NAME} provides an AI phone receptionist: inbound answering, optional outbound
        campaigns and SMS, calendaring, and a dashboard. Voice conversation is powered by our
        AI voice. Calls and texts are carried by our telephony/SMS carrier. We are not selling
        a third-party conversational AI as the product; the carrier is the transport path.
      </p>
      <p>
        Operator: {BRAND_OPERATOR}. Address: {BRAND_ADDRESS}. Legal entity on file:{' '}
        {BRAND_LEGAL_ENTITY} (confirm with counsel). Contact:{' '}
        <a href={`mailto:${BRAND_SUPPORT_EMAIL}`}>{BRAND_SUPPORT_EMAIL}</a>.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <p>
        You must be 18 or older and able to form a contract. You are responsible for
        credentials, for users you invite, and for configuring the AI (prompts, hours,
        transfers, disclosures) lawfully. You must provide accurate business information.
      </p>

      <h2>3. AI nature of the service — no professional advice</h2>
      <p>
        The receptionist is software. It can misunderstand speech, invent details, or fail
        to escalate. It does <strong>not</strong> provide legal, medical, insurance-binding,
        or other licensed professional advice. You must not present it as a licensed
        professional. You remain responsible for your callers and for reviewing bookings and
        transcripts.
      </p>

      <h2>4. Customer compliance (TCPA, recording, industry rules)</h2>
      <p>You agree that you, not {BRAND_NAME}, are responsible for:</p>
      <ul>
        <li>
          Telephone Consumer Protection Act (TCPA) and state telemarketing rules for any
          outbound campaign, SMS, or list you upload — including consent, DNC, and calling-time
          restrictions
        </li>
        <li>
          Call-recording and all-party consent laws (including California Penal Code § 632)
          and telling callers they are speaking with an AI
        </li>
        <li>
          Healthcare, legal-ethics, insurance-licensing, and advertising rules in your
          industry
        </li>
        <li>
          Not using the service to process PHI unless a BAA is in place (see{' '}
          <Link href="/legal/hipaa">HIPAA / BAA</Link>)
        </li>
      </ul>
      <p>
        Demo “call me” on our marketing site is a call you request to your own number. Do not
        submit another person’s number without their permission.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You may not use the service to harass, defraud, spoof identity, violate sanctions,
        send unlawful spam, collect data you have no right to process, or attack the
        platform. We may suspend accounts that create carrier, fraud, or legal risk.</p>

      <h2>6. Plans, auto-renewal, and cancellation</h2>
      <p>
        Published list prices (verify on <Link href="/pricing">/pricing</Link>; we may change
        prices on notice for future periods):
      </p>
      <ul>
        <li>{PUBLISHED_PLAN_PRICES.trial.name} — {PUBLISHED_PLAN_PRICES.trial.price}</li>
        <li>{PUBLISHED_PLAN_PRICES.growth.name} — {PUBLISHED_PLAN_PRICES.growth.price}</li>
        <li>{PUBLISHED_PLAN_PRICES.scale.name} — {PUBLISHED_PLAN_PRICES.scale.price}</li>
        <li>{PUBLISHED_PLAN_PRICES.business.name} — {PUBLISHED_PLAN_PRICES.business.price}</li>
        <li>{PUBLISHED_PLAN_PRICES.payg.name} — {PUBLISHED_PLAN_PRICES.payg.price} plus number fees</li>
      </ul>
      <p>
        <strong>Automatic renewal.</strong> Paid subscriptions renew at the then-current rate
        each monthly or annual period until you cancel. Annual plans are prepaid. You can
        cancel auto-renewal from the billing page or by emailing {BRAND_SUPPORT_EMAIL}.
        Cancellation stops the next renewal; you keep access through the period already paid
        unless a refund applies under the <Link href="/refunds">Refund Policy</Link>.
      </p>
      <p>
        Overage minutes, extra numbers, and add-ons (for example voice clone) are billed as
        described at checkout or in the dashboard. We do <strong>not</strong> promise an
        uptime SLA or service credits on Growth, Scale, or Business unless a separate written
        enterprise agreement says otherwise.
      </p>

      <h2>7. Trials</h2>
      <p>
        The free trial is limited (currently 10 inbound AI minutes, no card required). Trial
        features may exclude SMS and outbound. We may modify or end trials.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        We own the {BRAND_NAME} software, brand, and documentation. You own your content
        (prompts, recordings you are authorized to capture, contact lists). You grant us a
        limited license to host and process that content solely to provide the service. You
        must not use the {BRAND_NAME} name or marks in a way that implies partnership or
        endorsement without permission. Trademark rights in “Telfin” should be confirmed with
        counsel (see the PR risk flags).
      </p>

      <h2>9. Third-party services</h2>
      <p>
        Calendars, CRMs, Google sign-in, Stripe, our voice and telephony providers, and hosting
        providers have their own terms. See <Link href="/legal/subprocessors">Subprocessors</Link>.
        Outages or policy changes at those providers can affect the product. We are not those
        providers.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS.” WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT TO THE FULLEST EXTENT ALLOWED BY LAW.
        We do not warrant uninterrupted calling, error-free transcription, or any particular
        booking or revenue result.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        TO THE FULLEST EXTENT ALLOWED BY LAW, {BRAND_NAME} AND ITS OPERATOR WILL NOT BE
        LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR
        LOST PROFITS, LOST CALLS, OR LOST DATA. OUR AGGREGATE LIABILITY FOR A CLAIM RELATING
        TO THE SERVICE IS LIMITED TO THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE 12 MONTHS
        BEFORE THE CLAIM (OR $100 IF YOU ARE ON A FREE TRIAL). Some states do not allow
        certain limitations; those limits apply only as permitted.
      </p>

      <h2>12. Indemnity</h2>
      <p>
        You will defend and indemnify us against claims arising from your content, your
        campaigns, your failure to obtain calling/recording consent, or your violation of
        these Terms or law, except to the extent caused by our willful misconduct.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of California, without regard to
        conflict-of-law rules. Courts in Los Angeles County, California have exclusive
        jurisdiction, except that either party may seek injunctive relief in any court of
        competent jurisdiction.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update these Terms by posting a new “Last updated” date. Continued use after
        the effective date constitutes acceptance, except where the law requires additional
        notice or consent.
      </p>

      <h2>15. Contact</h2>
      <p>
        <a href={`mailto:${BRAND_SUPPORT_EMAIL}`}>{BRAND_SUPPORT_EMAIL}</a> · {BRAND_ADDRESS}
      </p>
    </LegalDocument>
  );
}
