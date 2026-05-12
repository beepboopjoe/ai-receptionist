// ============================================================
// Number porting flow.
//
// V1: customer fills the LOA form → we store a phone_port_requests
// row → an operator manually submits to Telnyx via their UI and
// updates the row's telnyxPortRequestId + status. This avoids the
// complexity of Telnyx's porting webhook handshakes while still
// getting the customer's data captured cleanly.
//
// V2 (deferred): direct submission via Telnyx's Number Porting API
// + webhook handler to flip status automatically.
// ============================================================
import { db } from '../../db/client.js';
import { phonePortRequests, tenantPhoneNumbers } from '../../db/schema.js';
import { and, asc, eq } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '../../lib/errors.js';

export interface PortRequestInput {
  phoneE164: string;
  currentCarrier: string;
  accountNumber: string;
  accountPin?: string;
  authorizedName: string;
  authorizedTitle?: string;
  serviceAddress: string;
  serviceCity: string;
  serviceState: string;
  serviceZip: string;
  desiredCompleteDate?: string; // ISO YYYY-MM-DD
}

export interface PortRequestRow {
  id: string;
  phoneE164: string;
  currentCarrier: string;
  status: string;
  desiredCompleteDate: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

function validateInput(input: PortRequestInput): void {
  if (!/^\+\d{8,15}$/.test(input.phoneE164)) {
    throw new ValidationError('phoneE164 must be E.164 (e.g. "+14155551234")');
  }
  for (const [key, val] of Object.entries({
    currentCarrier: input.currentCarrier,
    accountNumber: input.accountNumber,
    authorizedName: input.authorizedName,
    serviceAddress: input.serviceAddress,
    serviceCity: input.serviceCity,
    serviceState: input.serviceState,
    serviceZip: input.serviceZip,
  })) {
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      throw new ValidationError(`${key} is required`);
    }
  }
  if (input.serviceState.trim().length !== 2) {
    throw new ValidationError('serviceState must be a 2-letter US state code');
  }
  if (!/^\d{5}(-\d{4})?$/.test(input.serviceZip.trim())) {
    throw new ValidationError('serviceZip must be 5 digits (or ZIP+4)');
  }
}

export async function createPortRequest(params: {
  tenantId: string;
  input: PortRequestInput;
}): Promise<PortRequestRow> {
  validateInput(params.input);

  // Reject duplicate active port requests for the same number.
  const [existing] = await db
    .select({ id: phonePortRequests.id, status: phonePortRequests.status })
    .from(phonePortRequests)
    .where(
      and(
        eq(phonePortRequests.tenantId, params.tenantId),
        eq(phonePortRequests.phoneE164, params.input.phoneE164)
      )
    )
    .limit(1);
  if (existing && !['failed', 'cancelled', 'completed'].includes(existing.status)) {
    throw new ValidationError(`A port request for ${params.input.phoneE164} is already in progress`);
  }

  const [row] = await db
    .insert(phonePortRequests)
    .values({
      tenantId: params.tenantId,
      phoneE164: params.input.phoneE164,
      currentCarrier: params.input.currentCarrier,
      accountNumber: params.input.accountNumber,
      accountPin: params.input.accountPin ?? null,
      authorizedName: params.input.authorizedName,
      authorizedTitle: params.input.authorizedTitle ?? null,
      serviceAddress: params.input.serviceAddress,
      serviceCity: params.input.serviceCity,
      serviceState: params.input.serviceState.toUpperCase(),
      serviceZip: params.input.serviceZip,
      desiredCompleteDate: params.input.desiredCompleteDate ?? null,
      status: 'pending',
    })
    .returning();
  if (!row) throw new Error('Port request insert returned no row');

  return rowToView(row);
}

export async function listTenantPortRequests(tenantId: string): Promise<PortRequestRow[]> {
  const rows = await db
    .select()
    .from(phonePortRequests)
    .where(eq(phonePortRequests.tenantId, tenantId))
    .orderBy(asc(phonePortRequests.createdAt));
  return rows.map(rowToView);
}

export async function cancelPortRequest(params: {
  tenantId: string;
  portRequestId: string;
}): Promise<void> {
  const [row] = await db
    .select()
    .from(phonePortRequests)
    .where(
      and(
        eq(phonePortRequests.id, params.portRequestId),
        eq(phonePortRequests.tenantId, params.tenantId)
      )
    )
    .limit(1);
  if (!row) throw new NotFoundError('PortRequest', params.portRequestId);
  if (!['pending', 'submitted'].includes(row.status)) {
    throw new ValidationError(`Port request in status "${row.status}" cannot be cancelled`);
  }
  await db
    .update(phonePortRequests)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(phonePortRequests.id, params.portRequestId));
}

/**
 * Operator-side: once a port completes on the Telnyx side, this links
 * the number to the tenant by creating the tenant_phone_numbers row.
 * Called from an admin route (not currently exposed in the dashboard;
 * call directly from a Node REPL or via the admin API later).
 */
export async function markPortCompleted(params: {
  portRequestId: string;
  telnyxPhoneId: string;
}): Promise<void> {
  const [port] = await db
    .select()
    .from(phonePortRequests)
    .where(eq(phonePortRequests.id, params.portRequestId))
    .limit(1);
  if (!port) throw new NotFoundError('PortRequest', params.portRequestId);

  await db.insert(tenantPhoneNumbers).values({
    tenantId: port.tenantId,
    phoneE164: port.phoneE164,
    telnyxPhoneId: params.telnyxPhoneId,
    country: 'US',
    numberType: 'local',
    monthlyCostCents: 500,
    isPrimary: false,
    isPorted: true,
    portRequestId: port.id,
  });

  await db
    .update(phonePortRequests)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(phonePortRequests.id, port.id));
}

function rowToView(row: typeof phonePortRequests.$inferSelect): PortRequestRow {
  return {
    id: row.id,
    phoneE164: row.phoneE164,
    currentCarrier: row.currentCarrier,
    status: row.status,
    desiredCompleteDate: row.desiredCompleteDate,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
