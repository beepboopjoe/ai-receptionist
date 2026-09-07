import Link from 'next/link';
import { LegalDocument } from '@/components/legal/legal-document';
import { BRAND_ADDRESS, BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';
import { PUBLISHED_PLAN_PRICES } from '@/lib/legal';

export const metadata = {
  title: 'Refund Policy — Telfin',
  description: 'When Telfin issues refunds on subscriptions and usage.',
};

export default function RefundsPage() {
  return (
    <LegalDocument
      title="Refund Policy"
      description={`${BRAND_NAME} subscription refunds. This is a commercial policy, not an SLA and not a guarantee of results.`}
    >
      <h2>1. Published prices</h2>
      <p>
        Current public list prices (confirm on <Link href="/pricing">Pricing</Link>):
      </p>
      <ul>
        <li>{PUBLISHED_PLAN_PRICES.trial.name}: {PUBLISHED_PLAN_PRICES.trial.price}</li>
        <li>{PUBLISHED_PLAN_PRICES.growth.name}: {PUBLISHED_PLAN_PRICES.growth.price}</li>
        <li>{PUBLISHED_PLAN_PRICES.scale.name}: {PUBLISHED_PLAN_PRICES.scale.price}</li>
        <li>{PUBLISHED_PLAN_PRICES.business.name}: {PUBLISHED_PLAN_PRICES.business.price}</li>
        <li>
          {PUBLISHED_PLAN_PRICES.payg.name}: {PUBLISHED_PLAN_PRICES.payg.price} (plus any
          number rental)
        </li>
      </ul>
      <p>
        Annual billing is offered at a discount to the monthly rate (see the pricing toggle).
        Add-ons (extra numbers, toll-free, voice clone, overage minutes) are extra.
      </p>

      <h2>2. 30-day money-back on a first paid subscription</h2>
      <p>
        If you are a new paying subscriber and you are not satisfied, email{' '}
        <a href={`mailto:${BRAND_SUPPORT_EMAIL}`}>{BRAND_SUPPORT_EMAIL}</a> within{' '}
        <strong>30 days of your first paid charge</strong> and we will refund that first
        subscription payment. We may disable the paid workspace when the refund is issued.
      </p>
      <p>This 30-day window does not apply to:</p>
      <ul>
        <li>Renewals after the first paid period</li>
        <li>Overage minutes, SMS carrier fees, or extra phone-number charges</li>
        <li>Pay-as-you-go usage already incurred</li>
        <li>Partner commissions or affiliate payouts</li>
        <li>Enterprise custom invoices unless the order form says otherwise</li>
      </ul>

      <h2>3. After day 30 / cancellations</h2>
      <p>
        You may cancel anytime in Billing or by emailing us. Cancellation stops auto-renewal.
        We do not prorate unused days or unused minute balances on a canceled period after
        the 30-day first-charge window, except where California or other law requires a
        different result.
      </p>
      <p>
        Downgrades take effect at the next renewal. Upgrades may be charged immediately on a
        prorated basis.
      </p>

      <h2>4. Free trial</h2>
      <p>
        The trial is free. There is nothing to refund unless we accidentally charged you —
        in that case, write us and we will reverse the charge.
      </p>

      <h2>5. No SLA credits on standard plans</h2>
      <p>
        Growth, Scale, and Business do not include a contractual uptime guarantee or
        automatic service credits. If the product is unavailable, contact support; any
        courtesy credit is discretionary and not an admission of liability.
      </p>

      <h2>6. Chargebacks</h2>
      <p>
        Please contact us before disputing a charge with your bank so we can help. Repeated
        chargebacks may result in account closure.
      </p>

      <h2>7. How to request a refund</h2>
      <p>
        Email {BRAND_SUPPORT_EMAIL} from the account owner address with the workspace name,
        approximate charge date, and last four of the payment method if you have it. Mail:{' '}
        {BRAND_NAME}, {BRAND_ADDRESS}.
      </p>
    </LegalDocument>
  );
}
