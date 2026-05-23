# Project handoff — read this first

This file is loaded automatically at the start of every Claude Code session in this repo. It's the orientation document for any agent picking up work, including future-you.

If you only read three things, read these:
1. `README.md` — architecture, run commands, "where things live" table.
2. `~/.claude/plans/make-sure-the-sms-foamy-rivest.md` — running plan file with the most recent phase's scope decisions (last held: Curate-My-Agent wizard).
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

**Phase 9 — Revenue + integrations.** Stripe subscriptions + metered billing (starter/growth/scale + pay-as-you-go at $0.39/min). Overage invoice items + 80% usage warning email. Telnyx phone number purchase + LOA porting. Reseller affiliate MVP (attribution via `?ref=`, commission events). Real-audio sample voice player (HTML5 audio, xAI TTS MP3s). `/inbound` + `/outbound` marketing pages (cream theme). `/demo` + `/pricing` unified cream theme. `DashboardTeaser` + `DemoVideoPlayer` components. Email-on-call notifications. Google OAuth sign-in. HubSpot OAuth + bidirectional contact sync (`crm/adapters/hubspot.adapter.ts`, `crm/hubspot-oauth.router.ts`, `queue/jobs/hubspot-sync.job.ts`). Per-vertical workflow overrides — `legal` (conflict-check escalation), `insurance` (consultation booking), `home_services` (urgency triage). DB rename patients→contacts (migration 0009). Obsidian knowledge vault at `AI Receptionist Notes/`.

**Phase 10 — Partner portal V2.** Partner self-signup at `/partners` (cream theme, bcrypt password). Login at `/partners/login` (stores `partner_token` JWT with `role:'partner'`). Commission dashboard at `/partners/dashboard` (stats cards, referral link copy, commission history, payout request modal). `requirePartner` middleware. `partner.router.ts` endpoints: apply, login, me, commissions, payout-requests, profile. `affiliate.service.ts`: `applyAsPartner`, `loginPartner`, `getPartnerProfile` (SQL aggregate stats), `createPayoutRequest` (validates pending balance), `approvePartner`. Migration 0018: `status`/`password_hash`/`payout_email`/`payout_method` on affiliates + `payout_requests` table. HubSpot OAuth production activation (credentials in Railway). `/pricing` partner CTA now links to `/partners`.

**Phase 11 — Founder ops + marketing polish + agent curation (2026-05-22).** Five workstreams shipped against existing infrastructure — no new domain primitives:

- **Platform Admin dashboard at `/platform`** (commit `d609b84`). Founder-only surface gated by `ADMIN_EMAILS` env var on the API. Stats cards (MRR / total tenants / signups 7d–30d / platform minutes used this month), searchable + sortable tenant table with inline minute-usage bars, "Grant trial" modal (plan picker + minute input + 30/60/120/250 presets), "Revoke" button on promo-trial rows. Backend at `apps/api/src/modules/platform/platform.router.ts`: `/platform/{whoami,stats,tenants}` — all gated by a `requirePlatformAdmin` check against `ADMIN_EMAILS`. Sidebar link only renders when `whoami` returns `ok:true`.
- **Google sign-in 401-loop fix** (commit `23057e7`). Root cause: `/platform/whoami` returned 401 for non-admins, and the dashboard's global 401-interceptor saw the response from the sidebar's startup-time call and bounced the user back to `/login`. Fix: `whoami` now uses `app.authenticate` and always returns 200 with `{ok: boolean}` — no 401 for non-admins. Sidebar reads `res.ok` instead of catching a throw. Also fixed `google-auth.service.ts` audit-log `actorType: 'admin'` (invalid enum) → `'admin_user'`, which had silently broken every Google signup's audit insert.
- **Wholesale phone-number pricing for promo-trial tenants.** `apps/api/src/modules/phone-numbers/phone.service.ts` now exports `resolveMonthlyCostCents(numberType, promoTrial)` and `getNumberPricingForTenant(tenantId)`. Promo-trial tenants pay wholesale ($1 local / $2 toll-free, configurable via `TELNYX_WHOLESALE_LOCAL_CENTS` / `TELNYX_WHOLESALE_TOLLFREE_CENTS`) instead of the retail $5/$10. `GET /phone-numbers/pricing` exposes active rates to the dashboard, which renders an indigo→violet "Promo trial · numbers at cost" banner and uses the dynamic values across the buy/release UI. Stripe invoice description includes `(promo trial · at cost)` + `metadata.pricing = "wholesale_promo"|"retail"`.
- **Curate-My-Agent wizard** (commit `e499efc`). New page at `/settings/voice-agent/curate` — guided 8-question Q&A whose answers synthesize into the same `tenant_settings.business_context` field the AI reads on every call. Critical files: `apps/dashboard/src/lib/agent-curation-questions.ts` (vertical-aware question sets — dental sees insurance-carrier prompts, legal sees case-type prompts, etc.), `apps/dashboard/src/lib/agent-curation-synth.ts` (`synthesizeContext()` + `parseContextToAnswers()`). Output wrapped in `<!-- agent-curation-v1 -->` anchor comments — round-trippable on re-run, and user's custom prose outside the anchors is preserved. CTA card (indigo→amber gradient) above the Business Context textarea on `/settings/voice-agent`. No backend changes — pure composition of existing `business_context` + `settingsApi.update`.
- **Marketing polish.** Marketing header NAV_LINKS: `Resellers` → `Affiliate` (URL stays `/resellers`); inline nav on `/resellers` matches. `/inbound`: deleted "What you get inside" eyebrow block, moved Dashboard preview to position 3 (after How it works). `/demo`: consolidated three demo sections (vertical filter pills + SampleCallPlayer + VoiceLanguageDemo) into one unified section under the "🌐 Multilingual AI / Every voice. Every language." header — VoiceLanguageDemo on top, divider, then "Sample calls by industry" sub-section with the vertical pills + EN/ES toggle + SampleCallPlayer.

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

