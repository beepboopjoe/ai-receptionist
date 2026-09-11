// ============================================================
// Vertical switch helpers — migrate appointment types / strip
// legal practice-area blocks without touching calendar, CRM,
// or phone numbers.
// ============================================================

export const LEGAL_PRACTICE_AREA_BLOCK_RE =
  /<!--\s*legal-practice-area-v1\s*-->[\s\S]*?<!--\s*\/legal-practice-area-v1\s*-->/g;

export function stripLegalPracticeAreaBlock(context: string | null | undefined): string {
  if (!context) return '';
  return context.replace(LEGAL_PRACTICE_AREA_BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function shouldStripLegalBlock(fromVertical: string, toVertical: string): boolean {
  return fromVertical === 'legal' && toVertical !== 'legal';
}
