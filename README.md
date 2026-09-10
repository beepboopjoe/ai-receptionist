# AI Receptionist

AI-powered phone receptionist + scheduling for appointment-based businesses across six verticals (dental, insurance, legal, real estate, home services, and other appointment-based businesses).

The agent answers inbound calls, books appointments against the customer's calendar, escalates urgent matters to staff, and runs outbound campaigns to qualify leads — all tuned per industry via a single `Vertical` config.

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│  apps/dashboard      Next.js 14 app router. Marketing site  │
│                      + authenticated SaaS dashboard.        │
├─────────────────────────────────────────────────────────────┤
│  apps/api            Fastify API. Telephony webhooks,       │
│                      voice agent WS proxy, scheduler,       │
│                      campaigns, webhooks-out, activity gw.  │
├─────────────────────────────────────────────────────────────┤
│  packages/shared     @ai-receptionist/shared — types        │
│                      shared by both apps. Single source of  │
│                      truth for `Vertical`, webhook events,  │
│                      domain DTOs.                           │
└─────────────────────────────────────────────────────────────┘
```

External services:

- **Postgres** — primary store (Drizzle ORM)
- **Redis** — call state cache + BullMQ campaign dialer queue
- **xAI Grok Realtime** — voice model (WebSocket)
- **Telnyx** — telephony provider (or RingCentral)
- **Google / Microsoft Calendar** — appointment booking
- **SendGrid** — email notifications

## Quick start

```bash
# 1. Install
pnpm install

# 2. Copy env template + fill in required values
cp .env.example .env
#   Required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET,
#             ENCRYPTION_KEY (64 hex chars), XAI_API_KEY

# 3. Apply migrations
pnpm --filter @ai-receptionist/api migrate

# 4. Seed one tenant per vertical with realistic data
pnpm --filter @ai-receptionist/api seed

# 5. Start everything
pnpm dev
#   API:        http://localhost:3001
#   Dashboard:  http://localhost:3000
```

Login to any seed tenant with `owner@<slug>.example.com` / `demo1234`. Slugs:
`riverside-dental`, `apex-insurance`, `smith-associates`, `horizon-realty`, `profix-services`, `demo-business`.

## Where things live

| Concern | File |
|---|---|
| Vertical config (UI copy + emoji) | `apps/dashboard/src/lib/verticals.ts` |
| Vertical type (canonical) | `packages/shared/src/types/vertical.types.ts` |
| Voice agent system prompts (per vertical) | `apps/api/src/modules/voice-agent/vertical-prompts.ts` |
| Generic prompt assembly | `apps/api/src/modules/voice-agent/prompt-builder.ts` |
| Inbound call handler | `apps/api/src/modules/telephony/media-stream.handler.ts` |
| Campaign dialer | `apps/api/src/modules/campaigns/` |
| Outbound webhooks | `apps/api/src/modules/webhooks/` |
| Activity feed (WebSocket) | `apps/api/src/modules/activity/` |
| Reusable UI primitives | `apps/dashboard/src/components/ui/` |
| Tenant context provider | `apps/dashboard/src/lib/TenantProvider.tsx` |
| Feature flags | `apps/dashboard/src/lib/featureFlags.ts` |
| Plan tiers + pricing | `apps/dashboard/src/app/pricing/page.tsx` |
| Mock fixtures (dev mode) | `apps/api/src/mocks/` |

## Adding a new vertical

1. Append the literal to `VERTICAL_VALUES` in `packages/shared/src/types/vertical.types.ts`
2. Add a config to `VERTICAL_CONFIGS` in `apps/dashboard/src/lib/verticals.ts`
3. Add 5 system prompts to `apps/api/src/modules/voice-agent/vertical-prompts.ts`
4. Add a mock-data overlay to `apps/api/src/mocks/vertical-overlays.ts`
5. Add the literal to the DB CHECK constraint via a new migration
6. Add a card on the landing page Industries section
7. Optional: a vertical-specific flow variant via the registry in `apps/api/src/modules/workflow-engine/orchestrator.ts`

## Outbound webhooks

Customers register a URL via `/settings/webhooks`; we sign each delivery with HMAC-SHA256 and POST it. Schema in `apps/api/src/db/schema.ts` (`webhookEndpoints`, `webhookDeliveries`); delivery service in `apps/api/src/modules/webhooks/webhook.service.ts`; periodic drain worker in `apps/api/src/workers/webhook-drain.worker.ts`.

Verify a signature on the receiver:

```ts
import crypto from 'node:crypto';
const [tsPart, sigPart] = req.headers['x-webhook-signature'].split(',');
const t = Number(tsPart.split('=')[1]);
const expected = crypto
  .createHmac('sha256', SECRET)
  .update(`${t}.${rawBody}`)
  .digest('hex');
