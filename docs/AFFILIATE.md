# Affiliate v1 — lean referrals

Platform-admin referral tracking. **Not** a partner portal and **not** white-label.

Default payout: **20% of paid invoices for the first 12 months** after attribution. Optional custom % , month window (`0` = lifetime), or a **flat bounty** on the first paid conversion.

## How it works

1. **Create an affiliate** in Platform Admin → [Affiliates](/platform/affiliates) (`ADMIN_EMAILS` on the API). Name, email, optional custom code/slug.
2. **Share a tracked link:** `https://telfin.ai/?ref=CODE` or `https://telfin.ai/r/CODE`.
3. The visitor gets a first-party `telfin_ref` cookie (90 days) + `localStorage`. First-touch wins unless they type a different code on signup.
4. **Signup** (password or Google) stores `tenants.affiliate_id`. Returning Google logins are not re-attributed.
5. **Paid conversion:** Stripe `invoice.paid` with `amount_paid > 0` writes a `commission_events` row. **$0 trial invoices do not commission.** Duplicate Stripe deliveries are ignored (`stripe_webhook_events` event id + unique `(stripe_invoice_id, affiliate_id)`).
6. Mark a conversion **paid** in admin when you Venmo/PayPal the partner. No Stripe Connect in v1.

## Test plan (Stripe test mode is fine)

1. Sign in as an `ADMIN_EMAILS` user → `/platform/affiliates` → New affiliate (e.g. code `JOEYTEST`, 20%, 12 months).
2. Copy the tracked link. Open it in a private window. Confirm `telfin_ref` cookie and `/signup?ref=JOEYTEST` still works if you navigate away and back.
3. Sign up (email or Google). In admin, the new tenant should appear under Referred tenants.
4. Subscribe on a paid plan (Stripe test card `4242…`). After `invoice.paid`, a conversion row appears with ~20% of `amount_paid`.
5. Replay the webhook or pay again on the same invoice id — still **one** row.
6. Click **Mark paid**. Status becomes Paid.

## Residual / follow-up

- Existing `/partners` self-serve portal is unchanged; v1 ops live in Platform Admin.
- Enterprise white-label (logo + custom subdomain) is a later PR — see the note at the bottom of this file.
- Partner Stripe Connect automated payouts remain deferred.

## Enterprise white-label (next, not this PR)

When Joey is ready: tenant-level logo + brand color on the customer dashboard, plus a custom subdomain (e.g. `acme.telfin.ai`) that resolves to that tenant’s themed app. Keep billing, voice, and data on Telfin; do not fork the dashboard. Affiliates stay a referral layer — white-label is an Enterprise product skin, not a reseller control panel.
