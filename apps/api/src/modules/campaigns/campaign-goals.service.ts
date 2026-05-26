// ============================================================
// Campaign Goals — curated, vertical-aware campaign templates.
//
// Each entry in GOAL_CATALOG defines a "one-click campaign" that:
//   1. Surfaces in the dashboard gallery when it has candidates
//   2. Builds its own contact list via SQL against the tenant's data
//   3. Pre-fills campaign config (name, dial window, voicemail)
//   4. Optionally overrides the outbound script's opening pitch
//
// Design notes:
//   • SQL filters are intentionally simple — one query per goal.
//     A goal that needs schema we don't have today is omitted from
//     V1 with a `// TODO: requires <field>` comment.
//   • Candidate count is computed on demand. We cache the SUGGESTIONS
//     response per-tenant for 5 minutes (see campaign.router.ts) so
//     repeated dashboard renders don't hammer the DB.
//   • findCandidates returns up to 500 candidates per goal — enough
//     for any realistic SMB tenant; bigger lists should be paginated
//     via a future "filter campaign" flow, not bulk one-click.
// ============================================================
import { db } from '../../db/client.js';
import { contacts, appointments, calls, campaignContacts } from '../../db/schema.js';
import { and, eq, gt, gte, lt, lte, sql, isNull, notInArray, ilike, inArray } from 'drizzle-orm';
import type { Vertical } from '../voice-agent/prompt-builder.js';

export interface CandidateContact {
  contactId: string;
  phoneE164: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

export interface GoalDefinition {
  slug: string;
  vertical: Vertical;
  title: string;
  description: string;
  defaultName: (date: Date) => string;
  defaultDialWindow: { start: string; end: string };
  defaultVoicemail: string;
  /** Build the candidate contact list for this tenant. Pure SQL — no LLM. */
  findCandidates: (tenantId: string) => Promise<CandidateContact[]>;
  /** Optional opening-line override for outbound-qualification.prompt.ts. */
  pitchOverride?: string;
}

const HARD_CAP_PER_GOAL = 500;
const dialDay = { start: '09:00', end: '17:00' };

// ---- Reusable SQL building blocks -------------------------------------------

/** Contacts that have NEVER had an appointment. */
function contactsWithoutAppointment(tenantId: string) {
  const sub = db
    .select({ contactId: appointments.contactId })
    .from(appointments)
    .where(eq(appointments.tenantId, tenantId));
  return db
    .select({
      contactId: contacts.id,
      phoneE164: contacts.phoneE164,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        notInArray(contacts.id, sub)
      )
    );
}

/** Contacts whose last appointment was older than `monthsAgo`. */
function contactsWithStaleAppointment(tenantId: string, monthsAgo: number) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsAgo);
  // Latest appointment per contact, filtered to those whose max(startsAt) < cutoff.
  const lastAppt = db
    .select({
      contactId: appointments.contactId,
      lastAppt: sql<Date>`MAX(${appointments.startsAt})`.as('last_appt'),
    })
    .from(appointments)
    .where(eq(appointments.tenantId, tenantId))
    .groupBy(appointments.contactId)
    .having(sql`MAX(${appointments.startsAt}) < ${cutoff.toISOString()}`)
    .as('last_appt');
  return db
    .select({
      contactId: contacts.id,
      phoneE164: contacts.phoneE164,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
    })
    .from(contacts)
    .innerJoin(lastAppt, eq(lastAppt.contactId, contacts.id))
    .where(eq(contacts.tenantId, tenantId));
}

// ---- Goal helpers -----------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nameForDate(prefix: string) {
  return (d: Date) => `${prefix} · ${isoDate(d)}`;
}

// ---- Goal catalog -----------------------------------------------------------

