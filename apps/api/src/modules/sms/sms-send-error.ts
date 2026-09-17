// ============================================================
// Map carrier SMS send failures to tenant-safe, honest errors.
// Does not claim A2P/10DLC registration or TCPA compliance.
// Never names infrastructure vendors in the returned message.
// ============================================================

export type ClassifiedSmsSendError = {
  httpStatus: 502;
  code: 'SmsCarrierRejected' | 'SmsSendFailed';
  message: string;
};

const A2P_HINT =
  /10\s*dlc|10dlc|a2p|campaign[_\s-]?id|brand[_\s-]?id|unregistered|messaging profile|not authorized to send|4030[0-9]|30022|30023/i;

/**
 * Classify a thrown send error. Residual risk: US A2P/10DLC may be
 * required by the carrier; we surface that as a possible cause, not
 * a completed registration.
 */
export function classifySmsSendError(err: unknown): ClassifiedSmsSendError {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (A2P_HINT.test(raw)) {
    return {
      httpStatus: 502,
      code: 'SmsCarrierRejected',
      message:
        'The carrier rejected this text. US application-to-person (A2P / 10DLC) registration may be required before this business number can send SMS. Telfin has not completed that registration for you — this is not a compliance certification.',
    };
  }
  return {
    httpStatus: 502,
    code: 'SmsSendFailed',
    message: 'Could not send this text right now. Try again in a moment.',
  };
}
