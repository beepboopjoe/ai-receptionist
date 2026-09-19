// ============================================================
// Public booking — unauthenticated page + book into the same
// scheduler the voice agent uses (Google if connected, else
// internal appointments). Paid / promo-trial only for live books.
// ============================================================
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { tenants } from '../../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { getTenantDemoFlags } from '../billing/demo-account.js';
import { createContact, identifyCaller, updateContact } from '../crm/crm.service.js';
import { normalizePhone } from '../crm/contact-normalizer.js';
import { findAppointmentType } from '../scheduler/appointment-types.js';
import { bookAppointment, getAvailableSlots } from '../scheduler/scheduler.service.js';
import { getTenantSettingsForBooking } from './public-booking.settings.js';
import {
  BOOKING_NOT_LIVE_VISITOR_MESSAGE,
  formatHoursForPublicPage,
  isEmailFormat,
  isValidBookingSlug,
  publicServices,
  splitCustomerName,
} from './public-booking.helpers.js';

export interface PublicBookingPage {
  slug: string;
  businessName: string;
  timezone: string;
  bookingLive: boolean;
  message: string | null;
  hours: ReturnType<typeof formatHoursForPublicPage>;
  services: ReturnType<typeof publicServices>;
  calendarMode: 'connected' | 'internal';
}

export async function loadTenantBySlug(slug: string) {
  const cleaned = slug.trim().toLowerCase();
  if (!isValidBookingSlug(cleaned)) {
    throw new NotFoundError('Booking page');
  }
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      timezone: tenants.timezone,
    })
    .from(tenants)
    .where(eq(tenants.slug, cleaned))
    .limit(1);
  if (!tenant) throw new NotFoundError('Booking page');
  return tenant;
}

export async function getPublicBookingPage(slug: string): Promise<PublicBookingPage> {
  const tenant = await loadTenantBySlug(slug);
  const demo = await getTenantDemoFlags(tenant.id);
  const settings = await getTenantSettingsForBooking(tenant.id);
  return {
    slug: tenant.slug,
    businessName: tenant.name,
    timezone: tenant.timezone || 'America/New_York',
    bookingLive: !demo.isDemo,
    message: demo.isDemo ? BOOKING_NOT_LIVE_VISITOR_MESSAGE : null,
    hours: formatHoursForPublicPage(settings.officeHours),
    services: publicServices(settings.appointmentTypes),
    calendarMode: settings.calendarConnected ? 'connected' : 'internal',
  };
}

export async function getPublicBookingAvailability(opts: {
  slug: string;
  dateKey: string;
  appointmentType: string;
}) {
  const tenant = await loadTenantBySlug(opts.slug);
  const timezone = tenant.timezone || 'America/New_York';
  const slots = await getAvailableSlots({
    tenantId: tenant.id,
    date: new Date(`${opts.dateKey}T12:00:00`),
    dateKey: opts.dateKey,
    appointmentType: opts.appointmentType,
    timezone,
  });

  return {
    bookingLive: true as const,
    timezone,
    date: opts.dateKey,
    slots: slots.map((s) => ({
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
    })),
  };
}

export async function createPublicBooking(opts: {
  slug: string;
  name: string;
  phone: string;
  email?: string;
  appointmentType: string;
  startAt: string;
  notes?: string;
}) {
  const tenant = await loadTenantBySlug(opts.slug);
  const name = opts.name.trim();
  if (name.length < 2) throw new ValidationError('Enter your name.');

  const phone = normalizePhone(opts.phone);
  if (!phone) throw new ValidationError('Enter a valid phone number, like (555) 123-4567.');

  const emailRaw = opts.email?.trim() ?? '';
  if (emailRaw && !isEmailFormat(emailRaw)) {
    throw new ValidationError('Enter a valid email, or leave it blank.');
  }
  const email = emailRaw || undefined;

  const settings = await getTenantSettingsForBooking(tenant.id);
  const apptType = findAppointmentType(settings.appointmentTypes, opts.appointmentType);
  if (!apptType) throw new ValidationError('Pick a service.');

  const startAt = new Date(opts.startAt);
  if (Number.isNaN(startAt.getTime())) throw new ValidationError('Pick a time.');
  if (startAt.getTime() <= Date.now()) throw new ConflictError('That time is no longer available.');

  const endAt = new Date(startAt.getTime() + apptType.durationMin * 60_000);
  const { firstName, lastName } = splitCustomerName(name);
  let contact = await identifyCaller(phone, tenant.id);
  if (!contact) {
    contact = await createContact(
      {
        firstName,
        lastName,
        phoneE164: phone,
        ...(email ? { email } : {}),
        contactType: 'new',
        source: 'web_booking',
        ...(opts.notes?.trim()
          ? { notes: `Web booking: ${opts.notes.trim().slice(0, 400)}` }
          : {}),
      },
      tenant.id,
    );
  } else if (email && !contact.email) {
    try {
      contact = await updateContact(contact.id, { email }, tenant.id);
    } catch {
      /* keep existing contact */
    }
  }

  const appointment = await bookAppointment({
    tenantId: tenant.id,
    contactId: contact.id,
    appointmentType: apptType.id,
    startAt,
    endAt,
    durationMinutes: apptType.durationMin,
    timezone: tenant.timezone || 'America/New_York',
    ...(email ? { attendeeEmail: email } : {}),
    ...(opts.notes?.trim() ? { notes: opts.notes.trim().slice(0, 400) } : {}),
  });

  return {
    appointmentId: appointment.id,
    businessName: tenant.name,
    appointmentType: apptType.name,
    startsAt:
      appointment.startsAt instanceof Date
        ? appointment.startsAt.toISOString()
        : String(appointment.startsAt),
    endsAt:
      appointment.endsAt instanceof Date
        ? appointment.endsAt.toISOString()
        : String(appointment.endsAt),
    durationMinutes: appointment.durationMinutes,
  };
}
