# Project handoff — read this first

This file is loaded automatically at the start of every Claude Code session in this repo. It's the orientation document for any agent picking up work, including future-you.

If you only read three things, read these:
1. `README.md` — architecture, run commands, "where things live" table.
2. `~/.claude/plans/witty-knitting-ritchie.md` — running plan file with the most recent phase and its scope decisions.
3. This file — phase rollup + open work + cost-conscious patterns.

---

## What this product is

Multi-vertical AI receptionist SaaS. Six industries (dental / insurance / legal / real_estate / home_services / generic). Voice agent answers inbound calls + runs outbound campaigns. Customers integrate via webhooks and a public REST API.

**Monorepo (pnpm workspaces):**
- `apps/api` — Fastify backend (Postgres + Redis + BullMQ + xAI Grok Realtime via WebSocket)
- `apps/dashboard` — Next.js 14 app router, marketing site + authenticated SaaS UI
- `packages/shared` — `@ai-receptionist/shared`, source-of-truth types (Vertical, WebhookEventType, domain DTOs)

---

## Phase rollup (what's already shipped)

Don't re-do any of this. Verify before adding what you think might be missing.

**Phase 4 — Multi-vertical foundation.** `verticals.ts`, `vertical-prompts.ts`, `step-0-industry`, demo/outbound/landing generalized. Dental no longer the only first-class vertical.

**Phase 5 — Vertical plumbing end-to-end.** `tenants.vertical` column + migration. Vertical threaded through `media-stream.handler`, `prompt-builder`, `outbound-qualification.prompt`, orchestrator flow registry. Onboarding signup → step-0 → DB. UI badge + settings dropdown.

**Phase 6 — Activate, unify, connect.** Shared `Vertical` + `WebhookEventType` in `packages/shared`. Activity gateway at `/ws/activity` with `pushActivity()`. `emitWebhook()` + `pushActivity()` wired into call.started/completed/missed, appointment.booked/cancelled, escalation.created/resolved, campaign milestones. Webhook drain worker. `/settings/webhooks` UI. Toast/Skeleton/EmptyState/ErrorBoundary/TenantProvider primitives. 401 interceptor. Feature flags. BRAND_NAME constant. 404 page + route-progress. `.env.example`, seed script, top-level README.

**Phase 7 — Shippable.** `requireRole('owner'|'admin'|'staff')` middleware applied across admin/webhook/campaign routers. Invitations table + team router + `/settings/team` + `/accept-invite/<token>`. `/settings/audit-log`. Persisted password reset tokens (SHA-256 hashed, DB-backed). Per-route auth rate limits. `@fastify/helmet` + dashboard security headers in `next.config.js`. Real `/health/ready` (pings DB + Redis). 4 smoke test files + GitHub Actions CI. Landing-page heavy components lazy-loaded. CSV export buttons on every list page. Onboarding completion banner. Bulk delete on contacts.

**Phase 8 — Integrable.** `tenant_api_keys` table + `requireApiKey('read'|'write')`. Public read endpoints at `/api/v1/public/*` (calls, appointments, contacts, escalations, whoami, contacts-by-phone). `/settings/api-keys` UI with one-time secret reveal. OpenAPI spec via `@fastify/swagger` + Swagger UI at `/docs`. Global cmd-K search (`/search` admin endpoint + `<CommandPalette>`). OpenTelemetry tracing in `apps/api/src/telemetry.ts` (opt-in via `OTEL_ENABLED`).

---

## Where to find things

The README has a longer table; these are the high-leverage entry points:

| Concern | File |
|---|---|
| Canonical `Vertical` type | `packages/shared/src/types/vertical.types.ts` |
| Vertical UI configs (emoji, nouns, use-cases) | `apps/dashboard/src/lib/verticals.ts` |
| Voice agent prompts per vertical | `apps/api/src/modules/voice-agent/vertical-prompts.ts` |
| Inbound call → AI pipeline | `apps/api/src/modules/telephony/media-stream.handler.ts` |
| Outbound webhook delivery | `apps/api/src/modules/webhooks/webhook.service.ts` |
| Activity push to dashboard | `apps/api/src/modules/activity/activity.service.ts` |
| Role middleware | `apps/api/src/modules/admin/auth.middleware.ts` |
| API key middleware | `apps/api/src/modules/public-api/api-key.middleware.ts` |
| Tenant context provider | `apps/dashboard/src/lib/TenantProvider.tsx` |
| Feature flags | `apps/dashboard/src/lib/featureFlags.ts` |
| Shared UI primitives | `apps/dashboard/src/components/ui/{empty-state,skeleton,toast,error-boundary,download-csv-button,command-palette,route-progress}.tsx` |

