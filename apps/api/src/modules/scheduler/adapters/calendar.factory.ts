// ============================================================
// Calendar adapter factory — resolves concrete adapter by provider name
// ============================================================
import type { ICalendarAdapter } from './base.adapter.js';
import { GoogleCalendarAdapter, type GoogleCalendarAdapterOpts } from './google.adapter.js';
import { MicrosoftCalendarAdapter } from './microsoft.adapter.js';

export function createCalendarAdapter(
  provider: string,
  credentials: Record<string, string>,
  opts?: GoogleCalendarAdapterOpts
): ICalendarAdapter {
  if (provider === 'google') {
    return new GoogleCalendarAdapter(credentials, opts);
  }
  if (provider === 'microsoft') {
    return new MicrosoftCalendarAdapter(credentials);
  }
  throw new Error(`Unknown calendar provider: ${provider}. Supported: google, microsoft`);
}

export function getSupportedCalendarProviders(): string[] {
  return ['google', 'microsoft'];
}
