// ============================================================
// Settings Service — tenant settings CRUD
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers, tenantSettings, tenants } from '../../db/schema.js';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { OfficeHours, AppointmentType, InboundRoutingMode } from '@ai-receptionist/shared';
import { VERTICAL_VALUES as _VERTICAL_VALUES, isVertical as _isVertical } from '@ai-receptionist/shared';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { coerceVoiceSettings } from './voice-coerce.js';
import { planIncludesInboundDid } from '../outbound-pool/pool-size.js';
import { isProvisionedE164 } from '../phone-numbers/inbound-did.js';
import {
  nextOnboardingStep,
  onboardingStepsCompleted,
  onboardingUiStep,
} from './onboarding-progress.js';

export { coerceVoiceSettings } from './voice-coerce.js';

// ---- Read ----

export async function getSettings(tenantId: string) {
  const [settings] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!settings) {
    throw new NotFoundError('Settings not found for this tenant');
  }
  const coerced = coerceVoiceSettings(settings);
  return { ...settings, ...coerced };
}

export async function getTenantInfo(tenantId: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }
  return tenant;
}

// ---- Update ----

export interface UpdateSettingsInput {
  officeHours?: OfficeHours;
  afterHoursMode?: 'voicemail' | 'transfer' | 'callback_promise';
  inboundRoutingMode?: InboundRoutingMode;
  transferNumber?: string;
  maxHoldSeconds?: number;
  voiceName?: string;
  voiceProvider?: 'grok';
  telephonyProvider?: 'telnyx' | 'ringcentral';
  provisionedNumber?: string;
  provisionedNumberSid?: string;
  appointmentTypes?: AppointmentType[];
  recallIntervalMonths?: number;
  notificationPreferences?: Record<string, boolean>;
  callSummaryEmail?: string | null;
  /** Free-text business description injected into the AI's system prompt on every call.
   *  Max 4000 chars (validated in the PATCH /settings route). */
  businessContext?: string | null;
}

export async function updateSettings(tenantId: string, input: UpdateSettingsInput) {
  const payload: UpdateSettingsInput = { ...input };
  if (input.voiceName !== undefined || input.voiceProvider !== undefined) {
    const coerced = coerceVoiceSettings({
      voiceName: input.voiceName,
      voiceProvider: input.voiceProvider,
    });
    payload.voiceName = coerced.voiceName;
    payload.voiceProvider = coerced.voiceProvider;
  }

  const [existing] = await db
    .select({ id: tenantSettings.id })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!existing) {
    // Auto-create if missing (first call after account creation)
    const [created] = await db
      .insert(tenantSettings)
      .values({ tenantId, ...payload })
      .returning();
    return created;
  }

  const [updated] = await db
    .update(tenantSettings)
    .set(payload)
    .where(eq(tenantSettings.tenantId, tenantId))
    .returning();

  return updated;
}

export async function updateTenantProfile(
  tenantId: string,
  input: { name?: string; timezone?: string; vertical?: string }
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.name === 'string' && input.name.trim()) {
    patch.name = input.name.trim().slice(0, 120);
  }
  if (typeof input.timezone === 'string' && input.timezone.trim()) {
    patch.timezone = input.timezone.trim();
  }
  if (input.vertical) {
    if (!_isVertical(input.vertical)) {
      throw new ValidationError(
        `Unknown vertical "${input.vertical}". Must be one of: ${_VERTICAL_VALUES.join(', ')}`
      );
    }
    patch.vertical = input.vertical;
  }

  if (Object.keys(patch).length === 1) {
    return getTenantInfo(tenantId);
  }

  const [updated] = await db
    .update(tenants)
    .set(patch)
    .where(eq(tenants.id, tenantId))
    .returning();

  if (!updated) throw new NotFoundError('Tenant not found');
  return updated;
}

export async function updateOfficeHours(tenantId: string, officeHours: OfficeHours) {
  return updateSettings(tenantId, { officeHours });
}

export async function updateAppointmentTypes(tenantId: string, appointmentTypes: AppointmentType[]) {
  if (!Array.isArray(appointmentTypes)) {
    throw new ValidationError('appointmentTypes must be an array');
  }
  return updateSettings(tenantId, { appointmentTypes });
}

// ---- Vertical (industry) ----

export { VERTICAL_VALUES, type Vertical, isVertical } from '@ai-receptionist/shared';

export async function updateVertical(tenantId: string, vertical: string) {
  if (!_isVertical(vertical)) {
    throw new ValidationError(
      `Unknown vertical "${vertical}". Must be one of: ${_VERTICAL_VALUES.join(', ')}`
    );
  }
  const [updated] = await db
    .update(tenants)
    .set({ vertical, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();

  if (!updated) throw new NotFoundError('Tenant not found');
  return updated;
}

// ---- Onboarding ----

export async function advanceOnboardingStep(tenantId: string, step: number) {
  const [tenant] = await db
    .select({ onboardingStep: tenants.onboardingStep })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) throw new NotFoundError('Tenant not found');

  const onboardingStep = nextOnboardingStep(tenant.onboardingStep, step);
  await db
    .update(tenants)
    .set({ onboardingStep, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
  return { onboardingStep };
}

export async function activateTenant(tenantId: string) {
  await db
    .update(tenants)
    .set({ isActive: true, onboardingStep: 5, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

export async function getOnboardingStatus(tenantId: string) {
  const [tenant] = await db
    .select({
      onboardingStep: tenants.onboardingStep,
      isActive: tenants.isActive,
      plan: tenants.plan,
      vertical: tenants.vertical,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) throw new NotFoundError('Tenant not found');

  const inboundRows = await db
    .select({
      phoneE164: tenantPhoneNumbers.phoneE164,
      provisionStatus: tenantPhoneNumbers.provisionStatus,
      provisionError: tenantPhoneNumbers.provisionError,
    })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        eq(tenantPhoneNumbers.purpose, 'inbound'),
        isNull(tenantPhoneNumbers.releasedAt)
      )
    )
    .orderBy(asc(tenantPhoneNumbers.purchasedAt));

  const activeInbound = inboundRows.find(
    (row) => (row.provisionStatus ?? 'active') === 'active' && isProvisionedE164(row.phoneE164)
  );
  const inbound = activeInbound ?? inboundRows[0] ?? null;

  return {
    currentStep: tenant.onboardingStep,
    uiStep: onboardingUiStep(tenant.onboardingStep, tenant.isActive),
    isActive: tenant.isActive,
    plan: tenant.plan,
    vertical: tenant.vertical,
    includesInboundDid: planIncludesInboundDid(tenant.plan),
    inbound: inbound
      ? {
          phoneE164: inbound.phoneE164,
          provisionStatus: inbound.provisionStatus ?? 'active',
          provisionError: inbound.provisionError,
        }
      : null,
    stepsCompleted: onboardingStepsCompleted(tenant.onboardingStep, tenant.isActive),
  };
}
