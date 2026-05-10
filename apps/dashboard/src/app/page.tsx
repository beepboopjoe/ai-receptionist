import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { BRAND_NAME } from '@/lib/brand'

// Heavy client-only components (canvas, WebSocket, audio APIs) are
// lazy-loaded so the landing page's initial bundle doesn't carry
// ~1400 LOC of code most visitors never trigger. ssr: false because
// they all touch browser globals (AudioContext, navigator, etc.).
const EmbeddedVoiceDemo = dynamic(
  () => import('@/components/ui/embedded-voice-demo').then((m) => m.EmbeddedVoiceDemo),
  {
    ssr: false,
    loading: () => (
      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6">
        <Skeleton width="w-full" height="h-96" rounded="lg" />
      </div>
    ),
  }
)
const DashboardTeaser = dynamic(
  () => import('@/components/ui/dashboard-teaser').then((m) => m.DashboardTeaser),
  {
    ssr: false,
    loading: () => <Skeleton width="w-full" height="h-[480px]" rounded="lg" />,
  }
)
const RoiSection = dynamic(
  () => import('@/components/ui/roi-section').then((m) => m.RoiSection),
  {
    ssr: false,
    loading: () => <Skeleton width="w-full" height="h-64" rounded="lg" />,
  }
)

// ─────────────────────────────────────────────────────────────
// Stat cards for the social proof strip
// ─────────────────────────────────────────────────────────────
const STATS = [
  { value: '500+', label: 'Businesses live', icon: '🏢' },
  { value: '89%',  label: 'Calls handled by AI', icon: '🤖' },
  { value: '0',    label: 'Missed calls reported', icon: '✅' },
  { value: '35h',  label: 'Staff hours saved / week', icon: '⏱️' },
]

// ─────────────────────────────────────────────────────────────
// Pricing data
// ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    key: 'starter',
    emoji: '⚡',
    name: 'Starter',
    price: '$199',
    tagline: 'Never miss a call again',
    for: 'For inbound-only businesses',
    color: 'text-sky-400',
    features: [
      '1,000 AI minutes / mo',
      '1 phone number',
      'Inbound calls only',
      'Appointment booking',
      'SMS confirmations',
      'Call transcripts & recordings',
    ],
    overage: '$0.14/min',
    cta: 'Start with Starter',
    ctaStyle: 'border border-white/20 text-white hover:bg-white/10',
    popular: false,
  },
  {
    key: 'growth',
    emoji: '🚀',
    name: 'Growth',
    price: '$399',
    tagline: 'Turn calls into customers',
    for: 'Inbound + Outbound — best ROI',
    color: 'text-brand-300',
    features: [
      '3,000 AI minutes / mo',
      '2 phone numbers',
      'Inbound & outbound calls',
      'Lead qualification',
      'CRM sync & analytics',
      'Priority support',
    ],
    overage: '$0.13/min',
    cta: 'Start with Growth →',
    ctaStyle: 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-900/50',
    popular: true,
  },
  {
    key: 'pro',
    emoji: '🔥',
    name: 'Pro',
    price: '$799',
    tagline: 'Full automation system',
    for: 'Multi-location scaling businesses',
    color: 'text-violet-400',
    features: [
      '8,000 AI minutes / mo',
      '5 phone numbers',
      'Multi-location (5 sites)',
      'Custom workflows & AI tuning',
      'Dedicated account manager',
      'Priority call handling',
    ],
    overage: '$0.12/min',
    cta: 'Start with Pro',
    ctaStyle: 'border border-white/20 text-white hover:bg-white/10',
    popular: false,
  },
  {
    key: 'enterprise',
    emoji: '🧠',
    name: 'Enterprise',
    price: 'Custom',
    tagline: 'Built around your operation',
    for: 'From $1,500/mo',
    color: 'text-amber-400',
    features: [
      'Unlimited AI minutes',
      'White-label branding',
      'Custom CRM integrations',
      'Volume pricing',
      'SLA guarantees',
      'HIPAA BAA included',
    ],
    overage: 'Volume rates',
    cta: 'Talk to sales →',
    ctaStyle: 'border border-amber-400/40 text-amber-400 hover:bg-amber-400/10',
    popular: false,
  },
]

