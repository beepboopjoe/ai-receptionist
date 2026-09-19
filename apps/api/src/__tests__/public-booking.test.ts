// ============================================================
// Public booking page — slot math, type normalization, gates,
// vendor-neutral copy, and wiring into the shared scheduler.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlan } from '@ai-receptionist/shared';
import {
  findAppointmentType,
  normalizeAppointmentType,
  resolveAppointmentTypes,
} from '../modules/scheduler/appointment-types.js';
import {
  filterOpenSlots,
  generateCandidateSlots,
  rangesOverlap,
} from '../modules/scheduler/slot-math.js';
import {
  BOOKING_NOT_LIVE_VISITOR_MESSAGE,
  BOOKING_UPGRADE_MESSAGE,
  assertBookableDateKey,
  formatHoursForPublicPage,
  isValidBookingSlug,
  splitCustomerName,
} from '../modules/public-api/public-booking.helpers.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

describe('slot math', () => {
  it('detects overlapping ranges and leaves a touching edge free', () => {
    const a0 = new Date('2026-09-21T14:00:00Z');
    const a1 = new Date('2026-09-21T15:00:00Z');
    const b0 = new Date('2026-09-21T15:00:00Z');
    const b1 = new Date('2026-09-21T16:00:00Z');
    const c0 = new Date('2026-09-21T14:30:00Z');
    expect(rangesOverlap(a0, a1, b0, b1)).toBe(false);
    expect(rangesOverlap(a0, a1, c0, b1)).toBe(true);
  });

  it('builds 15-minute office-hour slots and hides times that are already past', () => {
    const slots = generateCandidateSlots({
      dateKey: '2026-09-21',
      timezone: 'UTC',
      officeOpen: '09:00',
      officeClose: '11:00',
      durationMinutes: 30,
      bufferMinutes: 0,
      now: new Date('2026-09-21T09:20:00Z'),
    });
    expect(slots[0]?.startAt.toISOString()).toBe('2026-09-21T09:00:00.000Z');
    expect(slots[0]?.available).toBe(false);
    expect(slots.some((s) => s.startAt.toISOString() === '2026-09-21T09:30:00.000Z' && s.available)).toBe(
      true,
    );
    expect(slots.some((s) => s.startAt.toISOString() === '2026-09-21T10:45:00.000Z')).toBe(false);
  });

  it('drops a candidate that overlaps a confirmed appointment including buffer', () => {
    const slots = generateCandidateSlots({
      dateKey: '2026-09-21',
      timezone: 'UTC',
      officeOpen: '09:00',
      officeClose: '12:00',
      durationMinutes: 30,
      now: new Date('2026-09-20T00:00:00Z'),
    });
    const open = filterOpenSlots(
      slots,
      [{ start: new Date('2026-09-21T10:00:00Z'), end: new Date('2026-09-21T10:30:00Z') }],
      15,
    );
    expect(open.some((s) => s.startAt.toISOString() === '2026-09-21T10:00:00.000Z')).toBe(false);
    expect(open.some((s) => s.startAt.toISOString() === '2026-09-21T09:45:00.000Z')).toBe(false);
    expect(open.some((s) => s.startAt.toISOString() === '2026-09-21T09:30:00.000Z')).toBe(false);
    expect(open.some((s) => s.startAt.toISOString() === '2026-09-21T09:15:00.000Z')).toBe(true);
  });
});

describe('appointment types', () => {
  it('accepts duration_min from signup defaults and durationMin from shared types', () => {
    expect(normalizeAppointmentType({ id: 'consult', name: 'Consult', duration_min: 45, buffer_min: 5 })).toEqual({
      id: 'consult',
      name: 'Consult',
      durationMin: 45,
      bufferMin: 5,
    });
    expect(
      findAppointmentType(resolveAppointmentTypes([{ id: 'consult', name: 'Consult', durationMin: 45 }]), 'Consult')
        ?.id,
    ).toBe('consult');
  });

  it('falls back to generic consultation when the tenant has no types', () => {
    const types = resolveAppointmentTypes([]);
    expect(types[0]?.id).toBe('consultation');
  });
});

