# Session handoff — Phases 12.1–12.7

> Generated end-of-session 2026-05-26. Captures everything shipped during this conversation so the next session can pick up cold without replaying the chat. **Read this BEFORE CLAUDE.md** — this is the latest state; CLAUDE.md captures Phases 1–11 and is still accurate for the earlier rollups.

If you only read three things, read these:
1. **This file** — phase rollup, open work, file map for everything 12.1+.
2. `CLAUDE.md` — earlier-phase rollup + cost-conscious patterns.
3. `~/.claude/plans/hat-does-ultra-review-starry-panda.md` — the active plan file (last contains Phase 12.7 lead-discovery plan).

---

## What this session shipped (Phases 12.1–12.7)

Seven coordinated phases plus a typecheck cleanup pass. Repo started this session at **11 dashboard typecheck errors + ~200 API typecheck errors (most pre-existing schema/rootDir issues)**. Ends at **0 dashboard errors, 87/87 API smoke tests green**, with significantly more API code shipped. No regressions introduced.

### Phase 12.1 — Live call monitor + take-over
Real-time transcript streaming + warm-transfer "panic button" for in-progress AI calls. First-time customers can now watch the AI working and hand off to themselves.

**Backend changes:**
- `apps/api/src/modules/activity/activity.service.ts` — `ActivityEventType` union extended with `call_live_started`, `call_caller_said`, `call_agent_said`, `call_live_ended`, `call_taken_over`.
- `apps/api/src/modules/voice-agent/adapters/grok.adapter.ts` — `processEvent` now returns `flushedAgentText` / `callerText` so callers can stream transcript without poking the buffer.
- `apps/api/src/modules/telephony/media-stream.handler.ts` — emits per-utterance activity events while the call is live; pushes `call_live_ended` on socket close with duration.
- `apps/api/src/modules/telephony/transfer.ts` — new `initiateManualTakeover()` is provider-aware (uses `TelnyxAdapter.transferCall` for Telnyx, falls back to RingCentral path).
- `apps/api/src/modules/admin/router.ts` — new `POST /calls/:id/takeover` with status-409 / 400 / 502 error semantics. Audits `call.taken_over` with `actorType: 'admin_user'`.

**Dashboard changes:**
- `apps/dashboard/src/lib/useActivityFeed.ts` — mirrored 5 new event types.
- `apps/dashboard/src/lib/useLiveCalls.ts` — derives `{ activeCalls, transcriptByCallId }` from the activity stream.
- `apps/dashboard/src/components/dashboard/live-call-drawer.tsx` — slide-over drawer with chat bubbles, live timer, take-over button + confirm dialog, multi-call tab strip.
- `apps/dashboard/src/app/(app)/calls/page.tsx` — live banner above the log when calls are in progress.
- `apps/dashboard/src/components/layout/sidebar.tsx` — pulsing `● LIVE` indicator on the Call Log link.
- `apps/dashboard/src/lib/api.ts` — added `callsApi.takeover(id)`.

### Phase 12.2 — Free trial visibility on the marketing site
Trial plan was fully built in the backend but explicitly filtered out of the marketing pages. Unhid it.

- `packages/shared/src/types/billing.types.ts` — tightened `PLANS.trial` to inbound-only (`outbound: false`), trimmed features list, refreshed tagline.
- `apps/dashboard/src/app/pricing/page.tsx` — `PRICING_PLANS` filter now puts trial first instead of excluding it.
- `apps/dashboard/src/components/ui/pricing-cards.tsx` — grid bumped to `lg:grid-cols-5`, new `isFree` CTA branch.
- `apps/dashboard/src/components/ui/plan-comparison-table.tsx` — added 5th column (Free Trial leftmost), 5-cell tuple per row.
- `apps/dashboard/src/components/ui/marketing-header.tsx` — "Try Free →" now the primary filled CTA; "See plans" demoted to outline.
- `apps/dashboard/src/app/{inbound,outbound}/page.tsx` — hero CTAs swapped to "Try Free — 10 min".

### Phase 12.3 — "Try it for real" (call-me widget + test-call button)
Activation pair: homepage call-me widget + dashboard test-call button. Both ride on the existing Telnyx outbound dialer.

