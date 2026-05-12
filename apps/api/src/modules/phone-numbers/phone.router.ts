// ============================================================
// Tenant phone-number routes — JWT-gated, owner/admin only for
// write actions. Search is admin+, list is staff+.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../lib/errors.js';
import {
  listTenantNumbers,
  searchNumbers,
  purchaseTenantNumber,
  releaseTenantNumber,
} from './phone.service.js';
import {
  createPortRequest,
  listTenantPortRequests,
  cancelPortRequest,
  type PortRequestInput,
} from './port.service.js';
import { config } from '../../config.js';

export async function phoneNumbersPlugin(app: FastifyInstance): Promise<void> {
  // ── List ──────────────────────────────────────────────────
  app.get('/phone-numbers', { onRequest: [app.requireRole('staff')] }, async (request, reply) => {
    const numbers = await listTenantNumbers(request.user!.tenantId);
    return reply.send({ data: numbers });
  });

  // ── Search Telnyx ─────────────────────────────────────────
  app.post('/phone-numbers/search', { onRequest: [app.requireRole('admin')] }, async (request, reply) => {
    if (!config.TELNYX_API_KEY) {
      return reply.code(503).send({
        error: 'Telnyx not configured',
        message: 'TELNYX_API_KEY is not set on the API.',
      });
    }
    const body = (request.body ?? {}) as {
      areaCode?: string;
      locality?: string;
      type?: 'local' | 'toll_free';
    };
    if (body.areaCode && !/^\d{3}$/.test(body.areaCode)) {
      throw new ValidationError('areaCode must be 3 digits (e.g. "415")');
    }
    if (body.type && body.type !== 'local' && body.type !== 'toll_free') {
      throw new ValidationError('type must be "local" or "toll_free"');
    }
    const results = await searchNumbers(body);
    return reply.send({ data: results });
  });

  // ── Purchase ──────────────────────────────────────────────
  app.post('/phone-numbers/purchase', { onRequest: [app.requireRole('admin')] }, async (request, reply) => {
    const { phoneE164, numberType } = (request.body ?? {}) as {
      phoneE164?: string;
      numberType?: 'local' | 'toll_free';
    };
    if (!phoneE164 || !/^\+\d{8,15}$/.test(phoneE164)) {
      throw new ValidationError('phoneE164 must be E.164 (e.g. "+14155551234")');
    }
    if (numberType && numberType !== 'local' && numberType !== 'toll_free') {
      throw new ValidationError('numberType must be "local" or "toll_free"');
    }
    const result = await purchaseTenantNumber({
      tenantId: request.user!.tenantId,
      phoneE164,
      numberType,
    });
    return reply.code(201).send(result);
  });

  // ── Release ───────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/phone-numbers/:id',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      await releaseTenantNumber({
        tenantId: request.user!.tenantId,
        numberId: request.params.id,
      });
      return reply.code(204).send();
    }
  );

  // ── Number porting (LOA form submission) ──────────────────
  // Customer fills the form in /settings/phone-numbers; we capture
  // it here. An operator then submits to Telnyx separately and
  // updates the status. Auto-submission is a V2 nicety.
  app.post('/phone-numbers/port', { onRequest: [app.requireRole('admin')] }, async (request, reply) => {
    const body = (request.body ?? {}) as PortRequestInput;
    const created = await createPortRequest({
      tenantId: request.user!.tenantId,
      input: body,
    });
    return reply.code(201).send(created);
  });

  app.get('/phone-numbers/port-requests', { onRequest: [app.requireRole('staff')] }, async (request, reply) => {
    const requests = await listTenantPortRequests(request.user!.tenantId);
    return reply.send({ data: requests });
  });

  app.delete<{ Params: { id: string } }>(
    '/phone-numbers/port-requests/:id',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      await cancelPortRequest({
        tenantId: request.user!.tenantId,
        portRequestId: request.params.id,
      });
      return reply.code(204).send();
    }
  );
}
