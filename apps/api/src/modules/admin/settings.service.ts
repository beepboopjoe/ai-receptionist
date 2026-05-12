// ============================================================
// Settings Service — tenant settings CRUD
// ============================================================
import { db } from '../../db/client.js';
import { tenantSettings, tenants } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { OfficeHours, AppointmentType } from '@ai-receptionist/shared';
import { ValidationError, NotFoundError } from '../../lib/errors.js';

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
  return settings;
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
  transferNumber?: string;
  maxHoldSeconds?: number;
  voiceName?: string;
  voiceProvider?: 'grok' | 'elevenlabs';
  telephonyProvider?: 'telnyx' | 'ringcentral';
  provisionedNumber?: string;
  provisionedNumberSid?: string;
  appointmentTypes?: AppointmentType[];
  recallIntervalMonths?: number;
  notificationPreferences?: Record<string, boolean>;
  callSummaryEmail?: string | null;
}

export async function updateSettings(tenantId: string, input: UpdateSettingsInput) {
  const [existing] = await db
    .select({ id: tenantSettings.id })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!existing) {
    // Auto-create if missing (first call after account creation)
    const [created] = await db
      .insert(tenantSettings)
      .values({ tenantId, ...input })
      .returning();
    return created;
  }

  const [updated] = await db
    .update(tenantSettings)
    .set(input)
    .where(eq(tenantSettings.tenantId, tenantId))
    .returning();

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
import { VERTICAL_VALUES as _VERTICAL_VALUES, isVertical as _isVertical } from '@ai-receptionist/shared';

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
  await db
    .update(tenants)
    .set({ onboardingStep: step, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

export async function activateTenant(tenantId: string) {
  await db
    .update(tenants)
    .set({ isActive: true, onboardingStep: 5, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

export async function getOnboardingStatus(tenantId: string) {
  const [tenant] = await db
    .select({ onboardingStep: tenants.onboardingStep, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) throw new NotFoundError('Tenant not found');

  return {
    currentStep: tenant.onboardingStep,
    isActive: tenant.isActive,
    stepsCompleted: {
      step1_telephony: tenant.onboardingStep >= 1,
      step2_calendar: tenant.onboardingStep >= 2,
      step3_contacts: tenant.onboardingStep >= 3,
      step4_rules: tenant.onboardingStep >= 4,
      step5_activate: tenant.isActive,
    },
  };
}
