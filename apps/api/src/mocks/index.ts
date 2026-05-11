// ============================================================
// Mock Fastify plugin — registers all dev-mode API routes with
// in-memory fixtures. Mounted under /api/v1 in dev-server.ts.
//
// Shapes mirror the real API exactly so the dashboard works
// unchanged (see apps/dashboard/src/lib/api.ts).
// ============================================================
import type { FastifyPluginAsync } from 'fastify';
import {
  MOCK_TENANT,
  MOCK_USER,
  MOCK_BILLING,
  MOCK_CONTACTS,
  MOCK_CALLS,
  MOCK_MISSED_CALLS,
  MOCK_APPOINTMENTS,
  MOCK_ESCALATIONS,
  MOCK_NOTIFICATIONS,
  MOCK_CAMPAIGNS,
  MOCK_INTEGRATIONS,
  ACTIVITY_SAMPLES,
} from './fixtures.js';

const FAKE_TOKEN = 'mock.jwt.token.' + Math.random().toString(36).slice(2);
const FAKE_REFRESH = 'mock.refresh.' + Math.random().toString(36).slice(2);

function issueTokens() {
  return {
    token: FAKE_TOKEN,
    refreshToken: FAKE_REFRESH,
    user: MOCK_USER,
    tenant: MOCK_TENANT,
  };
}

export const mocksPlugin: FastifyPluginAsync = async (app) => {
  // ── Auth ──────────────────────────────────────────────────
  app.post('/auth/login', async () => issueTokens());
  app.post('/auth/register', async () => issueTokens());
  app.post('/auth/refresh', async () => ({ token: FAKE_TOKEN, refreshToken: FAKE_REFRESH }));
  app.post('/auth/logout', async () => ({ ok: true }));
  app.post('/auth/forgot-password', async () => ({ ok: true }));
  app.post('/auth/reset-password', async () => ({ ok: true }));
  app.get('/auth/me', async () => ({ user: MOCK_USER, tenant: MOCK_TENANT }));

  // ── Billing ───────────────────────────────────────────────
  app.get('/billing', async () => MOCK_BILLING);
  app.get('/billing/usage', async () => ({
    minutesUsed: MOCK_BILLING.minutesUsed,
    minutesIncluded: MOCK_BILLING.minutesIncluded,
    usagePercent: MOCK_BILLING.usagePercent,
  }));

  // ── Calls ─────────────────────────────────────────────────
  app.get('/calls', async () => ({ data: MOCK_CALLS, total: MOCK_CALLS.length }));
  app.get<{ Params: { id: string } }>('/calls/:id', async (req, reply) => {
    const c = MOCK_CALLS.find(x => x.id === req.params.id);
    if (!c) return reply.code(404).send({ error: 'Not found' });
    return c;
  });
  app.get('/calls/missed', async () => ({ data: MOCK_MISSED_CALLS }));

  // ── Missed calls (separate endpoint) ──────────────────────
  app.get('/missed-calls', async () => ({ data: MOCK_MISSED_CALLS }));

  // ── Appointments ──────────────────────────────────────────
  app.get('/appointments', async () => ({ data: MOCK_APPOINTMENTS }));
  app.get<{ Params: { id: string } }>('/appointments/:id', async (req, reply) => {
    const a = MOCK_APPOINTMENTS.find(x => x.id === req.params.id);
    if (!a) return reply.code(404).send({ error: 'Not found' });
    return a;
  });

  // ── Contacts ──────────────────────────────────────────────
  app.get('/contacts', async () => ({ data: MOCK_CONTACTS, total: MOCK_CONTACTS.length }));
  app.get<{ Params: { id: string } }>('/contacts/:id', async (req, reply) => {
    const c = MOCK_CONTACTS.find(x => x.id === req.params.id);
    if (!c) return reply.code(404).send({ error: 'Not found' });
    return c;
  });

  // ── Escalations ───────────────────────────────────────────
  app.get('/escalations', async () => ({ data: MOCK_ESCALATIONS }));

  // ── Notifications / Reminders ─────────────────────────────
  app.get('/notifications', async () => ({ data: MOCK_NOTIFICATIONS }));
  app.get('/reminders', async () => ({ data: MOCK_NOTIFICATIONS }));

  // ── Campaigns ─────────────────────────────────────────────
  app.get<{ Querystring: { status?: string } }>('/campaigns', async (req) => {
    const status = req.query.status;
    const data = status ? MOCK_CAMPAIGNS.filter(c => c.status === status) : MOCK_CAMPAIGNS;
    return { data };
  });
  app.get<{ Params: { id: string } }>('/campaigns/:id', async (req, reply) => {
    const c = MOCK_CAMPAIGNS.find(x => x.id === req.params.id);
    if (!c) return reply.code(404).send({ error: 'Not found' });
    return c;
  });
  app.post('/campaigns', async (req) => ({
    id: 'cmp_' + Math.random().toString(36).slice(2, 8),
    ...((req.body as object) ?? {}),
    status: 'draft',
    totalLeads: 0, contacted: 0, connected: 0, booked: 0, failed: 0,
    progressPercent: 0, bookingRate: 0,
    createdAt: new Date().toISOString(),
  }));

  // ── Integrations ──────────────────────────────────────────
  app.get('/integrations', async () => ({ data: MOCK_INTEGRATIONS }));

  // ── Dashboard stats (summary) ─────────────────────────────
  app.get('/dashboard/stats', async () => ({
    totalCalls: MOCK_CALLS.length,
    upcomingAppointments: MOCK_APPOINTMENTS.length,
    openEscalations: MOCK_ESCALATIONS.filter(e => e.status === 'open').length,
    missedCalls: MOCK_MISSED_CALLS.length,
    activeCampaigns: MOCK_CAMPAIGNS.filter(c => c.status === 'running').length,
  }));

  // ── Activity WebSocket ────────────────────────────────────
  app.get('/ws/activity', { websocket: true }, (socket /*, req */) => {
    // Send a recent backlog first
    ACTIVITY_SAMPLES.slice(0, 3).forEach((sample, i) => {
      socket.send(JSON.stringify({
        id: `evt_${Date.now()}_${i}`,
        ...sample,
        createdAt: new Date(Date.now() - (3 - i) * 60_000).toISOString(),
      }));
    });

    // Then stream new events every 8s
    const iv = setInterval(() => {
      const sample = ACTIVITY_SAMPLES[Math.floor(Math.random() * ACTIVITY_SAMPLES.length)]!;
      socket.send(JSON.stringify({
        id: `evt_${Date.now()}`,
        ...sample,
        createdAt: new Date().toISOString(),
      }));
    }, 8000);

    socket.on('close', () => clearInterval(iv));
  });
};
