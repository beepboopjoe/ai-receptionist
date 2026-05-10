// ============================================================
// CampaignFlowDiagram — 4-step "how outbound works" visual.
// Server component (no interactivity needed). Pure SVG + grid.
// ============================================================
import { Upload, Phone, MessageSquare, Calendar } from 'lucide-react';

const STEPS = [
  {
    num: '01',
    icon: Upload,
    title: 'Upload your list',
    desc: 'Pull from Dentrix, Eaglesoft, or Open Dental — or drop a CSV. Tag patients by overdue, treatment-pending, or inactive.',
  },
  {
    num: '02',
    icon: Phone,
    title: 'AI dials at the right time',
    desc: 'Smart pacing across business hours and time zones. Voicemail detection drops a tailored message. No spam, no spray-and-pray.',
  },
  {
    num: '03',
    icon: MessageSquare,
    title: 'Qualifies and books',
    desc: 'Real conversation: confirms identity, answers questions, finds a slot that works. Hands off to staff for anything human-only.',
  },
  {
    num: '04',
    icon: Calendar,
    title: 'Syncs to your calendar',
    desc: 'Appointments land in Google Calendar or your PMS instantly. Confirmation SMS goes out automatically.',
  },
];

export function CampaignFlowDiagram() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">How it works</p>
        <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
          From list to booked appointment, automated.
        </h2>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Connecting line */}
        <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent" />

        {STEPS.map(({ num, icon: Icon, title, desc }) => (
          <div key={num} className="relative bg-white border border-cream-200 rounded-2xl p-6 hover:border-brand-300 transition-colors">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-5">
              <Icon size={26} className="text-brand-600" strokeWidth={1.6} />
            </div>
            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-[0.2em]">{num}</span>
            <h3 className="font-serif text-xl text-cream-900 mt-2 leading-tight">{title}</h3>
            <p className="text-sm text-cream-600 mt-2 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