---

## Open work — explicit deferred items

These were deliberately punted, not forgotten. If you propose work, check this list first.

1. **DB rename `patients` → `contacts`.** Deferred 4× across phases. UI surface already uses vertical-aware copy via `useVertical()` so users never see "patients" unless their vertical is dental. Schema rename is a real migration with FK + query updates everywhere.
2. **HubSpot OAuth + sync.** Listed in `/settings/integrations` as a CRM option but not wired. Requires HubSpot dev app registration (free) + OAuth flow + contact sync worker.
3. **Sentry / PostHog.** User has been explicit: no new SaaS accounts. Use the OpenTelemetry path (Phase 8) instead — self-hostable Jaeger or SigNoz for traces. Pino logs already structured.
4. **Per-vertical workflow flow variants.** `orchestrator.ts` has a `VERTICAL_FLOW_OVERRIDES` registry that's empty. Add an entry when a vertical genuinely needs different post-call logic (e.g. legal new-client intake → conflict-of-interest check).
5. **Public API write endpoints.** Phase 8 shipped read-only. Mutation routes under `/api/v1/public/*` with `requireApiKey('write')` are a natural follow-on — careful with idempotency keys for POSTs.
6. **i18n beyond dental Spanish.** Spanish scripts exist for dental only. Full product i18n would let any vertical run in Spanish.

---

## Conventions to keep

- **Single source of truth for `Vertical`** — `packages/shared/src/types/vertical.types.ts`. Don't redeclare the union elsewhere.
- **Fire-and-forget side effects.** `emitWebhook()` and `pushActivity()` never throw. Call them with `void` or unawaited. Business logic must complete even when telemetry fails.
- **`requireRole(...)` for JWT routes, `requireApiKey(...)` for public API.** Never reuse `app.authenticate` directly except on `/auth/*` routes.
- **One auth hop per request.** Don't compose `authenticate + requireRole` — `requireRole` already calls `authenticate` internally.
- **Skeletons on load, EmptyState on zero-results.** Don't render "Loading…" text or inline "No rows" — both have shared components in `components/ui/`.
- **Toast on every save/delete.** No more inline red banners or "Saved!" fade labels.
- **`BRAND_NAME` constant.** Don't hardcode "AI Receptionist" in JSX — import from `lib/brand.ts`.

---

## Run / verify checklist (for a fresh laptop)

```bash
cp .env.example .env       # fill DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY, XAI_API_KEY
pnpm install
pnpm --filter @ai-receptionist/api migrate   # applies through 0008
pnpm --filter @ai-receptionist/api seed      # one tenant per vertical
pnpm dev                                     # api on :3001, dashboard on :3000
```

Smoke tests: `pnpm --filter @ai-receptionist/api test` (4 files, no DB needed).

---

## Cost-conscious patterns for the next agent

This codebase has 7 phases of accumulated context. Tactics that keep sessions cheap:

1. **Don't re-read files you just edited.** The harness tracks state — Edit and Write succeed or error loudly. Re-reading is usually wasted tokens.
2. **Use `Edit` over `Write` for existing files.** Sends only the diff, not the whole file.
3. **Use `Grep` with `output_mode: 'files_with_matches'` (default) first.** Only escalate to `content` mode when you need surrounding lines.
4. **Prefer `Explore` subagent for "where does X live?" lookups.** Keeps long file contents off the main thread.
5. **Avoid `Bash cat/head/tail/find/grep`.** Use `Read`/`Glob`/`Grep` directly — they're cheaper and scoped to allowed paths.
6. **Skip system-reminder acknowledgements unless asked.** They don't need a response.
7. **Batch parallel edits in one message.** Multiple `Edit` calls in a single tool_use block beat a serial loop.
8. **When you finish a phase, write the rollup here.** That way the next agent can skip what's done. Update the "Phase rollup" section above + the deferred-items list.

---

## When to start fresh

This session's history is long. If you're picking up work and don't need the play-by-play, you'll get faster turns by starting a new session in this repo — Claude Code will auto-load this file and the README, and you can pull plan context from `~/.claude/plans/witty-knitting-ritchie.md` on demand.

Signs you should start fresh:
- Turns are getting slow (long replay before the model responds).
- You only need to ship one or two more items, not re-architect.
- The user explicitly asks about cost / context.
