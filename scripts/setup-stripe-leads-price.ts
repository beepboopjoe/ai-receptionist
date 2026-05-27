#!/usr/bin/env tsx
/**
 * Creates (or looks up existing) Stripe product + metered price for Lead Discovery.
 * Safe to re-run — finds existing objects via metadata before creating.
 *
 * Usage (PowerShell):
 *   $env:STRIPE_SECRET_KEY="sk_live_..."; pnpm tsx scripts/setup-stripe-leads-price.ts
 *
 * Usage (bash / git-bash):
 *   STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/setup-stripe-leads-price.ts
 *
 * Outputs the single Railway env var to copy-paste.
 */

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('❌  Set STRIPE_SECRET_KEY env var before running.');
  process.exit(1);
}

// Pin to a pre-2025-03-31 API version so we create a LEGACY metered price.
// Stripe 2025-03-31.basil onwards requires metered prices to be backed by a
// Billing Meter object, which would require updating lead-billing.service.ts
// to call billing.meterEvents.create instead of subscriptionItems.createUsageRecord.
// Legacy prices created with older API versions keep working indefinitely.
const stripe = new Stripe(KEY, { apiVersion: '2024-10-28.acacia' as Stripe.LatestApiVersion });

const PLAN_KEY = 'leads_discovered';
const PRICE_KEY = 'ai_receptionist_leads_discovered_metered';
const UNIT_AMOUNT_CENTS = 99; // $0.99 per lead

async function findOrCreateProduct(): Promise<string> {
  // Use list + filter instead of search — search requires the account to have
  // indexed data which can take ~15 min on a new account or after a key rotation.
  let starting_after: string | undefined;
  while (true) {
    const page = await stripe.products.list({ limit: 100, ...(starting_after && { starting_after }) });
    const match = page.data.find((p) => p.metadata['ai_receptionist_plan'] === PLAN_KEY);
    if (match) {
      console.log(`  product: found existing "${match.name}" (${match.id})`);
      return match.id;
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  const product = await stripe.products.create({
    name: 'AI Receptionist — Leads Discovered',
    metadata: { ai_receptionist_plan: PLAN_KEY },
  });
  console.log(`  product: created "${product.name}" (${product.id})`);
  return product.id;
}

async function findOrCreatePrice(productId: string): Promise<string> {
  // Same as above: list prices scoped to our product, filter in code.
  let starting_after: string | undefined;
  while (true) {
    const page = await stripe.prices.list({ product: productId, limit: 100, ...(starting_after && { starting_after }) });
    const match = page.data.find((p) => p.metadata['price_key'] === PRICE_KEY);
    if (match) {
      const currentAmount = match.unit_amount ?? 0;
      if (currentAmount !== UNIT_AMOUNT_CENTS) {
        console.warn(`  ⚠️  ${PRICE_KEY}: existing price is $${(currentAmount / 100).toFixed(2)}/lead but expected $${(UNIT_AMOUNT_CENTS / 100).toFixed(2)}/lead.`);
        console.warn(`      Stripe prices are immutable — creating a new price. Archive the old one (${match.id}) manually.`);
        break;
      } else {
        console.log(`  price:   found existing metered = ${match.id} ($${(currentAmount / 100).toFixed(2)}/lead)`);
        return match.id;
      }
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: UNIT_AMOUNT_CENTS,
    currency: 'usd',
    recurring: {
      interval: 'month',
      usage_type: 'metered',
      aggregate_usage: 'sum',
    },
    metadata: { price_key: PRICE_KEY },
  });
  console.log(`  price:   created metered = ${price.id} ($${(UNIT_AMOUNT_CENTS / 100).toFixed(2)}/lead, sum aggregation, monthly billing)`);
  return price.id;
}

async function main() {
  const mode = KEY!.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  console.log(`\n🔑  Stripe key mode: ${mode}\n`);
  if (mode === 'LIVE') {
    console.log('⚠️   Running against LIVE Stripe — price will be real.\n');
  }

  console.log('── Leads Discovered ──');
  const productId = await findOrCreateProduct();
  const priceId = await findOrCreatePrice(productId);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Copy this env var into Railway (API service):');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`STRIPE_PRICE_LEADS_DISCOVERED=${priceId}`);
  console.log('\n══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
