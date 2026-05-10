// ============================================================
// Configuration — validated at startup via zod
// ============================================================
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().url().default('http://localhost:3001'),
  DASHBOARD_URL: z.string().url().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Encryption (AES-256: 64 hex chars = 32 bytes)
  ENCRYPTION_KEY: z.string().length(64),

  // RingCentral (optional — only required if TELEPHONY_PROVIDER=ringcentral)
  RINGCENTRAL_CLIENT_ID: z.string().default(''),
  RINGCENTRAL_CLIENT_SECRET: z.string().default(''),
  RINGCENTRAL_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/integrations/ringcentral/callback'),
  RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN: z.string().default(''),
  RINGCENTRAL_SERVER_URL: z
    .string()
    .url()
    .default('https://platform.devtest.ringcentral.com'),

  // xAI / Grok Voice (primary voice provider)
  XAI_API_KEY: z.string().min(1),

  // ElevenLabs (optional fallback voice provider)
  ELEVENLABS_API_KEY: z.string().default(''),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'),

  // Voice + telephony provider selection
  VOICE_PROVIDER: z.enum(['grok', 'elevenlabs']).default('grok'),
  TELEPHONY_PROVIDER: z.enum(['telnyx', 'ringcentral']).default('telnyx'),

  // Google Calendar (optional — only required when integration is connected)
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/integrations/google-calendar/callback'),

  // Microsoft (optional — only required when integration is connected)
  MICROSOFT_CLIENT_ID: z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_TENANT_ID: z.string().default('common'),
  MICROSOFT_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/integrations/microsoft-calendar/callback'),

  // Telnyx (primary telephony + SMS provider)
  TELNYX_API_KEY: z.string().default(''),
  /** Connection Profile ID from the Telnyx portal → My Connections */
  TELNYX_APP_ID: z.string().default(''),
  /** Webhook signing public key — Ed25519 (optional in dev, required in prod) */
  TELNYX_PUBLIC_KEY: z.string().default(''),
  /** E.164 number used as the From address for outbound SMS */
  TELNYX_FROM_NUMBER: z.string().default(''),
  /** Messaging Profile ID from the Telnyx portal — optional, for compliance routing */
  TELNYX_MESSAGING_PROFILE_ID: z.string().default(''),

  // SendGrid
  SENDGRID_API_KEY: z.string().default(''),
  SENDGRID_FROM_EMAIL: z.string().email().default('noreply@example.com'),
  SENDGRID_FROM_NAME: z.string().default('AI Receptionist'),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    // In non-test environments, crash early on bad config
    if (process.env['NODE_ENV'] !== 'test') {
      process.exit(1);
    }
  }
  // Return parsed data or a partial stub for tests
  return result.success ? result.data : ({} as z.infer<typeof envSchema>);
}

export const config = loadConfig();
export type Config = z.infer<typeof envSchema>;
