# UI Reference Libraries

Downloaded for the AI Receptionist SaaS dashboard project.
All repos cloned with `--depth=1` (files only, no git history).

---

## 1. magicui/ — Magic UI (⭐ 20.5k)
**Repo:** https://github.com/magicuidesign/magicui
**Use for:** Animated landing page components, hero sections, shimmer effects,
             animated cards, number tickers, marquees, beam effects.
**Stack:** React, Next.js, Tailwind CSS, Framer Motion
**Best pages to reference:**
- `registry/` — copy-paste component source files
- Landing page hero sections, feature grids, CTA blocks

---

## 2. awesome-shadcn-ui/ — Awesome shadcn/ui (⭐ 19.3k)
**Repo:** https://github.com/birobirobiro/awesome-shadcn-ui
**Use for:** Curated index of every shadcn/ui-compatible component, template,
             block library, and tool in the ecosystem.
**Stack:** Reference list only (no code)
**Best pages to reference:**
- `README.md` — full categorized list of components, templates, tools

---

## 3. shadcn-admin/ — shadcn Admin Dashboard (⭐ 10.9k)
**Repo:** https://github.com/satnaing/shadcn-admin
**Use for:** Complete admin dashboard layout patterns — sidebar, breadcrumbs,
             data tables, settings pages, auth pages, user management.
**Stack:** React, shadcn/ui, Tailwind CSS, Vite, TanStack Table
**Best pages to reference:**
- `src/pages/` — dashboard, tasks, users, settings, auth pages
- `src/components/ui/` — extended shadcn component overrides
- `src/components/layout/` — sidebar, header, nav patterns

---

## 4. free-nextjs-admin-dashboard/ — TailAdmin Next.js (⭐ ~5k)
**Repo:** https://github.com/TailAdmin/free-nextjs-admin-dashboard
**Use for:** Next.js 14 App Router dashboard structure, chart components,
             form layouts, table patterns, stat cards.
**Stack:** Next.js 14, Tailwind CSS, ApexCharts
**Best pages to reference:**
- `src/app/` — App Router page structure
- `src/components/Dashboard/` — stat cards, charts
- `src/components/Tables/` — table layouts

---

## 5. tremor/ — Tremor (⭐ ~17k)
**Repo:** https://github.com/tremorlabs/tremor
**Use for:** Data visualization components — bar charts, line charts, area charts,
             KPI cards, progress bars, sparklines. Built for dashboards.
**Stack:** React, Tailwind CSS, Recharts
**Best pages to reference:**
- `src/components/chart-elements/` — all chart types
- `src/components/vis-elements/` — progress bars, delta badges
- `src/components/input-elements/` — selects, date pickers for filters

---

## 6. nextjs-animated-components/ — Next.js Animated Components
**Repo:** https://github.com/itsjwill/nextjs-animated-components
**Use for:** 110+ copy-paste animated React/Next.js components. Alternative to
             Aceternity UI. Dock menus, spotlight cards, glassmorphism, 3D effects,
             scroll animations, Stripe-style mesh gradients.
**Stack:** Next.js, Tailwind CSS, Framer Motion, GSAP, Three.js
**Best pages to reference:**
- `components/` — all animated component source files
- Landing page hero, feature section, and CTA animations

---

## Usage Guide

When building a page, check these in this order:

| What you need              | Check first           | Check second            |
|----------------------------|-----------------------|-------------------------|
| Dashboard layout/sidebar   | `shadcn-admin/`       | `free-nextjs-admin-dashboard/` |
| Stat cards / KPI widgets   | `tremor/`             | `shadcn-admin/`         |
| Charts / graphs            | `tremor/`             | `free-nextjs-admin-dashboard/` |
| Data tables                | `shadcn-admin/`       | `free-nextjs-admin-dashboard/` |
| Landing page sections      | `magicui/`            | `nextjs-animated-components/` |
| Animated effects           | `nextjs-animated-components/` | `magicui/`        |
| Find any component type    | `awesome-shadcn-ui/README.md` | —                |
| Settings / forms           | `shadcn-admin/`       | —                       |