describe('public booking helpers', () => {
  it('validates slugs and splits names', () => {
    expect(isValidBookingSlug('acme-dental-ab12c')).toBe(true);
    expect(isValidBookingSlug('../etc/passwd')).toBe(false);
    expect(isValidBookingSlug('A')).toBe(false);
    expect(splitCustomerName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(splitCustomerName('Prince')).toEqual({ firstName: 'Prince', lastName: '-' });
  });

  it('reads both office-hours shapes for the public hours list', () => {
    const stream = formatHoursForPublicPage({ mon: { open: '09:00', close: '17:00' } });
    expect(stream.find((d) => d.key === 'mon')).toMatchObject({ closed: false, open: '09:00', close: '17:00' });
    expect(stream.find((d) => d.key === 'sun')?.closed).toBe(true);

    const dashboard = formatHoursForPublicPage({
      monday: { open: true, start: '08:00', end: '16:00' },
      saturday: { open: false, start: '09:00', end: '13:00' },
    });
    expect(dashboard.find((d) => d.key === 'mon')).toMatchObject({ open: '08:00', close: '16:00' });
    expect(dashboard.find((d) => d.key === 'sat')?.closed).toBe(true);
  });

  it('rejects malformed or far-future dates', () => {
    expect(assertBookableDateKey('2026-13-40')).toBeTruthy();
    expect(assertBookableDateKey('2020-01-01', new Date('2026-09-19T12:00:00Z'))).toBeTruthy();
    expect(assertBookableDateKey('2026-09-20', new Date('2026-09-19T12:00:00Z'))).toBeNull();
  });
});

describe('catalog prices stay at Growth / Scale / Business', () => {
  it('does not introduce a $29 FAQ clone tier', () => {
    expect(getPlan('growth')!.monthlyPrice).toBe(199);
    expect(getPlan('scale')!.monthlyPrice).toBe(399);
    expect(getPlan('business')!.monthlyPrice).toBe(599);
    expect(getPlan('starter')).toBeUndefined();
  });
});

describe('public booking wiring (source)', () => {
  it('registers the unauthenticated plugin under /api/v1 and is not wrapped in fastify-plugin', () => {
    const main = readFileSync(join(srcRoot, 'main.ts'), 'utf8');
    expect(main).toContain('publicBookingPlugin');
    expect(main).toContain("await app.register(publicBookingPlugin, { prefix: '/api/v1' })");

    const router = readFileSync(join(srcRoot, 'modules/public-api/public-booking.router.ts'), 'utf8');
    expect(router).not.toMatch(/export const \w+Plugin = fp\(/);
    expect(router).toContain("'/public/booking/:slug'");
    expect(router).toContain("'/public/booking/:slug/availability'");
    expect(router).toContain('getTenantDemoFlags');
    expect(router).toContain("error: 'upgrade_required'");
    expect(router).toContain('createPublicBooking');
    expect(router).toContain('getPublicBookingPage');
  });

  it('books through the shared scheduler and falls back to the internal calendar', () => {
    const service = readFileSync(join(srcRoot, 'modules/public-api/public-booking.service.ts'), 'utf8');
    expect(service).toContain('bookAppointment');
    expect(service).toContain('getAvailableSlots');
    expect(service).toContain("source: 'web_booking'");
    expect(service).toContain('identifyCaller');

    const scheduler = readFileSync(join(srcRoot, 'modules/scheduler/scheduler.service.ts'), 'utf8');
    expect(scheduler).toContain('InternalCalendarAdapter');
    expect(scheduler).toContain('findOverlappingAppointment');
    expect(scheduler).toContain('listConfirmedBusyRanges');
    expect(scheduler).toContain("throw new ConflictError('That time is no longer available.')");

    const adapter = readFileSync(
      join(srcRoot, 'modules/scheduler/adapters/internal.adapter.ts'),
      'utf8',
    );
    expect(adapter).toContain("readonly provider = 'internal'");
    expect(adapter).toContain('listConfirmedBusyRanges');
  });

  it('keeps visitor copy free of Grok / Telnyx / xAI and upgrade prices on the public page', () => {
    const page = readFileSync(join(dashboardRoot, 'app/book/[slug]/page.tsx'), 'utf8');
    expect(page).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
    expect(page).not.toMatch(/\$29/);
    expect(page).toContain('Booking is not live');
    expect(page).toContain('publicBookingApi');

    const card = readFileSync(
      join(dashboardRoot, 'components/settings/share-booking-page-card.tsx'),
      'utf8',
    );
    expect(card).toContain('Share your booking page');
    expect(card).toContain('Growth $199 / Scale $399 / Business $599');
    expect(card).toContain("reason=\"public_booking\"");
    expect(card).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);

    expect(BOOKING_UPGRADE_MESSAGE).toMatch(/Free plan/);
    expect(BOOKING_NOT_LIVE_VISITOR_MESSAGE).toMatch(/call the business/);
  });

  it('surfaces the share card from setup and settings, and skips the 401 interceptor on /book', () => {
    const setup = readFileSync(join(dashboardRoot, 'app/(app)/setup/page.tsx'), 'utf8');
    const hours = readFileSync(join(dashboardRoot, 'app/(app)/settings/office-hours/page.tsx'), 'utf8');
    const appts = readFileSync(join(dashboardRoot, 'app/(app)/appointments/page.tsx'), 'utf8');
    const integrations = readFileSync(
      join(dashboardRoot, 'app/(app)/settings/integrations/page.tsx'),
      'utf8',
    );
    expect(setup).toContain('ShareBookingPageCard');
    expect(hours).toContain('ShareBookingPageCard');
    expect(appts).toContain('ShareBookingPageCard');
    expect(integrations).toContain('ShareBookingPageCard');

    const api = readFileSync(join(dashboardRoot, 'lib/api.ts'), 'utf8');
    expect(api).toContain("path.startsWith('/book/')");
    expect(api).toContain('publicBookingApi');
    expect(api).toContain('/public/booking/');
  });
});