**Backend:**
- `apps/api/src/modules/campaigns/telnyx-dialer.service.ts` — new `dialDirect()` helper for outbound calls without AMD or campaign context. Encodes `isOutbound: false` in client_state so the Telnyx webhook handler routes call.answered → startStream immediately.
- `apps/api/src/modules/public-api/public-demo.router.ts` (new) — unauth `POST /api/v1/public/call-me` with US/CA-only regex, junk-number filter, per-IP rate limit (3/24h), global daily cap, per-number cooldown (1/hour), 503 fallback when demo unconfigured.
- `apps/api/src/modules/admin/router.ts` — `POST /api/v1/calls/test-call` (requireRole staff). Marks calls with `direction: 'test'` so they skip billed-minute counters.
- `apps/api/src/config.ts` — new env vars `DEMO_TENANT_ID`, `DEMO_FROM_NUMBER`, `DEMO_DAILY_CALL_LIMIT`.

**Dashboard:**
- `apps/dashboard/src/components/ui/call-me-widget.tsx` (new) — formatted phone input, status state machine (idle → calling → ringing → error), wired into homepage hero in `app/page.tsx`.
- Test-call button placed inline next to Staff Transfer Number in `/settings/voice-agent` and as a card above "Go Live" on `/onboarding/step-5-activate`.
- `apps/dashboard/src/lib/api.ts` — added `callsApi.testCall()`.

### Phase 12.4 — Goal-driven campaign suggestions
Replaces the blank-form New Campaign experience with curated, vertical-aware templates. Customer clicks a goal → contact list auto-built from SQL → draft campaign created → review and Start.

- `apps/api/src/db/migrations/0027_campaign_goals.sql` + schema update — added `goal` + `goal_source` to `outbound_campaigns`.
- `apps/api/src/modules/campaigns/campaign-goals.service.ts` (new) — 16-goal `GOAL_CATALOG` across 6 verticals, each with `findCandidates` SQL.
- `apps/api/src/modules/campaigns/campaign.router.ts` — `GET /campaigns/suggestions` (cached 5min via Redis) + `POST /campaigns/from-goal`.
- `apps/api/src/modules/campaigns/outbound-qualification.prompt.ts` — accepts optional `goalPitch` override so goals can customize the opening line per call.
- `apps/api/src/modules/telephony/media-stream.handler.ts` — outbound path reads the campaign's `goal` and passes `goalPitch: findGoal(goal).pitchOverride` into the prompt builder.
- `apps/dashboard/src/components/campaigns/{campaign-goal-card,campaign-goal-gallery}.tsx` (new) — SWR-fetched grid filtering out zero-candidate goals.
- `apps/dashboard/src/components/dashboard/top-campaign-suggestion.tsx` (new) — single hero card on `/dashboard` showing the highest-candidate-count goal.

### Phase 12.5 — SectionAgent (8 sections)
Suggestive agent header at the top of every meaningful dashboard section. Three stacked layers: educational "what this is" copy + live counts + inline pending agent suggestions re-homed from the dashboard's global queue.

**Backend:**
- `apps/api/src/modules/sections/sections.service.ts` (new) — `getSectionSuggestions(tenantId, section)` returns `{ liveCounts, pendingSuggestionIds }`. SQL-only detectors per section.
- `apps/api/src/modules/sections/section.router.ts` (new) — `GET /sections/:section/suggestions`, Redis-cached 60s per (tenant, section).

**Dashboard:**
- `apps/dashboard/src/lib/section-meta.ts` (new) — registry of all 8 sections (calls, missed-calls, appointments, escalations, contacts, messages, campaigns, reminders) plus `lead-discovery` added later. Vertical-aware copy functions.
- `apps/dashboard/src/components/dashboard/section-agent.tsx` (new) — reusable component with collapse-toggle (per-section localStorage), live count chips, action chips, inline `AgentSuggestionRow` for relevant pending suggestions.
- `apps/dashboard/src/components/dashboard/agent-suggestion-row.tsx` (new, extracted) — the approve/skip row component reused by both the section agents and the dashboard summary.
- `apps/dashboard/src/components/dashboard/agent-suggestions-card.tsx` — slimmed to a router/summary: rolls pending suggestions by type and links each to its natural section. No longer renders inline approve/skip.
- `<SectionAgent>` wired into all 8 section pages.

