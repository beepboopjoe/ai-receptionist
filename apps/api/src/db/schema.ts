// ============================================================
// Drizzle ORM Schema — all PostgreSQL table definitions
// ============================================================
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  smallint,
  timestamp,
  jsonb,
  bigserial,
  date,
  index,
  unique,
  numeric,
} from 'drizzle-orm/pg-core';

// ---- Tenants ----
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('trial'),
  vertical: text('vertical').notNull().default('generic'), // dental|insurance|legal|real_estate|home_services|generic
  timezone: text('timezone').notNull().default('America/New_York'),
  isActive: boolean('is_active').notNull().default(false),
  onboardingStep: smallint('onboarding_step').notNull().default(1),
  // ---- Stripe billing ----
  // Populated by the /billing/checkout flow + the Stripe webhook handler.
  // All nullable so trial / not-yet-paying tenants are valid.
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  subscriptionStatus: text('subscription_status'), // mirrors Stripe's status enum
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  trialEnd: timestamp('trial_end', { withTimezone: true }),
  billingCycle: text('billing_cycle'), // 'monthly' | 'annual'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Stripe Webhook Idempotency ----
export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  eventId: text('event_id').primaryKey(),
  eventType: text('event_type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  payload: jsonb('payload').notNull(),
});

// ---- Per-period minute usage rollup ----
export const minuteUsage = pgTable(
  'minute_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    minutesUsed: numeric('minutes_used', { precision: 12, scale: 4 }).notNull().default('0'),
    overageMinutes: numeric('overage_minutes', { precision: 12, scale: 4 }).notNull().default('0'),
    overageChargedCents: integer('overage_charged_cents').notNull().default(0),
    /** Set when the 80%-of-plan warning email goes out. Per-period flag. */
    warningSentAt: timestamp('warning_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantPeriodUniq: unique().on(t.tenantId, t.periodStart),
  })
);

// ---- Tenant Settings ----
export const tenantSettings = pgTable('tenant_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' })
    .unique(),
  officeHours: jsonb('office_hours').notNull().default({}),
  afterHoursMode: text('after_hours_mode').notNull().default('voicemail'),
  transferNumber: text('transfer_number'),
  maxHoldSeconds: integer('max_hold_seconds').notNull().default(30),
  voiceAgentId: text('voice_agent_id'),
  voiceName: text('voice_name').notNull().default('eve'),
  voiceProvider: text('voice_provider').notNull().default('grok'),
  telephonyProvider: text('telephony_provider').notNull().default('telnyx'),
  provisionedNumber: text('twilio_number'),      // column kept for migration compat; name is provider-agnostic
  provisionedNumberSid: text('twilio_number_sid'), // ditto
  appointmentTypes: jsonb('appointment_types').notNull().default([]),
  recallIntervalMonths: integer('recall_interval_months').notNull().default(6),
});

// ---- Integrations ----
export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    status: text('status').notNull().default('pending'),
    credentials: jsonb('credentials').notNull().default({}),
    metadata: jsonb('metadata').notNull().default({}),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProviderUniq: unique().on(t.tenantId, t.provider),
  })
);

// ---- Contacts ----
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phoneE164: text('phone_e164').notNull(),
    email: text('email'),
    dateOfBirth: date('date_of_birth'),
    contactType: text('contact_type').notNull().default('existing'),
    insuranceProvider: text('insurance_provider'),
    insuranceId: text('insurance_id'),
    recallDueDate: date('recall_due_date'),
    preferredProvider: text('preferred_provider'),
    notes: text('notes'),
    source: text('source').notNull().default('manual'),
    externalCrmId: text('external_crm_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantPhoneUniq: unique().on(t.tenantId, t.phoneE164),
    tenantPhoneIdx: index('contacts_tenant_phone_idx').on(t.tenantId, t.phoneE164),
    tenantNameIdx: index('contacts_tenant_name_idx').on(t.tenantId, t.lastName, t.firstName),
  })
);

