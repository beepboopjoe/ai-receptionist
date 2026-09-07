// ============================================================
// Shared legal-page constants. Keep dates and disclaimer copy
// in one place so Privacy / Terms / Cookies / Refunds stay aligned.
//
// These documents are practical California SaaS templates, not
// attorney work product. See LEGAL_NOT_ADVICE.
// ============================================================
import {
  BRAND_ADDRESS,
  BRAND_NAME,
  BRAND_SUPPORT_EMAIL,
} from '@/lib/brand';

export const LEGAL_LAST_UPDATED = 'September 7, 2026';

export const LEGAL_NOT_ADVICE =
  `These pages are practical compliance templates for a California SaaS operated from Pasadena / Los Angeles County. They are not formal legal advice and do not create an attorney–client relationship. ${BRAND_NAME} should have a California-licensed attorney review them before relying on them.`;

export const LEGAL_CONTACT_LINE = `${BRAND_NAME}, ${BRAND_ADDRESS}. Email: ${BRAND_SUPPORT_EMAIL}.`;

export const LEGAL_NAV = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/cookies', label: 'Cookie Policy' },
  { href: '/refunds', label: 'Refund Policy' },
  { href: '/legal/hipaa', label: 'HIPAA / BAA' },
  { href: '/legal/subprocessors', label: 'Subprocessors' },
] as const;

/** Current paid list prices — keep in sync with PLANS in @ai-receptionist/shared. */
export const PUBLISHED_PLAN_PRICES = {
  trial: { name: 'Free Trial', price: 'Free (10 minutes)' },
  growth: { name: 'Growth', price: '$199/month' },
  scale: { name: 'Scale', price: '$399/month' },
  business: { name: 'Business', price: '$599/month' },
  payg: { name: 'Pay as you go', price: '$0.39/minute' },
} as const;