export const GOAL_CATALOG: GoalDefinition[] = [
  // ── DENTAL ────────────────────────────────────────────────────────────────
  {
    slug: 'dental_recall',
    vertical: 'dental',
    title: 'Patient recall',
    description:
      'Reach out to patients whose recall is due in the next 30 days. Confirm interest and book the cleaning.',
    defaultName: nameForDate('Recall'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, this is your dental practice — just a friendly reminder it's time to schedule your next cleaning. Please call us back when you can. Thank you!",
    pitchOverride:
      "I'm calling because it looks like you're due for your next cleaning soon and I wanted to help get something on the calendar.",
    findCandidates: async (tenantId) => {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      const rows = await db
        .select({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            lte(contacts.recallDueDate, isoDate(horizon))
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'dental_no_show_recovery',
    vertical: 'dental',
    title: 'No-show recovery',
    description:
      'Patients marked no-show in the last 30 days. Offer to reschedule before the relationship cools off.',
    defaultName: nameForDate('No-show recovery'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, we missed you at your recent appointment and wanted to check in. Please call us back so we can find a new time that works for you.",
    pitchOverride:
      "I'm following up because we missed you at your recent appointment and we'd love to get a new time on the books.",
    findCandidates: async (tenantId) => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const rows = await db
        .selectDistinct({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(appointments)
        .innerJoin(contacts, eq(appointments.contactId, contacts.id))
        .where(
          and(
            eq(appointments.tenantId, tenantId),
            eq(appointments.status, 'no_show'),
            gte(appointments.startsAt, since)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'dental_inactive_reactivation',
    vertical: 'dental',
    title: 'Inactive patient reactivation',
    description:
      "Patients who haven't been in for 12+ months. Re-engage before they drift to another practice.",
    defaultName: nameForDate('Reactivation'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, it's been a while since we've seen you at the practice. We'd love to get you back on the schedule. Please give us a call.",
    pitchOverride:
      "I noticed it's been over a year since your last visit — wanted to check in and see if we can get you back on the schedule.",
    findCandidates: async (tenantId) => {
      const rows = await contactsWithStaleAppointment(tenantId, 12).limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },

  // ── INSURANCE ─────────────────────────────────────────────────────────────
  // NOTE: insurance_renewal omitted from V1 — requires a policy_renewal_at
  // field on contacts that doesn't exist yet.
  {
    slug: 'insurance_quote_follow_up',
    vertical: 'insurance',
    title: 'Quote follow-up',
    description:
      "Contacts who requested a quote in the last 14 days but haven't booked a consultation yet.",
    defaultName: nameForDate('Quote follow-up'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, just following up on the quote we discussed recently. Give us a call back so we can answer any questions and finalize coverage.",
    pitchOverride:
      "I'm following up on the quote we put together for you — wanted to see if you had any questions or wanted to move forward.",
    findCandidates: async (tenantId) => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const sub = db
        .select({ contactId: appointments.contactId })
        .from(appointments)
        .where(eq(appointments.tenantId, tenantId));
      const rows = await db
        .select({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            gte(contacts.createdAt, since),
            notInArray(contacts.id, sub)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'insurance_lapsed',
    vertical: 'insurance',
    title: 'Lapsed contact outreach',
    description:
      "Past clients with no activity in 12+ months. Check on their coverage and offer a review.",
    defaultName: nameForDate('Lapsed outreach'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, just checking in to see how your coverage is working out and whether there's anything we can help with. Please call us back.",
    pitchOverride:
      "I'm reaching out because it's been a while since we last connected — wanted to see how your coverage is holding up.",
    findCandidates: async (tenantId) => {
      const rows = await contactsWithStaleAppointment(tenantId, 12).limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },

  // ── LEGAL ─────────────────────────────────────────────────────────────────
  {
    slug: 'legal_stale_intake',
    vertical: 'legal',
    title: 'Stale intake',
    description:
      "Contacts who reached out in the last 7-30 days but never booked a consultation. Re-engage before the matter goes cold.",
    defaultName: nameForDate('Stale intake'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, we wanted to follow up on the matter you reached out about. Please give us a call back so we can set up a free consultation.",
    pitchOverride:
      "I'm following up on the matter you reached out about — wanted to make sure we get you set up with a consultation if you'd still like one.",
    findCandidates: async (tenantId) => {
      const lower = new Date();
      lower.setDate(lower.getDate() - 30);
      const upper = new Date();
      upper.setDate(upper.getDate() - 7);
      const sub = db
        .select({ contactId: appointments.contactId })
        .from(appointments)
        .where(eq(appointments.tenantId, tenantId));
      const rows = await db
        .select({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            gte(contacts.createdAt, lower),
            lte(contacts.createdAt, upper),
            notInArray(contacts.id, sub)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'legal_past_client_checkin',
    vertical: 'legal',
    title: 'Past client check-in',
    description:
      "Clients whose case closed 12+ months ago. Friendly check-in keeps you top of mind for referrals and new matters.",
    defaultName: nameForDate('Past client check-in'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, just a quick check-in from the firm. Wanted to make sure everything's been going well since we last spoke. Call us back if anything has come up.",
    pitchOverride:
      "I'm calling for a quick check-in to make sure everything's been going well since we wrapped up your matter.",
    findCandidates: async (tenantId) => {
      const rows = await contactsWithStaleAppointment(tenantId, 12).limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },

  // ── REAL ESTATE ───────────────────────────────────────────────────────────
  {
    slug: 'realestate_buyer_followup',
    vertical: 'real_estate',
    title: 'Buyer follow-up',
    description:
      "Buyer leads with no activity in the last 14-60 days. Re-engage before they list with another agent.",
    defaultName: nameForDate('Buyer follow-up'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, just checking in on your home search. New listings hit the market every day — give me a call when you can.",
    pitchOverride:
      "I'm checking in on your home search — wanted to see if you're still actively looking and whether any new listings caught your eye.",
    findCandidates: async (tenantId) => {
      const lower = new Date();
      lower.setDate(lower.getDate() - 60);
      const upper = new Date();
      upper.setDate(upper.getDate() - 14);
      const sub = db
        .select({ contactId: appointments.contactId })
        .from(appointments)
        .where(eq(appointments.tenantId, tenantId));
      const rows = await db
        .select({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            gte(contacts.createdAt, lower),
            lte(contacts.createdAt, upper),
            notInArray(contacts.id, sub)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'realestate_open_house_rsvp',
    vertical: 'real_estate',
    title: 'Open house RSVPs',
    description:
      "Appointments tagged 'open house' in the next 48 hours. Confirm RSVPs ahead of the day.",
    defaultName: nameForDate('Open house confirmations'),
    defaultDialWindow: { start: '10:00', end: '19:00' },
    defaultVoicemail:
      "Hi, just confirming you're still planning to stop by the open house. Call us back if you have any questions about the property.",
    pitchOverride:
      "I'm calling to confirm you're still planning to come by the open house — would love to make sure you have all the details.",
    findCandidates: async (tenantId) => {
      const now = new Date();
      const horizon = new Date();
      horizon.setHours(horizon.getHours() + 48);
      const rows = await db
        .selectDistinct({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(appointments)
        .innerJoin(contacts, eq(appointments.contactId, contacts.id))
        .where(
          and(
            eq(appointments.tenantId, tenantId),
            gte(appointments.startsAt, now),
            lte(appointments.startsAt, horizon),
            ilike(appointments.appointmentType, '%open house%')
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'realestate_anniversary',
    vertical: 'real_estate',
    title: '1-year anniversary check-in',
    description:
      "Past clients whose closing was ~12 months ago. Anniversary touch keeps you top of mind for referrals.",
    defaultName: nameForDate('Anniversary check-in'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, it's been about a year since we wrapped up your purchase — wanted to check in on how the home's been treating you.",
    pitchOverride:
      "I noticed it's been about a year since we wrapped up your closing — just calling to see how the home's been treating you.",
    findCandidates: async (tenantId) => {
      const lower = new Date();
      lower.setDate(lower.getDate() - 380);
      const upper = new Date();
      upper.setDate(upper.getDate() - 350);
      const rows = await db
        .selectDistinct({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(appointments)
        .innerJoin(contacts, eq(appointments.contactId, contacts.id))
        .where(
          and(
            eq(appointments.tenantId, tenantId),
            gte(appointments.startsAt, lower),
            lte(appointments.startsAt, upper)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },

  // ── HOME SERVICES ─────────────────────────────────────────────────────────
  {
    slug: 'home_seasonal_maintenance',
    vertical: 'home_services',
    title: 'Seasonal maintenance',
    description:
      "Past customers due for a maintenance call (6+ months since last service). Schedule before equipment fails.",
    defaultName: nameForDate('Maintenance reminder'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, this is a reminder that it's time for your seasonal maintenance check. Call us back to book a convenient slot.",
    pitchOverride:
      "I'm calling because you're due for your next seasonal maintenance visit — wanted to help get a time on the calendar.",
    findCandidates: async (tenantId) => {
      const rows = await contactsWithStaleAppointment(tenantId, 6).limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'home_quote_followup',
    vertical: 'home_services',
    title: 'Quote follow-up',
    description:
      "Customers who got a quote in the last 14 days but haven't scheduled the work yet.",
    defaultName: nameForDate('Quote follow-up'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, just following up on the quote we sent over. Give us a call back so we can answer any questions and get the work scheduled.",
    pitchOverride:
      "I'm following up on the quote we sent over — wanted to see if you had questions or are ready to get the work on the schedule.",
    findCandidates: async (tenantId) => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const sub = db
        .select({ contactId: appointments.contactId })
        .from(appointments)
        .where(eq(appointments.tenantId, tenantId));
      const rows = await db
        .select({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            gte(contacts.createdAt, since),
            notInArray(contacts.id, sub)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'home_review_request',
    vertical: 'home_services',
    title: 'Review request',
    description:
      "Customers whose service was completed in the last 14 days. Ask for a review while the experience is fresh.",
    defaultName: nameForDate('Review request'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, thanks again for letting us handle your recent service. We'd love a quick review if you have a moment — call us back when you can.",
    pitchOverride:
      "I'm following up on the service we just wrapped — would love your feedback on how it went and whether we can do anything else for you.",
    findCandidates: async (tenantId) => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const rows = await db
        .selectDistinct({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(appointments)
        .innerJoin(contacts, eq(appointments.contactId, contacts.id))
        .where(
          and(
            eq(appointments.tenantId, tenantId),
            eq(appointments.status, 'completed'),
            gte(appointments.startsAt, since)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },

  // ── GENERIC ───────────────────────────────────────────────────────────────
  {
    slug: 'generic_stale_lead',
    vertical: 'generic',
    title: 'Stale lead follow-up',
    description:
      "Leads created in the last 14-60 days who never booked. Re-engage before they go cold.",
    defaultName: nameForDate('Stale lead'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, just checking in on the inquiry you sent over recently. Give us a call back when it's convenient.",
    findCandidates: async (tenantId) => {
      const lower = new Date();
      lower.setDate(lower.getDate() - 60);
      const upper = new Date();
      upper.setDate(upper.getDate() - 14);
      const sub = db
        .select({ contactId: appointments.contactId })
        .from(appointments)
        .where(eq(appointments.tenantId, tenantId));
      const rows = await db
        .select({
          contactId: contacts.id,
          phoneE164: contacts.phoneE164,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            gte(contacts.createdAt, lower),
            lte(contacts.createdAt, upper),
            notInArray(contacts.id, sub)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
  {
    slug: 'generic_missed_call_callback',
    vertical: 'generic',
    title: 'Missed call callbacks (last 7 days)',
    description:
      "Callers from the last 7 days whose calls didn't reach a human. Call them back before they call a competitor.",
    defaultName: nameForDate('Missed call callbacks'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, we noticed you tried to reach us recently and we missed the call. Please call us back when you have a moment.",
    pitchOverride:
      "I'm following up because you tried to reach us recently and we missed the call — wanted to make sure we connect.",
    findCandidates: async (tenantId) => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      // Deduplicated by phone — group by from_number. We pull a single
      // representative row per number, using contact info if linked.
      const rows = await db
        .selectDistinct({
          contactId: sql<string>`COALESCE(${calls.contactId}::text, '')`.as('contact_id'),
          phoneE164: calls.fromNumber,
          firstName: sql<string>`COALESCE(${contacts.firstName}, 'Unknown')`.as('first_name'),
          lastName: sql<string>`COALESCE(${contacts.lastName}, '')`.as('last_name'),
          email: contacts.email,
        })
        .from(calls)
        .leftJoin(contacts, eq(calls.contactId, contacts.id))
        .where(
          and(
            eq(calls.tenantId, tenantId),
            eq(calls.status, 'missed'),
            gte(calls.startedAt, since)
          )
        )
        .limit(HARD_CAP_PER_GOAL);
      // contactId may be empty string when the call wasn't linked to a contact;
      // the from-goal endpoint will create campaign_contacts with null contactId.
      return rows.map((r) => ({
        ...r,
        contactId: r.contactId || '',
      }));
    },
  },
  {
    slug: 'generic_inactive_reactivation',
    vertical: 'generic',
    title: 'Inactive contact reactivation',
    description:
      "Contacts with no activity in the last 6+ months. Re-engage before they forget about you entirely.",
    defaultName: nameForDate('Reactivation'),
    defaultDialWindow: dialDay,
    defaultVoicemail:
      "Hi, just checking in — we'd love to reconnect when you have a moment. Give us a call back.",
    pitchOverride:
      "I'm reaching out because it's been a while since we last connected — wanted to check in and see if there's anything we can help with.",
    findCandidates: async (tenantId) => {
      const rows = await contactsWithStaleAppointment(tenantId, 6).limit(HARD_CAP_PER_GOAL);
      return rows;
    },
  },
];

/** Goals for a given tenant's vertical, plus the always-available generic ones. */
export function goalsForVertical(vertical: Vertical): GoalDefinition[] {
  return GOAL_CATALOG.filter(
    (g) => g.vertical === vertical || g.vertical === 'generic'
  );
}

export function findGoal(slug: string): GoalDefinition | undefined {
  return GOAL_CATALOG.find((g) => g.slug === slug);
}
