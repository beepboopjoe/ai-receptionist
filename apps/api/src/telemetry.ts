// ============================================================
// OpenTelemetry bootstrap
//
// IMPORTANT: this module must be imported BEFORE any other module
// that you want auto-instrumented (Fastify, pg, ioredis, http).
// We import it as the first line of main.ts via a side-effect
// `import './telemetry.js';`.
//
// Configuration via env:
//   OTEL_ENABLED        — '1' / 'true' to enable. Off by default.
//   OTEL_EXPORTER       — 'otlp' (default) | 'console'
//   OTEL_EXPORTER_OTLP_ENDPOINT — defaults to http://localhost:4318
//   OTEL_SERVICE_NAME   — defaults to 'ai-receptionist-api'
//
// Free / no-account paths:
//   - `OTEL_EXPORTER=console` prints spans to stdout. Useful in dev.
//   - `OTEL_EXPORTER=otlp` with a local Jaeger/SigNoz/OTel collector
//     gives a UI; both have free self-hostable images.
//   - When OTEL_ENABLED is unset, this module is a no-op so prod
//     deploys without observability spin up identically.
// ============================================================
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const enabled = ['1', 'true', 'yes'].includes((process.env['OTEL_ENABLED'] ?? '').toLowerCase());

let sdk: NodeSDK | null = null;

if (enabled) {
  const exporterChoice = (process.env['OTEL_EXPORTER'] ?? 'otlp').toLowerCase();
  const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'ai-receptionist-api';

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env['npm_package_version'] ?? '0.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env['NODE_ENV'] ?? 'development',
  });

  const traceExporter =
    exporterChoice === 'console'
      ? new ConsoleSpanExporter()
      : new OTLPTraceExporter({
          // OTel collector / Jaeger default port. Set OTEL_EXPORTER_OTLP_ENDPOINT to override.
          url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT']
            ? `${process.env['OTEL_EXPORTER_OTLP_ENDPOINT']}/v1/traces`
            : 'http://localhost:4318/v1/traces',
        });

  sdk = new NodeSDK({
    resource,
    // SimpleSpanProcessor avoids batching delays in dev. Swap to
    // BatchSpanProcessor in production by setting OTEL_BATCH=1.
    spanProcessor: new SimpleSpanProcessor(traceExporter),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Don't auto-instrument fs — extremely noisy and never useful for us.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(`[otel] tracing enabled — service=${serviceName} exporter=${exporterChoice}`);
  } catch (err) {
    // Never let observability break the app. Log + carry on uninstrumented.
    // eslint-disable-next-line no-console
    console.error('[otel] failed to start, continuing without tracing:', err);
    sdk = null;
  }

  // Flush on shutdown so we don't lose the last few spans.
  const shutdown = async (): Promise<void> => {
    if (!sdk) return;
    try {
      await sdk.shutdown();
    } catch {
      /* ignore */
    }
  };
  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT', () => { void shutdown(); });
}

export const otelEnabled = enabled && sdk !== null;