// ---- Calls ----
export const calls = pgTable(
  'calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    rcCallId: text('rc_call_id').notNull(),
    rcSessionId: text('rc_session_id'),
    direction: text('direction').notNull().default('inbound'),
    fromNumber: text('from_number').notNull(),
    toNumber: text('to_number').notNull(),
    status: text('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    workflowTriggered: text('workflow_triggered'),
    escalationReason: text('escalation_reason'),
    outcome: text('outcome'),
    summary: text('summary'),
    recordingUrl: text('recording_url'),
    transcript: jsonb('transcript'),
    streamSid: text('stream_sid'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('calls_tenant_status_idx').on(t.tenantId, t.status),
    tenantStartedIdx: index('calls_tenant_started_idx').on(t.tenantId, t.startedAt),
    rcCallIdIdx: index('calls_rc_call_id_idx').on(t.rcCallId),
    streamSidIdx: index('calls_stream_sid_idx').on(t.streamSid),
  })
);

// ---- Appointments ----
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
    calendarProvider: text('calendar_provider').notNull(),
    calendarEventId: text('calendar_event_id'),
    calendarId: text('calendar_id'),
    appointmentType: text('appointment_type').notNull(),
    providerName: text('provider_name'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    status: text('status').notNull().default('confirmed'),
    notes: text('notes'),
    reminder24hSent: boolean('reminder_24h_sent').notNull().default(false),
    reminder2hSent: boolean('reminder_2h_sent').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStartsIdx: index('appts_tenant_starts_idx').on(t.tenantId, t.startsAt),
    contactIdx: index('appts_contact_idx').on(t.contactId),
    tenantStatusIdx: index('appts_status_idx').on(t.tenantId, t.status),
  })
);

// ---- Audit Logs ----
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('audit_tenant_created_idx').on(t.tenantId, t.createdAt),
    entityIdx: index('audit_entity_idx').on(t.entityType, t.entityId),
  })
);

// ---- Notifications ----
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, {
    onDelete: 'set null',
  }),
  callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  channel: text('channel').notNull(),
  toAddress: text('to_address').notNull(),
  status: text('status').notNull().default('pending'),
  templateId: text('template_id').notNull(),
  body: text('body').notNull(),
  providerMsgId: text('provider_msg_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  failedReason: text('failed_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Admin Users ----
export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // Nullable: users that signed up via Google never set a password.
    passwordHash: text('password_hash'),
    // Google `sub` claim — used to look up Google-authenticated users
    // and link existing email accounts to a Google identity.
    googleId: text('google_id'),
    role: text('role').notNull().default('staff'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantEmailUniq: unique().on(t.tenantId, t.email),
  })
);

// ---- Escalations ----
export const escalations = pgTable('escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  reason: text('reason').notNull(),
  priority: text('priority').notNull().default('normal'),
  status: text('status').notNull().default('open'),
  assignedTo: uuid('assigned_to').references(() => adminUsers.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNote: text('resolution_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Outbound Campaigns ----
export const outboundCampaigns = pgTable(
  'outbound_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('draft'), // draft|running|paused|completed|cancelled
    fromNumber: text('from_number').notNull(),
    maxRetries: integer('max_retries').notNull().default(3),
    retryDelayMinutes: integer('retry_delay_minutes').notNull().default(60),
    maxConcurrentCalls: integer('max_concurrent_calls').notNull().default(3),
    dialWindowStart: text('dial_window_start').notNull().default('09:00'),
    dialWindowEnd: text('dial_window_end').notNull().default('17:00'),
    voicemailMessage: text('voicemail_message'),
    totalLeads: integer('total_leads').notNull().default(0),
    dialedCount: integer('dialed_count').notNull().default(0),
    connectedCount: integer('connected_count').notNull().default(0),
    qualifiedCount: integer('qualified_count').notNull().default(0),
    bookedCount: integer('booked_count').notNull().default(0),
    voicemailCount: integer('voicemail_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('campaigns_tenant_status_idx').on(t.tenantId, t.status),
  })
);

// ---- Campaign Contacts (Leads) ----
export const campaignContacts = pgTable(
  'campaign_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => outboundCampaigns.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    phoneE164: text('phone_e164').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull().default(''),
    email: text('email'),
    // status: pending|queued|dialing|connected|voicemail|no_answer|qualified|not_qualified|booked|failed|do_not_call
    status: text('status').notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    lastDialedAt: timestamp('last_dialed_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    callId: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
    callSid: text('call_sid'),
    outcome: text('outcome'),
    qualificationNotes: text('qualification_notes'),
    appointmentId: uuid('appointment_id').references(() => appointments.id, {
      onDelete: 'set null',
    }),
    csvRowData: jsonb('csv_row_data').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignStatusIdx: index('campaign_contacts_campaign_status_idx').on(t.campaignId, t.status),
    campaignNextRetryIdx: index('campaign_contacts_next_retry_idx').on(
      t.campaignId,
      t.nextRetryAt
    ),
    tenantPhoneIdx: index('campaign_contacts_tenant_phone_idx').on(t.tenantId, t.phoneE164),
  })
);

// ---- Public API Keys ----
//
// Customers create API keys on /settings/api-keys. We display the raw
// secret exactly once at create time and store only its SHA-256 hash.
// All keys are scoped to a tenant and (optionally) a role-tier-equivalent
// permission level so a read-only key can't, say, modify appointments.
export const tenantApiKeys = pgTable(
  'tenant_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Short identifier shown alongside the key — first 8 chars of the raw token. */
    prefix: text('prefix').notNull(),
    /** SHA-256 hex of the raw token. Lookups hash the incoming header value and compare. */
    keyHash: text('key_hash').notNull().unique(),
    name: text('name').notNull(),
    /** Permission level — 'read' = GETs only, 'write' = full read+write. */
    scope: text('scope').notNull().default('read'), // read | write
    createdBy: uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('api_keys_tenant_idx').on(t.tenantId),
    keyHashIdx: index('api_keys_hash_idx').on(t.keyHash),
  })
);

