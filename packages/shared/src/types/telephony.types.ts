// ============================================================
// Telephony Adapter Interface — provider-agnostic contract
// Implemented by: TwilioAdapter, RingCentralAdapter
// ============================================================

export type TelephonyProvider = 'twilio' | 'ringcentral';

export interface ProvisionedNumber {
  phoneNumber: string;   // E.164 format e.g. "+15555550100"
  sid: string;           // Provider-specific identifier
  provider: TelephonyProvider;
}

export interface CallEvent {
  callSid: string;       // Provider call identifier
  from: string;          // Caller E.164 number
  to: string;            // Called E.164 number
  status: 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'canceled' | 'failed';
  direction: 'inbound' | 'outbound';
  tenantId?: string;     // Resolved from called number
}

export interface ITelephonyAdapter {
  readonly provider: TelephonyProvider;

  /**
   * Provision a new phone number for a tenant.
   * For Twilio: purchases a number via REST API.
   * For RingCentral: links an existing RC extension.
   */
  provisionNumber(tenantId: string, areaCode?: string): Promise<ProvisionedNumber>;

  /**
   * Transfer an active call to a human staff number.
   */
  transferCall(callSid: string, toNumber: string): Promise<void>;

  /**
   * Hang up an active call programmatically.
   */
  hangupCall(callSid: string): Promise<void>;

  /**
   * Retrieve a recording URL for a completed call (if available).
   */
  getCallRecording(callSid: string): Promise<string | null>;
}
