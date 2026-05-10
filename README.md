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

Production-ready feature surface. Loose ends being tracked in `~/.claude/plans/witty-knitting-ritchie.md`. Active areas:

- Real CRM integration depth (HubSpot/Clio/Follow Up Boss are listed but not wired)
- DB column rename `patients` → `contacts` (deferred — UI surface uses vertical-aware copy via `useVertical()`)
- Test coverage (intentionally minimal during fast-iteration phase)
