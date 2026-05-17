'use client';
// ============================================================
// DashboardTeaser — interactive browser-mockup preview of the
// actual client dashboard for the landing page
// ============================================================
import { BRAND_NAME } from '@/lib/brand';
import { useState } from 'react';

// ── Tab definitions ──────────────────────────────────────────
const TABS = [
  { id: 'dashboard',    label: '📊 Dashboard' },
  { id: 'calls',        label: '📞 Call Log' },
  { id: 'messages',     label: '💬 Messages' },
  { id: 'integrations', label: '🔌 Integrations' },
  { id: 'campaigns',    label: '📡 Campaigns' },
];

// ── Sidebar nav items (matches real sidebar) ─────────────────
const NAV_ITEMS = [
  { icon: '▦',  label: 'Dashboard',    id: 'dashboard' },
  { icon: '📞', label: 'Call Log',     id: 'calls' },
  { icon: '📅', label: 'Appointments', id: null },
  { icon: '👥', label: 'Patients',     id: null },
  { icon: '📵', label: 'Missed Calls', id: null },
  { icon: '🔔', label: 'Reminders',    id: null },
  { icon: '⚠️', label: 'Escalations',  id: null },
  { icon: '📡', label: 'Campaigns',    id: 'campaigns' },
  { icon: '💬', label: 'Messages',     id: 'messages' },
  { icon: '💳', label: 'Billing',      id: null },
];

const SETTINGS_NAV = [
  { label: 'Integrations', id: 'integrations' },
  { label: 'Office Hours',  id: null },
  { label: 'Voice Agent',   id: null },
  { label: 'Notifications', id: null },
];

// ── Mock data ────────────────────────────────────────────────
const MOCK_CALLS = [
  { from: '+1 (310) 555-0192', status: 'completed', outcome: 'booked',     time: '2m ago',  duration: '1:42', summary: 'New caller — booked consultation' },
  { from: '+1 (424) 555-0147', status: 'completed', outcome: 'rescheduled',time: '8m ago',  duration: '2:11', summary: 'Existing client — rescheduled follow-up' },
  { from: '+1 (213) 555-0088', status: 'transferred',outcome: 'escalated', time: '15m ago', duration: '0:34', summary: 'Urgent request — transferred to staff' },
  { from: '+1 (818) 555-0321', status: 'completed', outcome: 'booked',     time: '22m ago', duration: '1:58', summary: 'New caller — booked intake meeting' },
  { from: '+1 (626) 555-0055', status: 'missed',    outcome: 'voicemail',  time: '31m ago', duration: '—',    summary: 'No answer — voicemail sent' },
  { from: '+1 (310) 555-0274', status: 'completed', outcome: 'cancelled',  time: '45m ago', duration: '1:05', summary: 'Cancelled Tuesday appointment' },
];

const MOCK_CAMPAIGNS = [
  { name: 'Inactive Contact Reactivation', status: 'running',   leads: 243, connected: 89, booked: 34, progress: 37 },
  { name: 'New Client Outreach — Q2',      status: 'paused',    leads: 120, connected: 41, booked: 18, progress: 34 },
  { name: 'Lead Follow-Up Campaign',       status: 'completed', leads: 88,  connected: 72, booked: 29, progress: 100 },
  { name: 'Appointment Reminder Blast',    status: 'draft',     leads: 0,   connected: 0,  booked: 0,  progress: 0 },
];

