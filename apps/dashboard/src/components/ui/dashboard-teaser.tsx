'use client';
// ============================================================
// DashboardTeaser — fully-interactive browser-mockup preview of
// the real client dashboard. Every sidebar item is clickable
// and shows a representative sample view. Used on /inbound,
// /outbound, and /demo as a "command-centre" teaser.
// ============================================================
import { BRAND_NAME } from '@/lib/brand';
import { useState } from 'react';

// ── Tab + view IDs ───────────────────────────────────────────
type TabId =
  | 'dashboard'
  | 'calls'
  | 'appointments'
  | 'contacts'
  | 'missed'
  | 'reminders'
  | 'escalations'
  | 'campaigns'
  | 'messages'
  | 'billing'
  | 'integrations'
  | 'office_hours'
  | 'voice_agent'
  | 'notifications';

// ── Sidebar nav (matches the real /sidebar component) ────────
const NAV_ITEMS: { icon: string; label: string; id: TabId }[] = [
  { icon: '▦',  label: 'Dashboard',    id: 'dashboard'    },
  { icon: '📞', label: 'Call Log',     id: 'calls'        },
  { icon: '📅', label: 'Appointments', id: 'appointments' },
  { icon: '👥', label: 'Contacts',     id: 'contacts'     },
  { icon: '📵', label: 'Missed Calls', id: 'missed'       },
  { icon: '🔔', label: 'Reminders',    id: 'reminders'    },
  { icon: '⚠️', label: 'Escalations',  id: 'escalations'  },
  { icon: '📡', label: 'Campaigns',    id: 'campaigns'    },
  { icon: '💬', label: 'Messages',     id: 'messages'     },
  { icon: '💳', label: 'Billing',      id: 'billing'      },
];

const SETTINGS_NAV: { label: string; id: TabId }[] = [
  { label: 'Integrations',  id: 'integrations'  },
  { label: 'Office Hours',  id: 'office_hours'  },
  { label: 'Voice Agent',   id: 'voice_agent'   },
  { label: 'Notifications', id: 'notifications' },
];

