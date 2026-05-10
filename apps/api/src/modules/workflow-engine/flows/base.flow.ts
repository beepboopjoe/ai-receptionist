// ============================================================
// Base flow — common interface all flows implement
// ============================================================
import type { FlowResult, CallState } from '@ai-receptionist/shared';

export interface BaseFlow {
  execute(state: CallState): Promise<FlowResult>;
}
