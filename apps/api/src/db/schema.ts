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
  customType,
} from 'drizzle-orm/pg-core';

// ---- Custom column types for Phase 12.8 (Knowledge Base) ----
// Drizzle doesn't ship native helpers for `bytea` or `vector(N)`, so we
// declare them as customType wrappers. The vector helper round-trips a
// JS number[] to pgvector's `[0.1,0.2,...]` string representation.

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value !== 'string') return [];
    return value.replace(/^\[|\]$/g, '').split(',').map(Number);
  },
});

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
  // ---- Add-ons ----
  // voice_clone_addon: true when the tenant has an active Stripe subscription
  // for the Voice Clone add-on ($49/mo). Managed by the Stripe webhook.
  voiceCloneAddon: boolean('voice_clone_addon').notNull().default(false),
  voiceCloneStripeSub: text('voice_clone_stripe_sub_id'),
  // ---- HIPAA / Compliance ----
  // baaAcceptedAt: timestamp when the account owner signed the BAA.
  // hipaaMode: enforces idle-timeout + stricter audit for healthcare tenants.
  // dataRetentionDays: how long PHI data is kept (HIPAA min = 2190 / 6yr;
  //   default 2555 = 7 years which is what most dental practices need).
  baaAcceptedAt: timestamp('baa_accepted_at', { withTimezone: true }),
  baaAcceptedBy: uuid('baa_accepted_by'),
  hipaaMode: boolean('hipaa_mode').notNull().default(false),
  dataRetentionDays: integer('data_retention_days').notNull().default(2555),
  // ---- AI Agent ----
  // agentEnabled: master switch for the dashboard agent (suggestions feed).
  // agentAutoExecute: when true, "safe" suggestion types execute without
  //   human approval. Forced false (and disabled in UI) when hipaaMode is on.
  agentEnabled: boolean('agent_enabled').notNull().default(true),
  agentAutoExecute: boolean('agent_auto_execute').notNull().default(false),
  // ---- Promo trial (manual grant via /admin/tenants/:id/grant-promo-trial) ----
  // minutesOverride: per-tenant hard minute cap. NULL = use plan default.
  // promoTrial:      when true, the system HARD-blocks calls at the cap and
  //                  the dashboard shows the promo-trial banner with Upgrade CTA.
  // Used to give specific friends/testers full-tier access with a low cap.
  minutesOverride: integer('minutes_override'),
  promoTrial:      boolean('promo_trial').notNull().default(false),
  // Affiliate attribution — set on signup when ?ref= was present.
  // FK declared in migration 0015 (we can't reference `affiliates`
  // here because it's declared below this tenants table).
  affiliateId: uuid('affiliate_id'),
  attributionSignedAt: timestamp('attribution_signed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Affiliates (reseller MVP → V2 partner portal) ----
// One affiliate row per partner. Their `code` is the URL param
// (?ref=ABC123) used during signup attribution. V2 adds self-serve
// registration (passwordHash) and payout fields.
export const affiliates = pgTable('affiliates', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  commissionPct: numeric('commission_pct', { precision: 5, scale: 2 }).notNull().default('20.00'),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  isActive: boolean('is_active').notNull().default(true),
  // V2: self-registration + payout
  // status: 'pending_review' | 'active' | 'suspended'
  status: text('status').notNull().default('active'),
  passwordHash: text('password_hash'),
  payoutEmail: text('payout_email'),
  payoutMethod: text('payout_method').notNull().default('paypal'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Payout Requests ----
// Partner-initiated requests to be paid their pending commissions.
// Admin reviews + marks paid manually (V2); Stripe Connect automates in V3.
export const payoutRequests = pgTable(
  'payout_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    affiliateId: uuid('affiliate_id').notNull().references(() => affiliates.id, { onDelete: 'cascade' }),
    requestedAmountCents: integer('requested_amount_cents').notNull(),
    // status: 'pending' | 'approved' | 'paid' | 'rejected'
    status: text('status').notNull().default('pending'),
    note: text('note'),       // partner's message to admin
    adminNote: text('admin_note'), // admin's reply
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => ({
    affiliateIdx: index('payout_requests_affiliate_idx').on(t.affiliateId),
    statusIdx: index('payout_requests_status_idx').on(t.status),
  })
);

// One row per Stripe invoice.paid event for an affiliated tenant.
// Unique on (stripe_invoice_id, affiliate_id) guards against duplicate
// webhook deliveries.
export const commissionEvents = pgTable(
  'commission_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    affiliateId: uuid('affiliate_id').notNull().references(() => affiliates.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    stripeInvoiceId: text('stripe_invoice_id').notNull(),
    invoiceAmountCents: integer('invoice_amount_cents').notNull(),
    commissionCents: integer('commission_cents').notNull(),
    commissionPct: numeric('commission_pct', { precision: 5, scale: 2 }).notNull(),
    payoutStatus: text('payout_status').notNull().default('pending'),
    paidOutAt: timestamp('paid_out_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invoiceUniq: unique().on(t.stripeInvoiceId, t.affiliateId),
  })
);

// ---- Tenant Phone Numbers ----
// Numbers purchased through the in-app Telnyx flow. Released numbers
// are soft-deleted (released_at populated) so history isn't lost.
export const tenantPhoneNumbers = pgTable(
  'tenant_phone_numbers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    phoneE164: text('phone_e164').notNull(),
    telnyxPhoneId: text('telnyx_phone_id'),
    country: text('country').notNull().default('US'),
    region: text('region'),
    /** "local" or "toll_free" — drives the monthly rate. */
    numberType: text('number_type').notNull().default('local'),
    monthlyCostCents: integer('monthly_cost_cents').notNull().default(500),
    isPrimary: boolean('is_primary').notNull().default(false),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    stripeSubscriptionItemId: text('stripe_subscription_item_id'),
    /** True when this number was acquired via porting (vs new purchase). */
    isPorted: boolean('is_ported').notNull().default(false),
    /** FK to phone_port_requests when this came from a port; null for new buys. */
    portRequestId: uuid('port_request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('tenant_phone_numbers_tenant_idx').on(t.tenantId, t.releasedAt),
  })
);

// ---- Number Port Requests ----
// Customer fills out an LOA form to move their existing business
// number from another carrier onto our Telnyx account. The port goes
// through pending → submitted → in_progress → completed (or failed)
// statuses. A successful port creates a corresponding tenant_phone_numbers
// row with is_ported=true.
export const phonePortRequests = pgTable(
  'phone_port_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    phoneE164: text('phone_e164').notNull(),
    currentCarrier: text('current_carrier').notNull(),
    accountNumber: text('account_number').notNull(),
    accountPin: text('account_pin'),
    authorizedName: text('authorized_name').notNull(),
    authorizedTitle: text('authorized_title'),
    serviceAddress: text('service_address').notNull(),
    serviceCity: text('service_city').notNull(),
    serviceState: text('service_state').notNull(),
    serviceZip: text('service_zip').notNull(),
    desiredCompleteDate: date('desired_complete_date'),
    status: text('status').notNull().default('pending'),
    telnyxPortRequestId: text('telnyx_port_request_id'),
    rejectionReason: text('rejection_reason'),
    notes: text('notes'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('phone_port_requests_tenant_idx').on(t.tenantId, t.status),
  })
);

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
  // ---- Custom voice clone (ElevenLabs IVC) ----
  // voiceCloneStatus: 'none' | 'uploading' | 'ready' | 'failed'
  voiceCloneId: text('voice_clone_id'),
  voiceCloneStatus: text('voice_clone_status').notNull().default('none'),
  voiceCloneName: text('voice_clone_name'),
  provisionedNumber: text('twilio_number'),      // column kept for migration compat; name is provider-agnostic
  provisionedNumberSid: text('twilio_number_sid'), // ditto
  appointmentTypes: jsonb('appointment_types').notNull().default([]),
  recallIntervalMonths: integer('recall_interval_months').notNull().default(6),
  /** JSON map of notification toggles (see dashboard /settings/notifications). */
  notificationPreferences: jsonb('notification_preferences').default({}),
  /** Address that receives per-call summary emails when emailOnEveryCall is on. */
  callSummaryEmail: text('call_summary_email'),
  /** Free-text business context shown to the AI as a system-prompt section
   *  on every call. Owner-edited from Settings → Voice Agent. Max 4000 chars
   *  enforced at the API layer (validation in the /settings PATCH route). */
  businessContext: text('business_context'),
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
    /** Goal slug (e.g. 'dental_recall') when created from a template. Phase 12.4. */
    goal: text('goal'),
    /** 'template' | 'manual' — NULL on legacy rows. */
    goalSource: text('goal_source'),
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

