// ============================================================
// Call state machine — tracks which step a call is currently on
// ============================================================
import { saveCallState, getCallState, updateCallState } from '../voice-agent/session-manager.js';
import type { CallState, FlowStep, CollectedCallData, WorkflowType } from '@ai-receptionist/shared';
import type { Contact } from '@ai-receptionist/shared';

export async function initCallState(params: {
  callId: string;
  rcCallId: string;
  tenantId: string;
  fromNumber: string;
  contact: Contact | null;
  workflow: WorkflowType | null;
}): Promise<CallState> {
  const state: CallState = {
    callId: params.callId,
    rcCallId: params.rcCallId,
    tenantId: params.tenantId,
    fromNumber: params.fromNumber,
    contact: params.contact,
    workflow: params.workflow,
    currentStep: 'greeting',
    retryCount: 0,
    collectedData: {},
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    elevenLabsSessionId: null,
  };
  await saveCallState(state);
  return state;
}

export async function advanceStep(rcCallId: string, step: FlowStep): Promise<CallState | null> {
  return updateCallState(rcCallId, { currentStep: step });
}

export async function incrementRetry(rcCallId: string): Promise<number> {
  const state = await getCallState(rcCallId);
  if (!state) return 0;
  const newCount = state.retryCount + 1;
  await updateCallState(rcCallId, { retryCount: newCount });
  return newCount;
}

export async function collectData(
  rcCallId: string,
  data: Partial<CollectedCallData>
): Promise<void> {
  const state = await getCallState(rcCallId);
  if (!state) return;
  await updateCallState(rcCallId, {
    collectedData: { ...state.collectedData, ...data },
  });
}

export const MAX_RETRIES = 3;
