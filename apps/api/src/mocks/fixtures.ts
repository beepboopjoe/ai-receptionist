// ============================================================
// Mock fixtures — realistic in-memory data for dev server.
// Shape matches the real API responses used by the dashboard.
//
// Vertical-flavored fields (appointment types, call reasons,
// provider names, escalation reasons, notification bodies) come
// from vertical-overlays.ts so a dev tenant configured as
// e.g. 'legal' sees lawyer-flavored mock data instead of dental.
// ============================================================
import { getOverlay } from './vertical-overlays.js';

const now = Date.now();
const minutesAgo = (n: number) => new Date(now - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(now - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(now + n * 86_400_000).toISOString();

export const MOCK_TENANT = {
  id: 'tnt_demo_001',
  name: 'Demo Business',
  slug: 'demo-business',
  plan: 'growth',
  vertical: 'generic',
};

export const MOCK_USER = {
  id: 'usr_demo_001',
  tenantId: MOCK_TENANT.id,
  email: 'demo@demobusiness.com',
  firstName: 'Demo',
  lastName: 'User',
  role: 'owner',
};

export const MOCK_BILLING = {
  plan: 'growth',
  minutesUsed: 1840,
  minutesIncluded: 3000,
  usagePercent: 61,
  callsThisMonth: 487,
  appointmentsThisMonth: 312,
  renewalDate: daysFromNow(18),
  monthlyPrice: 399,
  outboundEnabled: true,
  analyticsEnabled: false,
  multiLocationEnabled: false,
};

const FIRST_NAMES = ['Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'James', 'Sophia', 'Daniel', 'Ava', 'Liam', 'Isabella', 'Noah', 'Mia', 'Ethan', 'Charlotte', 'Lucas', 'Amelia', 'Mason', 'Harper', 'Elijah', 'Evelyn', 'Logan', 'Abigail', 'Jackson', 'Emily', 'Aiden', 'Elizabeth', 'Sebastian', 'Sofia', 'Henry'];
const LAST_NAMES = ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker'];

function phone(i: number) {
  const base = 6265551000 + i * 7;
  const s = String(base);
  return `+1${s.slice(0, 3)}${s.slice(3, 6)}${s.slice(6)}`;
}

export const MOCK_CONTACTS = FIRST_NAMES.map((first, i) => ({
  id: `pat_${String(i + 1).padStart(4, '0')}`,
  firstName: first,
  lastName: LAST_NAMES[i % LAST_NAMES.length],
  fullName: `${first} ${LAST_NAMES[i % LAST_NAMES.length]}`,
  phone: phone(i),
  email: `${first.toLowerCase()}.${LAST_NAMES[i % LAST_NAMES.length]!.toLowerCase()}@example.com`,
  dob: `19${70 + (i % 40)}-0${(i % 9) + 1}-1${i % 10}`,
  createdAt: daysAgo(30 + i),
  lastVisit: daysAgo(i * 3),
  tags: i % 5 === 0 ? ['VIP'] : i % 7 === 0 ? ['New'] : [],
}));

const CALL_OUTCOMES = ['booked', 'escalated', 'voicemail', 'missed', 'completed', 'booked', 'completed', 'booked'];
// Vertical overlay drives reasons/types/providers so dev tenants get industry-flavored mock data.
const overlay = getOverlay(MOCK_TENANT.vertical);
const CALL_REASONS = overlay.callReasons;

export const MOCK_CALLS = Array.from({ length: 20 }, (_, i) => {
  const contact = MOCK_CONTACTS[i % MOCK_CONTACTS.length]!;
  const outcome = CALL_OUTCOMES[i % CALL_OUTCOMES.length]!;
  return {
    id: `call_${String(i + 1).padStart(4, '0')}`,
    direction: i % 4 === 0 ? 'outbound' : 'inbound',
    fromNumber: contact.phone,
    toNumber: '+16265170214',
    callerName: contact.fullName,
    contactId: contact.id,
    status: outcome === 'missed' ? 'missed' : 'completed',
    outcome,
    reason: CALL_REASONS[i % CALL_REASONS.length],
    durationSeconds: outcome === 'missed' ? 0 : 60 + (i * 17) % 400,
    recordingUrl: outcome === 'missed' ? null : `https://recordings.example.com/call_${i + 1}.mp3`,
    transcriptPreview: outcome === 'missed'
      ? null
      : `"Hi, I'd like to ${CALL_REASONS[i % CALL_REASONS.length]!.toLowerCase()}..."`,
    startedAt: minutesAgo(i * 37 + 5),
    endedAt: minutesAgo(i * 37),
    createdAt: minutesAgo(i * 37 + 5),
    aiHandled: outcome !== 'escalated',
    satisfactionScore: outcome === 'missed' || outcome === 'escalated' ? null : [5, 4, 5, 5, 3, 4, null, 5][i % 8],
    summary: `${CALL_REASONS[i % CALL_REASONS.length]} — ${outcome === 'booked' ? 'appointment scheduled' : outcome === 'voicemail' ? 'left voicemail' : outcome === 'escalated' ? 'transferred to staff' : 'resolved by AI'}`,
  };
});

export const MOCK_MISSED_CALLS = MOCK_CALLS.filter(c => c.outcome === 'missed').slice(0, 4);

const APPT_TYPES = overlay.apptTypes;

export const MOCK_APPOINTMENTS = Array.from({ length: 8 }, (_, i) => {
  const contact = MOCK_CONTACTS[i]!;
  return {
    id: `apt_${String(i + 1).padStart(4, '0')}`,
    contactId: contact.id,
    contactName: contact.fullName,
    contactPhone: contact.phone,
    type: APPT_TYPES[i % APPT_TYPES.length],
    status: i === 0 ? 'confirmed' : i === 7 ? 'pending' : 'confirmed',
    startTime: daysFromNow(Math.floor(i / 2) + 1),
    endTime: daysFromNow(Math.floor(i / 2) + 1),
    durationMinutes: 30 + (i % 3) * 15,
    providerName: overlay.providerNames[i % overlay.providerNames.length],
    notes: i === 3 ? 'New client — please allow extra time' : null,
    source: i % 3 === 0 ? 'ai_inbound' : i % 3 === 1 ? 'ai_outbound' : 'manual',
    createdAt: hoursAgo(i * 2 + 1),
  };
});

export const MOCK_ESCALATIONS = [
  { id: 'esc_001', contactName: MOCK_CONTACTS[0]!.fullName, contactPhone: MOCK_CONTACTS[0]!.phone, reason: 'Urgent request — needs same-day appointment', priority: 'urgent', status: 'open', createdAt: minutesAgo(12), callId: MOCK_CALLS[1]!.id, assignedTo: null },
  { id: 'esc_002', contactName: MOCK_CONTACTS[4]!.fullName, contactPhone: MOCK_CONTACTS[4]!.phone, reason: 'Billing question — caller wants human', priority: 'normal', status: 'open', createdAt: hoursAgo(1), callId: MOCK_CALLS[3]!.id, assignedTo: null },
  { id: 'esc_003', contactName: MOCK_CONTACTS[7]!.fullName, contactPhone: MOCK_CONTACTS[7]!.phone, reason: 'Complaint about last service', priority: 'high', status: 'open', createdAt: hoursAgo(3), callId: MOCK_CALLS[5]!.id, assignedTo: null },
  { id: 'esc_004', contactName: MOCK_CONTACTS[11]!.fullName, contactPhone: MOCK_CONTACTS[11]!.phone, reason: 'Urgent service issue — needs immediate attention', priority: 'urgent', status: 'resolved', createdAt: daysAgo(1), callId: MOCK_CALLS[8]!.id, assignedTo: 'Alex Carter', resolvedAt: hoursAgo(20) },
  { id: 'esc_005', contactName: MOCK_CONTACTS[14]!.fullName, contactPhone: MOCK_CONTACTS[14]!.phone, reason: 'Complex inquiry — requires specialist', priority: 'normal', status: 'resolved', createdAt: daysAgo(2), callId: MOCK_CALLS[10]!.id, assignedTo: 'Jordan Lee', resolvedAt: daysAgo(1) },
];

export const MOCK_NOTIFICATIONS = [
  { id: 'not_001', type: 'sms_reminder', channel: 'sms', status: 'sent', toAddress: MOCK_CONTACTS[0]!.phone, subject: null, body: 'Reminder: Consultation tomorrow at 10am', createdAt: hoursAgo(2), sentAt: hoursAgo(2), failedReason: null },
  { id: 'not_002', type: 'sms_reminder', channel: 'sms', status: 'sent', toAddress: MOCK_CONTACTS[1]!.phone, subject: null, body: 'Reminder: Follow-up Wednesday at 2:30pm', createdAt: hoursAgo(5), sentAt: hoursAgo(5), failedReason: null },
  { id: 'not_003', type: 'sms_reminder', channel: 'sms', status: 'pending', toAddress: MOCK_CONTACTS[2]!.phone, subject: null, body: 'Reminder: Intake meeting Friday 9am', createdAt: minutesAgo(30), sentAt: null, failedReason: null },
  { id: 'not_004', type: 'booking_confirmation', channel: 'sms', status: 'sent', toAddress: MOCK_CONTACTS[3]!.phone, subject: null, body: 'Confirmed: Review appointment Mar 28 at 11am', createdAt: hoursAgo(8), sentAt: hoursAgo(8), failedReason: null },
  { id: 'not_005', type: 'sms_reminder', channel: 'sms', status: 'failed', toAddress: MOCK_CONTACTS[4]!.phone, subject: null, body: 'Reminder: Service call Saturday 1pm', createdAt: hoursAgo(12), sentAt: null, failedReason: 'Invalid phone number' },
  { id: 'not_006', type: 'sms_reminder', channel: 'sms', status: 'pending', toAddress: MOCK_CONTACTS[5]!.phone, subject: null, body: 'Reminder: New client exam Monday 3pm', createdAt: minutesAgo(10), sentAt: null, failedReason: null },
];

export const MOCK_CAMPAIGNS = [
  {
    id: 'cmp_001', name: 'Inactive Contact Reactivation',
    status: 'running', script: 'Hi {firstName}, this is Aria from Demo Business — we\'d love to reconnect.',
    totalLeads: 124, contacted: 87, connected: 54, booked: 31, failed: 8,
    progressPercent: 70, bookingRate: 57,
    startedAt: daysAgo(3), scheduledAt: null, completedAt: null, createdAt: daysAgo(4),
  },
  {
    id: 'cmp_002', name: 'Lead Follow-Up Campaign',
    status: 'paused', script: 'Hi {firstName}, following up on your recent inquiry.',
    totalLeads: 62, contacted: 30, connected: 18, booked: 9, failed: 2,
    progressPercent: 48, bookingRate: 50,
    startedAt: daysAgo(7), scheduledAt: null, completedAt: null, createdAt: daysAgo(8),
  },
  {
    id: 'cmp_003', name: 'New Client Outreach',
    status: 'completed', script: 'Hi {firstName}, we have a special offer for new clients this month.',
    totalLeads: 210, contacted: 210, connected: 142, booked: 58, failed: 12,
    progressPercent: 100, bookingRate: 41,
    startedAt: daysAgo(21), scheduledAt: null, completedAt: daysAgo(14), createdAt: daysAgo(22),
  },
];

export const MOCK_INTEGRATIONS = [
  { id: 'int_001', provider: 'google_calendar', name: 'Google Calendar', status: 'connected', connectedAt: daysAgo(45), accountEmail: 'demo@demobusiness.com' },
  { id: 'int_002', provider: 'telnyx', name: 'Phone System', status: 'connected', connectedAt: daysAgo(60), phoneNumber: '+16265170214' },
  { id: 'int_003', provider: 'twilio', name: 'Twilio', status: 'disconnected', connectedAt: null },
  { id: 'int_004', provider: 'hubspot', name: 'HubSpot', status: 'disconnected', connectedAt: null },
  { id: 'int_005', provider: 'salesforce', name: 'Salesforce', status: 'disconnected', connectedAt: null },
];

export const ACTIVITY_SAMPLES = [
  { type: 'call_started', description: 'Incoming call', meta: { from: '+16265551234' } },
  { type: 'call_completed', description: 'Call booked appointment', meta: { outcome: 'booked' } },
  { type: 'appointment_booked', description: 'New appointment — Consultation', meta: { contact: 'Sarah Johnson' } },
  { type: 'appointment_cancelled', description: 'Appointment cancelled', meta: { contact: 'Michael Brown' } },
  { type: 'escalation_created', description: 'Escalated: urgent request', meta: { priority: 'urgent' } },
  { type: 'campaign_lead_connected', description: 'Outbound lead connected', meta: { campaign: 'Inactive Contact Reactivation' } },
];
