// ============================================================
// Calendar adapter factory — resolves concrete adapter by provider name
// ============================================================
import type { ICalendarAdapter } from './base.adapter.js';
import { GoogleCalendarAdapter } from './google.adapter.js';
import { MicrosoftCalendarAdapter } from './microsoft.adapter.js';

type AdapterConstructor = new (credentials: Record<string, string>) => ICalendarAdapter;

const registry: Record<string, AdapterConstructor> = {
  google: GoogleCalendarAdapter,
  microsoft: MicrosoftCalendarAdapter,
};

export function createCalendarAdapter(
  provider: string,
  credentials: Record<string, string>
): ICalendarAdapter {
  const Adapter = registry[provider];
  if (!Adapter) {
    throw new Error(`Unknown calendar provider: ${provider}. Supported: ${Object.keys(registry).join(', ')}`);
  }
  return new Adapter(credentials);
}

export function getSupportedCalendarProviders(): string[] {
  return Object.keys(registry);
}
