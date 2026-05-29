'use client';
// ============================================================
// /resellers — Reseller & White-Label Partner Program
// Three tiers: Affiliate → Reseller → White-Label
// Cream theme, matches /pricing / /partners style.
// ============================================================
import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  TrendingUp,
  DollarSign,
  Zap,
  CheckCircle,
  ArrowRight,
  Globe,
  Palette,
  LayoutDashboard,
  Mail,
  Phone,
  Shield,
  Building2,
  ChevronDown,
  ChevronUp,
  Star,
  Package,
  Crown,
} from 'lucide-react';

// ── Commission calculator ─────────────────────────────────────────────────────
type TierKey = 'affiliate' | 'reseller' | 'white_label';

const TIER_BUTTONS: Array<{ key: TierKey; label: string; rate: string }> = [
  { key: 'affiliate',   label: 'Affiliate',   rate: '20%'  },
  { key: 'reseller',    label: 'Reseller',    rate: '35%'  },
  { key: 'white_label', label: 'White-Label', rate: '50%+' },
];

function CommissionCalculator() {
  const [clients, setClients] = useState(10);
  const [avgPlan, setAvgPlan] = useState(199);
  const [tier, setTier] = useState<TierKey>('affiliate');

  const RATES: Record<TierKey, number> = { affiliate: 0.20, reseller: 0.35, white_label: 0.50 };
  const monthly = Math.round(clients * avgPlan * RATES[tier]);
  const annual  = monthly * 12;

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-8">
      <h3 className="font-serif text-2xl text-cream-900 font-bold mb-1">Earnings calculator</h3>
      <p className="text-sm text-cream-500 mb-6">Estimate your monthly recurring revenue</p>

      {/* Tier selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TIER_BUTTONS.map(({ key, label, rate }) => (
          <button
            key={key}
            onClick={() => setTier(key as TierKey)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
              tier === key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-cream-50 text-cream-700 border-cream-200 hover:border-brand-300'
            }`}
          >
            {label} · {rate}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="space-y-5 mb-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-cream-700">Clients referred</label>
            <span className="text-sm font-bold text-cream-900">{clients}</span>
          </div>
          <input
            type="range" min={1} max={100} value={clients}
            onChange={(e) => setClients(Number(e.target.value))}
            className="w-full h-2 bg-cream-200 rounded-full appearance-none cursor-pointer accent-brand-600"
          />
          <div className="flex justify-between text-[10px] text-cream-400 mt-1">
            <span>1</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-cream-700">Avg plan value</label>
            <span className="text-sm font-bold text-cream-900">${avgPlan}/mo</span>
          </div>
          <input
            type="range" min={79} max={399} step={10} value={avgPlan}
            onChange={(e) => setAvgPlan(Number(e.target.value))}
            className="w-full h-2 bg-cream-200 rounded-full appearance-none cursor-pointer accent-brand-600"
          />
          <div className="flex justify-between text-[10px] text-cream-400 mt-1">
            <span>$79</span><span>$199</span><span>$399</span>
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="rounded-xl bg-brand-600 text-white p-5 text-center">
        <p className="text-sm font-medium opacity-80 mb-1">Your estimated monthly earnings</p>
        <p className="text-4xl font-serif font-bold">${monthly.toLocaleString()}</p>
        <p className="text-sm opacity-70 mt-1">${annual.toLocaleString()} / year</p>
      </div>

      <p className="text-[10px] text-cream-400 text-center mt-3">
        *Affiliate tier earns on referred revenue. Reseller and White-Label tiers earn on the
        full margin between wholesale cost and your client price. Actual earnings may vary.
      </p>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What's the difference between Affiliate and Reseller?",
    a: "Affiliates earn a commission (20%) on invoices paid by customers they refer. Resellers buy seats at wholesale pricing and sell to clients at their own price — keeping the full margin. Resellers also get priority support, co-branded materials, and a dedicated account manager.",
  },
  {
    q: "What does White-Label include?",
    a: "White-Label removes all Telfin branding and replaces it with yours — your logo, your product name, your domain (e.g. app.youragency.com), custom color palette, and custom email templates. Your clients never see our name. We operate entirely in the background.",
  },
  {
    q: "Can I set my own pricing?",
    a: "Yes. Resellers and White-Label partners purchase seats at wholesale rates and can price them however they like — flat-fee, per-seat, usage-based, or bundled with other services. The margin is yours.",
  },
  {
    q: "How do I handle client support?",
    a: "Affiliates pass support to us directly. Resellers get a partner support channel (Slack or email, SLA 4hr). White-Label partners get a dedicated success manager and can optionally white-label our support helpdesk so clients never reach us.",
  },
  {
    q: "How are commissions paid?",
    a: "Affiliate commissions are paid monthly via PayPal or bank transfer once your balance reaches $100. Reseller margins are settled in real time as invoices are paid. White-Label partners invoice us monthly under their own agreement.",
  },
  {
    q: "Is there a minimum volume commitment?",
    a: "Affiliates: none. Resellers: 3 active paying clients within 90 days of activation. White-Label: 10 seats minimum. These thresholds ensure we can provide the level of support each tier demands.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-cream-200 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <span className="text-sm font-semibold text-cream-900">{q}</span>
        {open ? <ChevronUp size={16} className="text-cream-400 shrink-0" /> : <ChevronDown size={16} className="text-cream-400 shrink-0" />}
      </button>
      {open && (
        <p className="pb-4 text-sm text-cream-600 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ── Tier card data ────────────────────────────────────────────────────────────
const TIERS = [
  {
    icon: Star,
    label: 'Affiliate',
    tagline: 'Refer and earn',
    commission: '20%',
    commissionNote: 'of every invoice, forever',
    color: 'border-cream-200',
    headerBg: 'bg-cream-50',
    features: [
      'Unique referral link',
      'Real-time dashboard',
      'Monthly payouts',
      'No minimum volume',
      'Co-branded one-pagers',
    ],
    notIncluded: [
      'Set your own pricing',
      'White-label branding',
      'Wholesale seat pricing',
      'Dedicated account manager',
    ],
    cta: { label: 'Apply free →', href: '/partners' },
    ctaStyle: 'border border-brand-600 text-brand-600 hover:bg-brand-50',
  },
  {
    icon: Package,
    label: 'Reseller',
    tagline: 'Your price. Your margin.',
    commission: '35%+',
    commissionNote: 'wholesale margin to keep',
    color: 'border-brand-300 ring-2 ring-brand-100',
    headerBg: 'bg-brand-600',
    headerText: 'text-white',
    badge: 'Most popular',
    features: [
      'Wholesale seat pricing',
      'Set your own client price',
      'Co-branded portal & materials',
      'Priority support (4hr SLA)',
      'Dedicated account manager',
      'Monthly invoicing',
      'Volume discounts at 25+ seats',
    ],
    notIncluded: [
      'Custom domain (app.yourco.com)',
      'Full white-label branding',
    ],
    cta: { label: 'Apply as reseller →', href: 'mailto:resellers@aireceptionist.ai?subject=Reseller%20Program%20Inquiry' },
    ctaStyle: 'bg-brand-600 text-white hover:bg-brand-700',
  },
  {
    icon: Crown,
    label: 'White-Label',
    tagline: 'Your brand. Completely.',
    commission: '50%+',
    commissionNote: 'margin on your own pricing',
    color: 'border-amber-200',
    headerBg: 'bg-amber-50',
    features: [
      'Your logo + brand colors',
      'Custom domain (app.yourco.com)',
      'Your product name + AI voice name',
      'Fully remove our branding',
      'Custom email & SMS templates',
      'Clients never see our name',
      'White-labeled support helpdesk',
      'Dedicated success manager',
      'Custom contract & SLA',
    ],
    notIncluded: [],
    cta: { label: 'Schedule a call →', href: 'mailto:whitelabel@aireceptionist.ai?subject=White-Label%20Inquiry' },
    ctaStyle: 'bg-amber-600 text-white hover:bg-amber-700',
  },
];

// ── White-label feature grid ──────────────────────────────────────────────────
const WL_FEATURES = [
  { icon: Globe, title: 'Custom domain', desc: 'app.yourcompany.com — your clients log into your domain, not ours.' },
  { icon: Palette, title: 'Your brand colors & logo', desc: 'Complete visual rebrand. Logo, primary color, typography — all yours.' },
  { icon: LayoutDashboard, title: 'Custom AI voice name', desc: 'Rename the AI assistant. "Meet Aria from Smith Dental" becomes "Meet Maya from Elite Dental."' },
  { icon: Mail, title: 'Custom email templates', desc: 'Every notification email — reminders, escalations, summaries — carries your brand.' },
  { icon: Phone, title: 'Branded phone numbers', desc: 'Port your client\'s existing numbers or provision new ones under your reseller account.' },
  { icon: Shield, title: 'SLA-backed support', desc: 'Your clients call you. We back you up with a 4-hour response SLA and a dedicated Slack channel.' },
  { icon: Building2, title: 'Multi-tenant management', desc: 'One admin console to manage all your client accounts, billing, and usage.' },
  { icon: DollarSign, title: 'Flexible billing', desc: 'Charge clients monthly or annually, flat-fee or usage-based. We invoice you wholesale.' },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ResellersPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-nav border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-serif text-lg shadow-sm">
              ar
            </div>
            <span className="font-semibold text-cream-900 text-sm hidden sm:inline">Telfin</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <Link href="/inbound" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Inbound</Link>
            <Link href="/outbound" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Outbound</Link>
            <Link href="/pricing" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Pricing</Link>
            <Link href="/resellers" className="text-sm font-medium text-brand-600">Affiliate</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/partners/login" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Partner login</Link>
            <Link href="/signup" className="glow-btn inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors">
              Try free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 mb-6">
          <Building2 size={12} /> Reseller & White-Label Program
        </div>
        <h1 className="font-serif text-5xl lg:text-6xl font-bold text-cream-900 leading-tight mb-5">
          Sell Telfin<br />
          <span className="text-brand-600">as your own product</span>
        </h1>
        <p className="text-xl text-cream-600 max-w-2xl mx-auto mb-10">
          Three ways to partner — from referring clients for 20% recurring commissions, to
          reselling at your own price, to deploying a fully white-labeled product under your brand.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-cream-600">
          {['20–50%+ margins', 'Set your own pricing', 'Full white-label available', 'No cap on earnings'].map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-brand-500" /> {t}
            </div>
          ))}
        </div>
      </section>

      {/* ── Tier cards ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid lg:grid-cols-3 gap-6">
          {TIERS.map(({ icon: Icon, label, tagline, commission, commissionNote, color, headerBg, headerText, badge, features, notIncluded, cta, ctaStyle }) => (
            <div key={label} className={`bg-white rounded-2xl border overflow-hidden flex flex-col ${color}`}>
              {/* Card header */}
              <div className={`${headerBg} px-6 py-5`}>
                {badge && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-bold text-white mb-3">
                    <Star size={9} fill="currentColor" /> {badge}
                  </div>
                )}
                <div className={`flex items-center gap-2 mb-1 ${headerText ?? 'text-cream-900'}`}>
                  <Icon size={18} />
                  <span className="font-serif text-xl font-bold">{label}</span>
                </div>
                <p className={`text-sm ${headerText ? 'text-white/80' : 'text-cream-500'}`}>{tagline}</p>
              </div>

              {/* Commission highlight */}
              <div className="px-6 py-4 border-b border-cream-100">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-serif font-bold text-brand-600">{commission}</span>
                  <span className="text-xs text-cream-500">{commissionNote}</span>
                </div>
              </div>

              {/* Features */}
              <div className="px-6 py-5 flex-1 space-y-2.5">
                {features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-cream-700">
                    <CheckCircle size={14} className="text-brand-500 shrink-0" />
                    {f}
                  </div>
                ))}
                {notIncluded.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-cream-300 line-through">
                    <div className="w-3.5 h-3.5 rounded-full border border-cream-200 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="px-6 pb-6">
                <a
                  href={cta.href}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${ctaStyle}`}
                >
                  {cta.label}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Commission calculator ────────────────────────────────── */}
      <section className="bg-cream-100 border-y border-cream-200 py-20">
        <div className="max-w-5xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 mb-4">
              <TrendingUp size={12} /> Earnings potential
            </div>
            <h2 className="font-serif text-4xl font-bold text-cream-900 mb-4 leading-tight">
              The more clients you bring, the more you earn
            </h2>
            <p className="text-cream-600 mb-6">
              Commissions and margins compound over time. Unlike one-time referral fees,
              you earn on every invoice your clients pay — for as long as they're subscribed.
            </p>
            <div className="space-y-3 text-sm">
              {[
                { tier: 'Affiliate', detail: '20% recurring on referred revenue', color: 'text-brand-600' },
                { tier: 'Reseller', detail: '~35% margin — buy at $130, sell at $199+', color: 'text-brand-600' },
                { tier: 'White-Label', detail: '50%+ — set any price, keep all margin over wholesale', color: 'text-amber-600' },
              ].map(({ tier, detail, color }) => (
                <div key={tier} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-cream-200">
                  <DollarSign size={16} className={`${color} mt-0.5 shrink-0`} />
                  <div>
                    <span className="font-semibold text-cream-900">{tier}</span>
                    <span className="text-cream-500 ml-2">{detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <CommissionCalculator />
        </div>
      </section>

      {/* ── White-label deep dive ────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 mb-4">
            <Crown size={12} /> White-Label Program
          </div>
          <h2 className="font-serif text-4xl font-bold text-cream-900 mb-4">
            Your brand. Your product. Our engine.
          </h2>
          <p className="text-cream-600 max-w-2xl mx-auto">
            White-Label partners deploy Telfin as their own SaaS product. Your clients
            log into your domain, see your logo, and hear your AI voice name — we run entirely
            in the background.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {WL_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-cream-200 p-5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
                <Icon size={18} className="text-amber-700" />
              </div>
              <h3 className="font-semibold text-cream-900 text-sm mb-1.5">{title}</h3>
              <p className="text-xs text-cream-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a
            href="mailto:whitelabel@aireceptionist.ai?subject=White-Label%20Inquiry"
            className="glow-btn inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-8 py-4 text-base font-bold text-white transition-colors"
          >
            <Mail size={16} /> Talk to us about White-Label
          </a>
          <p className="text-xs text-cream-400 mt-3">We'll respond within 1 business day.</p>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="bg-white border-y border-cream-200 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-center font-serif text-3xl font-bold text-cream-900 mb-10">How it works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Apply', desc: 'Submit your application. Affiliates are approved instantly. Resellers and White-Label partners go through a quick onboarding call.' },
              { step: '02', title: 'Set up', desc: 'Get your partner portal, referral link, and wholesale access. White-Label partners get a staging environment to configure branding.' },
              { step: '03', title: 'Sell', desc: 'Bring your first clients onboard. We handle the infrastructure, AI, and compliance. You handle the relationship.' },
              { step: '04', title: 'Earn', desc: 'Commissions and margins are tracked in real time. Monthly payouts, no surprises, no minimum withholding.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="text-4xl font-serif font-bold text-cream-200 mb-3">{step}</div>
                <h3 className="font-semibold text-cream-900 mb-2 text-sm">{title}</h3>
                <p className="text-xs text-cream-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ideal partners ───────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center font-serif text-3xl font-bold text-cream-900 mb-3">Who this is built for</h2>
        <p className="text-center text-cream-600 mb-10 max-w-xl mx-auto">
          Our best partners already serve small-to-mid businesses in service industries.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { emoji: '🏢', title: 'Digital agencies', desc: 'Add a recurring AI product to your client retainer. Sell it as part of your marketing or automation stack.' },
            { emoji: '🦷', title: 'Healthcare IT consultants', desc: 'Your dental and medical clients already trust you with their tech. Add an AI receptionist to that relationship.' },
            { emoji: '🏠', title: 'Real estate tech vendors', desc: 'Bundle AI lead qualification with your existing CRM or listing tools for a complete inbound automation suite.' },
            { emoji: '📞', title: 'Answering service companies', desc: "Automate the routine calls your agents shouldn't be taking. Sell AI as the first-touch tier." },
            { emoji: '💼', title: 'Business consultants', desc: 'Add a white-glove AI implementation service to your consulting practice. Earn ongoing margin for maintenance.' },
            { emoji: '🛠️', title: 'SaaS companies', desc: 'Embed AI call handling into your existing platform as a native feature or add-on module.' },
          ].map(({ emoji, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-cream-200 p-5 flex gap-4">
              <div className="text-2xl shrink-0">{emoji}</div>
              <div>
                <h3 className="font-semibold text-cream-900 text-sm mb-1">{title}</h3>
                <p className="text-xs text-cream-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-serif text-3xl font-bold text-cream-900 mb-8 text-center">Frequently asked questions</h2>
        <div className="bg-white rounded-2xl border border-cream-200 px-6">
          {FAQS.map((item) => <FaqItem key={item.q} {...item} />)}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto text-center px-6 py-20">
        <h2 className="font-serif text-3xl font-bold text-cream-900 mb-4">
          Ready to make Telfin your revenue stream?
        </h2>
        <p className="text-cream-600 mb-8">
          Start with Affiliate — free, no commitments. Or jump straight to Reseller or White-Label
          if you're ready to go deeper.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/partners"
            className="glow-btn inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-7 py-4 text-base font-bold text-white transition-colors"
          >
            <Star size={16} /> Apply as Affiliate
          </Link>
          <a
            href="mailto:resellers@aireceptionist.ai?subject=Reseller%20Program%20Inquiry"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cream-300 bg-white hover:bg-cream-50 px-7 py-4 text-base font-semibold text-cream-900 transition-colors"
          >
            <ArrowRight size={16} /> Reseller / White-Label inquiry
          </a>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-cream-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-cream-400">
          <span>© 2026 Telfin</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-cream-900 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-cream-900 transition-colors">Pricing</Link>
            <Link href="/partners" className="hover:text-cream-900 transition-colors">Affiliate signup</Link>
            <Link href="/partners/login" className="hover:text-cream-900 transition-colors">Partner login</Link>
            <a href="mailto:hello@aireceptionist.ai" className="hover:text-cream-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
