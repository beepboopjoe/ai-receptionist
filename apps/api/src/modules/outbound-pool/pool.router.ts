// ============================================================
// Outbound pool router — read-only pool visibility for the
// dashboard settings page. Pool lifecycle (provision/rotate/
// scale) is platform-managed; tenants get no mutation surface.
//
// NOTE: plain (encapsulated) plugin so the `/api/v1` prefix in
// main.ts applies. fastify-plugin (fp) de-encapsulates and drops
// the prefix → routes 404.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { listOutboundPoolNumbers } from './pool.service.js';

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
}
