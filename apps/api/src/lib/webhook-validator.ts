// ============================================================
// Webhook HMAC validation for RingCentral events
// ============================================================
import crypto from 'crypto';
import type { FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { UnauthorizedError } from './errors.js';

/**
 * Validate a RingCentral webhook request.
 * RC sends a Validation-Token header for initial URL validation.
 * For live events, it sends a signature we verify via HMAC-SHA256.
 */
export function validateRingCentralWebhook(request: FastifyRequest): void {
  const validationToken = request.headers['validation-token'];

  // Initial webhook registration challenge — just needs to be returned as-is
  if (validationToken) {
    return; // Handled in the route handler
  }

  const signature = request.headers['x-ringcentral-signature'] as string | undefined;
  if (!signature) {
    throw new UnauthorizedError('Missing RingCentral signature header');
  }

  const verificationToken = config.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN;
  if (!verificationToken) {
    // In dev without a token configured, skip validation
    return;
  }

  const body = JSON.stringify(request.body);
  const expectedSig = crypto
    .createHmac('sha256', verificationToken)
    .update(body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    throw new UnauthorizedError('Invalid RingCentral webhook signature');
  }
}

/**
 * Validate an ElevenLabs webhook (if needed in future).
 */
export function validateGenericHmac(
  payload: string,
  secret: string,
  receivedSig: string
): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expected));
  } catch {
    return false;
  }
}