### Phase 12.6a — Analytics page
Scale-plan analytics page driving renewal/upsell. Stats cards + hand-rolled SVG daily bar chart + peak hour + ROI block.

- `apps/api/src/modules/analytics/analytics.router.ts` (new) — `GET /analytics/overview?days=N`, 5-minute Redis cache, 5 parallel SQL queries (totals / bookings / escalations / daily series with `generate_series` / peak hour). Returns aggregated metrics + ROI heuristics (calls recovered, money saved, hours-of-staff-work avoided).
- `apps/dashboard/src/app/(app)/analytics/page.tsx` (new) — range picker (7/30/90d), 4 stat cards, SVG bar chart with stacked missed-call overlay + booking dots, peak-hour callout, escalations card, ROI block. `<LockedFeature>` overlay for non-Scale plans with a realistic fake-data stub behind the blur.
- `apps/dashboard/src/components/layout/sidebar.tsx` — pro-locked Analytics nav item now renders as a real `<Link>` when entitled (previously hidden when entitled, a bug from before this session).

### Phase 12.7 — Lead Discovery (Apify Google Maps Scraper)
Per-lead-priced lead-generation feature. Customers describe who they want, we scrape Google Maps via Apify, customer reviews + imports. Billing via Stripe metered. **$0.99/lead retail vs ~$0.002 wholesale = ~95% gross margin.**

**Backend:**
- `apps/api/src/db/migrations/0028_lead_discovery.sql` + schema — new `lead_discovery_jobs` table tracking Apify run state, cost, import status.
- `apps/api/src/modules/lead-discovery/apify.client.ts` (new) — REST wrapper for `startRun`, `getRunStatus`, `getRunResults`. Platform-managed `APIFY_API_TOKEN`.
- `apps/api/src/modules/lead-discovery/lead-discovery.service.ts` (new) — `estimateCost`, `startDiscovery`, `pollAndIngest`, `importToContacts`. Post-hoc filtering by phone presence + minRating. US-phone E.164 normalization.
- `apps/api/src/modules/lead-discovery/lead-discovery.router.ts` (new) — 5 endpoints: preview, start, list, get, import. 503 fallback when Apify unconfigured.
- `apps/api/src/queue/jobs/lead-discovery-poll.job.ts` (new) — BullMQ worker that re-checks Apify every 15s until settled (max 10min). New `leadDiscoveryQueue` in `queues.ts` + worker registration in `worker.ts`.
- `apps/api/src/modules/billing/lead-billing.service.ts` (new) — `reportLeadsDiscoveredUsage` via `stripe.subscriptionItems.createUsageRecord`. Graceful no-op when Stripe unconfigured.
- `apps/api/src/config.ts` — new env vars: `APIFY_API_TOKEN`, `APIFY_GOOGLE_MAPS_ACTOR_ID` (defaults to `compass~crawler-google-places`), `LEAD_DISCOVERY_PRICE_CENTS` (default 99), `STRIPE_PRICE_LEADS_DISCOVERED`.

**Dashboard:**
- `apps/dashboard/src/app/(app)/leads/discover/page.tsx` (new) — search form + cost preview + progress polling + selectable results table + import button + history. TCPA banner non-dismissible. `<SectionAgent section="lead-discovery">` at the top.
- `apps/dashboard/src/components/dashboard/lead-discovery-card.tsx` (new, reusable) — amber-themed promo card with compact + default variants.
- LeadDiscoveryCard surfaced on: `/dashboard` home (between TopCampaignSuggestion and AgentSuggestionsCard), `/contacts` empty state, `/campaigns` empty state.
- `apps/dashboard/src/app/(app)/campaigns/new/page.tsx` — added a three-tile lead-source picker at the top: "Find new leads" / "Pick a goal template" / "Build from scratch".
- Sidebar — added "Lead Discovery" link with Crosshair icon between Contacts and Missed Calls.

