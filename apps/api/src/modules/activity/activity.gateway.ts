// ============================================================
// Activity gateway — Fastify WebSocket route at /ws/activity.
//
// Wire format:
//   Connect: ws://<host>/ws/activity?token=<JWT>
//   On open: receive a `{type:'connected'}` welcome event
//   Server pushes: ActivityEvent JSON whenever pushActivity() fires
//                   for the authenticated tenant
//
// Auth: query-string token only (browsers can't send custom headers
// on WebSocket connect). Validated against the same JWT secret used
// elsewhere via app.jwt.verify().
// ============================================================
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import pino from 'pino';
import { subscribe } from './activity.service.js';
import type { JwtPayload } from '../admin/auth.middleware.js';

const logger = pino({ name: 'activity-gateway' });

export async function activityGatewayPlugin(app: FastifyInstance): Promise<void> {
  app.get(
    '/ws/activity',
    { websocket: true },
    (socket /* WebSocket */, req) => {
      const ws = socket as unknown as WebSocket;
      const query = req.query as Record<string, string | undefined>;
      const token = query['token'];

      if (!token) {
        try { ws.send(JSON.stringify({ type: 'error', error: 'token required' })); } catch { /* ignore */ }
        ws.close(1008, 'token required');
        return;
      }

      let payload: JwtPayload;
      try {
        payload = app.jwt.verify(token) as JwtPayload;
      } catch (err) {
        logger.warn({ err }, 'Activity WS auth failed');
        try { ws.send(JSON.stringify({ type: 'error', error: 'invalid token' })); } catch { /* ignore */ }
        ws.close(1008, 'invalid token');
        return;
      }

      const tenantId = payload.tenantId;
      if (!tenantId) {
        ws.close(1008, 'no tenantId in token');
        return;
      }

      // Send a welcome so the dashboard's `connected` indicator flips on.
      try { ws.send(JSON.stringify({ type: 'connected', tenantId })); } catch { /* ignore */ }

      const unsubscribe = subscribe(tenantId, ws);

      ws.on('close', () => {
        unsubscribe();
        logger.debug({ tenantId }, 'Activity WS closed');
      });

      ws.on('error', (err: Error) => {
        logger.warn({ err, tenantId }, 'Activity WS error');
        unsubscribe();
      });
    }
  );
}
