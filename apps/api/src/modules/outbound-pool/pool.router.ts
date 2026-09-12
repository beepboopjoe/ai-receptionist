// ============================================================
// Outbound pool router — list + lean v1 health actions.
// Provision/rotate/scale stay platform-managed. Tenants can
// re-enable a CLI that health signals pulled out of rotation.
// Free / demo accounts may list (empty) but cannot mutate (#43).
//
// NOTE: plain (encapsulated) plugin so the `/api/v1` prefix in
// main.ts applies. fastify-plugin (fp) de-encapsulates and drops
// the prefix → routes 404.
// ============================================================
import type { FastifyInstance } from 'fastify';
import {
  listOutboundPoolNumbers,
  reenablePoolNumber,
  retryOutboundPool,
} from './pool.service.js';
import { getTenantDemoFlags, UPGRADE_TO_GO_LIVE_MESSAGE } from '../billing/demo-account.js';

export async function outboundPoolPlugin(app: FastifyInstance): Promise<void> {
  app.get(
    '/outbound-pool/numbers',
    { onRequest: [app.requireRole('staff')] },
    async (request) => {
      const { tenantId } = request.authUser;
      const data = await listOutboundPoolNumbers(tenantId);
      return { data };
    }
  );

  app.post(
    '/outbound-pool/retry',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const demo = await getTenantDemoFlags(tenantId);
      if (demo.isDemo) {
        return reply.status(402).send({
          error: 'upgrade_required',
          message: UPGRADE_TO_GO_LIVE_MESSAGE,
        });
      }
      const data = await retryOutboundPool(tenantId);
      return { data };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/outbound-pool/numbers/:id/reenable',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const demo = await getTenantDemoFlags(tenantId);
      if (demo.isDemo) {
        return reply.status(402).send({
          error: 'upgrade_required',
          message: UPGRADE_TO_GO_LIVE_MESSAGE,
        });
      }
      const number = await reenablePoolNumber(tenantId, request.params.id);
      return { data: number };
    }
  );
}
