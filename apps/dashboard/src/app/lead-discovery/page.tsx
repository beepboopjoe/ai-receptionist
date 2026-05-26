// ============================================================
// /lead-discovery — Phase 12.7. Public marketing landing for the
// Lead Discovery feature. Cream theme matching /inbound, /outbound,
// /pricing, /demo. Conversion-focused: hero → how-it-works →
// sample leads → pricing → FAQ → CTA.
// ============================================================
import Link from 'next/link';
import {
  Search,
  MapPin,
  Phone,
  Star,
  CheckCircle,
  ExternalLink,
  Sparkles,
  Crosshair,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';

// Sample lead rows shown in the "what you'll see" preview. Fake but realistic.
const SAMPLE_LEADS = [
  {
    title: 'Brooklyn Roasters Co.',
    phone: '+1 (718) 555-0142',
    address: '241 Bedford Ave, Brooklyn, NY',
    rating: 4.6,
    category: 'Coffee shop',
    website: 'brooklynroasters.com',
  },
  {
    title: 'Williamsburg Java',
    phone: '+1 (718) 555-0188',
    address: '189 N 6th St, Brooklyn, NY',
    rating: 4.3,
    category: 'Cafe',
    website: 'williamsburgjava.com',
  },
  {
    title: 'Greenpoint Beans',
    phone: '+1 (718) 555-0231',
    address: '622 Manhattan Ave, Brooklyn, NY',
    rating: 4.8,
    category: 'Coffee shop',
    website: 'greenpointbeans.coffee',
  },
  {
    title: 'Bushwick Brew Bar',
    phone: '+1 (718) 555-0207',
    address: '1024 Bushwick Ave, Brooklyn, NY',
    rating: 4.1,
    category: 'Espresso bar',
    website: null,
  },
  {
    title: 'Park Slope Coffee Society',
    phone: '+1 (347) 555-0119',
    address: '512 5th Ave, Brooklyn, NY',
    rating: 4.7,
    category: 'Coffee shop',
    website: 'parkslopecoffee.com',
  },
];

const STEPS = [
  {
    icon: Search,
    title: 'Describe who you want to call',
    body: 'Business type, city, radius, minimum rating, phone required. 90 seconds of clicks.',
  },
  {
    icon: Crosshair,
    title: 'We scrape Google Maps',
    body: 'Our integration runs in the background. Results land in your dashboard in 1–3 minutes.',
  },
  {
    icon: CheckCircle,
    title: 'Review + import to a campaign',
    body: 'See every lead before importing. Uncheck the ones you don’t want. One click drafts a campaign for review.',
  },
];

const FAQS = [
  {
    q: 'Where do the leads come from?',
    a: 'We use the Apify Google Maps Scraper actor to pull public business listings from Google Maps. Every record is a real, indexed business with a phone number on Google. We never scrape personal contact info or anything behind a login.',
  },
  {
    q: 'Is this TCPA-compliant?',
    a: 'These are cold leads — recipients may be on Do Not Call lists. We surface a prominent reminder before every import and recommend you have a permissible purpose (existing relationship, prior consent, or an exemption like a business-to-business call) before calling. Compliance with TCPA, state DNC, and your local rules is your responsibility.',
  },
  {
    q: 'How accurate is the data?',
    a: 'Phone numbers and addresses come straight from Google’s business listings, which businesses maintain themselves. Quality is high but not perfect — expect ~5–10% to be outdated. You only pay for leads you actually import, so duds you uncheck are free.',
  },
  {
    q: 'What does it cost?',
    a: 'A flat $0.99 per imported lead. No subscription, no minimum, no commitment. The "max results" cap on the search form bounds your spend up front — if you set max 100, you can’t spend more than $99 on that search.',
  },
  {
    q: 'Do I have to use Apify directly?',
    a: 'No. We hold the Apify account and bill you a single per-lead price. You never sign up for Apify, never see an Apify dashboard, never pay them directly. Everything is in your AI Receptionist account.',
  },
  {
    q: 'What if a search returns junk?',
    a: 'Inspect every lead before importing. If a result has no phone, looks closed, or is wildly off-topic, just uncheck it. You’re only charged for what you keep.',
  },
];

export default function LeadDiscoveryMarketingPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mesh-gradient-light pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Crosshair size={13} />
            Phase 12.7 · Lead Discovery
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-900 tracking-tight leading-[1.05]">
            No list? No problem.
            <br />
            <span className="gradient-text">We find your next 100 calls.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Describe who you want to reach — &ldquo;dentists in Chicago, rated 3.5+, with a
            phone number&rdquo; — and we scrape Google Maps in the background. Review the
            results, import the ones you like, launch a campaign. Pay only for the leads you keep.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              Try Free — 10 min →
            </Link>
            <Link
              href="#pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-800 bg-white border border-cream-200 rounded-xl hover:bg-cream-50 transition-colors"
            >
              See pricing ↓
            </Link>
          </div>
          <p className="text-xs text-cream-500 mt-5">
            $0.99 per imported lead · No subscription · You only pay for what you keep
          </p>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
              How it works
            </p>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
              From idea to dialing leads in under five minutes.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative rounded-2xl border border-cream-200 bg-cream-50 p-6">
                  <div className="absolute -top-3 left-6 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white border border-cream-200 flex items-center justify-center mb-4 mt-2">
                    <Icon size={18} className="text-brand-600" />
                  </div>
                  <h3 className="font-semibold text-cream-900">{s.title}</h3>
                  <p className="text-sm text-cream-600 mt-2 leading-relaxed">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Sample results preview ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
            Inside the product
          </p>
          <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
            Here&apos;s what 5 minutes of searching looks like.
          </h2>
          <p className="text-cream-600 mt-3 max-w-xl mx-auto">
            Real Brooklyn coffee shops from a single discovery run. Phone, address, rating, website,
            category — ready to call.
          </p>
        </div>

        <div className="rounded-2xl border border-cream-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-cream-100 bg-cream-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-cream-900">5 leads found</p>
              <p className="text-[11px] text-cream-500 mt-0.5">Brooklyn, NY · coffee shops · rating 4.0+</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1">
              <CheckCircle size={11} /> All match filters
            </span>
          </div>
          <div className="divide-y divide-cream-50">
            {SAMPLE_LEADS.map((lead, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="mt-1 rounded border-cream-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-cream-900 truncate">{lead.title}</p>
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      {lead.rating.toFixed(1)}
                    </span>
                    <span className="text-[11px] text-cream-400">· {lead.category}</span>
                  </div>
                  <div className="text-xs text-cream-500 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} /> {lead.phone}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} /> {lead.address}
                    </span>
                    {lead.website && (
                      <span className="inline-flex items-center gap-0.5 text-brand-600">
                        {lead.website} <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-cream-100 bg-cream-50 flex items-center justify-between">
            <p className="text-sm text-cream-700">
              <span className="font-bold tabular-nums">5</span> selected ·{' '}
              <span className="text-brand-700 font-bold tabular-nums">$4.95</span>
            </p>
            <span className="inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white text-sm font-semibold px-4 py-1.5">
              <CheckCircle size={13} /> Add to a new campaign
            </span>
          </div>
        </div>

        <p className="text-xs text-cream-500 mt-4 text-center">
          Phone numbers and names obscured for the preview. Real searches return real, current business data.
        </p>
      </section>

      {/* ── Why it matters ─────────────────────────────────────────── */}
      <section className="bg-cream-100 border-y border-cream-200 py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Sparkles size={20} className="text-brand-600" />,
              title: 'No list-buying middlemen',
              body: 'Skip the $500/month lead aggregators with stale CSVs. You pay per lead, in real time, on demand.',
            },
            {
              icon: <Phone size={20} className="text-brand-600" />,
              title: 'Targeted at the city block',
              body: 'Search by radius from a specific city or ZIP. Filter by rating, presence of a phone, business category. Hyper-local outreach.',
            },
            {
              icon: <Shield size={20} className="text-brand-600" />,
              title: 'Compliance reminders built in',
              body: 'TCPA disclosure banner before every import. We make it impossible to forget that these are cold leads who haven’t opted in.',
            },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl bg-white border border-cream-200 p-6">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4">
                {b.icon}
              </div>
              <h3 className="font-semibold text-cream-900">{b.title}</h3>
              <p className="text-sm text-cream-600 mt-2 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-3xl mx-auto px-6 py-20 scroll-mt-20">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
            Pricing
          </p>
          <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
            One number. No surprises.
          </h2>
        </div>

        <div className="rounded-2xl border-2 border-brand-400 bg-white p-8 shadow-lg text-center">
          <p className="text-xs font-bold text-brand-700 uppercase tracking-[0.2em] mb-4">
            Pay-as-you-go
          </p>
          <div className="flex items-baseline justify-center gap-1 mb-4">
            <span className="font-serif text-6xl font-black text-cream-900">$0.99</span>
            <span className="text-cream-500 text-lg">/ lead</span>
          </div>
          <p className="text-sm text-cream-600 max-w-md mx-auto leading-relaxed">
            Charged only when you import a lead. The &ldquo;max results&rdquo; cap on every search
            bounds your spend up front — set max 100, spend at most $99.
          </p>

          <ul className="mt-7 space-y-2.5 text-left max-w-md mx-auto">
            {[
              'Phone, address, rating, website, category included',
              'Real-time Google Maps data — no stale lists',
              'Filter by location, radius, rating, phone presence',
              'Unselect duds before import — you only pay for keepers',
              'Imported leads flow straight into a draft campaign',
              'Available on Growth and Scale plans',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-cream-700">
                <CheckCircle size={14} className="text-brand-500 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <Link
            href="/signup?plan=trial"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 text-white font-semibold text-sm px-6 py-3 hover:bg-brand-700 transition-colors"
          >
            Start free trial <ArrowRight size={14} />
          </Link>
          <p className="text-[11px] text-cream-500 mt-3">
            Trial includes 10 free AI minutes. Lead Discovery is paid per-use on Growth+.
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-serif text-4xl text-cream-900 text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="rounded-xl bg-white border border-cream-200 group">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none font-medium text-cream-900 text-sm">
                {q}
                <span className="faq-icon text-cream-400 text-xl leading-none">+</span>
              </summary>
              <p className="px-6 pb-5 text-sm text-cream-600 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ────────────────────────────────────────────── */}
      <section className="bg-cream-900 text-white py-20 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl text-white mb-3">
            Stop searching. Start dialing.
          </h2>
          <p className="text-cream-300 mb-10 max-w-xl mx-auto">
            Your first 10 AI minutes are free. Find your first 50 leads in the next 5 minutes after that.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-8 py-4 text-base font-bold text-white transition-colors"
            >
              <CheckCircle size={18} /> Try Free — 10 min
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 hover:bg-white/10 px-8 py-4 text-base font-semibold text-cream-100 transition-colors"
            >
              See full pricing
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