// ---- User Invitations ----
//
// When a tenant owner invites a teammate, we mint a row here with a
// random token. The invite email links to /accept-invite/<token>.
// Accepted invitations are kept (acceptedAt set) for audit history.
export const userInvitations = pgTable(
  'user_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('staff'), // owner|admin|staff
    /** 64-char hex token. We store the raw value because invitations
     *  are short-lived (7d default) and rotated by the owner via DELETE+POST. */
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    invitedBy: uuid('invited_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantEmailPendingIdx: index('invitations_tenant_email_idx').on(t.tenantId, t.email),
    tokenIdx: index('invitations_token_idx').on(t.token),
  })
);

// ---- Password Reset Tokens ----
//
// Persisted (vs. an in-memory Map) so reset links survive server
// restarts and work across multiple instances. We store a SHA-256
// hash of the token, never the token itself — the raw value is
// emailed to the user once and never persisted.
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    /** SHA-256 hex digest of the random token. Lookup uses this. */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('password_reset_user_idx').on(t.userId),
    tokenHashIdx: index('password_reset_token_idx').on(t.tokenHash),
  })
);

// ---- Outbound Webhooks ----
//
// Customers register a URL + secret; whenever an interesting event fires
// (call.completed, appointment.booked, escalation.created, etc.) we POST
// a signed payload to that URL. `webhookDeliveries` tracks each attempt for
// retry + audit.
export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    /** HMAC-SHA256 signing secret. Customer sees this once at create-time. */
    secret: text('secret').notNull(),
    /** Comma-separated event names: 'call.completed,appointment.booked,*' */
    events: text('events').notNull().default('*'),
    isActive: boolean('is_active').notNull().default(true),
    description: text('description'),
    lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }),
    lastFailedAt: timestamp('last_failed_at', { withTimezone: true }),
    failureCount: integer('failure_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('webhook_endpoints_tenant_idx').on(t.tenantId),
  })
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    /** pending | delivered | failed | dead_letter */
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    httpStatus: integer('http_status'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    endpointIdx: index('webhook_deliveries_endpoint_idx').on(t.endpointId),
    statusNextAttemptIdx: index('webhook_deliveries_status_next_idx').on(t.status, t.nextAttemptAt),
  })
);

// ---- Type inference helpers ----
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantSettings = typeof tenantSettings.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type Escalation = typeof escalations.$inferSelect;
export type OutboundCampaign = typeof outboundCampaigns.$inferSelect;
export type NewOutboundCampaign = typeof outboundCampaigns.$inferInsert;
export type CampaignContact = typeof campaignContacts.$inferSelect;
export type NewCampaignContact = typeof campaignContacts.$inferInsert;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type UserInvitation = typeof userInvitations.$inferSelect;
export type NewUserInvitation = typeof userInvitations.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type TenantApiKey = typeof tenantApiKeys.$inferSelect;
export type NewTenantApiKey = typeof tenantApiKeys.$inferInsert;