// ---- Lead Discovery Jobs (Phase 12.7) ----
// Tracks Apify Google Maps scrape jobs from creation → ingestion →
// import into campaign_contacts. Pricing is per-lead via Stripe
// metered billing; margin tracked via cost_cents vs apify_cost_cents.
export const leadDiscoveryJobs = pgTable(
  'lead_discovery_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').notNull(),
    apifyRunId: text('apify_run_id'),
    /** pending | running | succeeded | failed | imported */
    status: text('status').notNull().default('pending'),
    searchParams: jsonb('search_params').notNull(),
    rawResults: jsonb('raw_results'),
    leadsFound: integer('leads_found').notNull().default(0),
    leadsImported: integer('leads_imported').notNull().default(0),
    costCents: integer('cost_cents').notNull().default(0),
    apifyCostCents: integer('apify_cost_cents').notNull().default(0),
    importedCampaignId: uuid('imported_campaign_id').references(
      () => outboundCampaigns.id,
      { onDelete: 'set null' }
    ),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    importedAt: timestamp('imported_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('lead_discovery_jobs_tenant_idx').on(t.tenantId, t.createdAt),
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

// ---- SMS Messages ----
// Stores both inbound and outbound SMS per tenant so they appear in the
// unified two-way inbox. Missed-call text-backs and appointment reminders
// also write here so they appear in the conversation thread view.
export const smsMessages = pgTable(
  'sms_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    /** 'inbound' = external → tenant number; 'outbound' = tenant → external. */
    direction: text('direction').notNull(),
    fromNumber: text('from_number').notNull(),
    toNumber: text('to_number').notNull(),
    body: text('body').notNull(),
    telnyxMessageId: text('telnyx_message_id'),
    status: text('status').notNull().default('delivered'),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('sms_messages_tenant_created_idx').on(t.tenantId, t.createdAt),
    tenantFromIdx:    index('sms_messages_tenant_from_idx').on(t.tenantId, t.fromNumber),
    tenantToIdx:      index('sms_messages_tenant_to_idx').on(t.tenantId, t.toNumber),
  })
);

