# Stripe Setup — production checklist

The codebase is wired but Stripe needs to be configured on **your** Stripe account once. Estimated time: ~20 minutes for the first time, then forever after it's just adjusting prices in the Stripe dashboard.

## 0. Sign up / log in

Go to https://dashboard.stripe.com → sign up if you don't have an account. Stay in **test mode** while you set everything up; flip to live mode at the end.

## 1. Create the products + prices

In the Stripe dashboard, go to **Product catalog** → **+ Add product** and create four products. For each one, add **two recurring prices** (Monthly and Annual). Stay in **test mode** while production is on `sk_test`.

The prices below match `packages/shared/src/types/billing.types.ts` — keep them in sync if you ever change them there.

Preferred: `STRIPE_SECRET_KEY=sk_test_… pnpm tsx scripts/setup-stripe-prices.ts` (idempotent via metadata).

Manual Dashboard / CLI (Starter only — Growth/Scale/Business already exist):

```bash
# Monthly $20
stripe prices create \
  --unit-amount 2000 \
  --currency usd \
  -d "recurring[interval]=month" \
  -d "product_data[name]=Telfin — Starter" \
  -d "metadata[price_key]=ai_receptionist_starter_monthly"

# Annual effective $17/mo, billed every 12 months ($204)
stripe prices create \
  --unit-amount 1700 \
  --currency usd \
  -d "recurring[interval]=month" \
  -d "recurring[interval_count]=12" \
  -d "product_data[name]=Telfin — Starter" \
  -d "metadata[price_key]=ai_receptionist_starter_annual"
```

| Product | Monthly price | Annual (effective /mo) | Description |
|---|---|---|---|
| **Starter** | $20 USD / month | $17/mo ($204/yr) | 50 AI minutes, 1 phone number, full product |
| **Growth**  | $199 USD / month | $169/mo | 380 AI minutes, 2 phone numbers, outbound |
| **Scale**   | $399 USD / month | $339/mo | 780 AI minutes, 5 phone numbers |
| **Business** | $599 USD / month | $509/mo | 1,100 AI minutes, 10 phone numbers |

When creating each price, copy the **price ID** (starts with `price_…`) — you'll paste them into Railway env vars in step 4.

## 2. Configure the webhook endpoint

Stripe → **Developers** → **Webhooks** → **+ Add endpoint**.

- **Endpoint URL**: `{API_PUBLIC_URL}/webhooks/stripe` (the live Fastify origin — Stripe is registered at the root, not under `/api/v1`. The old Railway hostname `ai-receptionist-production-de7b.up.railway.app` returned Railway's "Application not found" 404 and must be replaced with whatever host the current API deploy actually serves.)
- **Events to send**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

After creating, click into the endpoint → **Signing secret** → reveal → copy. Starts with `whsec_…`.

## 3. Get your secret key

Stripe → **Developers** → **API keys** → copy the **Secret key** (starts with `sk_test_…` in test mode, `sk_live_…` once you go live).

## 4. Set the Railway env vars

In Railway → ai-receptionist service → **Variables**, add:

```
STRIPE_SECRET_KEY=sk_test_…             # from step 3
STRIPE_WEBHOOK_SECRET=whsec_…           # from step 2

# Railway API service already has these two names from earlier catalog
# work. Confirm they point at $20 / $17 test-mode prices — leftover $79
# Starter IDs would check out the wrong amount.
STRIPE_PRICE_STARTER_MONTHLY=price_…
STRIPE_PRICE_STARTER_ANNUAL=price_…
STRIPE_PRICE_GROWTH_MONTHLY=price_…
STRIPE_PRICE_GROWTH_ANNUAL=price_…
STRIPE_PRICE_SCALE_MONTHLY=price_…
STRIPE_PRICE_SCALE_ANNUAL=price_…
STRIPE_PRICE_BUSINESS_MONTHLY=price_…
STRIPE_PRICE_BUSINESS_ANNUAL=price_…
```

Railway redeploys automatically (~1 min). Migration `0012_stripe_subscriptions.sql` runs on startup and adds the Stripe columns to the `tenants` table.

## 5. Configure the Customer Portal

Stripe → **Settings** → **Billing** → **Customer portal**.

- Allow customers to **update payment method**, **view invoices**, **cancel** their subscription.
- (Optional) Allow them to **switch plans** between your three tiers — saves them clicking back into your dashboard.
- **Default redirect after action**: `https://ai-receptionist-dashboard-sigma.vercel.app/billing`

Save. The "Manage billing" button on the in-app `/billing` page now opens this portal.

## 6. Test the full flow

1. Visit `/pricing` → click Subscribe on **Starter** (or Growth).
2. Sign up for a new account (or check out while logged in).
3. Inside the dashboard go to **Billing** → click **Switch to Starter** (or whatever tier).
4. Stripe Checkout opens. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
5. After redirect back, the **Billing** page should show "Starter" as the current plan with a 14-day trial end date.
6. In the Stripe dashboard → **Webhooks** → your endpoint → check that recent deliveries are 200 OK.

## 7. Going live

When you're ready:
1. Stripe → flip the **Test mode** toggle off.
2. Re-do steps 1–4 in **live mode** (you'll get fresh `sk_live_…`, `whsec_…`, and `price_…` IDs).
3. Replace the Railway env vars with the live values.
4. Add a real bank account in Stripe → **Settings** → **Bank accounts and scheduling** so payouts work.

That's it.

---

## Troubleshooting

- **"Stripe not configured" 503** when clicking checkout: the API doesn't see `STRIPE_SECRET_KEY`. Check the Variables tab on Railway — env vars need a redeploy to take effect.
- **Webhook failing with 400 "Invalid signature"**: the `STRIPE_WEBHOOK_SECRET` env var doesn't match the endpoint's signing secret. Open the webhook in Stripe → **Reveal signing secret** and re-paste.
- **Subscription created in Stripe but tenant.plan didn't update**: check Railway logs for the webhook handler, and the `stripe_webhook_events` table in Postgres. The `processed_at` column tells you whether sync ran. If `processed_at` is null, the handler errored — log line will show which event id.
