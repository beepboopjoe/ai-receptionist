// ============================================================
// Public booking router — unauthenticated /api/v1/public/booking/:slug
//
// GET    /public/booking/:slug                 page branding + services
// GET    /public/booking/:slug/availability    slots for a date + service
// POST   /public/booking/:slug                 book (paid / promo-trial)
//
// Free / demo tenants can view the page (bookingLive: false).
// Live writes reuse bookAppointment() so they share the voice calendar.
// Do not wrap this plugin in fastify-plugin — /api/v1 prefix must stick.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { getTenantDemoFlags } from '../billing/demo-account.js';
import {
  createPublicBooking,
  getPublicBookingAvailability,
  getPublicBookingPage,
  loadTenantBySlug,
} from './public-booking.service.js';
import {
  BOOKING_UPGRADE_MESSAGE,
  assertBookableDateKey,
} from './public-booking.helpers.js';
import { ValidationError } from '../../lib/errors.js';

export async function publicBookingPlugin(app: FastifyInstance): Promise<void> {
  app.get(
    '/public/booking/:slug',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Public booking'],
        summary: 'Public booking page for a tenant slug',
        params: {
          type: 'object',
          required: ['slug'],
          properties: { slug: { type: 'string', minLength: 2, maxLength: 80 } },
        },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      return getPublicBookingPage(slug);
    },
  );

  app.get(
    '/public/booking/:slug/availability',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Public booking'],
        summary: 'Available times for a service on a date',
        params: {
          type: 'object',
          required: ['slug'],
          properties: { slug: { type: 'string', minLength: 2, maxLength: 80 } },
        },
        querystring: {
          type: 'object',
          required: ['date', 'appointmentType'],
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' },
            appointmentType: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const query = request.query as { date?: string; appointmentType?: string };
      const dateKey = String(query.date ?? '').trim();
      const appointmentType = String(query.appointmentType ?? '').trim();
      if (!appointmentType) throw new ValidationError('appointmentType is required');
      const dateError = assertBookableDateKey(dateKey);
      if (dateError) throw new ValidationError(dateError);

      const tenant = await loadTenantBySlug(slug);
      const demo = await getTenantDemoFlags(tenant.id);
      if (demo.isDemo) {
        return reply.send({
          bookingLive: false,
          timezone: tenant.timezone,
          date: dateKey,
          slots: [],
        });
      }

      return getPublicBookingAvailability({ slug, dateKey, appointmentType });
    },
  );

  app.post(
    '/public/booking/:slug',
    {
      config: { rateLimit: { max: 8, timeWindow: '1 hour' } },
      schema: {
        tags: ['Public booking'],
        summary: 'Book an appointment from the public page',
        params: {
          type: 'object',
          required: ['slug'],
          properties: { slug: { type: 'string', minLength: 2, maxLength: 80 } },
        },
        body: {
          type: 'object',
          required: ['name', 'phone', 'appointmentType', 'startAt'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 120 },
            phone: { type: 'string', minLength: 7, maxLength: 32 },
            email: { type: 'string', maxLength: 200 },
            appointmentType: { type: 'string', minLength: 1, maxLength: 80 },
            startAt: { type: 'string' },
            notes: { type: 'string', maxLength: 400 },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await loadTenantBySlug(slug);
      const demo = await getTenantDemoFlags(tenant.id);
      if (demo.isDemo) {
        return reply.status(402).send({
          error: 'upgrade_required',
          message: BOOKING_UPGRADE_MESSAGE,
        });
      }

      const body = (request.body ?? {}) as {
        name?: string;
        phone?: string;
        email?: string;
        appointmentType?: string;
        startAt?: string;
        notes?: string;
      };

      const booked = await createPublicBooking({
        slug,
        name: String(body.name ?? ''),
        phone: String(body.phone ?? ''),
        appointmentType: String(body.appointmentType ?? ''),
        startAt: String(body.startAt ?? ''),
        ...(body.email ? { email: body.email } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      });

      return reply.status(201).send(booked);
    },
  );
}