// ─────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Do I need to change my phone system?',
    a: 'No. You simply forward calls to your AI line. Works with any landline, VoIP, or cell phone. Setup takes under 10 minutes.',
  },
  {
    q: 'What if a caller has an urgent situation?',
    a: 'The AI detects urgency in real-time and transfers the call to your staff within seconds — no delay.',
  },
  {
    q: 'How accurate is the appointment booking?',
    a: 'The AI connects directly to your Google or Microsoft Calendar. It only offers genuinely available slots. Zero double-bookings reported across our entire customer base.',
  },
  {
    q: 'Can I listen to call recordings?',
    a: 'Yes. Every call is transcribed, recorded, and summarized by AI. Review the full transcript, play the audio, and see every decision the AI made — all in your dashboard.',
  },
  {
    q: 'What happens when I reach my minute limit?',
    a: "You'll get an alert at 80% usage. Calls continue — you're never cut off mid-conversation. We'll help you upgrade to the right plan seamlessly.",
  },
]

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen font-sans antialiased bg-[#030712]">

      {/* ══════════════════════════════════════════════════════
          NAVIGATION
      ══════════════════════════════════════════════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 glass-nav border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.4 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <span className="text-base font-bold text-gray-900 tracking-tight">{BRAND_NAME}</span>
            </div>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-7">
              {[
                { label: 'Features', href: '#features' },
                { label: 'Outbound', href: '/outbound' },
                { label: 'ROI', href: '#roi' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'Demo', href: '/demo' },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="relative text-sm text-gray-500 font-medium hover:text-gray-900 transition-colors group"
                >
                  {label}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-brand-600 rounded-full transition-all duration-300 group-hover:w-full" />
                </a>
              ))}
              <Link
                href="/demo"
                className="flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Live Demo
              </Link>
            </nav>

            {/* CTAs */}
            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-all duration-200 shadow-sm hover:shadow-brand-200 hover:-translate-y-px"
              >
                Start free →
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section className="relative mesh-gradient overflow-hidden pt-32 pb-24 px-4">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-32 w-[600px] h-[600px] rounded-full bg-brand-600/10 blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* Left: copy */}
            <div className="flex-1 text-center lg:text-left">

              {/* Badge */}
              <div className="shimmer-badge inline-flex items-center gap-2.5 bg-brand-950/80 border border-brand-700/50 rounded-full px-4 py-2 text-sm text-brand-300 mb-8 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                </span>
                Trusted by 500+ businesses across 6 industries
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight text-white mb-6">
                Your phones.<br />
                <span className="gradient-text">Handled by AI.</span>
              </h1>

              <p className="text-lg md:text-xl text-gray-400 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                Book appointments, handle missed calls, and run outbound campaigns — all on autopilot.
                Never miss a call again.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                <Link
                  href="/signup"
                  className="glow-btn inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white bg-brand-600 rounded-xl shadow-xl shadow-brand-950"
                >
                  Start free trial
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd"/></svg>
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-semibold text-white/80 border border-white/15 rounded-xl hover:bg-white/8 hover:text-white transition-all duration-200"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
                  </span>
                  Try live demo
                </Link>
              </div>

              <p className="text-sm text-gray-600">
                No contracts · 14-day free trial · Setup in 10 minutes
              </p>
            </div>

            {/* Right: phone mockup */}
            <div className="flex-shrink-0 animate-float">
              {/* Glow ring behind phone */}
              <div className="relative">
                <div className="absolute inset-0 bg-brand-600/20 blur-3xl rounded-full scale-110" />

                <div className="relative w-64 h-[500px] bg-gray-900 rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                  style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.1)' }}>

                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10 flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                    <div className="w-8 h-1.5 rounded-full bg-gray-700"></div>
                  </div>

                  {/* Status bar */}
                  <div className="flex justify-between items-center px-6 pt-8 pb-2">
                    <span className="text-[10px] text-gray-400 font-medium">9:41</span>
                    <div className="flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-gray-400"><path d="M1.93 7.93C3.82 6.04 6.29 5 9 5s5.18 1.04 7.07 2.93l1.41-1.41C15.31 4.35 12.27 3 9 3S2.69 4.35.52 6.52l1.41 1.41z"/><path d="M9 9c-1.77 0-3.37.72-4.52 1.88L5.89 12.3C6.72 11.47 7.8 11 9 11s2.28.47 3.11 1.3l1.41-1.42C12.37 9.72 10.77 9 9 9z"/></svg>
                      <span className="text-[10px] text-gray-400">●●●</span>
                    </div>
                  </div>

                  {/* Screen */}
                  <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5">

                    {/* Avatar with ring */}
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-full border border-brand-500/30 animate-pulse" />
                      <div className="absolute -inset-8 rounded-full border border-brand-500/15 animate-ping" style={{ animationDuration: '2.5s' }} />
                      <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-violet-600 rounded-full flex items-center justify-center shadow-xl shadow-brand-900/60">
                        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-white" stroke="currentColor" strokeWidth="1.8">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.4 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Incoming Call</p>
                      <p className="text-white font-semibold text-sm">+1 (310) 555-0192</p>
                      <p className="text-gray-500 text-xs mt-0.5">New Caller · Unknown</p>
                    </div>

                    {/* AI status card */}
                    <div className="w-full rounded-2xl overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                          </div>
                          <span className="text-[10px] text-green-400 font-semibold tracking-wider uppercase">AI Answering</span>
                        </div>
                        <p className="text-gray-300 text-[11px] leading-relaxed">
                          &ldquo;Thank you for calling — how can I help you today?&rdquo;
                        </p>
                        {/* Audio waveform */}
                        <div className="flex items-end gap-0.5 mt-2 h-4">
                          {[3,6,9,5,11,7,4,8,6,3,9,5,7,4,10,6,3,8,5,7].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-green-400/60 rounded-full"
                              style={{ height: `${h}px`, animationDelay: `${i * 0.08}s`, animation: 'glow 1s ease-in-out infinite alternate' }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Call action buttons */}
                    <div className="flex gap-8 w-full justify-center">
                      <button className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shadow-lg">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-400">
                          <path d="M21 15.46l-5.27-.61-2.52 2.52c-2.83-1.44-5.15-3.75-6.59-6.59l2.53-2.53L8.54 3H3.03C2.45 20.67 11.55 21 12 21c4.42 0 8-3.58 8-8v-4.08l1 .54z"/>
                        </svg>
                      </button>
                      <button className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center shadow-xl shadow-green-900/50">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Home indicator */}
                  <div className="flex justify-center pb-4 pt-2">
                    <div className="w-28 h-1 bg-white/15 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          WORKS WITH STRIP
      ══════════════════════════════════════════════════════ */}
      <section className="bg-[#030712] border-b border-white/5 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs text-gray-600 uppercase tracking-[0.2em] mb-5">Works with</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['HubSpot', 'Salesforce', 'Clio', 'Follow Up Boss', 'ServiceTitan', 'Google Calendar', 'Telnyx', 'Twilio', 'SendGrid'].map((name) => (
              <span
                key={name}
                className="inline-flex items-center px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-gray-400 tracking-wide"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════ */}
      <section className="bg-gray-950 border-y border-white/5 py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-black text-white mb-1">{s.value}</div>
                <div className="text-sm text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-28 px-4 bg-[#030712]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-[0.2em] mb-4">How it works</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-5 leading-tight">
              From first ring to<br />
              <span className="gradient-text">booked appointment</span> — in seconds
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Three steps. No IT department. No contract.
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-12 left-[calc(33.3%-8px)] right-[calc(33.3%-8px)] h-px bg-gradient-to-r from-brand-600/40 via-brand-400/60 to-brand-600/40" />

            {[
              {
                num: '01',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7 text-brand-400">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.4 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                ),
                title: 'Connect your number',
                desc: 'Forward your existing line or we provision a new AI number. Works with any phone system in minutes.',
              },
              {
                num: '02',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7 text-brand-400">
                    <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
                  </svg>
                ),
                title: 'AI handles every call',
                desc: 'Greets patients, books appointments, answers questions, and escalates emergencies — instantly.',
              },
              {
                num: '03',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7 text-brand-400">
                    <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                  </svg>
                ),
                title: 'Watch the results',
                desc: 'Every call logged, every booking tracked. Full transcripts, recordings, and analytics in one dashboard.',
              },
            ].map((step) => (
              <div key={step.num} className="glass-card feature-card rounded-2xl p-8 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-brand-950/80 border border-brand-500/30 flex items-center justify-center mb-5 shadow-lg shadow-brand-950/50">
                  {step.icon}
                </div>
                <span className="text-[10px] font-bold text-brand-500 uppercase tracking-[0.2em] mb-3">{step.num}</span>
                <h3 className="text-base font-bold text-white mb-3">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          DASHBOARD TEASER
      ══════════════════════════════════════════════════════ */}
      <section id="platform" className="bg-gray-950">
        <DashboardTeaser />
      </section>

      {/* ══════════════════════════════════════════════════════
          LIVE DEMO
      ══════════════════════════════════════════════════════ */}
      <section id="demo" className="bg-[#030712]">
        <EmbeddedVoiceDemo />
      </section>

      {/* ══════════════════════════════════════════════════════
          FEATURES — Inbound vs Outbound
      ══════════════════════════════════════════════════════ */}
      <section id="features" className="py-28 px-4 bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-[0.2em] mb-4">Capabilities</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-5 leading-tight">Two products.<br />One platform.</h2>
            <p className="text-gray-500 text-lg">Handle every caller touchpoint — inbound and outbound.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inbound */}
            <div className="feature-card glass-card rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6 text-emerald-400">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.4 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Inbound</p>
                  <h3 className="text-xl font-bold text-white">{BRAND_NAME}</h3>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  'Answers every call 24/7 — no hold music',
                  'Books, reschedules & cancels appointments',
                  'Identifies new vs. existing callers by phone',
                  'Escalates pain emergencies within seconds',
                  'Sends SMS confirmations & 24h reminders',
                  'Full call transcript + AI summary in dashboard',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-3 text-gray-400 text-sm">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center">
                      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-emerald-400"><path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            {/* Outbound */}
            <div className="feature-card glass-card rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-950/60 border border-brand-500/30 flex items-center justify-center shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6 text-brand-400">
                    <path d="m22 2-7 20-4-9-9-4 20-7z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.2em]">Outbound</p>
                  <h3 className="text-xl font-bold text-white">AI Caller</h3>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  'Dials your lead lists automatically',
                  'Qualifies prospects with natural conversation',
                  'Books appointments from cold leads',
                  'Leaves personalized voicemails',
                  'Retry logic with configurable schedules',
                  'Real-time campaign analytics & reporting',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-3 text-gray-400 text-sm">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-brand-950 border border-brand-500/40 flex items-center justify-center">
                      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-brand-400"><path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          ROI SECTION
      ══════════════════════════════════════════════════════ */}
      <RoiSection />

      {/* ══════════════════════════════════════════════════════
          INDUSTRIES — vertical-specific use cases + social proof
      ══════════════════════════════════════════════════════ */}
      <section id="industries" className="py-28 px-4 bg-cream-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-4">Industries</p>
            <h2 className="font-serif text-3xl md:text-5xl text-cream-900 mb-5 tracking-tight">
              Built for businesses<br />that live on the phone.
            </h2>
            <p className="text-cream-700 text-lg">Six verticals. One AI receptionist tuned for each.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                emoji: '🦷',
                label: 'Healthcare / Dental',
                bullets: ['Appointment booking & recall', 'Emergency triage & escalation', 'Insurance verification'],
                quote: '"We added 41 net-new patients in our first month — without hiring."',
                attribution: 'Dental practice owner · Austin, TX',
              },
              {
                emoji: '📋',
                label: 'Insurance Agency',
                bullets: ['Inbound lead qualification', 'Quote follow-up calls', 'Renewal reminders'],
                quote: '"Our quote-to-bind rate jumped from 18% to 27% once we stopped missing callbacks."',
                attribution: 'Independent agency · Denver, CO',
              },
              {
                emoji: '⚖️',
                label: 'Law Firm',
                bullets: ['24/7 new case intake', 'Consultation scheduling', 'Client follow-up'],
                quote: '"After-hours intake captures 6–8 new matters a week we used to lose to voicemail."',
                attribution: 'PI firm · Phoenix, AZ',
              },
              {
                emoji: '🏠',
                label: 'Real Estate',
                bullets: ['Instant lead qualification', 'Showing scheduling', 'Buyer & seller follow-up'],
                quote: '"Showings are now booked while the lead is still on the phone — not 3 days later."',
                attribution: 'Brokerage · Tampa, FL',
              },
              {
                emoji: '🔧',
                label: 'Home Services',
                bullets: ['24/7 job booking', 'Emergency dispatch', 'Maintenance reminders'],
                quote: '"We stopped losing emergency calls to a voicemail box. That alone paid for itself."',
                attribution: 'HVAC company · Houston, TX',
              },
              {
                emoji: '💼',
                label: 'Other Appointment-Based Businesses',
                bullets: ['24/7 call answering', 'Appointment booking', 'Outbound follow-up'],
                quote: '"It just works. Customers don\'t even realize it\'s AI."',
                attribution: 'Multi-location service business',
              },
            ].map((v) => (
              <div
                key={v.label}
                className="rounded-2xl bg-white border border-cream-200 p-6 flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl shrink-0">{v.emoji}</span>
                  <p className="font-serif text-lg text-cream-900 leading-tight">{v.label}</p>
                </div>
                <ul className="space-y-1.5 mb-5">
                  {v.bullets.map((b) => (
                    <li key={b} className="text-sm text-cream-700 flex items-start gap-2">
                      <span className="text-brand-500 mt-1 shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-5 border-t border-cream-100">
                  <p className="text-sm text-cream-800 italic leading-relaxed mb-2">{v.quote}</p>
                  <p className="text-xs text-cream-500">— {v.attribution}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors"
            >
              Hear it for your industry →
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-28 px-4 bg-[#030712]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-[0.2em] mb-4">Pricing</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-5 leading-tight">Simple pricing.<br />No surprises.</h2>
            <p className="text-gray-500 text-lg">14-day free trial on all plans. No credit card required.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`pricing-card relative flex flex-col rounded-2xl overflow-hidden border ${
                  plan.popular
                    ? 'border-brand-500/60 shadow-2xl shadow-brand-950'
                    : 'border-white/8'
                }`}
                style={plan.popular
                  ? { background: 'linear-gradient(160deg, #1e1b4b 0%, #111827 60%)' }
                  : { background: 'rgba(255,255,255,0.03)' }
                }
              >
                {plan.popular && (
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
                )}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-brand-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-brand-900/60">
                      ⭐ Most Popular
                    </span>
                  </div>
                )}

                <div className={`px-7 pt-8 pb-6 ${plan.popular ? 'pt-10' : ''}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{plan.emoji}</span>
                    <span className={`text-xs font-bold uppercase tracking-[0.18em] ${plan.color}`}>{plan.name}</span>
                  </div>
                  <div className="flex items-end gap-1.5 mb-1">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-gray-500 mb-1.5 text-sm">/mo</span>}
                  </div>
                  <p className="text-xs text-gray-500 italic mb-0.5">&ldquo;{plan.tagline}&rdquo;</p>
                  <p className={`text-xs mt-1 ${plan.color} opacity-70`}>{plan.for}</p>
                </div>

                <div className="px-7 pb-7 flex flex-col flex-1 gap-6">
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-gray-400">
                        <svg viewBox="0 0 12 12" fill="none" className="w-4 h-4 mt-0.5 shrink-0 text-brand-400"><path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="pt-4 border-t border-white/8">
                    <p className="text-xs text-gray-600 mb-4">Overage: <span className="text-gray-400 font-semibold">{plan.overage}</span></p>
                    <Link
                      href={plan.key === 'enterprise' ? 'mailto:sales@aireceptionist.ai' : '/signup'}
                      className={`block w-full text-center py-3 px-5 rounded-xl text-sm font-semibold transition-all duration-200 ${plan.ctaStyle}`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="mt-12 rounded-2xl border border-white/8 p-7" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.18em] text-center mb-6">Available Add-ons</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Extra phone numbers', price: '$8–$12/mo each', icon: '📱' },
                { label: 'White-glove setup', price: '$500–$2,000 one-time', icon: '🛠️' },
                { label: 'CRM integrations', price: '$100/mo', icon: '🔗' },
              ].map((addon) => (
                <div key={addon.label} className="glass-card rounded-xl px-5 py-4 text-center">
                  <span className="text-xl mb-2 block">{addon.icon}</span>
                  <p className="text-sm font-semibold text-white mb-1">{addon.label}</p>
                  <p className="text-sm text-brand-400 font-bold">{addon.price}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-gray-600 mt-8">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════════════ */}
      <section className="py-28 px-4 bg-gray-950">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-[0.2em] mb-4">FAQ</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-5">Questions &amp; answers</h2>
            <p className="text-gray-500 text-lg">Everything you need to know before getting started.</p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group glass-card rounded-2xl border border-white/8 overflow-hidden cursor-pointer open:border-brand-500/30"
              >
                <summary className="flex items-center justify-between px-6 py-5 font-semibold text-white text-sm select-none hover:text-brand-200 transition-colors">
                  <span>{faq.q}</span>
                  <span className="faq-icon ml-4 w-6 h-6 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0 text-gray-400 text-base group-open:border-brand-500/50 group-open:text-brand-400">+</span>
                </summary>
                <p className="px-6 pb-6 text-gray-500 text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════ */}
      <section className="relative mesh-gradient overflow-hidden py-32 px-4 text-center">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-brand-600/10 blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <p className="text-xs font-bold text-brand-400 uppercase tracking-[0.2em] mb-6">Get started today</p>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
            Start in 10 minutes.<br />
            <span className="gradient-text">No contracts.</span>
          </h2>
          <p className="text-gray-500 text-lg mb-12">
            Join 500+ businesses that let AI handle the phones.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="glow-btn inline-flex items-center gap-2 px-10 py-5 text-base font-bold text-white bg-brand-600 rounded-2xl shadow-xl shadow-brand-950"
            >
              Start your free trial
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd"/></svg>
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2.5 px-8 py-5 text-base font-semibold text-white/70 border border-white/15 rounded-2xl hover:bg-white/8 hover:text-white transition-all"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
              </span>
              Try live demo
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-600">No credit card required · Setup takes under 10 minutes</p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer className="bg-gray-950 border-t border-white/5 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">

            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.4 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <span className="text-white font-bold text-base tracking-tight">{BRAND_NAME}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
                AI-powered phone operations for appointment-based businesses across 6 industries.
              </p>
              <div className="flex gap-3 mt-5">
                {['#', '#', '#'].map((href, i) => (
                  <a key={i} href={href} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-gray-600 hover:border-brand-500/50 hover:text-brand-400 transition-all">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      {i === 0 && <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z"/>}
                      {i === 1 && <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/>}
                      {i === 2 && <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>}
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              { title: 'Product', links: [['Features', '#features'], ['Pricing', '#pricing'], ['How It Works', '#how-it-works'], ['Live Demo', '/demo']] },
              { title: 'Company', links: [['About', '#features'], ['Blog', 'https://aireceptionist.ai/blog'], ['Contact', 'mailto:hello@aireceptionist.ai']] },
              { title: 'Legal', links: [['Privacy Policy', '/legal/privacy'], ['Terms of Service', '/legal/terms'], ['HIPAA', '/legal/hipaa']] },
            ].map((col) => (
              <div key={col.title}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-[0.15em] mb-4">{col.title}</p>
                <ul className="space-y-3">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a
                        href={href}
                        className={`text-sm transition-colors ${label === 'Live Demo' ? 'text-green-400 hover:text-green-300' : 'text-gray-600 hover:text-gray-300'}`}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-700">© 2026 AI Receptionist. All rights reserved.</p>
            <p className="text-xs text-gray-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              All systems operational
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
