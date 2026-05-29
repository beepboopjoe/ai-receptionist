// ============================================================
// Stripe SDK singleton.
//
// Returns a configured Stripe client when STRIPE_SECRET_KEY is set,
// otherwise returns null. Callers must check before using — this lets
// the app boot in dev/CI without Stripe credentials and the routes
// respond with a clear 503 instead of crashing.
// ============================================================
import Stripe from 'stripe';
import { config } from '../../config.js';

let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;

  const key = config.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return null;
  }

  cached = new Stripe(key, {
    // Pin the API version so a Stripe-side change doesn't silently break us.
    // Bump deliberately when upgrading; consult the Stripe migration guide.
    apiVersion: '2025-08-27.basil',
    typescript: true,
    appInfo: {
      name: 'Telfin',
      version: '1.0.0',
    },
  });
  return cached;
}

/** Map our plan key + billing cycle to the configured Stripe Price ID. */
export function priceIdFor(planKey: string, cycle: 'monthly' | 'annual'): string | null {
  const upper = planKey.toUpperCase();
  const cycleUpper = cycle.toUpperCase();
  const envKey = `STRIPE_PRICE_${upper}_${cycleUpper}` as keyof typeof config;
  const value = config[envKey];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
