'use client';
// Day-one “sync the practice” panel — calendar, contact list, call notes.
// Appointment verticals (especially dental) see front-desk copy, not admin jargon.
import Link from 'next/link';
import { ArrowRight, CalendarDays, Mail, Upload } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';
import { useGoLive } from '@/lib/useGoLive';
import type { Vertical } from '@/lib/verticals';

const APPOINTMENT_VERTICALS: Vertical[] = [
  'dental',
  'legal',
  'insurance',
  'real_estate',
  'home_services',
  'generic',
];

function practiceCopy(verticalId: Vertical, contactPlural: string) {
  if (verticalId === 'dental') {
    return {
      eyebrow: 'Before the phones start ringing',
      title: 'Connect your practice',
      subtitle:
        'Three quick taps so the front desk can book around the real schedule, greet returning patients by name, and leave notes where your team already looks.',
      calendarTitle: 'Share the schedule',
      calendarDesc: 'Connect Google Calendar or Microsoft 365 so we book around real openings — not a guess.',
      calendarCta: 'Connect calendar',
      importTitle: 'Bring in your patients',
      importDesc: 'Upload a CSV. A Dentrix or Open Dental export works — first name, last name, and phone.',
      importCta: 'Upload patient list',
      notesTitle: 'Where should call notes go?',
      notesDesc: 'Pick the inbox that gets a summary after every call — like a sticky note for the front desk.',
      notesCta: 'Set the inbox',
    };
  }
  if (verticalId === 'legal') {
    return {
      eyebrow: 'Set up the firm',
      title: 'Connect your practice',
      subtitle: `Calendar, ${contactPlural}, and an inbox for call notes — so the AI can book consults and recognize returning callers.`,
      calendarTitle: 'Connect the calendar',
      calendarDesc: 'Google Calendar or Microsoft 365 so consults land on the real schedule.',
      calendarCta: 'Connect calendar',
      importTitle: `Import ${contactPlural}`,
      importDesc: 'Upload a CSV from Clio or your case software so returning callers are recognized.',
      importCta: `Import ${contactPlural}`,
      notesTitle: 'Where call notes go',
      notesDesc: 'Email a summary after every call to the inbox your team already checks.',
      notesCta: 'Set call notes email',
    };
  }
  return {
    eyebrow: 'Day-one setup',
    title: 'Connect your practice',
    subtitle: `Calendar, ${contactPlural}, and where call notes should land — so the AI can book and recognize returning callers.`,
    calendarTitle: 'Connect a calendar',
    calendarDesc: 'Google Calendar or Microsoft 365 lets the AI book live around real openings.',
    calendarCta: 'Connect calendar',
    importTitle: `Import ${contactPlural}`,
    importDesc: `Upload a CSV so returning ${contactPlural} are greeted by name.`,
    importCta: `Import ${contactPlural}`,
    notesTitle: 'Where to send call notes',
    notesDesc: 'Set the email that receives a summary after every conversation.',
    notesCta: 'Set call notes email',
  };
}

export function ConnectPracticePanel() {
  const vertical = useVertical();
  const goLive = useGoLive();

  if (!APPOINTMENT_VERTICALS.includes(vertical.id)) return null;
  if (goLive.loading) return null;
  if (goLive.practiceReady) return null;

  const copy = practiceCopy(vertical.id, vertical.contactNounPlural);
  const taps = [
    {
      done: goLive.hasCalendar,
      href: '/settings/integrations#calendar',
      icon: CalendarDays,
      title: copy.calendarTitle,
      desc: copy.calendarDesc,
      cta: copy.calendarCta,
    },
    {
      done: goLive.hasContacts,
      href: '/contacts#import',
      icon: Upload,
      title: copy.importTitle,
      desc: copy.importDesc,
      cta: copy.importCta,
    },
    {
      done: goLive.hasCallNotes,
      href: '/settings/notifications#call-notes',
      icon: Mail,
      title: copy.notesTitle,
      desc: copy.notesDesc,
      cta: copy.notesCta,
    },
  ];

  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-6 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-1">{copy.eyebrow}</p>
        <h2 className="font-serif text-xl text-cream-900 mb-1">{copy.title}</h2>
        <p className="text-sm text-cream-700 max-w-2xl">{copy.subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {taps.map((tap) => {
          const Icon = tap.icon;
          return (
            <Link
              key={tap.href}
              href={tap.href}
              className={`group rounded-xl border p-4 transition-all ${
                tap.done
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-cream-50/80 border-cream-200 hover:border-brand-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    tap.done ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white'
                  }`}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-cream-900 mb-0.5">{tap.title}</p>
                  <p className="text-xs text-cream-600 leading-relaxed mb-2">{tap.desc}</p>
                  {tap.done ? (
                    <span className="text-xs font-semibold text-emerald-700">Done</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-1.5 transition-all">
                      {tap.cta} <ArrowRight size={11} />
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
