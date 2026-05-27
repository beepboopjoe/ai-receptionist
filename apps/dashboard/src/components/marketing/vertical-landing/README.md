# Vertical landing kit

Reusable section components for vertical marketing pages (`/legal`, `/dental`,
`/insurance`, `/real-estate`, `/home-services`). All components are prop-driven
and stateless — adding a new vertical is a content-only change, no new
component files needed.

## Files in this kit

- `vertical-hero.tsx` — hero with eyebrow chip + headline + two CTAs.
- `vertical-crm-strip.tsx` — "Works inside your CRM" with CRM logo cards.
- `vertical-features-grid.tsx` — 3-column feature grid.
- `vertical-roi-block.tsx` — 3 big-number stats with supporting copy.
- `vertical-faq.tsx` — collapsible FAQ accordion using native `<details>`.

## Adding a new vertical page

1. **Add the content block.** Open `apps/dashboard/src/lib/vertical-landing-content.ts`
   and find the stub for your vertical (one of `dental`, `insurance`, `real_estate`,
   `home_services`). Replace the TODO with a full `VerticalLandingContent` object.
   Copy `content.legal` as a template — every field is required.

2. **Create the page.** Add `apps/dashboard/src/app/<vertical>/page.tsx`.
   Copy `apps/dashboard/src/app/legal/page.tsx` and change two lines:
   - The import: `import { content } from '@/lib/vertical-landing-content';` then
     `const c = content.<vertical>;`
   - The `metadata` export — title and description targeting your vertical's
     search terms.

3. **Add the header link.** In `apps/dashboard/src/components/ui/marketing-header.tsx`,
   add `{ label: 'For <Vertical>', href: '/<vertical>' }` to `NAV_LINKS`. Once you
   have 3+ vertical pages, refactor `NAV_LINKS` to use a "Verticals" dropdown
   component — single link per vertical gets cluttered after that.

4. **Pick an accent color.** Each vertical has its own accent for the eyebrow
   chip + features-grid icon gradient. Current assignments:
   - `legal` → indigo (`bg-indigo-100 text-indigo-700`, `from-indigo-500 to-violet-500`)
   - `dental` → green (`bg-green-100 text-green-700`, `from-green-500 to-emerald-500`)
   - `insurance` → blue (`bg-blue-100 text-blue-700`, `from-blue-500 to-cyan-500`)
   - `real_estate` → amber (`bg-amber-100 text-amber-700`, `from-amber-500 to-orange-500`)
   - `home_services` → orange (`bg-orange-100 text-orange-700`, `from-orange-500 to-red-500`)

5. **Test locally.** `pnpm --filter @ai-receptionist/dashboard dev`, visit
   `http://localhost:3000/<vertical>`. Check mobile viewport (375px) — sections
   should stack cleanly.

6. **Ship it.** Single commit, push to main, Vercel deploys.

## What's intentionally NOT in this kit

- **Sample call player** — that's `<SampleCallPlayer />` from `@/components/ui/`,
  pass `vertical=<your vertical>` to filter to the right scripts.
- **Testimonial card** — composed inline in the page, not extracted. Each vertical
  may want a different testimonial layout (single quote vs grid of logos vs video).
  Premature extraction.
- **Header / footer chrome** — `<MarketingHeader />` and `<MarketingFooter />` come
  from `@/components/ui/`, mount them in the page itself.
