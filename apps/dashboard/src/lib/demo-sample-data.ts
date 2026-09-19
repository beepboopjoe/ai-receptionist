// ============================================================
// Demo / Free-account sample office data.
// Shown only when the tenant is an unpaid demo account AND the
// corresponding live list is empty. IDs are prefixed `demo-` so
// detail pages and mutations can stay view-only. Not persisted.
// ============================================================
import type { ActivityEvent } from './useActivityFeed';
import type { SectionLiveCount, SmsConversation, SmsMessage, SmsThread } from './api';
import type { SectionKey } from './section-meta';
import type { VerticalConfig } from './verticals';

export const DEMO_ID_PREFIX = 'demo-';

export const DEMO_READ_ONLY_MESSAGE =
  'Sample data is view-only. Upgrade to Starter ($20/mo) to go live.';

export function isDemoSampleId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(DEMO_ID_PREFIX);
}

function atOffset(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function appointmentTypes(vertical: VerticalConfig): string[] {
  switch (vertical.id) {
    case 'dental':
      return ['New patient exam', 'Cleaning', 'Crown consultation', 'Emergency visit'];
    case 'insurance':
      return ['Policy review', 'Quote follow-up', 'New client consult', 'Renewal meeting'];
    case 'legal':
      return ['Intake consult', 'Case review', 'Document signing', 'Follow-up'];
    case 'real_estate':
      return ['Property showing', 'Buyer consult', 'Listing walkthrough', 'Offer review'];
    case 'home_services':
      return ['Estimate visit', 'Service appointment', 'Follow-up inspection', 'Emergency call-out'];
    default:
      return ['New client meeting', 'Consultation', 'Follow-up', 'Intro call'];
  }
}

function campaignNames(vertical: VerticalConfig): [string, string, string] {
  const types = vertical.campaignTypes;
  return [
    types[0] ?? 'Inactive Contact Reactivation',
    types[1] ?? 'Lead Follow-Up Campaign',
    types[2] ?? 'New Client Outreach',
  ];
}

function insuranceLabel(vertical: VerticalConfig): string {
  switch (vertical.id) {
    case 'dental':
      return 'Delta Dental';
    case 'insurance':
      return 'Auto + Home bundle';
    case 'legal':
      return 'Personal injury';
    case 'real_estate':
      return 'Buyer';
    case 'home_services':
      return 'Annual plan';
    default:
      return 'Preferred account';
  }
}

export type DemoCall = {
  id: string;
  fromNumber: string;
  toNumber: string;
  status: 'completed' | 'missed' | 'transferred';
  outcome: string;
  startedAt: string;
  durationSeconds: number | null;
  summary: string;
  workflowTriggered: string;
  recordingUrl: string | null;
  transcript: Array<{ role: 'agent' | 'caller'; text: string }>;
  satisfactionScore: number | null;
  contactId: string;
  direction: 'inbound';
};

export type DemoContact = {
  id: string;
  firstName: string;
  lastName: string;
  phoneE164: string;
  email: string;
  contactType: 'new' | 'existing';
  source: string;
  createdAt: string;
  insuranceProvider: string;
  notes: string;
  recallDueDate: string | null;
};

export type DemoAppointment = {
  id: string;
  appointmentType: string;
  providerName: string;
  startsAt: string;
  startTime: string;
  durationMinutes: number;
  status: 'confirmed' | 'completed';
  notes: string;
  contactId: string;
};

export type DemoEscalation = {
  id: string;
  reason: string;
  priority: 'urgent' | 'normal';
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

export type DemoNotification = {
  id: string;
  status: 'sent' | 'queued';
  channel: 'sms' | 'email';
  type: string;
  toAddress: string;
  createdAt: string;
  failedReason: string | null;
};

export type DemoCampaign = {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed';
  totalLeads: number;
  dialedCount: number;
  connectedCount: number;
  qualifiedCount: number;
  bookedCount: number;
  createdAt: string;
};

export type DemoSampleData = {
  calls: DemoCall[];
  contacts: DemoContact[];
  appointments: DemoAppointment[];
  escalations: DemoEscalation[];
  notifications: DemoNotification[];
  campaigns: DemoCampaign[];
  conversations: SmsConversation[];
  threads: Record<string, SmsThread>;
  activity: ActivityEvent[];
  sectionCounts: Partial<Record<SectionKey, SectionLiveCount[]>>;
};

const PEOPLE = [
  { first: 'James', last: 'Park', phone: '+13105550192', email: 'james.park@example.com' },
  { first: 'Maria', last: 'Torres', phone: '+14245550147', email: 'maria.torres@example.com' },
  { first: 'Linda', last: 'Davis', phone: '+12135550088', email: 'linda.davis@example.com' },
  { first: 'Robert', last: 'Chen', phone: '+18185550321', email: 'robert.chen@example.com' },
  { first: 'Anna', last: 'Petrov', phone: '+16265550055', email: 'anna.petrov@example.com' },
  { first: 'Marcus', last: 'Lopez', phone: '+13105550274', email: 'marcus.lopez@example.com' },
] as const;

export function buildDemoSample(vertical: VerticalConfig): DemoSampleData {
  const types = appointmentTypes(vertical);
  const noun = vertical.appointmentNoun;
  const contact = vertical.contactNoun;
  const [campA, campB, campC] = campaignNames(vertical);
  const carrier = insuranceLabel(vertical);

  const contacts: DemoContact[] = PEOPLE.map((p, i) => ({
    id: `${DEMO_ID_PREFIX}contact-${i + 1}`,
    firstName: p.first,
    lastName: p.last,
    phoneE164: p.phone,
    email: p.email,
    contactType: i < 2 ? 'new' : 'existing',
    source: i < 2 ? 'inbound_call' : 'import',
    createdAt: atOffset(-(48 - i * 6)),
    insuranceProvider: carrier,
    notes:
      i === 0
        ? `First-time ${contact}. Booked a ${types[0]!.toLowerCase()} after asking about availability this week.`
        : i === 2
          ? `Asked to speak with a person. Transferred; follow up if they call back.`
          : `Returning ${contact}. Prefers afternoon slots.`,
    recallDueDate: vertical.id === 'dental' && i === 4 ? atOffset(24 * 10).slice(0, 10) : null,
  }));

  const calls: DemoCall[] = [
    {
      id: `${DEMO_ID_PREFIX}call-1`,
      fromNumber: PEOPLE[0].phone,
      toNumber: '+12135551000',
      status: 'completed',
      outcome: 'booked',
      startedAt: atOffset(-0.04),
      durationSeconds: 102,
      summary: `New ${contact} — booked ${types[0]!.toLowerCase()}`,
      workflowTriggered: 'booking',
      recordingUrl: null,
      satisfactionScore: 5,
      contactId: contacts[0]!.id,
      direction: 'inbound',
      transcript: [
        { role: 'agent', text: `Hi, thanks for calling — this is Telfin. How can I help today?` },
        { role: 'caller', text: `Hi, I need to get on the calendar this week if possible.` },
        { role: 'agent', text: `I can do that. I have ${types[0]!.toLowerCase()} openings Thursday afternoon. Would 2:30 work?` },
        { role: 'caller', text: `2:30 Thursday is perfect.` },
        { role: 'agent', text: `You're set. I'll text a confirmation to this number.` },
      ],
    },
    {
      id: `${DEMO_ID_PREFIX}call-2`,
      fromNumber: PEOPLE[1].phone,
      toNumber: '+12135551000',
      status: 'completed',
      outcome: 'rescheduled',
      startedAt: atOffset(-0.15),
      durationSeconds: 131,
      summary: `Existing ${contact} — rescheduled follow-up`,
      workflowTriggered: 'reschedule',
      recordingUrl: null,
      satisfactionScore: 4,
      contactId: contacts[1]!.id,
      direction: 'inbound',
      transcript: [
        { role: 'agent', text: `Hi Maria, this is Telfin. How can I help?` },
        { role: 'caller', text: `I need to move my ${noun} to later this week.` },
        { role: 'agent', text: `I can move you to Friday at 3:15. Does that work?` },
        { role: 'caller', text: `Yes, thank you.` },
      ],
    },
    {
      id: `${DEMO_ID_PREFIX}call-3`,
      fromNumber: PEOPLE[2].phone,
      toNumber: '+12135551000',
      status: 'transferred',
      outcome: 'escalated',
      startedAt: atOffset(-0.3),
      durationSeconds: 34,
      summary: 'Urgent request — transferred to staff',
      workflowTriggered: 'escalation',
      recordingUrl: null,
      satisfactionScore: null,
      contactId: contacts[2]!.id,
      direction: 'inbound',
      transcript: [
        { role: 'agent', text: `Thanks for calling — I can help, or connect you with someone on the team.` },
        { role: 'caller', text: `I need to speak with someone now. This can't wait.` },
        { role: 'agent', text: `I'm transferring you now. Stay on the line.` },
      ],
    },
    {
      id: `${DEMO_ID_PREFIX}call-4`,
      fromNumber: PEOPLE[3].phone,
      toNumber: '+12135551000',
      status: 'completed',
      outcome: 'booked',
      startedAt: atOffset(-0.4),
      durationSeconds: 118,
      summary: `New ${contact} — booked ${types[2]!.toLowerCase()}`,
      workflowTriggered: 'booking',
      recordingUrl: null,
      satisfactionScore: 5,
      contactId: contacts[3]!.id,
      direction: 'inbound',
      transcript: [
        { role: 'agent', text: `Good morning, this is Telfin. What can I help with?` },
        { role: 'caller', text: `I'd like to book a ${types[2]!.toLowerCase()}.` },
        { role: 'agent', text: `Tomorrow at 11:30 is open. Shall I hold it?` },
        { role: 'caller', text: `Yes, book it.` },
      ],
    },
    {
      id: `${DEMO_ID_PREFIX}call-5`,
      fromNumber: PEOPLE[4].phone,
      toNumber: '+12135551000',
      status: 'missed',
      outcome: 'voicemail',
      startedAt: atOffset(-0.55),
      durationSeconds: null,
      summary: 'No answer — voicemail + text-back queued',
      workflowTriggered: 'missed_call',
      recordingUrl: null,
      satisfactionScore: null,
      contactId: contacts[4]!.id,
      direction: 'inbound',
      transcript: [],
    },
    {
      id: `${DEMO_ID_PREFIX}call-6`,
      fromNumber: PEOPLE[5].phone,
      toNumber: '+12135551000',
      status: 'completed',
      outcome: 'cancelled',
      startedAt: atOffset(-0.8),
      durationSeconds: 65,
      summary: `Cancelled Tuesday ${noun}`,
      workflowTriggered: 'cancel',
      recordingUrl: null,
      satisfactionScore: 4,
      contactId: contacts[5]!.id,
      direction: 'inbound',
      transcript: [
        { role: 'agent', text: `Hi, this is Telfin. How can I help?` },
        { role: 'caller', text: `I need to cancel Tuesday. Something came up.` },
        { role: 'agent', text: `I've cancelled Tuesday. Want me to offer a new time?` },
        { role: 'caller', text: `I'll call back next week.` },
      ],
    },
    {
      id: `${DEMO_ID_PREFIX}call-7`,
      fromNumber: '+13105550489',
      toNumber: '+12135551000',
      status: 'missed',
      outcome: 'voicemail',
      startedAt: atOffset(-2.1),
      durationSeconds: null,
      summary: 'Missed — text-back replied and booked',
      workflowTriggered: 'missed_call',
      recordingUrl: null,
      satisfactionScore: null,
      contactId: contacts[1]!.id,
      direction: 'inbound',
      transcript: [],
    },
  ];

  const appointments: DemoAppointment[] = [
    {
      id: `${DEMO_ID_PREFIX}appt-1`,
      appointmentType: types[0]!,
      providerName: 'Alex Rivera',
      startsAt: atOffset(6),
      startTime: atOffset(6),
      durationMinutes: 45,
      status: 'confirmed',
      notes: 'Booked on inbound call',
      contactId: contacts[0]!.id,
    },
    {
      id: `${DEMO_ID_PREFIX}appt-2`,
      appointmentType: types[1]!,
      providerName: 'Alex Rivera',
      startsAt: atOffset(7),
      startTime: atOffset(7),
      durationMinutes: 30,
      status: 'confirmed',
      notes: '',
      contactId: contacts[1]!.id,
    },
    {
      id: `${DEMO_ID_PREFIX}appt-3`,
      appointmentType: types[2]!,
      providerName: 'Jordan Hale',
      startsAt: atOffset(18),
      startTime: atOffset(18),
      durationMinutes: 60,
      status: 'confirmed',
      notes: '',
      contactId: contacts[2]!.id,
    },
    {
      id: `${DEMO_ID_PREFIX}appt-4`,
      appointmentType: types[3]!,
      providerName: 'Jordan Hale',
      startsAt: atOffset(26),
      startTime: atOffset(26),
      durationMinutes: 30,
      status: 'confirmed',
      notes: 'Pending insurance card at check-in',
      contactId: contacts[3]!.id,
    },
    {
      id: `${DEMO_ID_PREFIX}appt-5`,
      appointmentType: types[1]!,
      providerName: 'Alex Rivera',
      startsAt: atOffset(-20),
      startTime: atOffset(-20),
      durationMinutes: 30,
      status: 'completed',
      notes: '',
      contactId: contacts[4]!.id,
    },
  ];

  const escalations: DemoEscalation[] = [
    {
      id: `${DEMO_ID_PREFIX}esc-1`,
      reason: 'Caller asked for a person — transferred, still needs a callback',
      priority: 'urgent',
      status: 'open',
      createdAt: atOffset(-0.08),
      resolvedAt: null,
      resolutionNote: null,
    },
    {
      id: `${DEMO_ID_PREFIX}esc-2`,
      reason: 'Verification needed before confirming the booking',
      priority: 'normal',
      status: 'open',
      createdAt: atOffset(-0.25),
      resolvedAt: null,
      resolutionNote: null,
    },
    {
      id: `${DEMO_ID_PREFIX}esc-3`,
      reason: 'Asked for the owner directly',
      priority: 'normal',
      status: 'resolved',
      createdAt: atOffset(-8),
      resolvedAt: atOffset(-7),
      resolutionNote: 'Owner called back the same afternoon.',
    },
  ];

  const notifications: DemoNotification[] = [
    {
      id: `${DEMO_ID_PREFIX}notif-1`,
      status: 'queued',
      channel: 'sms',
      type: '1_hour_reminder',
      toAddress: PEOPLE[0].phone,
      createdAt: atOffset(-0.2),
      failedReason: null,
    },
    {
      id: `${DEMO_ID_PREFIX}notif-2`,
      status: 'queued',
      channel: 'sms',
      type: '1_hour_reminder',
      toAddress: PEOPLE[1].phone,
      createdAt: atOffset(-0.3),
      failedReason: null,
    },
    {
      id: `${DEMO_ID_PREFIX}notif-3`,
      status: 'sent',
      channel: 'sms',
      type: '24_hour_reminder',
      toAddress: PEOPLE[2].phone,
      createdAt: atOffset(-4),
      failedReason: null,
    },
    {
      id: `${DEMO_ID_PREFIX}notif-4`,
      status: 'sent',
      channel: 'email',
      type: 'booking_confirmation',
      toAddress: PEOPLE[0].email,
      createdAt: atOffset(-0.05),
      failedReason: null,
    },
    {
      id: `${DEMO_ID_PREFIX}notif-5`,
      status: 'sent',
      channel: 'sms',
      type: '24_hour_reminder',
      toAddress: PEOPLE[3].phone,
      createdAt: atOffset(-18),
      failedReason: null,
    },
  ];

  const campaigns: DemoCampaign[] = [
    {
      id: `${DEMO_ID_PREFIX}campaign-1`,
      name: campA,
      status: 'running',
      totalLeads: 243,
      dialedCount: 91,
      connectedCount: 89,
      qualifiedCount: 52,
      bookedCount: 34,
      createdAt: atOffset(-72),
    },
    {
      id: `${DEMO_ID_PREFIX}campaign-2`,
      name: campB,
      status: 'paused',
      totalLeads: 120,
      dialedCount: 48,
      connectedCount: 41,
      qualifiedCount: 22,
      bookedCount: 18,
      createdAt: atOffset(-240),
    },
    {
      id: `${DEMO_ID_PREFIX}campaign-3`,
      name: campC,
      status: 'completed',
      totalLeads: 88,
      dialedCount: 88,
      connectedCount: 72,
      qualifiedCount: 40,
      bookedCount: 29,
      createdAt: atOffset(-480),
    },
  ];

  const threads: Record<string, SmsThread> = {
    [PEOPLE[0].phone]: {
      phone: PEOPLE[0].phone,
      contactId: contacts[0]!.id,
      contactName: `${PEOPLE[0].first} ${PEOPLE[0].last}`,
      messages: [
        {
          id: `${DEMO_ID_PREFIX}sms-1a`,
          direction: 'outbound',
          fromNumber: '+12135551000',
          toNumber: PEOPLE[0].phone,
          body: `You're booked Thursday at 2:30 for a ${types[0]!.toLowerCase()}. Reply C to cancel or R to reschedule.`,
          status: 'delivered',
          contactId: contacts[0]!.id,
          createdAt: atOffset(-0.03),
        },
        {
          id: `${DEMO_ID_PREFIX}sms-1b`,
          direction: 'inbound',
          fromNumber: PEOPLE[0].phone,
          toNumber: '+12135551000',
          body: 'Perfect, see you Thursday.',
          status: 'received',
          contactId: contacts[0]!.id,
          createdAt: atOffset(-0.02),
        },
      ],
    },
    [PEOPLE[4].phone]: {
      phone: PEOPLE[4].phone,
      contactId: contacts[4]!.id,
      contactName: `${PEOPLE[4].first} ${PEOPLE[4].last}`,
      messages: [
        {
          id: `${DEMO_ID_PREFIX}sms-2a`,
          direction: 'outbound',
          fromNumber: '+12135551000',
          toNumber: PEOPLE[4].phone,
          body: `Sorry we missed your call. Want us to call you back, or book a ${noun} here?`,
          status: 'delivered',
          contactId: contacts[4]!.id,
          createdAt: atOffset(-0.5),
        },
      ],
    },
    [PEOPLE[1].phone]: {
      phone: PEOPLE[1].phone,
      contactId: contacts[1]!.id,
      contactName: `${PEOPLE[1].first} ${PEOPLE[1].last}`,
      messages: [
        {
          id: `${DEMO_ID_PREFIX}sms-3a`,
          direction: 'outbound',
          fromNumber: '+12135551000',
          toNumber: PEOPLE[1].phone,
          body: 'We just missed you — I can book a time if you text your preferred day.',
          status: 'delivered',
          contactId: contacts[1]!.id,
          createdAt: atOffset(-2),
        },
        {
          id: `${DEMO_ID_PREFIX}sms-3b`,
          direction: 'inbound',
          fromNumber: PEOPLE[1].phone,
          toNumber: '+12135551000',
          body: 'Tuesday at 2pm works.',
          status: 'received',
          contactId: contacts[1]!.id,
          createdAt: atOffset(-1.9),
        },
        {
          id: `${DEMO_ID_PREFIX}sms-3c`,
          direction: 'outbound',
          fromNumber: '+12135551000',
          toNumber: PEOPLE[1].phone,
          body: `Booked Tuesday at 2:00 PM. See you then.`,
          status: 'delivered',
          contactId: contacts[1]!.id,
          createdAt: atOffset(-1.85),
        },
      ],
    },
  };

  const conversations: SmsConversation[] = [
    {
      externalPhone: PEOPLE[0].phone,
      lastMessage: 'Perfect, see you Thursday.',
      lastDirection: 'inbound',
      lastAt: atOffset(-0.02),
      inboundCount: 1,
      contactId: contacts[0]!.id,
      contactName: `${PEOPLE[0].first} ${PEOPLE[0].last}`,
    },
    {
      externalPhone: PEOPLE[4].phone,
      lastMessage: `Sorry we missed your call. Want us to call you back, or book a ${noun} here?`,
      lastDirection: 'outbound',
      lastAt: atOffset(-0.5),
      inboundCount: 0,
      contactId: contacts[4]!.id,
      contactName: `${PEOPLE[4].first} ${PEOPLE[4].last}`,
    },
    {
      externalPhone: PEOPLE[1].phone,
      lastMessage: 'Booked Tuesday at 2:00 PM. See you then.',
      lastDirection: 'outbound',
      lastAt: atOffset(-1.85),
      inboundCount: 1,
      contactId: contacts[1]!.id,
      contactName: `${PEOPLE[1].first} ${PEOPLE[1].last}`,
    },
  ];

  const activity: ActivityEvent[] = [
    {
      type: 'appointment_booked',
      timestamp: atOffset(-0.03),
      data: { contactName: `${PEOPLE[0].first} ${PEOPLE[0].last}`, fromNumber: PEOPLE[0].phone },
    },
    {
      type: 'call_completed',
      timestamp: atOffset(-0.04),
      data: { contactName: `${PEOPLE[0].first} ${PEOPLE[0].last}`, fromNumber: PEOPLE[0].phone },
    },
    {
      type: 'sms_received',
      timestamp: atOffset(-0.02),
      data: { contactName: `${PEOPLE[0].first} ${PEOPLE[0].last}`, fromNumber: PEOPLE[0].phone },
    },
    {
      type: 'escalation_created',
      timestamp: atOffset(-0.08),
      data: { contactName: `${PEOPLE[2].first} ${PEOPLE[2].last}`, fromNumber: PEOPLE[2].phone },
    },
    {
      type: 'call_completed',
      timestamp: atOffset(-0.15),
      data: { contactName: `${PEOPLE[1].first} ${PEOPLE[1].last}`, fromNumber: PEOPLE[1].phone },
    },
    {
      type: 'sms_sent',
      timestamp: atOffset(-0.5),
      data: { contactName: `${PEOPLE[4].first} ${PEOPLE[4].last}`, fromNumber: PEOPLE[4].phone },
    },
  ];

  const sectionCounts: DemoSampleData['sectionCounts'] = {
    calls: [
      { label: 'Calls last 7 days', value: calls.length, severity: 'info' },
      { label: 'Escalated', value: 1, severity: 'warning' },
    ],
    'missed-calls': [
      { label: 'Missed last 7 days', value: 2, severity: 'warning' },
      { label: 'Last 24 hours', value: 1, severity: 'critical' },
    ],
    appointments: [
      { label: `Upcoming ${vertical.appointmentNounPlural}`, value: 4, severity: 'success' },
      { label: 'Today', value: 2, severity: 'info' },
    ],
    escalations: [
      { label: 'Open', value: 2, severity: 'warning' },
      { label: 'Resolved', value: 1, severity: 'success' },
    ],
    contacts: [
      { label: `Total ${vertical.contactNounPlural}`, value: contacts.length, severity: 'info' },
      { label: 'New this week', value: 2, severity: 'success' },
    ],
    messages: [
      { label: 'Open threads', value: conversations.length, severity: 'info' },
      { label: 'Unreplied', value: 1, severity: 'warning' },
    ],
    campaigns: [
      { label: 'Running', value: 1, severity: 'success' },
      { label: 'Booked this month', value: 81, severity: 'info' },
    ],
    reminders: [
      { label: 'Queued', value: 2, severity: 'info' },
      { label: 'Sent', value: 3, severity: 'success' },
    ],
  };

  return {
    calls,
    contacts,
    appointments,
    escalations,
    notifications,
    campaigns,
    conversations,
    threads,
    activity,
    sectionCounts,
  };
}

export function findDemoCall(id: string, vertical: VerticalConfig): DemoCall | undefined {
  return buildDemoSample(vertical).calls.find((c) => c.id === id);
}

export function findDemoContact(id: string, vertical: VerticalConfig): DemoContact | undefined {
  return buildDemoSample(vertical).contacts.find((c) => c.id === id);
}

export function findDemoCampaign(id: string, vertical: VerticalConfig): DemoCampaign | undefined {
  return buildDemoSample(vertical).campaigns.find((c) => c.id === id);
}

export function findDemoThread(phone: string, vertical: VerticalConfig): SmsThread | undefined {
  return buildDemoSample(vertical).threads[phone];
}

export function filterDemoContacts(contacts: DemoContact[], q: string): DemoContact[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return contacts;
  return contacts.filter((c) =>
    `${c.firstName} ${c.lastName} ${c.phoneE164} ${c.email}`.toLowerCase().includes(needle)
  );
}

export type DemoFillResult<T> = {
  items: T[];
  total: number;
  isSample: boolean;
};

/** Overlay sample rows when a Free/demo tenant has an empty live list. */
export function fillDemoList<T>(opts: {
  isDemoAccount: boolean;
  planLoading: boolean;
  listLoading?: boolean;
  realItems: T[] | undefined;
  realTotal?: number;
  sampleItems: T[];
}): DemoFillResult<T> {
  const real = opts.realItems ?? [];
  if (!opts.planLoading && !opts.listLoading && opts.isDemoAccount && real.length === 0) {
    return { items: opts.sampleItems, total: opts.sampleItems.length, isSample: true };
  }
  return { items: real, total: opts.realTotal ?? real.length, isSample: false };
}
