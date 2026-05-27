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

  // Resend (transactional email)
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('noreply@example.com'),
  RESEND_FROM_NAME: z.string().default('AI Receptionist'),

  // Stripe billing — optional. Webhook + checkout endpoints respond
  // 503 with setup instructions when STRIPE_SECRET_KEY is unset.
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  // Per-plan price IDs. Each plan has both a monthly and an annual price
  // (the customer sees a 15% annual discount). All optional so dev works
  // without Stripe configured.
  STRIPE_PRICE_STARTER_MONTHLY: z.string().default(''),
  STRIPE_PRICE_STARTER_ANNUAL:  z.string().default(''),
  STRIPE_PRICE_GROWTH_MONTHLY:  z.string().default(''),
  STRIPE_PRICE_GROWTH_ANNUAL:   z.string().default(''),
  STRIPE_PRICE_SCALE_MONTHLY:        z.string().default(''),
  STRIPE_PRICE_SCALE_ANNUAL:         z.string().default(''),
  // Add-on: Voice Clone ($49/mo flat). Set this to the Stripe price_id after
  // creating the product in your Stripe dashboard.
  STRIPE_PRICE_VOICE_CLONE_MONTHLY:  z.string().default(''),

  // HubSpot CRM integration (optional — only required when a tenant connects HubSpot)
  HUBSPOT_CLIENT_ID: z.string().default(''),
  HUBSPOT_CLIENT_SECRET: z.string().default(''),
  HUBSPOT_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/integrations/hubspot/callback'),

  // Comma-separated list of admin emails for the platform-owner-only
  // admin endpoints (currently: affiliate management). Used as a
  // simple gate above and beyond the per-tenant role system.
  ADMIN_EMAILS: z.string().default(''),

  // Wholesale Telnyx number rates in CENTS / mo. Charged to promo-trial
  // tenants (in place of the retail $5/$10) so they pay what we pay.
  // Defaults track typical Telnyx US pricing; override via env if yours
  // differs. Retail rates are hardcoded in phone.service.ts.
  TELNYX_WHOLESALE_LOCAL_CENTS: z.coerce.number().int().min(0).default(100),
  TELNYX_WHOLESALE_TOLLFREE_CENTS: z.coerce.number().int().min(0).default(200),

  // Public homepage "Call me now" widget (Phase 12.3).
  // DEMO_TENANT_ID points at a real tenant row pre-configured with a generic
  // demo persona. DEMO_FROM_NUMBER is the E.164 number the call originates
  // from (must be assigned to that tenant in Telnyx). Both unset = widget
  // returns 503 "Demo unavailable" gracefully; no crash.
  DEMO_TENANT_ID: z.string().default(''),
  DEMO_FROM_NUMBER: z.string().default(''),
  /** Global ceiling on call-me requests per UTC day. Bounds cost worst-case. */
  DEMO_DAILY_CALL_LIMIT: z.coerce.number().int().min(0).default(200),

  // Apify integration (Phase 12.7) — Lead Discovery via Google Maps Scraper.
  // Platform-managed: we hold one Apify account and charge tenants per lead.
  // Endpoints respond 503 with setup instructions when this token is unset.
  APIFY_API_TOKEN: z.string().default(''),
  /** Apify actor used for Google Maps scraping. */
  APIFY_GOOGLE_MAPS_ACTOR_ID: z.string().default('compass~crawler-google-places'),
  /** Retail per-lead price in CENTS the tenant pays. */
  LEAD_DISCOVERY_PRICE_CENTS: z.coerce.number().int().min(1).default(99),
  /** Stripe price_id for the leads_discovered metered line item. */
  STRIPE_PRICE_LEADS_DISCOVERED: z.string().default(''),

  // Salesforce CRM (Phase 13) — OAuth Web Server Flow. Set on Railway after
  // creating the Connected App in your Salesforce dev console. Optional in
  // dev — /integrations/salesforce/connect returns 503 when CLIENT_ID unset.
  SALESFORCE_CLIENT_ID: z.string().default(''),
  SALESFORCE_CLIENT_SECRET: z.string().default(''),
  SALESFORCE_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/integrations/salesforce/callback'),

  // Clio CRM (Phase 13) — OAuth. Register your app at developers.clio.com,
  // set the redirect URI to the URI below.
  CLIO_CLIENT_ID: z.string().default(''),
  CLIO_CLIENT_SECRET: z.string().default(''),
  CLIO_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/integrations/clio/callback'),

  // Filevine CRM (Phase 13) — tenant-supplied API key + secret + orgId, no
  // platform-level env vars needed. Tenants paste credentials in the
  // dashboard's Connect Filevine modal.

  // Knowledge Base (Phase 12.8) — OpenAI embeddings + RAG.
  // Endpoints respond 503 with setup instructions when OPENAI_API_KEY unset.
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  /** Per-tenant document count + total byte limits by plan tier. */
  KB_DOC_LIMIT_STARTER: z.coerce.number().int().min(0).default(5),
  KB_DOC_LIMIT_GROWTH:  z.coerce.number().int().min(0).default(25),
  KB_DOC_LIMIT_SCALE:   z.coerce.number().int().min(0).default(500),
  KB_BYTES_LIMIT_STARTER: z.coerce.number().int().min(0).default(10_485_760),       // 10 MB
  KB_BYTES_LIMIT_GROWTH:  z.coerce.number().int().min(0).default(104_857_600),      // 100 MB
  KB_BYTES_LIMIT_SCALE:   z.coerce.number().int().min(0).default(2_147_483_648),    // 2 GB
  /** Trial tenants get the Starter quota by default. */
  KB_DOC_LIMIT_TRIAL: z.coerce.number().int().min(0).default(2),
  KB_BYTES_LIMIT_TRIAL: z.coerce.number().int().min(0).default(2_097_152),          // 2 MB
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
