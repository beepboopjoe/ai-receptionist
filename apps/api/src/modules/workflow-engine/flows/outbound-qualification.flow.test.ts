/**
 * Tests for the outbound qualification flow.
 *
 * Strategy: mock all I/O (DB, scheduler, notifications) and test the
 * decision logic in isolation. We want to verify:
 * - qualified + slot → bookAppointment called, status='booked'
 * - qualified + no slot → status='qualified', staff task queued
 * - do_not_call → status='do_not_call'
 * - not_qualified → status='not_qualified'
 * - callback_requested → notes saved, status stays 'pending'
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock all external I/O ----
vi.mock('../../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../../crm/crm.service.js', () => ({
  identifyCaller: vi.fn(),
  createContact: vi.fn(),
}));

vi.mock('../../scheduler/scheduler.service.js', () => ({
  bookAppointment: vi.fn(),
}));

vi.mock('../../notifications/notification.service.js', () => ({
  queueNotification: vi.fn(),
}));

// ---- Import after mocks ----
import { db } from '../../../db/client.js';
import { identifyCaller, createContact } from '../../crm/crm.service.js';
import { bookAppointment } from '../../scheduler/scheduler.service.js';
import { queueNotification } from '../../notifications/notification.service.js';

// We test the decision logic via the exported function
// Since the flow imports from modules above (mocked), we can test it.
import { runOutboundQualificationFlow } from './outbound-qualification.flow.js';
import type { CallState } from '@ai-receptionist/shared';

// ---- Fixtures ----

const CAMPAIGN_CONTACT_ID = 'cc-123';
const TENANT_ID = 'tenant-abc';
const CALL_ID = 'call-xyz';
const CONTACT_ID = 'contact-001';
const APPOINTMENT_ID = 'appt-999';

function makeCallState(overrides: Partial<CallState['collectedData']> = {}): CallState {
  return {
    callId: CALL_ID,
    rcCallId: 'tw-callsid',
    tenantId: TENANT_ID,
    fromNumber: '+15559876543',
    toNumber: '+15551234567',
    contact: null,
    workflow: 'outbound_qualification' as any,
    currentStep: 'complete',
    retryCount: 0,
    collectedData: {
      campaignContactId: CAMPAIGN_CONTACT_ID,
      qualificationStatus: 'qualified',
      interestedInAppointmentType: 'cleaning',
      selectedSlotStart: '2025-04-25T10:00:00-04:00',
      preferredTimeOfDay: 'morning',
      email: 'lead@test.com',
      qualificationNotes: 'Interested in a cleaning — last visit 2 years ago',
      ...overrides,
    },
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    elevenLabsSessionId: null,
  };
}

function makeCampaignContact(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_CONTACT_ID,
    campaignId: 'campaign-001',
    tenantId: TENANT_ID,
    contactId: null,
    phoneE164: '+15559876543',
    firstName: 'Alice',
    lastName: 'Smith',
    email: null,
    status: 'connected',
    retryCount: 0,
    ...overrides,
  };
}

// ---- Chain-able drizzle mock builder ----
function mockDbChain(returnVal: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnVal),
    set: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return chain;
}

// ---- Tests ----

describe('runOutboundQualificationFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: DB returns campaign contact, no existing CRM contact
    vi.mocked(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeCampaignContact()]),
        }),
      }),
    });
    vi.mocked(db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    vi.mocked(db.execute as any).mockResolvedValue([{ activeCount: '0' }]);
    vi.mocked(identifyCaller as any).mockResolvedValue(null); // no existing contact
    vi.mocked(createContact as any).mockResolvedValue({ id: CONTACT_ID });
    vi.mocked(bookAppointment as any).mockResolvedValue({ id: APPOINTMENT_ID });
    vi.mocked(queueNotification as any).mockResolvedValue(undefined);
  });

  it('books appointment when lead is qualified with a selected slot', async () => {
    const state = makeCallState();
    const result = await runOutboundQualificationFlow(state);

    expect(createContact).toHaveBeenCalledWith(
      expect.objectContaining({ phoneE164: '+15559876543', firstName: 'Alice' }),
      TENANT_ID
    );
    expect(bookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        contactId: CONTACT_ID,
        appointmentType: expect.stringContaining('cleaning'),
      })
    );
    expect(result.outcome).toBe('booked');
    expect(result.appointmentId).toBe(APPOINTMENT_ID);
  });

  it('marks as qualified (no booking) when no slot was selected', async () => {
    const state = makeCallState({ selectedSlotStart: null });
    const result = await runOutboundQualificationFlow(state);

    expect(bookAppointment).not.toHaveBeenCalled();
    expect(queueNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'staff_task' })
    );
    expect(result.outcome).toBe('qualified');
  });

  it('uses existing CRM contact when phone matches', async () => {
    vi.mocked(identifyCaller as any).mockResolvedValue({ id: 'existing-contact-id', firstName: 'Alice' });
    const state = makeCallState();
    await runOutboundQualificationFlow(state);

    expect(createContact).not.toHaveBeenCalled();
    expect(bookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'existing-contact-id' })
    );
  });

  it('marks do_not_call and skips booking', async () => {
    const state = makeCallState({ qualificationStatus: 'do_not_call', selectedSlotStart: '2025-04-25T10:00:00' });
    const result = await runOutboundQualificationFlow(state);

    expect(bookAppointment).not.toHaveBeenCalled();
    expect(result.outcome).toBe('do_not_call');
  });

  it('marks not_qualified and skips booking', async () => {
    const state = makeCallState({ qualificationStatus: 'not_qualified' });
    const result = await runOutboundQualificationFlow(state);

    expect(bookAppointment).not.toHaveBeenCalled();
    expect(result.outcome).toBe('not_qualified');
  });

  it('handles callback_requested gracefully', async () => {
    const state = makeCallState({
      qualificationStatus: 'callback_requested',
      qualificationNotes: 'Call back Thursday afternoon',
    });
    const result = await runOutboundQualificationFlow(state);

    expect(bookAppointment).not.toHaveBeenCalled();
    expect(result.outcome).toBe('callback_requested');
  });

  it('returns no_action when campaignContactId is missing', async () => {
    const state = makeCallState();
    state.collectedData = {}; // no campaignContactId
    const result = await runOutboundQualificationFlow(state);

    expect(result.outcome).toBe('no_action');
  });

  it('still marks qualified if booking fails', async () => {
    vi.mocked(bookAppointment as any).mockRejectedValue(new Error('Calendar integration not connected'));
    const state = makeCallState();
    const result = await runOutboundQualificationFlow(state);

    // Booking failed but lead should still be saved as 'qualified'
    expect(result.outcome).toBe('qualified');
    expect(result.appointmentId).toBeUndefined();
  });
});