1. **Google OAuth env vars in prod.** ✅ Done (2026-05-22). `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` / `API_PUBLIC_URL` set on Railway; Google Cloud callback URL approved; sign-in + signup verified end-to-end after the 401-loop fix in Phase 11.
2. **HubSpot credentials in prod.** ✅ Done (2026-05-13).
3. **`ADMIN_EMAILS` on Railway.** Required to make the new `/platform` Admin dashboard link appear in the sidebar (Phase 11). Add `ADMIN_EMAILS=joeykhabbazz@gmail.com` (comma-separated for multiple) to the API service env on Railway and redeploy. Until set, the link is hidden but the platform is otherwise functional — anyone with the URL is gated out.
4. **Generate sample voice MP3s.** Script exists at `scripts/generate-sample-voices.ts`. Run: `XAI_API_KEY=xxx pnpm tsx scripts/generate-sample-voices.ts`. Output → `apps/dashboard/public/audio/samples/*.mp3`. Cost ~$0.05.
5. **Record demo videos.** `DemoVideoPlayer` component + catalog exist. Need screen-recorded MP4s at `apps/dashboard/public/videos/<vertical>-demo.mp4`.
6. **Partner portal — Stripe Connect payouts.** V2 self-signup + dashboard shipped (Phase 10). Remaining: Stripe Connect Express onboarding for automated payouts (`stripe.transfers.create` on `invoice.paid`), KYC/bank account flow.
7. **Spanish i18n for remaining verticals.** Dental only has Spanish prompts. Need `es` entries in `vertical-prompts.ts` for legal, insurance, real_estate, home_services.
8. **Sentry / PostHog.** User preference: no new SaaS accounts. Use OpenTelemetry (Phase 8) instead — self-hostable Jaeger/SigNoz.
9. **Public API idempotency + bulk ops.** Phase 9 shipped CRUD write endpoints. Idempotency keys for POSTs and bulk operations are deferred.
10. **Escalations 500 — stale migration.** Production API logs show `column "updated_at" does not exist` on `/api/v1/escalations`. Diff the live `escalations` table against `apps/api/src/db/schema.ts` and write a migration to add the missing column (or drop the ORM reference if intentional).
11. **Outbound feature gating for promo-trial tenants.** Decision tabled: feature flag is unlocked at Scale plan during promo, but Telnyx needs a tenant-owned dialer number for outbound. The wholesale-pricing path (Phase 11) makes BYO a $1/mo proposition for promo tenants — preferred. Alternative ("platform-owned shared trial dialer pool" via an `is_trial_outbound_pool` column on `tenant_phone_numbers`) is fully designed but unbuilt.

---

## Live design question (next session pickup)

User asked for prompt caching, ToolSearch, programmatic tool calling, and compaction. **Audit found no Anthropic SDK in the repo** — no `@anthropic-ai/sdk` in `apps/api/package.json`, no imports, voice path is xAI Grok Realtime end-to-end, the "call summary" at `grok.adapter.ts:206` is a placeholder that just joins transcript lines (comment: *"V2: POST to xAI chat completions"*), the AI Agent suggestion service uses static templates, the Curate-My-Agent wizard is pure UI synthesis. All four asked-for features are Anthropic-specific and have no Grok equivalent.

Decision pending: **Path A** = adopt Anthropic Claude as a second backend for one or more non-realtime workloads (call summarization is the strongest candidate; AI Agent script generation and curation refinement are secondary), in which case prompt caching is the high-value lever (system + per-tenant business context repeat across every call) and ToolSearch / PTC / compaction are likely overkill for these workloads. **Path B** = user meant something non-LLM (SWR, Redis, browser/CDN cache). Re-ask before writing code.

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
pnpm --filter @ai-receptionist/api migrate   # applies through 0018
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