// Friendly labels for the breadcrumb header.
const TAB_LABELS: Record<TabId, string> = {
  dashboard:    'Dashboard',
  calls:        'Call Log',
  appointments: 'Appointments',
  contacts:     'Contacts',
  missed:       'Missed Calls',
  reminders:    'Reminders',
  escalations:  'Escalations',
  campaigns:    'Campaigns',
  messages:     'Messages',
  billing:      'Billing',
  integrations: 'Integrations',
  office_hours: 'Office Hours',
  voice_agent:  'Voice Agent',
  notifications:'Notifications',
};

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
    category: 'AI Assistants & Drafts',
    items: [
      { icon: '🤖', name: 'OpenAI · ChatGPT',    desc: 'Drafts email replies, SMS responses, and call summaries',    status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '🧠', name: 'Anthropic · Claude',  desc: 'Draft messages with safety review + approval queue',         status: 'connected', color: 'bg-amber-50 border-amber-200'   },
      { icon: '✨', name: 'xAI · Grok',          desc: 'Voice agent core · multilingual TTS · realtime',             status: 'connected', color: 'bg-brand-50 border-brand-200'   },
      { icon: '📝', name: 'Draft Approval Queue', desc: 'Review every outbound draft before send · 1-click approve', status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
    ],
  },
  {
    category: 'Email Drafting & Sending',
    items: [
      { icon: '📧', name: 'Gmail',              desc: 'AI drafts land in your inbox · OAuth sign-in',     status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '📨', name: 'Microsoft Outlook',  desc: 'Two-way sync with Outlook 365 + drafts folder',    status: 'connected', color: 'bg-blue-50 border-blue-200'       },
      { icon: '💌', name: 'Apple Mail',         desc: 'IMAP sync for iCloud + custom domains',            status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '📬', name: 'Resend',             desc: 'High-deliverability transactional email',          status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '✉️', name: 'Postmark',           desc: 'Transactional email backup',                       status: 'available', color: 'bg-gray-50 border-gray-200'       },
    ],
  },
  {
    category: 'Messaging Channels',
    items: [
      { icon: '💬', name: 'SMS Inbox',          desc: 'Two-way SMS from your business number',            status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '🟢', name: 'WhatsApp Business',  desc: 'Bilingual drafts queued for approval',             status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '🍎', name: 'Apple Business Chat', desc: 'Reach iPhone users in the Messages app',          status: 'coming_soon', color: 'bg-gray-50 border-gray-200'     },
      { icon: '📘', name: 'Facebook Messenger', desc: 'Lead capture replies from your Facebook Page',     status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '📸', name: 'Instagram DM',       desc: 'Auto-draft replies for Instagram inquiries',       status: 'available', color: 'bg-gray-50 border-gray-200'       },
    ],
  },
  {
    category: 'Approval Inboxes',
    items: [
      { icon: '💼', name: 'Slack',              desc: 'Receive draft approvals + alerts in Slack',        status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '👥', name: 'Microsoft Teams',    desc: 'Approve email + SMS drafts inside Teams',          status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '📲', name: 'Mobile push',        desc: 'Tap-to-approve from your phone (iOS + Android)',   status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
    ],
  },
  {
    category: 'Calendar & Scheduling',
    items: [
      { icon: '📅', name: 'Google Calendar',    desc: 'Real-time slot lookup + appointment booking',      status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '📆', name: 'Microsoft 365',      desc: 'Outlook calendar + Teams meeting links',            status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '🍎', name: 'Apple iCloud',       desc: 'iCal sync for iPhone + Mac calendars',              status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '🗓️', name: 'Calendly',          desc: 'Pull live availability from your Calendly links',   status: 'available', color: 'bg-gray-50 border-gray-200'       },
    ],
  },
  {
    category: 'CRM & Contact Records',
    items: [
      { icon: '🗄️', name: 'Built-in CRM',      desc: 'Contact profiles, call history, notes, tags',       status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '🔗', name: 'HubSpot',           desc: 'Bi-directional contact + deal pipeline sync',        status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '☁️', name: 'Salesforce',        desc: 'Enterprise contact + opportunity sync',              status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '🪈', name: 'Pipedrive',         desc: 'Sales pipeline + activity logging',                  status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '🐙', name: 'Zoho CRM',          desc: 'Contacts + activities sync',                         status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '📊', name: 'CSV Import',        desc: 'Bulk import from any system',                        status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
    ],
  },
  {
    category: 'Phone & Voice',
    items: [
      { icon: '📞', name: 'Bring your own number', desc: 'Forward your existing line · free porting',     status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '🌐', name: 'SIP trunking',       desc: 'Plug in any SIP-compatible carrier',                status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '🔔', name: 'RingCentral',        desc: 'Enterprise VoIP + advanced routing',                status: 'available', color: 'bg-gray-50 border-gray-200'       },
    ],
  },
  {
    category: 'Automation & Webhooks',
    items: [
      { icon: '⚡', name: 'Zapier',             desc: 'Connect to 5,000+ apps · trigger on any event',     status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
      { icon: '🔧', name: 'Make',               desc: 'Visual workflow automation',                        status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '🛠️', name: 'n8n',               desc: 'Self-hosted workflow automation',                   status: 'available', color: 'bg-gray-50 border-gray-200'       },
      { icon: '🔗', name: 'Custom webhooks',    desc: 'Fire on call.completed, appointment.booked, more',  status: 'connected', color: 'bg-emerald-50 border-emerald-200' },
    ],
  },
];

const MOCK_APPOINTMENTS = [
  { name: 'James Park',     phone: '(310) 555-0192', when: 'Today · 2:30 PM',  service: 'New patient exam',     status: 'confirmed' },
  { name: 'Maria Torres',   phone: '(424) 555-0147', when: 'Today · 3:15 PM',  service: 'Cleaning',             status: 'confirmed' },
  { name: 'Linda Davis',    phone: '(213) 555-0088', when: 'Tomorrow · 9:00 AM',service:'Crown fitting',         status: 'confirmed' },
  { name: 'Robert Chen',    phone: '(818) 555-0321', when: 'Tomorrow · 11:30 AM',service:'Consultation',         status: 'pending'   },
  { name: 'Anna Petrov',    phone: '(626) 555-0055', when: 'Thu · 8:30 AM',    service: 'Cleaning + checkup',    status: 'confirmed' },
  { name: 'Marcus Lopez',   phone: '(310) 555-0274', when: 'Thu · 2:00 PM',    service: 'Whitening follow-up',   status: 'confirmed' },
];

const MOCK_CONTACTS = [
  { name: 'James Park',     phone: '(310) 555-0192', email: 'james@example.com',  bookings: 4, lastCall: '2m ago'  },
  { name: 'Maria Torres',   phone: '(424) 555-0147', email: 'maria@example.com',  bookings: 2, lastCall: '8m ago'  },
  { name: 'Linda Davis',    phone: '(213) 555-0088', email: 'linda@example.com',  bookings: 7, lastCall: '15m ago' },
  { name: 'Robert Chen',    phone: '(818) 555-0321', email: 'robert@example.com', bookings: 1, lastCall: '22m ago' },
  { name: 'Anna Petrov',    phone: '(626) 555-0055', email: 'anna@example.com',   bookings: 3, lastCall: '31m ago' },
  { name: 'Marcus Lopez',   phone: '(310) 555-0274', email: 'marcus@example.com', bookings: 5, lastCall: '45m ago' },
];

const MOCK_MISSED = [
  { phone: '(626) 555-0055', time: '12:32 PM',  textBack: 'Sent · awaiting reply',     status: 'pending'  },
  { phone: '(310) 555-0489', time: '11:18 AM',  textBack: 'Replied — booked Tue 2pm',  status: 'resolved' },
  { phone: '(818) 555-1234', time: '10:47 AM',  textBack: 'Sent · no reply yet',       status: 'pending'  },
  { phone: '(424) 555-9981', time: 'Yesterday', textBack: 'Replied — wrong number',    status: 'resolved' },
];

const MOCK_REMINDERS = [
  { name: 'James Park',   when: 'Today 1:30 PM',  type: '1-hour reminder',  channel: 'SMS', status: 'queued' },
  { name: 'Maria Torres', when: 'Today 2:15 PM',  type: '1-hour reminder',  channel: 'SMS', status: 'queued' },
  { name: 'Linda Davis',  when: 'Tomorrow 9 AM',  type: '24-hour reminder', channel: 'SMS', status: 'queued' },
  { name: 'Robert Chen',  when: 'Today 9:00 AM',  type: '24-hour reminder', channel: 'SMS', status: 'sent'   },
  { name: 'Anna Petrov',  when: 'Yesterday',      type: '24-hour reminder', channel: 'SMS', status: 'sent'   },
];

const MOCK_ESCALATIONS = [
  { caller: 'Sarah Kim',      issue: 'Dental emergency — wisdom tooth pain',   priority: 'high',   age: '3m ago',  status: 'open'       },
  { caller: '(213) 555-0088', issue: 'Insurance verification needed urgently', priority: 'medium', age: '12m ago', status: 'in_progress'},
  { caller: 'Michael Reyes',  issue: 'Caller asked for the dentist directly',  priority: 'low',    age: '47m ago', status: 'resolved'   },
];

// ── Helper components ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:    'bg-green-100 text-green-700',
    transferred:  'bg-amber-100 text-amber-700',
    missed:       'bg-red-100 text-red-700',
    booked:       'bg-emerald-100 text-emerald-700',
    rescheduled:  'bg-blue-100 text-blue-700',
    escalated:    'bg-amber-100 text-amber-700',
    cancelled:    'bg-gray-100 text-gray-600',
    voicemail:    'bg-gray-100 text-gray-600',
    running:      'bg-green-100 text-green-700',
    paused:       'bg-amber-100 text-amber-700',
    draft:        'bg-gray-100 text-gray-600',
    connected:    'bg-green-100 text-green-700',
    available:    'bg-gray-100 text-gray-500',
    coming_soon:  'bg-purple-50 text-purple-600',
    confirmed:    'bg-emerald-100 text-emerald-700',
    pending:      'bg-amber-100 text-amber-700',
    resolved:     'bg-green-100 text-green-700',
    queued:       'bg-blue-100 text-blue-700',
    sent:         'bg-emerald-100 text-emerald-700',
    open:         'bg-red-100 text-red-700',
    in_progress:  'bg-amber-100 text-amber-700',
    high:         'bg-red-100 text-red-700',
    medium:       'bg-amber-100 text-amber-700',
    low:          'bg-gray-100 text-gray-600',
  };
  const label: Record<string, string> = {
    completed:    'Completed',
    transferred:  'Transferred',
    missed:       'Missed',
    booked:       'Booked',
    rescheduled:  'Rescheduled',
    escalated:    'Escalated',
    cancelled:    'Cancelled',
    voicemail:    'Voicemail',
    running:      'Running',
    paused:       'Paused',
    draft:        'Draft',
    connected:    '✓ Connected',
    available:    'Connect',
    coming_soon:  'Coming soon',
    confirmed:    'Confirmed',
    pending:      'Pending',
    resolved:     'Resolved',
    queued:       'Queued',
    sent:         'Sent',
    open:         'Open',
    in_progress:  'In progress',
    high:         'High',
    medium:       'Medium',
    low:          'Low',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label[status] ?? status}
    </span>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Tab content views ─────────────────────────────────────────
function DashboardView() {
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Calls Today',           value: '47',  color: 'bg-brand-600',   icon: '📞' },
          { label: 'Appointments Booked',   value: '12',  color: 'bg-emerald-500', icon: '📅' },
          { label: 'Open Escalations',      value: '2',   color: 'bg-amber-500',   icon: '⚠️' },
          { label: 'Missed Calls',          value: '3',   color: 'bg-red-500',     icon: '📵' },
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
              { type: 'appointment_booked',  text: 'Cleaning booked — J. Park',     t: '0:12' },
              { type: 'call_started',         text: 'Inbound call from (310)…',      t: '0:34' },
              { type: 'escalation_created',   text: 'Pain emergency — transferred',  t: '1:05' },
              { type: 'appointment_booked',  text: 'Exam booked — M. Torres',       t: '2:18' },
              { type: 'call_completed',       text: 'Call ended — 2m 11s',           t: '3:40' },
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
    <SectionCard
      title="Call Log"
      action={
        <div className="flex gap-2">
          {['All', 'Completed', 'Missed', 'Escalated'].map(f => (
            <button key={f} className={`text-xs px-3 py-1 rounded-full font-medium ${f === 'All' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'}`}>{f}</button>
          ))}
        </div>
      }
    >
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
    </SectionCard>
  );
}

