// ============================================================
// Demo video catalog — one video per use case. Drop MP4s into
// apps/dashboard/public/videos/ with the names listed below;
// the player auto-detects missing files and shows a fallback.
//
// Recommended specs:
//   - 1080p, 16:9
//   - H.264 + AAC (universal browser compat)
//   - 30-90 seconds
//   - Keep file size under 8 MB so the page-load impact stays light
//   - Use the same Aria voice across all videos for brand consistency
// ============================================================
import type { Vertical } from '@/lib/verticals';

export interface DemoVideo {
  id: string;
  title: string;
  scenario: string;
  vertical: Vertical;
  /** Path relative to /public — e.g. '/videos/dental-recall.mp4'. */
  src: string;
  /** Poster image shown before play. Falls back to a styled placeholder. */
  poster?: string;
  /** Approx duration label shown on the card. */
  duration: string;
  /** Language tag for accessibility. */
  lang: 'en' | 'es';
}

export const DEMO_VIDEOS: DemoVideo[] = [
  {
    id: 'dental_recall',
    title: 'Patient Recall',
    scenario: 'AI calls an overdue patient and books their cleaning',
    vertical: 'dental',
    src: '/videos/dental-recall.mp4',
    duration: '45s',
    lang: 'en',
  },
  {
    id: 'dental_es_reminder',
    title: 'Recordatorio (Español)',
    scenario: 'AI confirma una cita en español',
    vertical: 'dental',
    src: '/videos/dental-es-reminder.mp4',
    duration: '35s',
    lang: 'es',
  },
  {
    id: 'insurance_quote',
    title: 'Quote Follow-Up',
    scenario: 'Warm lead — AI books a 15-min agent consultation',
    vertical: 'insurance',
    src: '/videos/insurance-quote.mp4',
    duration: '50s',
    lang: 'en',
  },
  {
    id: 'legal_intake',
    title: 'New Case Intake',
    scenario: 'After-hours injury call — AI qualifies and schedules',
    vertical: 'legal',
    src: '/videos/legal-intake.mp4',
    duration: '55s',
    lang: 'en',
  },
  {
    id: 'real_estate_showing',
    title: 'Showing Request',
    scenario: 'Buyer asks about a listing — AI books on the spot',
    vertical: 'real_estate',
    src: '/videos/real-estate-showing.mp4',
    duration: '45s',
    lang: 'en',
  },
  {
    id: 'home_services_hvac',
    title: 'HVAC Repair',
    scenario: 'AC stopped working — AI dispatches a technician',
    vertical: 'home_services',
    src: '/videos/home-services-hvac.mp4',
    duration: '40s',
    lang: 'en',
  },
  {
    id: 'generic_inbound',
    title: 'Inbound Call',
    scenario: 'Generic appointment booking flow',
    vertical: 'generic',
    src: '/videos/generic-inbound.mp4',
    duration: '40s',
    lang: 'en',
  },
];

/** Filter helper for the marketing pages. */
export function getVideosForVertical(vertical?: Vertical): DemoVideo[] {
  if (!vertical) return DEMO_VIDEOS;
  const match = DEMO_VIDEOS.filter((v) => v.vertical === vertical);
  return match.length > 0 ? match : DEMO_VIDEOS.filter((v) => v.vertical === 'generic');
}