**Marketing site:**
- `apps/dashboard/src/app/lead-discovery/page.tsx` (new) — full landing page: hero, 3-step how-it-works, realistic sample-leads preview, why-it-matters cards, pricing block, 6-Q FAQ, dark footer CTA.
- `apps/dashboard/src/app/page.tsx` — "Three products" section bumped to four; new Lead Finder card.
- `apps/dashboard/src/app/outbound/page.tsx` — new "No list? We find them" callout section above the existing campaign-flow diagram.
- `apps/dashboard/src/app/pricing/page.tsx` — new add-on section below the PAYG strip with two cards (Lead Discovery $0.99/lead + existing Voice Clone $49/mo). New row in `plan-comparison-table.tsx` for "Lead Discovery (Google Maps · $0.99/lead)".
- `apps/dashboard/src/components/ui/marketing-header.tsx` — new "Leads" link between Outbound and Pricing.

### Cleanup pass (typecheck → 0 errors)
Three real bugs fixed + 7 strict-optional violations + 1 TypedArray cast:

- **Real bugs:**
  - `settings/phone-numbers/page.tsx:377` — `EmptyState` was being called with wrong prop names (`title/description/actionLabel/onAction`); fixed to `label/hint/cta`.
  - `components/ui/command-palette.tsx:18` — missing `searchApi` + `SearchHits` exports from `lib/api.ts`; added them (cmd-K palette was silently broken).
  - `components/ui/marketing-footer.tsx:32` — Link `href` was typed as `string | undefined`; fixed with `as const` on the tuple array.
- **`exactOptionalPropertyTypes` violations** in `campaigns/[id]`, `campaigns/new`, `dashboard`, `settings/phone-numbers` (×2), `settings/webhooks` — all converted from `{ key: value || undefined }` to `...(value && { key: value })` conditional spreads.
- **Float32Array TS 5.7 mismatch** in `embedded-voice-demo.tsx:239` — sidestepped via `buffer.getChannelData(0).set(chunk)` instead of `copyToChannel`.

---

## File map — high-leverage entry points (added/modified this session)

| Concern | File |
|---|---|
| **Live-call monitor / take-over** |  |
| Activity event types | `apps/api/src/modules/activity/activity.service.ts`, `apps/dashboard/src/lib/useActivityFeed.ts` |
| Live transcript emission | `apps/api/src/modules/telephony/media-stream.handler.ts` |
| Take-over endpoint | `apps/api/src/modules/admin/router.ts` (search `/calls/:id/takeover`) |
| Provider-aware transfer | `apps/api/src/modules/telephony/transfer.ts` |
| Live UI hook + drawer | `apps/dashboard/src/lib/useLiveCalls.ts`, `apps/dashboard/src/components/dashboard/live-call-drawer.tsx` |
| **Free trial** |  |
| Trial scope source-of-truth | `packages/shared/src/types/billing.types.ts` (the `key: 'trial'` entry) |
| **Call-me + test-call** |  |
| Direct-dial helper | `apps/api/src/modules/campaigns/telnyx-dialer.service.ts` (`dialDirect`) |
| Public demo endpoint | `apps/api/src/modules/public-api/public-demo.router.ts` |
| Test-call endpoint | `apps/api/src/modules/admin/router.ts` (search `/calls/test-call`) |
| Homepage widget | `apps/dashboard/src/components/ui/call-me-widget.tsx` |
| **Campaign goals** |  |
| Goal catalog | `apps/api/src/modules/campaigns/campaign-goals.service.ts` |
| Goal endpoints | `apps/api/src/modules/campaigns/campaign.router.ts` (search `from-goal`) |
| Goal UI | `apps/dashboard/src/components/campaigns/{campaign-goal-card,campaign-goal-gallery}.tsx` |
| **SectionAgent** |  |
| Section detectors | `apps/api/src/modules/sections/sections.service.ts` |
| Section endpoint | `apps/api/src/modules/sections/section.router.ts` |
| Section meta registry | `apps/dashboard/src/lib/section-meta.ts` |
| Section component | `apps/dashboard/src/components/dashboard/section-agent.tsx` |
| Suggestion row | `apps/dashboard/src/components/dashboard/agent-suggestion-row.tsx` |
| **Analytics** |  |
| Analytics endpoint | `apps/api/src/modules/analytics/analytics.router.ts` |
| Analytics page | `apps/dashboard/src/app/(app)/analytics/page.tsx` |
| **Lead Discovery** |  |
| Apify client | `apps/api/src/modules/lead-discovery/apify.client.ts` |
| Discovery service | `apps/api/src/modules/lead-discovery/lead-discovery.service.ts` |
| Discovery endpoints | `apps/api/src/modules/lead-discovery/lead-discovery.router.ts` |
| Poll worker | `apps/api/src/queue/jobs/lead-discovery-poll.job.ts` |
| Stripe billing helper | `apps/api/src/modules/billing/lead-billing.service.ts` |
| Discovery page | `apps/dashboard/src/app/(app)/leads/discover/page.tsx` |
| Promo card | `apps/dashboard/src/components/dashboard/lead-discovery-card.tsx` |
| Marketing landing | `apps/dashboard/src/app/lead-discovery/page.tsx` |