function AppointmentsView() {
  return (
    <div className="space-y-4">
      {/* Mini calendar strip */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-900 text-sm">This week</span>
          <div className="flex gap-1">
            <button className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">‹</button>
            <button className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">›</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
            <div key={d} className={`text-center rounded-lg py-2 ${i === 1 ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-600'}`}>
              <p className="text-[10px] font-semibold opacity-70">{d}</p>
              <p className="text-sm font-bold mt-0.5">{19 + i}</p>
              <div className="flex justify-center gap-0.5 mt-1">
                {[0, 1, 2].slice(0, (i + 2) % 4).map((dot) => (
                  <span key={dot} className={`w-1 h-1 rounded-full ${i === 1 ? 'bg-white' : 'bg-brand-400'}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionCard title="Upcoming appointments" action={<button className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-semibold">+ New</button>}>
        <div className="divide-y divide-gray-50">
          {MOCK_APPOINTMENTS.map((a, i) => (
            <div key={i} className="px-5 py-3 grid grid-cols-12 gap-3 items-center text-xs">
              <span className="col-span-3 font-semibold text-gray-900 truncate">{a.name}</span>
              <span className="col-span-3 font-mono text-gray-500 text-[11px]">{a.phone}</span>
              <span className="col-span-3 text-gray-600">{a.when}</span>
              <span className="col-span-2 text-gray-500 truncate">{a.service}</span>
              <span className="col-span-1 text-right"><StatusBadge status={a.status} /></span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ContactsView() {
  return (
    <SectionCard
      title="Contacts"
      action={
        <div className="flex gap-2 items-center">
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">🔍</span>
            <span className="text-[11px] text-gray-400">Search 1,247 contacts…</span>
          </div>
          <button className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-semibold">+ Add</button>
        </div>
      }
    >
      <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
        <span className="col-span-3">Name</span>
        <span className="col-span-3">Phone</span>
        <span className="col-span-3">Email</span>
        <span className="col-span-2">Bookings</span>
        <span className="col-span-1 text-right">Last call</span>
      </div>
      <div className="divide-y divide-gray-50">
        {MOCK_CONTACTS.map((c, i) => (
          <div key={i} className="px-5 py-3 grid grid-cols-12 gap-3 items-center text-xs hover:bg-gray-50 cursor-pointer">
            <span className="col-span-3 flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                {c.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
              </div>
              <span className="font-semibold text-gray-900 truncate">{c.name}</span>
            </span>
            <span className="col-span-3 font-mono text-gray-500 text-[11px]">{c.phone}</span>
            <span className="col-span-3 text-gray-500 truncate">{c.email}</span>
            <span className="col-span-2 text-gray-600">{c.bookings}</span>
            <span className="col-span-1 text-right text-gray-400">{c.lastCall}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function MissedCallsView() {
  return (
    <SectionCard title="Missed calls" action={<span className="text-[10px] text-gray-500">Auto text-back active</span>}>
      <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
        <span className="col-span-3">Phone</span>
        <span className="col-span-3">When</span>
        <span className="col-span-4">Text-back</span>
        <span className="col-span-2 text-right">Status</span>
      </div>
      <div className="divide-y divide-gray-50">
        {MOCK_MISSED.map((m, i) => (
          <div key={i} className="px-5 py-3 grid grid-cols-12 gap-3 items-center text-xs">
            <span className="col-span-3 font-mono text-gray-700">{m.phone}</span>
            <span className="col-span-3 text-gray-500">{m.time}</span>
            <span className="col-span-4 text-gray-500 truncate">{m.textBack}</span>
            <span className="col-span-2 text-right"><StatusBadge status={m.status} /></span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RemindersView() {
  return (
    <SectionCard title="SMS reminders" action={<span className="text-[10px] text-gray-500">24h + 2h auto-fire</span>}>
      <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
        <span className="col-span-3">Recipient</span>
        <span className="col-span-3">When</span>
        <span className="col-span-3">Type</span>
        <span className="col-span-2">Channel</span>
        <span className="col-span-1 text-right">Status</span>
      </div>
      <div className="divide-y divide-gray-50">
        {MOCK_REMINDERS.map((r, i) => (
          <div key={i} className="px-5 py-3 grid grid-cols-12 gap-3 items-center text-xs">
            <span className="col-span-3 font-semibold text-gray-900 truncate">{r.name}</span>
            <span className="col-span-3 text-gray-500">{r.when}</span>
            <span className="col-span-3 text-gray-500">{r.type}</span>
            <span className="col-span-2 text-gray-500">{r.channel}</span>
            <span className="col-span-1 text-right"><StatusBadge status={r.status} /></span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function EscalationsView() {
  return (
    <SectionCard title="Open escalations" action={<span className="text-[10px] text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-full">2 unresolved</span>}>
      <div className="divide-y divide-gray-50">
        {MOCK_ESCALATIONS.map((e, i) => (
          <div key={i} className="px-5 py-3 flex items-start gap-3 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
              e.priority === 'high' ? 'bg-red-500' : e.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-300'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-gray-900">{e.caller}</span>
                <StatusBadge status={e.priority} />
              </div>
              <p className="text-gray-500">{e.issue}</p>
            </div>
            <div className="text-right shrink-0">
              <StatusBadge status={e.status} />
              <p className="text-[10px] text-gray-400 mt-1">{e.age}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function IntegrationsView() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">Integrations</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            AI assistants draft your emails + SMS. You approve. Then they send through your inbox or business number.
          </p>
        </div>
        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
          ✓ Draft → Approve workflow live
        </span>
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
                    { label: 'Qualified', value: Math.round(c.connected * 0.6), color: 'text-purple-700 bg-purple-50' },
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

        <div className="border-t border-gray-100 p-3 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
            <span className="text-[11px] text-gray-400 flex-1">Reply to James…</span>
            <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px]">↑</span>
            </div>
          </div>
          <p className="text-[9px] text-gray-400 mt-1.5 text-center">SMS sent from your business number</p>
        </div>
      </div>
    </div>
  );
}

function BillingView() {
  return (
    <div className="space-y-4">
      {/* Current plan */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Current plan</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-gray-900">Growth</span>
              <span className="text-[10px] bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded-full">$199 / mo</span>
            </div>
          </div>
          <button className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-semibold">Upgrade →</button>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500">AI voice minutes</span>
            <span className="font-mono text-gray-900 font-semibold">890 / 1,500 min</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="bg-brand-500 h-2 rounded-full" style={{ width: '59%' }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Resets June 1 · Overage at $0.25/min</p>
        </div>
      </div>

      {/* Invoices */}
      <SectionCard title="Recent invoices" action={<button className="text-xs text-brand-600 font-semibold hover:underline">View all →</button>}>
        <div className="divide-y divide-gray-50">
          {[
            { id: 'INV-2026-0518', date: 'May 18, 2026', amount: '$199.00', status: 'paid' },
            { id: 'INV-2026-0418', date: 'Apr 18, 2026', amount: '$214.00', status: 'paid' },
            { id: 'INV-2026-0318', date: 'Mar 18, 2026', amount: '$199.00', status: 'paid' },
          ].map((inv, i) => (
            <div key={i} className="px-5 py-3 grid grid-cols-12 gap-3 items-center text-xs">
              <span className="col-span-4 font-mono text-gray-600">{inv.id}</span>
              <span className="col-span-4 text-gray-500">{inv.date}</span>
              <span className="col-span-2 font-semibold text-gray-900">{inv.amount}</span>
              <span className="col-span-2 text-right">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Paid</span>
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function OfficeHoursView() {
  const HOURS = [
    { day: 'Monday',    open: '8:00 AM',  close: '6:00 PM',  closed: false },
    { day: 'Tuesday',   open: '8:00 AM',  close: '6:00 PM',  closed: false },
    { day: 'Wednesday', open: '8:00 AM',  close: '6:00 PM',  closed: false },
    { day: 'Thursday',  open: '8:00 AM',  close: '7:00 PM',  closed: false },
    { day: 'Friday',    open: '8:00 AM',  close: '5:00 PM',  closed: false },
    { day: 'Saturday',  open: '9:00 AM',  close: '2:00 PM',  closed: false },
    { day: 'Sunday',    open: '—',        close: '—',        closed: true  },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-gray-900">Office Hours</h3>
        <p className="text-xs text-gray-500 mt-0.5">When your AI greets callers normally vs. with the after-hours flow.</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {HOURS.map((h) => (
          <div key={h.day} className="px-5 py-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-900 w-24">{h.day}</span>
            <div className="flex items-center gap-2">
              <span className={`w-8 h-4 rounded-full ${h.closed ? 'bg-gray-200' : 'bg-brand-500'} relative transition-colors`}>
                <span className={`absolute top-0.5 ${h.closed ? 'left-0.5' : 'left-4'} w-3 h-3 bg-white rounded-full transition-all`} />
              </span>
              <span className={`text-[10px] font-semibold ${h.closed ? 'text-gray-400' : 'text-gray-700'}`}>{h.closed ? 'Closed' : 'Open'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className="bg-gray-50 border border-gray-200 px-2 py-1 rounded font-mono text-[11px]">{h.open}</span>
              <span className="text-gray-400">–</span>
              <span className="bg-gray-50 border border-gray-200 px-2 py-1 rounded font-mono text-[11px]">{h.close}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <span className="font-semibold">After-hours mode:</span> Voicemail with auto text-back. Calls auto-resume normal flow at the next opening.
      </div>
    </div>
  );
}

function VoiceAgentView() {
  const VOICES = [
    { name: 'Ara', desc: 'Warm & professional', active: true  },
    { name: 'Eve', desc: 'Clear & friendly',    active: false },
    { name: 'Leo', desc: 'Confident & calm',    active: false },
    { name: 'Rex', desc: 'Crisp & precise',     active: false },
    { name: 'Sal', desc: 'Approachable & warm', active: false },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-gray-900">Voice Agent</h3>
        <p className="text-xs text-gray-500 mt-0.5">Pick a voice, set the greeting, choose languages.</p>
      </div>

      {/* Voice picker */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Voice</p>
        <div className="grid grid-cols-5 gap-2">
          {VOICES.map(v => (
            <div key={v.name} className={`rounded-lg border p-3 text-center cursor-pointer transition-all ${
              v.active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-gray-200 bg-white hover:border-brand-300'
            }`}>
              <div className={`w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center ${v.active ? 'bg-brand-600' : 'bg-gray-100'}`}>
                <span className={`text-xs font-bold ${v.active ? 'text-white' : 'text-gray-600'}`}>{v.name[0]}</span>
              </div>
              <p className="text-xs font-semibold text-gray-900">{v.name}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Greeting + languages */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Greeting script</p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 leading-relaxed">
            &ldquo;Hi there! Thanks for calling Smith Dental. This is your AI assistant — how can I help you today?&rdquo;
          </div>
          <p className="text-[10px] text-gray-400 mt-2">217 characters · {'<'} 6s spoken</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Languages enabled</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { flag: '🇺🇸', lang: 'English',  on: true  },
              { flag: '🇲🇽', lang: 'Spanish',  on: true  },
              { flag: '🇮🇹', lang: 'Italian',  on: false },
              { flag: '🇸🇦', lang: 'Arabic',   on: false },
              { flag: '🇮🇷', lang: 'Farsi',    on: false },
              { flag: '🇦🇲', lang: 'Armenian', on: false },
              { flag: '🇷🇺', lang: 'Russian',  on: false },
            ].map(l => (
              <div key={l.lang} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${
                l.on ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                <span>{l.flag}</span>
                <span>{l.lang}</span>
                {l.on && <span className="text-[9px]">✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsView() {
  const PREFS = [
    { event: 'New appointment booked',  email: true,  sms: false, webhook: true  },
    { event: 'Missed call',             email: true,  sms: true,  webhook: true  },
    { event: 'Escalation created',      email: true,  sms: true,  webhook: true  },
    { event: 'Daily summary',           email: true,  sms: false, webhook: false },
    { event: 'Usage at 80%',            email: true,  sms: false, webhook: false },
    { event: 'Payment receipt',         email: true,  sms: false, webhook: false },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-gray-900">Notifications</h3>
        <p className="text-xs text-gray-500 mt-0.5">Pick which events alert you — and where they land.</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
          <span className="col-span-6">Event</span>
          <span className="col-span-2 text-center">Email</span>
          <span className="col-span-2 text-center">SMS</span>
          <span className="col-span-2 text-center">Webhook</span>
        </div>
        <div className="divide-y divide-gray-50">
          {PREFS.map((p) => (
            <div key={p.event} className="px-5 py-3 grid grid-cols-12 gap-3 items-center text-xs">
              <span className="col-span-6 text-gray-700">{p.event}</span>
              {[p.email, p.sms, p.webhook].map((on, i) => (
                <span key={i} className="col-span-2 flex justify-center">
                  <span className={`w-8 h-4 rounded-full ${on ? 'bg-brand-500' : 'bg-gray-200'} relative transition-colors`}>
                    <span className={`absolute top-0.5 ${on ? 'left-4' : 'left-0.5'} w-3 h-3 bg-white rounded-full transition-all`} />
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── View dispatch ─────────────────────────────────────────────
function ActiveView({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'dashboard':    return <DashboardView />;
    case 'calls':        return <CallsView />;
    case 'appointments': return <AppointmentsView />;
    case 'contacts':     return <ContactsView />;
    case 'missed':       return <MissedCallsView />;
    case 'reminders':    return <RemindersView />;
    case 'escalations':  return <EscalationsView />;
    case 'campaigns':    return <CampaignsView />;
    case 'messages':     return <MessagesView />;
    case 'billing':      return <BillingView />;
    case 'integrations': return <IntegrationsView />;
    case 'office_hours': return <OfficeHoursView />;
    case 'voice_agent':  return <VoiceAgentView />;
    case 'notifications':return <NotificationsView />;
  }
}

// ── Main export ───────────────────────────────────────────────
export function DashboardTeaser() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      {/* Section header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-full px-4 py-1.5 text-sm text-brand-600 font-medium mb-5">
          ✦ Your command centre
        </div>
        <h2 className="font-serif text-3xl md:text-5xl text-cream-900 tracking-tight mb-4">
          Everything you need,<br />in one dashboard.
        </h2>
        <p className="text-cream-600 text-lg max-w-2xl mx-auto">
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
            app.aireceptionist.com/{activeTab.replace('_', '-')}
          </div>
          <div className="w-16" />
        </div>

        {/* App shell */}
        <div className="flex h-[640px]">
          {/* Sidebar */}
          <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col">
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-sm">🦷</div>
              <span className="text-sm font-semibold text-gray-900">{BRAND_NAME}</span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map(item => {
                const isActive = item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
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
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
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
            {/* Page header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Demo · Sample data</p>
                <h1 className="text-xl font-bold text-gray-900">{TAB_LABELS[activeTab]}</h1>
              </div>
              <span className="text-[10px] text-gray-400 italic">All tabs unlocked — click any sidebar item</span>
            </div>

            {/* Content */}
            <div key={activeTab} className="animate-in fade-in duration-200">
              <ActiveView tab={activeTab} />
            </div>
          </main>
        </div>
      </div>

      {/* Caption below */}
      <p className="text-center text-sm text-cream-500 mt-5">
        Click any sidebar item to explore · Every panel here is the real dashboard layout with sample data
      </p>
    </div>
  );
}
