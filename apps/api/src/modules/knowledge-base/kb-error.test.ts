import { describe, it, expect } from 'vitest';
import { sanitizeKbErrorMessage, KB_PROCESSING_UNAVAILABLE } from './kb-error.js';

describe('sanitizeKbErrorMessage', () => {
  it('returns null for empty input', () => {
    expect(sanitizeKbErrorMessage(null)).toBeNull();
    expect(sanitizeKbErrorMessage('')).toBeNull();
  });

  it('strips OpenAI 401 bodies and API keys', () => {
    const raw =
      'Integration error [openai]: Embeddings call failed (401): {"error":{"message":"Incorrect API key provided: sk-abc123","type":"invalid_api_key"}}';
    expect(sanitizeKbErrorMessage(raw)).toBe(KB_PROCESSING_UNAVAILABLE);
  });

  it('strips generic vendor JSON', () => {
    expect(sanitizeKbErrorMessage('failed: {"error":"nope"}')).toBe(KB_PROCESSING_UNAVAILABLE);
  });

  it('keeps short actionable copy', () => {
    expect(sanitizeKbErrorMessage('Unsupported file type.')).toBe('Unsupported file type.');
  });
});
