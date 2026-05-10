// ============================================================
// Vertical — single source of truth for the supported industry
// types across the entire monorepo. Both the API (validation,
// prompt selection, mock overlays, DB CHECK constraint) and the
// dashboard (UI config) import from here so the list never drifts.
//
// Add a new vertical:
//   1. Add the literal to `VERTICAL_VALUES` below
//   2. Add a config to `VERTICAL_CONFIGS` in apps/dashboard/src/lib/verticals.ts
//   3. Add a prompt set to apps/api/src/modules/voice-agent/vertical-prompts.ts
//   4. Add an overlay to apps/api/src/mocks/vertical-overlays.ts
//   5. Add the literal to the DB CHECK constraint via a new migration
// ============================================================

/** Frozen tuple — order is canonical for UI lists. */
export const VERTICAL_VALUES = [
  'dental',
  'insurance',
  'legal',
  'real_estate',
  'home_services',
  'generic',
] as const;

export type Vertical = typeof VERTICAL_VALUES[number];

/** True when the given string is a recognized vertical. */
export function isVertical(value: unknown): value is Vertical {
  return typeof value === 'string' && (VERTICAL_VALUES as readonly string[]).includes(value);
}

/** Returns the value if valid, otherwise the fallback (default 'generic'). */
export function asVertical(value: unknown, fallback: Vertical = 'generic'): Vertical {
  return isVertical(value) ? value : fallback;
}