const INTEGRATIONS = [
  {
    category: 'Phone & Telephony',
    items: [
      { icon: '📞', name: 'Twilio', desc: 'AI phone number, SMS, call recording', status: 'connected', color: 'bg-red-50 border-red-200' },
      { icon: '🔔', name: 'RingCentral', desc: 'Enterprise VoIP & call routing', status: 'available', color: 'bg-gray-50 border-gray-200' },
      { icon: '📡', name: 'Telnyx', desc: 'SIP trunking & media streaming', status: 'available', color: 'bg-gray-50 border-gray-200' },
    ],
  },
  {
    category: 'Calendar & Scheduling',
    items: [
      { icon: '📅', name: 'Google Calendar', desc: 'Appointment slots, event booking', status: 'connected', color: 'bg-blue-50 border-blue-200' },
      { icon: '📆', name: 'Microsoft 365', desc: 'Outlook calendar integration', status: 'available', color: 'bg-gray-50 border-gray-200' },
    ],
  },
  {
    category: 'CRM & Contact Records',
    items: [
      { icon: '🗄️', name: 'Built-in CRM', desc: 'Contact profiles, call history, notes', status: 'connected', color: 'bg-green-50 border-green-200' },
      { icon: '📊', name: 'CSV Import', desc: 'Bulk import from any system', status: 'connected', color: 'bg-green-50 border-green-200' },
      { icon: '🔗', name: 'HubSpot', desc: 'CRM sync and lead management (Growth+)', status: 'coming_soon', color: 'bg-gray-50 border-gray-200' },
      { icon: '☁️', name: 'Salesforce', desc: 'Enterprise CRM integration', status: 'coming_soon', color: 'bg-gray-50 border-gray-200' },
    ],
  },
  {
    category: 'Notifications',
    items: [
      { icon: '✉️', name: 'SendGrid', desc: 'Email confirmations & reminders', status: 'connected', color: 'bg-blue-50 border-blue-200' },
      { icon: '💬', name: 'Twilio SMS', desc: 'Text confirmations & recall', status: 'connected', color: 'bg-red-50 border-red-200' },
    ],
  },
];

// ── Helper components ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:   'bg-green-100 text-green-700',
    transferred: 'bg-amber-100 text-amber-700',
    missed:      'bg-red-100 text-red-700',
    booked:      'bg-emerald-100 text-emerald-700',
    rescheduled: 'bg-blue-100 text-blue-700',
    escalated:   'bg-amber-100 text-amber-700',
    cancelled:   'bg-gray-100 text-gray-600',
    voicemail:   'bg-gray-100 text-gray-600',
    running:     'bg-green-100 text-green-700',
    paused:      'bg-amber-100 text-amber-700',
    draft:       'bg-gray-100 text-gray-600',
    connected:   'bg-green-100 text-green-700',
    available:   'bg-gray-100 text-gray-500',
    coming_soon: 'bg-purple-50 text-purple-600',
  };
  const label: Record<string, string> = {
    completed:   'Completed',
    transferred: 'Transferred',
    missed:      'Missed',
    booked:      'Booked',
    rescheduled: 'Rescheduled',
    escalated:   'Escalated',
    cancelled:   'Cancelled',
    voicemail:   'Voicemail',
    running:     'Running',
    paused:      'Paused',
    draft:       'Draft',
    connected:   '✓ Connected',
    available:   'Connect',
    coming_soon: 'Coming soon',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label[status] ?? status}
    </span>
  );
}