const ok = crypto.timingSafeEqual(
  Buffer.from(expected),
  Buffer.from(sigPart.split('=')[1])
);
```

## Project status

Production-ready feature surface. Loose ends being tracked in `HANDOFF.md`.

## Beta operations — numbers, recordings, live join

These paths are the beta foundation for scale calling. Nothing here changes public list prices.

### How a new tenant gets a number

1. Trial stays on the shared platform number (plan `includedPhoneNumbers = 0`).
2. On **Go live** (`POST /api/v1/onboarding/activate`) or the first **paid** Stripe subscription, the API calls `ensureInboundDid()` (`apps/api/src/modules/phone-numbers/auto-provision.service.ts`).
3. That searches Telnyx (`GET /v2/available_phone_numbers`) and orders a US local DID onto `TELNYX_APP_ID` (`POST /v2/number_orders`), then stores it on `tenant_phone_numbers` (`purpose='inbound'`).
4. Inbound voice is routed by DID via `lookupTenantByDid()` in `apps/api/src/modules/telephony/telnyx-webhook.handler.ts` — not “first tenant in the database”.
5. Dashboard: **Settings → Phone numbers** (`/settings/phone-numbers`) — “Your numbers” with provisioning / active / failed + **Retry**. **Get my number** hits `POST /api/v1/phone-numbers/auto-provision`. Failed orders: `POST /api/v1/phone-numbers/:id/retry`.

Outbound pool (already on `purpose='outbound_pool'`) is sized from the soft `concurrentOutbound` ops ceiling in `packages/shared/src/types/billing.types.ts` (Growth 3, Scale 8, Business 25 capped at 15). That field is not a marketed seat — customer-facing packaging is minutes + included numbers. The pool still auto-grows on dial volume. Retry: `POST /api/v1/outbound-pool/retry`.

### How recordings appear

1. After the media stream starts, the API fires Telnyx `record_start` (`startCallRecording` in `apps/api/src/modules/campaigns/telnyx-dialer.service.ts`).
2. Telnyx posts `call.recording.saved` to `POST /webhooks/telnyx`. The handler writes `calls.recording_url`.
3. Grok transcripts are still persisted on media-stream close (`media-stream.handler.ts`). Empty transcripts mark the call `missed` unless it was transferred.
4. Dashboard **Call log** shows Play / Transcript badges. **Call detail** has an authenticated player (`GET /api/v1/calls/:id/recording`) and a transcript empty state. Only the owning tenant (JWT) can play; platform admins can use `GET /api/v1/platform/tenants/:tenantId/calls/:callId/recording`.

### How Join / Take over works

- **Join call** (`POST /api/v1/calls/:id/join`) dials the Staff Transfer Number into a Telnyx conference with the live caller (`initiateLiveJoin` in `apps/api/src/modules/telephony/transfer.ts`). When staff answers, the webhook stops the AI stream and conferences both legs.
- **Take over** (`POST /api/v1/calls/:id/takeover`) is the existing warm transfer (`actions/transfer`) — the AI drops immediately.
- Follow-up (not in this slice): Telnyx barge / whisper / silent browser listen.

### Env vars (Telnyx)

| Var | Required for |
|-----|----------------|
| `TELNYX_API_KEY` | Number search/order, call control, recordings |
| `TELNYX_APP_ID` | Attach purchased DIDs + outbound pool to Call Control |
| `TELNYX_PUBLIC_KEY` | Webhook signature verification |
| `TELNYX_FROM_NUMBER` | Fallback platform caller ID (demo / trial) |
| `TELNYX_MESSAGING_PROFILE_ID` | SMS |
| `TELNYX_WHOLESALE_LOCAL_CENTS` / `TELNYX_WHOLESALE_TOLLFREE_CENTS` | Promo-trial number cost (defaults $1 / $2) |

Do not set `DEMO_SKIP_COOLDOWN`. Homepage call-me / demo are unchanged.

### Env vars (Google Calendar)

Booking against a tenant's Google Calendar is optional. Without these, Connect shows **Not configured** (503 from the API). Setup: `docs/GOOGLE_CALENDAR_SETUP.md`.

| Var | Required for |
|-----|----------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Calendar OAuth (falls back to `GOOGLE_AUTH_*` if empty) |
| `GOOGLE_REDIRECT_URI` | Must match Google Cloud Console. Production default: `${APP_URL}/api/v1/integrations/google-calendar/callback` |
| `DASHBOARD_URL` | Post-OAuth redirect to `/settings/integrations` |


### Marketing product chatbot

Floating **Ask Telfin** widget on public marketing pages (`MarketingHeader` — homepage, pricing, `/demo`, inbound/outbound, verticals; not the logged-in app).

| Piece | Where |
|---|---|
| UI | `apps/dashboard/src/components/ui/product-chat-widget.tsx` |
| Chat API | `POST /api/v1/public/site-chat` |
| Lead API | `POST /api/v1/public/site-chat/lead` |
| Prompt | `apps/api/src/modules/public-api/site-chat.prompt.ts` |
| Admin list | `/platform` → Marketing leads (same `demo_leads` table as call-me) |

Env: uses existing `XAI_API_KEY`. Optional `XAI_CHAT_MODEL` (default `grok-4.3`). Fastify per-IP caps plus Redis hourly caps. Does not place calls. Lead capture requires name + email and/or US/CA phone, with explicit email and (if phone) SMS/call consent checkboxes.
