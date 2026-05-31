#!/usr/bin/env tsx
/**
 * Creates (or looks up existing) Stripe products + recurring prices for all three
 * paid plans at the prices shown in the UI.  Run once; safe to re-run — it uses
 * metadata to find existing objects instead of creating duplicates.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/setup-stripe-prices.ts
 *
 * Outputs the Railway env var block to copy-paste.
 */

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('❌  Set STRIPE_SECRET_KEY env var before running.');
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: '2025-04-30.basil' });

// ── Target prices (must match billing.types.ts) ────────────────────────────
// Phase 23 (2026-05-30): Starter removed; Business added as new top tier.
const PLANS = [
  { key: 'growth',   name: 'Growth',   monthly: 199_00, annual: 169_00 },
  { key: 'scale',    name: 'Scale',    monthly: 399_00, annual: 339_00 },
  { key: 'business', name: 'Business', monthly: 599_00, annual: 509_00 },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

async function findOrCreateProduct(planKey: string, planName: string): Promise<string> {
  // Search for an existing product tagged with our metadata key
  const existing = await stripe.products.search({
    query: `metadata['ai_receptionist_plan']:'${planKey}'`,
  });
  if (existing.data.length > 0) {
    console.log(`  product: found existing "${existing.data[0].name}" (${existing.data[0].id})`);
    return existing.data[0].id;
  }

  const product = await stripe.products.create({
    name: `AI Receptionist — ${planName}`,
    metadata: { ai_receptionist_plan: planKey },
  });
  console.log(`  product: created "${product.name}" (${product.id})`);
  return product.id;
}

async function findOrCreatePrice(
  productId: string,
  planKey: string,
  cycle: 'monthly' | 'annual',
  unitAmount: number,
): Promise<string> {
  const metaKey = `ai_receptionist_${planKey}_${cycle}`;

  // Search existing prices with this metadata
  const existing = await stripe.prices.search({
    query: `metadata['price_key']:'${metaKey}'`,
  });
  if (existing.data.length > 0) {
    const p = existing.data[0];
    const currentAmount = p.unit_amount ?? 0;
    if (currentAmount !== unitAmount) {
      console.warn(`  ⚠️  ${metaKey}: existing price is $${(currentAmount / 100).toFixed(2)}/mo but UI shows $${(unitAmount / 100).toFixed(2)}/mo.`);
      console.warn(`      Stripe prices are immutable — creating a new price. Archive the old one (${p.id}) manually.`);
    } else {
      console.log(`  price:   found existing ${metaKey} = ${p.id} ($${(currentAmount / 100).toFixed(2)}/mo)`);
      return p.id;
    }
  }

  const intervalCount = cycle === 'annual' ? 12 : 1;
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: 'usd',
    recurring: {
      interval: 'month',
      interval_count: intervalCount,
    },
    metadata: { price_key: metaKey },
  });
  console.log(`  price:   created ${metaKey} = ${price.id} ($${(unitAmount / 100).toFixed(2)}/mo${cycle === 'annual' ? ' billed every 12 months' : ''})`);
  return price.id;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const mode = KEY!.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  console.log(`\n🔑  Stripe key mode: ${mode}\n`);
  if (mode === 'LIVE') {
    console.log('⚠️   Running against LIVE Stripe — prices will be real.\n');
  }

  const results: Record<string, string> = {};

  for (const plan of PLANS) {
    console.log(`\n── ${plan.name} ──`);
    const productId = await findOrCreateProduct(plan.key, plan.name);
    results[`STRIPE_PRICE_${plan.key.toUpperCase()}_MONTHLY`] = await findOrCreatePrice(productId, plan.key, 'monthly', plan.monthly);
    results[`STRIPE_PRICE_${plan.key.toUpperCase()}_ANNUAL`]  = await findOrCreatePrice(productId, plan.key, 'annual',  plan.annual);
  }

  console.log('\n\n══════════════════════════════════════════════════════');
  console.log('  Copy these env vars into Railway (API service):');
  console.log('══════════════════════════════════════════════════════\n');
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}=${v}`);
  }
  console.log('\n══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