// ── Tab content views ─────────────────────────────────────────
function DashboardView() {
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Calls Today',           value: '47',  color: 'bg-brand-600', icon: '📞' },
          { label: 'Appointments Booked',   value: '12',  color: 'bg-emerald-500', icon: '📅' },
          { label: 'Open Escalations',      value: '2',   color: 'bg-amber-500', icon: '⚠️' },
          { label: 'Missed Calls',          value: '3',   color: 'bg-red-500', icon: '📵' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900">{s.value}</span>
              <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center text-sm`}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Recent Calls */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Recent Calls</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
              Live
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {MOCK_CALLS.slice(0, 5).map((call, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  call.status === 'completed' ? 'bg-green-500' :
                  call.status === 'missed' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <span className="font-mono text-gray-600 w-32 shrink-0">{call.from}</span>
                <span className="text-gray-500 flex-1 truncate">{call.summary}</span>
                <StatusBadge status={call.outcome} />
                <span className="text-gray-400 w-12 text-right">{call.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live activity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Live Activity</span>
          </div>
          <div className="p-3 space-y-2">
            {[
              { type: 'appointment_booked',   text: 'Cleaning booked — J. Park',  t: '0:12' },
              { type: 'call_started',          text: 'Inbound call from (310)…',   t: '0:34' },
              { type: 'escalation_created',    text: 'Pain emergency — transferred', t: '1:05' },
              { type: 'appointment_booked',   text: 'Exam booked — M. Torres',    t: '2:18' },
              { type: 'call_completed',        text: 'Call ended — 2m 11s',        t: '3:40' },
            ].map((ev, i) => {
              const color = ev.type === 'appointment_booked' ? 'bg-emerald-500' :
                ev.type === 'call_started' ? 'bg-blue-500' :
                ev.type === 'escalation_created' ? 'bg-amber-500' : 'bg-green-500';
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${color}`} />
                  <span className="text-gray-600 flex-1 leading-tight">{ev.text}</span>
                  <span className="text-gray-400 shrink-0">{ev.t}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CallsView() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Call Log</span>
        <div className="flex gap-2">
          {['All', 'Completed', 'Missed', 'Escalated'].map(f => (
            <button key={f} className={`text-xs px-3 py-1 rounded-full font-medium ${f === 'All' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'}`}>{f}</button>
          ))}
        </div>
      </div>
      {/* Table header */}
      <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
        <span className="col-span-3">Caller</span>
        <span className="col-span-1">Dir.</span>
        <span className="col-span-2">Status</span>
        <span className="col-span-2">Duration</span>
        <span className="col-span-3">AI Summary</span>
        <span className="col-span-1">Time</span>
      </div>
      <div className="divide-y divide-gray-50">
        {MOCK_CALLS.map((call, i) => (
          <div key={i} className="grid grid-cols-12 px-5 py-3 text-xs hover:bg-gray-50 cursor-pointer items-center">
            <span className="col-span-3 font-mono text-gray-700">{call.from}</span>
            <span className="col-span-1 text-gray-400">↓</span>
            <span className="col-span-2"><StatusBadge status={call.status} /></span>
            <span className="col-span-2 text-gray-500 font-mono">{call.duration}</span>
            <span className="col-span-3 text-gray-500 truncate pr-2">{call.summary}</span>
            <span className="col-span-1 text-gray-400">{call.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsView() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-gray-900">Integrations</h3>
        <p className="text-xs text-gray-500 mt-0.5">Connect your phone, calendar, CRM, and communication tools</p>
      </div>
      {INTEGRATIONS.map(group => (
        <div key={group.category}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.category}</p>
          <div className="grid grid-cols-2 gap-2">
            {group.items.map(item => (
              <div key={item.name} className={`flex items-center gap-3 rounded-xl border p-3 ${item.color}`}>
                <span className="text-xl shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignsView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Outbound Campaigns</h3>
          <p className="text-xs text-gray-500 mt-0.5">AI calls your lead lists, qualifies prospects, and books appointments</p>
        </div>
        <button className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-semibold">+ New Campaign</button>
      </div>
      <div className="space-y-2">
        {MOCK_CAMPAIGNS.map((c, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <span className="text-xs text-gray-400">{c.leads} leads</span>
            </div>
            {c.leads > 0 && (
              <>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                  <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${c.progress}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Connected', value: c.connected, color: 'text-blue-700 bg-blue-50' },
                    { label: 'Qualified',  value: Math.round(c.connected * 0.6), color: 'text-purple-700 bg-purple-50' },
                    { label: 'Booked',    value: c.booked, color: 'text-emerald-700 bg-emerald-50' },
                  ].map(stat => (
                    <div key={stat.label} className={`rounded-lg px-2 py-1.5 ${stat.color}`}>
                      <p className="text-sm font-bold">{stat.value}</p>
                      <p className="text-[10px]">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mock message data ─────────────────────────────────────────
const MOCK_CONVERSATIONS = [
  { name: 'James T.',     initials: 'JT', preview: 'Can I reschedule my appointment?',           time: '14m ago', unread: 2, active: true },
  { name: 'Sarah M.',     initials: 'SM', preview: 'You: Great! See you tomorrow at 2pm',        time: '32m ago', unread: 0, active: false },
  { name: 'Maria R.',     initials: 'MR', preview: 'CONFIRM',                                    time: '1h ago',  unread: 1, active: false },
  { name: '(213) 555-0088', initials: '88', preview: 'You: We missed your call! How can we help?', time: '2h ago',  unread: 0, active: false },
];

const MOCK_THREAD = [
  { dir: 'outbound', body: 'Hi James! We missed your call at Smith Dental. How can we help? Reply here or call us back.', time: '9:02 AM' },
  { dir: 'inbound',  body: 'Hi! I need to reschedule my cleaning appointment for next week if possible.',                time: '9:15 AM' },
  { dir: 'outbound', body: 'Of course! We have openings Mon 10am, Tue 2pm, or Thu 4pm. Which works best for you?',      time: '9:16 AM' },
  { dir: 'inbound',  body: 'Can I reschedule my appointment?',                                                           time: '9:47 AM' },
];

function MessagesView() {
  return (
    <div className="flex gap-3 h-[480px]">
      {/* Conversation list */}
      <div className="w-52 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-900">Messages</span>
          <span className="text-[10px] bg-brand-100 text-brand-700 font-bold px-1.5 py-0.5 rounded-full">3 new</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {MOCK_CONVERSATIONS.map((conv) => (
            <div
              key={conv.name}
              className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer ${conv.active ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-brand-700">{conv.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-semibold truncate ${conv.active ? 'text-brand-700' : 'text-gray-900'}`}>{conv.name}</span>
                  {conv.unread > 0 && (
                    <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">{conv.preview}</p>
                <p className="text-[9px] text-gray-300 mt-0.5">{conv.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Thread view */}
      <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        {/* Thread header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-[10px] font-bold text-brand-700">JT</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900">James T.</p>
            <p className="text-[10px] text-gray-400">(424) 555-0147</p>
          </div>
          <span className="ml-auto text-[10px] bg-amber-50 text-amber-600 font-semibold px-2 py-0.5 rounded-full">2 unread</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[9px] font-medium text-gray-400">Today</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          {MOCK_THREAD.map((msg, i) => (
            <div key={i} className={`flex ${msg.dir === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed ${
                msg.dir === 'outbound'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
              }`}>
                {msg.body}
                <p className={`text-[9px] mt-1 opacity-70 ${msg.dir === 'outbound' ? 'text-right' : 'text-left'}`}>{msg.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Send box */}
        <div className="border-t border-gray-100 p-3 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
            <span className="text-[11px] text-gray-400 flex-1">Reply to James…</span>
            <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px]">↑</span>
            </div>
          </div>
          <p className="text-[9px] text-gray-400 mt-1.5 text-center">SMS sent from your Telnyx number</p>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────
export function DashboardTeaser() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      {/* Section header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-full px-4 py-1.5 text-sm text-brand-600 font-medium mb-5">
          ✦ Your command centre
        </div>
        <h2 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
          Everything you need,<br />in one dashboard.
        </h2>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto">
          Every call logged, every appointment tracked, every integration connected — visible in real time from any device.
        </p>
      </div>

      {/* Browser chrome mockup */}
      <div className="rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/80 overflow-hidden bg-white">

        {/* Browser top bar */}
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1.5 text-xs text-gray-400 border border-gray-200 max-w-sm mx-auto text-center select-none">
            app.aireceptionist.com/{activeTab}
          </div>
          <div className="w-16" />
        </div>

        {/* App shell */}
        <div className="flex h-[600px]">
          {/* Sidebar */}
          <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col">
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-sm">🦷</div>
              <span className="text-sm font-semibold text-gray-900">{BRAND_NAME}</span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
              {NAV_ITEMS.map(item => {
                const isActive = item.id === activeTab;
                const isClickable = item.id !== null;
                return (
                  <button
                    key={item.label}
                    onClick={() => item.id && setActiveTab(item.id)}
                    className={`w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : isClickable
                          ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
                          : 'text-gray-400 cursor-default'
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}

              <div className="pt-3 pb-1 px-2.5">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Settings</p>
              </div>
              {SETTINGS_NAV.map(item => {
                const isActive = item.id === activeTab;
                const isClickable = item.id !== null;
                return (
                  <button
                    key={item.label}
                    onClick={() => item.id && setActiveTab(item.id)}
                    className={`w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : isClickable
                          ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
                          : 'text-gray-400 cursor-default'
                    }`}
                  >
                    <span className="text-[10px] text-gray-400">⚙</span>
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Usage widget */}
            <div className="mx-2 mb-2 rounded-xl border border-gray-100 bg-gray-50 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">Growth</span>
                <span className="text-[10px] text-gray-400">890 / 1500 min</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                <div className="bg-brand-500 h-1 rounded-full" style={{ width: '59%' }} />
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 bg-gray-50/60 overflow-y-auto p-5">
            {/* Tab quick-switcher */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300 hover:text-brand-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="animate-in fade-in duration-200">
              {activeTab === 'dashboard'    && <DashboardView />}
              {activeTab === 'calls'        && <CallsView />}
              {activeTab === 'messages'     && <MessagesView />}
              {activeTab === 'integrations' && <IntegrationsView />}
              {activeTab === 'campaigns'    && <CampaignsView />}
            </div>
          </main>
        </div>
      </div>

      {/* Caption below */}
      <p className="text-center text-sm text-gray-400 mt-5">
        Click the tabs above to explore · Data shown is sample data
      </p>
    </div>
  );
}
