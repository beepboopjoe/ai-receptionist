import Link from 'next/link';
import { LegalDocument } from '@/components/legal/legal-document';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

export const metadata = {
  title: 'Cookie Policy — Telfin',
  description: 'How Telfin uses cookies and how to manage optional analytics.',
};

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      description={`This policy describes cookies and similar technologies on ${BRAND_NAME} websites. It should be read with the Privacy Policy.`}
    >
      <h2>1. What we use today</h2>
      <p>
        As of the last-updated date, the public marketing site and dashboard source do{' '}
        <strong>not</strong> ship Google Analytics, Google Tag Manager, Meta Pixel, Hotjar,
        or similar advertising pixels. If those IDs are added later via environment
        variables, the corresponding scripts load <strong>only after</strong> you Accept
        (or enable Analytics / Marketing) in the cookie banner.
      </p>
      <p>We do use:</p>
      <ul>
        <li>
          <strong>Essential local storage / cookies</strong> after you sign in (auth and
          refresh tokens) and to remember cookie preferences
        </li>
        <li>
          <strong>Self-hosted webfonts</strong> served with the app (no runtime request to
          fonts.googleapis.com)
        </li>
        <li>
          <strong>First-party media</strong> (sample audio / optional MP4s we host)
        </li>
        <li>
          <strong>Third-party processors for the product itself</strong> (not website
          pixels): Stripe checkout, Google OAuth if you choose “Sign in with Google,”
          Telnyx and xAI when a call runs — see{' '}
          <Link href="/legal/subprocessors">Subprocessors</Link>
        </li>
      </ul>

      <h2>2. Categories</h2>
      <ul>
        <li>
          <strong>Essential</strong> — required to operate the site or honor your choice.
          Always on.
        </li>
        <li>
          <strong>Analytics</strong> — usage measurement. Off until you opt in.
        </li>
        <li>
          <strong>Marketing</strong> — advertising pixels. Off until you opt in. None are
          configured in the current codebase.
        </li>
      </ul>

      <h2>3. How to manage</h2>
      <p>
        Use <strong>Accept</strong>, <strong>Reject non-essential</strong>, or{' '}
        <strong>Manage</strong> on the banner. Re-open it anytime from the footer “Cookie
        settings” link. You can also control cookies in your browser; blocking essential
        storage will break sign-in.
      </p>
      <p>
        California residents: rejecting non-essential cookies is how you opt out of any
        future “sale” or “share” that would be implemented through those pixels. See the{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>4. What we ask of embeds</h2>
      <p>
        We avoid third-party video or chat embeds that set their own cookies on marketing
        pages. If a future embed cannot be gated, we will list it here.
      </p>

      <h2>5. Contact</h2>
      <p>
        <a href={`mailto:${BRAND_SUPPORT_EMAIL}`}>{BRAND_SUPPORT_EMAIL}</a>
      </p>
    </LegalDocument>
  );
}