---

## Open work — explicit deferred items

These were deliberately punted from earlier sessions OR are post-deploy setup tasks. Check this list before starting new work.

### Post-deploy configuration required for features to fully activate

1. **`DEMO_TENANT_ID` + `DEMO_FROM_NUMBER`** — required for the homepage call-me widget. Without these, `/api/v1/public/call-me` returns 503 with a graceful "demo unavailable" message. Setup:
   - Sign up a "Demo Inc" tenant via the normal signup flow
   - Buy/assign a dedicated Telnyx number to it via `/settings/phone-numbers`
   - Configure its vertical (generic), business_context, and voice
   - Set `DEMO_TENANT_ID=<uuid>` + `DEMO_FROM_NUMBER=+1XXXXXXXXXX` on Railway
2. **`APIFY_API_TOKEN`** — required for Lead Discovery to actually scrape. Without it, all `/leads/discover/*` endpoints return 503. Setup:
   - Sign up at apify.com, get an API token from Account → Integrations
   - Add `APIFY_API_TOKEN=apify_api_xxx` to Railway env
3. **`STRIPE_PRICE_LEADS_DISCOVERED`** — required for per-lead billing to actually charge customers. Without it, leads import successfully but no usage events fire to Stripe. Setup:
   - Create a new metered price in Stripe ($0.99 per unit, name "Leads Discovered")
   - Set `STRIPE_PRICE_LEADS_DISCOVERED=price_xxx` on Railway
   - Update existing customers' subscriptions to add the line item, OR wire it into subscription-create flow for new signups
4. **Run new migrations** before redeploying — both `0027_campaign_goals.sql` and `0028_lead_discovery.sql` need to apply.

### Carryovers from before this session (still pending — see CLAUDE.md)

- **Generate sample voice MP3s** — script at `scripts/generate-sample-voices.ts`. Run `XAI_API_KEY=xxx pnpm tsx scripts/generate-sample-voices.ts`. Output → `apps/dashboard/public/audio/samples/*.mp3`. Cost ~$0.05.
- **Record demo videos** — `DemoVideoPlayer` component + catalog exist. Need screen-recorded MP4s at `apps/dashboard/public/videos/<vertical>-demo.mp4`.
- **Spanish i18n for remaining 5 verticals** — only dental has Spanish prompts. Add `es` entries in `apps/api/src/modules/voice-agent/vertical-prompts.ts` for legal, insurance, real_estate, home_services, generic.
- **Partner portal — Stripe Connect payouts** — V2 self-signup + dashboard shipped (Phase 10). Remaining: Stripe Connect Express onboarding for automated payouts.
- **Escalations 500 — stale migration** — production API logs showed `column "updated_at" does not exist` on `/api/v1/escalations`. Verify against live `escalations` table; write migration if still applicable.
- **Outbound feature gating for promo-trial tenants** — decision tabled.
- **Public API idempotency + bulk ops** — deferred.

### Roadmap items for future phases

Listed in priority order based on the current state of the funnel:

1. **Customer logos + testimonials on marketing site** — last piece of the original 12.6 plan (the analytics page shipped; this didn't yet). Social-proof strip on homepage, testimonial cards with names/photos, ROI calculator promotion.
2. **Knowledge base / document upload** — customer uploads PDFs/FAQs/price lists, AI grounds calls in them. Major stickiness lever — once a customer's intake forms are uploaded, switching cost is real.
3. **Vertical-specific marketing pages** — `/dental`, `/legal`, `/insurance`, `/real-estate`, `/home-services`. SEO + paid-ad CVR multiplier. Each is a fork of `/inbound` with vertical-specific copy + sample calls.
4. **More agent suggestion types** — current types are `missed_call_callback`, `appointment_confirmation`, `stale_lead_followup`, `no_show_recapture`. Natural additions: `unconfirmed_appointment_reminder`, `low_satisfaction_followup`, `new_contact_welcome_sms`.
5. **Section-specific recommendation cards** — e.g. on `/appointments`, a "3 unconfirmed tomorrow — send reminders now?" one-click card driven by the SectionAgent live counts.
6. **Lead Discovery V2** — multi-source (Yelp, LinkedIn), email enrichment via Hunter.io, saved-search subscriptions, lead-deduplication against existing contacts.
7. **Recurring goal-driven campaigns** — "run this recall campaign every Monday" via the agent-scanner-worker pattern.
8. **AI Receptionist mobile PWA + push notifications** — for when AI escalates or books.
9. **Health-check banner in dashboard** — surfaces "your forwarding broke 2 hours ago" / "calendar disconnected".
10. **Whisper-mode live monitoring** — listen silently without taking over. Heavier (needs audio relay to browser); defer until take-over usage proves demand.

---

## Conventions introduced this session

Patterns the next agent should follow consistently:

- **SectionAgent everywhere** — every meaningful section page mounts `<SectionAgent section="<key>">` at the top. Adding a new section means: extend the backend `SectionKey` union + detector in `sections.service.ts`, add an entry to `section-meta.ts`, mount the component on the page. Three-file change pattern.
- **Per-feature promo cards** — Lead Discovery's `LeadDiscoveryCard` is the template for "feature exists, surface it on adjacent surfaces." Future features (knowledge base, voice clone, etc.) should follow the same pattern: amber/brand-themed Link card with compact + default variants, surfaceable via empty states and dashboard home.
- **Goal slugs on campaigns** — `outbound_campaigns.goal` is the analytics hook for grouping campaigns by template type. Always set `goalSource: 'template'` when creating from a goal (vs. `null` for manually built).
- **`csv_row_data` for raw imported data** — `campaign_contacts.csv_row_data` JSONB column stores the original imported record (CSV row, Apify business object, etc.). Always populate `{ source: '<origin>', ...raw }` so downstream agent suggestions know provenance.
- **Stripe metered usage pattern** — `stripe.subscriptionItems.createUsageRecord(item, { quantity, timestamp, action: 'increment' })`. The lead-billing service is the reference implementation. Graceful no-op when Stripe unconfigured.
- **Apify polling pattern** — long-running external job → BullMQ queue → worker re-enqueues itself with delay until settled. Lead-discovery-poll is the reference. Don't open long-lived HTTP requests waiting for completion.
- **503 with setup instructions for unconfigured integrations** — same pattern Stripe/HubSpot/Apify all use. Never crash; always tell the operator what env var is missing.
- **Vertical-aware copy via singular/plural derivation** — `contactNounPlural` is the only field exposed; `depluralize(plural)` (strip trailing 's') derives the singular. Works for all 6 current verticals; if you add a vertical with irregular plurals, extend the verticals.ts type.
- **Section-meta vertical context** — `whatThisIs(ctx)` and `actions(ctx)` receive a `VerticalCopyCtx`. Use it to swap "patient" / "client" / "lead" naturally instead of hardcoding any noun.

Unchanged conventions from CLAUDE.md (still apply):
- Single source of truth for `Vertical` (`packages/shared/src/types/vertical.types.ts`).
- Fire-and-forget side effects (`emitWebhook`, `pushActivity` never throw).
- `requireRole(...)` for JWT routes, `requireApiKey(...)` for public API.
- Skeletons on load, EmptyState on zero-results.
- Toast on every save/delete.
- `BRAND_NAME` constant from `lib/brand.ts`.

---

## Run / verify checklist (with new env vars)

```bash
# Same as CLAUDE.md, plus the new env vars:
cp .env.example .env       # fill all required vars
# Required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY, XAI_API_KEY
# Optional (new this session, feature stays in 503 fallback when unset):
#   DEMO_TENANT_ID, DEMO_FROM_NUMBER, DEMO_DAILY_CALL_LIMIT
#   APIFY_API_TOKEN, APIFY_GOOGLE_MAPS_ACTOR_ID, LEAD_DISCOVERY_PRICE_CENTS
#   STRIPE_PRICE_LEADS_DISCOVERED

pnpm install
pnpm --filter @ai-receptionist/api migrate   # now applies through 0028
pnpm --filter @ai-receptionist/api seed
pnpm dev                                     # api on :3001, dashboard on :3000
```

Health checks:
- `pnpm --filter @ai-receptionist/api test` — should report 87/87 passing.
- `pnpm --filter @ai-receptionist/dashboard exec tsc --noEmit` — should report 0 errors. (API side has ~200 pre-existing errors mostly in `packages/shared` rootDir setup — unchanged baseline.)

Smoke flow per feature:
- **Live call monitor:** call dev Telnyx number → see "Call in progress" banner on `/calls` within ~1s of pickup → click "Watch live" → transcript bubbles stream → click "Take over" → personal cell rings.
- **Free trial:** visit `/pricing` logged out → see 5 plan cards, Free Trial leftmost with "Try free →" button → lands on `/signup?plan=trial`.
- **Call-me widget:** homepage → enter your cell → AI calls you in ~5s.
- **Test-call button:** complete onboarding → `/onboarding/step-5-activate` → click "Call my AI now" → your AI calls your transferNumber.
- **Goal campaigns:** with seed data, `/campaigns` → gallery shows goals with candidate counts → click "Launch as draft" → land on `/campaigns/<id>` draft with leads populated.
- **SectionAgent:** visit each of `/calls`, `/missed-calls`, `/appointments`, `/escalations`, `/contacts`, `/messages`, `/campaigns`, `/reminders`, `/leads/discover` — agent header renders with vertical-aware copy + live counts + relevant pending suggestions inline.
- **Analytics:** as Scale-plan tenant, `/analytics` renders stats cards + bar chart + ROI block. As Starter/Growth, renders the locked stub with upgrade modal overlay.
- **Lead Discovery:** with `APIFY_API_TOKEN` set, `/leads/discover` → search "coffee shops" in "Brooklyn, NY" → progress card → results table → import → draft campaign appears at `/campaigns/<id>` with leads.

---

## Cost-conscious patterns for the next agent

Same advice as CLAUDE.md but with extra emphasis given how much code lives in this repo now:

1. **Read this file + CLAUDE.md first**, not the full chat history. Two phase rollups beat one long context replay.
2. **Don't re-read files you just edited.** Edit/Write succeed or error loudly.
3. **Use `Edit` over `Write` for existing files.**
4. **Use `Grep` with `files_with_matches` first.** Only escalate to `content` mode when you need surrounding lines.
5. **Prefer `Explore` subagent for "where does X live?" lookups.** Keeps long file contents off the main thread.
6. **Avoid `Bash cat/head/tail/find/grep`.** Use `Read`/`Glob`/`Grep` directly.
7. **Skip system-reminder acknowledgements unless asked.**
8. **Batch parallel edits in one message.** Multiple `Edit` calls in a single tool_use block beat a serial loop.
9. **When you finish a phase, update this file.** Append to the phase rollup; move new items into the open-work list. That way the next agent skips what's done.
10. **Plan mode for anything multi-file.** Approve the plan first, then execute. Especially important since this codebase now has many interconnected systems.

---

## When to start fresh

Same signs as CLAUDE.md:
- Turns getting slow (long replay before model responds).
- Shipping one or two more items, not re-architecting.
- User asks about cost / context.

Auto-loaded context: `CLAUDE.md` (phases 1–11) + this file (phases 12.1–12.7) + the active plan file at `~/.claude/plans/hat-does-ultra-review-starry-panda.md`.
