// ============================================================
// OpenAPI plugin
//
// Registers @fastify/swagger to auto-generate an OpenAPI 3 doc
// from every route's schema, plus @fastify/swagger-ui to serve
// an interactive explorer at /docs.
//
// We scope the doc to the Public API surface — internal admin
// routes are excluded via the `transform` filter so we don't
// leak owner-only endpoints into customer-facing docs.
// ============================================================
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const PUBLIC_PATH_PREFIX = '/api/v1/public/';

export async function openapiPlugin(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'AI Receptionist — Public API',
        description:
          'Read-only and mutation endpoints for integrating with your AI Receptionist tenant. ' +
          'All requests require an API key (mint one in Settings → API Keys). Send the key as ' +
          '`Authorization: Bearer ark_live_…` or `X-API-Key: ark_live_…`.',
        version: '1.0.0',
        contact: { name: 'AI Receptionist Support', email: 'hello@aireceptionist.ai' },
      },
      servers: [{ url: '/', description: 'Same-origin (relative path)' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'ark_live_<48 hex chars>',
            description: 'Send as `Authorization: Bearer ark_live_…`',
          },
          xApiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'Send as `X-API-Key: ark_live_…` if you can\'t set Authorization.',
          },
        },
      },
      security: [{ bearerAuth: [] }, { xApiKey: [] }],
      tags: [
        { name: 'Calls', description: 'Calls handled by the AI receptionist' },
        { name: 'Appointments', description: 'Booked appointments' },
        { name: 'Contacts', description: 'People in your CRM' },
        { name: 'Escalations', description: 'Calls flagged for staff follow-up' },
        { name: 'Auth', description: 'Identity + key info' },
      ],
    },
    // Only include routes under /api/v1/public/* in the generated spec.
    transform: ({ schema, url }) => {
      if (!url.startsWith(PUBLIC_PATH_PREFIX)) {
        // Hide non-public routes by marking them as hidden.
        return {
          schema: { ...schema, hide: true } as typeof schema,
          url,
        };
      }
      return { schema, url };
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });
}