// ---- Compliance Events ----
// Immutable audit trail for HIPAA-relevant actions (BAA acceptance, mode
// changes, retention updates). Separate from audit_log so it can be
// exported independently for compliance audits or OCR requests.
export const complianceEvents = pgTable(
  'compliance_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    // event_type: baa_accepted | hipaa_mode_enabled | hipaa_mode_disabled |
    //             retention_changed | settings_changed
    eventType: text('event_type').notNull(),
    actorId: uuid('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('compliance_events_tenant_idx').on(t.tenantId, t.createdAt),
  })
);

// ---- Agent Suggestions ----
// Queue of operator-facing AI recommendations ("call these missed callers",
// "confirm tomorrow's appointments"). The hourly scanner worker populates it;
// the dashboard renders pending rows; operator approves → execution runs.
export const agentSuggestions = pgTable(
  'agent_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    // missed_call_callback | appointment_confirmation | stale_lead_followup | no_show_recapture
    type: text('type').notNull(),
    // pending | approved | executed | skipped | expired | failed
    status: text('status').notNull().default('pending'),
    /** Deterministic hash of the source entity so the scanner is idempotent. */
    dedupeKey: text('dedupe_key').notNull(),
    payload: jsonb('payload').notNull().default({}),
    suggestedAt: timestamp('suggested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: uuid('decided_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    executionResult: jsonb('execution_result'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('agent_suggestions_tenant_status_idx').on(t.tenantId, t.status, t.suggestedAt),
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
export type Affiliate = typeof affiliates.$inferSelect;
export type PayoutRequest = typeof payoutRequests.$inferSelect;
export type NewPayoutRequest = typeof payoutRequests.$inferInsert;
export type SmsMessage = typeof smsMessages.$inferSelect;
export type NewSmsMessage = typeof smsMessages.$inferInsert;
export type ComplianceEvent = typeof complianceEvents.$inferSelect;
export type NewComplianceEvent = typeof complianceEvents.$inferInsert;
export type AgentSuggestion = typeof agentSuggestions.$inferSelect;
export type NewAgentSuggestion = typeof agentSuggestions.$inferInsert;

// ---- Support Tickets ----
// In-dashboard support channel. Tenants submit categorised messages from
// /support; the founder gets an email (Reply-To = submitter) and the ticket
// shows up in /platform admin queue. See migration 0026.
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    submittedBy: uuid('submitted_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    /** Snapshotted at submission time so Reply-To still works after the user is deleted. */
    submitterEmail: text('submitter_email').notNull(),
    submitterName: text('submitter_name'),
    category: text('category').notNull(), // bug | question | billing | feature_request
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    status: text('status').notNull().default('open'), // open | resolved
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('support_tickets_tenant_status_idx').on(t.tenantId, t.status),
    statusCreatedIdx: index('support_tickets_status_created_idx').on(t.status, t.createdAt),
  })
);

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;

// ---- Knowledge Base (Phase 12.8) ----
// Tenant-uploaded documents (PDF/DOCX/TXT/MD) parsed into chunks +
// OpenAI embeddings. Retrieved at call-start and injected into the
// system prompt as `# Knowledge Base Excerpts`. See migration 0029.
//
// V1 storage notes:
//   - file_bytes lives in Postgres (capped at 10MB by multipart limit).
//   - embedding is nullable so chunks can be inserted before the OpenAI
//     embed call lands; the BullMQ worker fills it in.
//   - embedding_model lets us migrate models later (e.g. to a 1536→3072
//     upgrade) without dropping comparability.
export const kbDocuments = pgTable(
  'kb_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    fileBytes: bytea('file_bytes').notNull(),
    /** pending | processing | ready | failed */
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    chunkCount: integer('chunk_count').notNull().default(0),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => ({
    tenantCreatedIdx: index('kb_documents_tenant_idx').on(t.tenantId, t.createdAt),
  })
);

export const kbChunks = pgTable(
  'kb_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => kbDocuments.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    /** 1536 dims = OpenAI text-embedding-3-small. Nullable while embed is in-flight. */
    embedding: vector1536('embedding'),
    embeddingModel: text('embedding_model').notNull().default('text-embedding-3-small'),
    tokenCount: integer('token_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentIdx: index('kb_chunks_document_idx').on(t.documentId, t.chunkIndex),
  })
);

export type KbDocument = typeof kbDocuments.$inferSelect;
export type NewKbDocument = typeof kbDocuments.$inferInsert;
export type KbChunk = typeof kbChunks.$inferSelect;
export type NewKbChunk = typeof kbChunks.$inferInsert;
