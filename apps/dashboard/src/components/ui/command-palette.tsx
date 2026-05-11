'use client';
// ============================================================
// CommandPalette — cmd-K global search.
//
// Mounted once in (app)/layout.tsx. Toggled with ⌘K / Ctrl-K
// (or by the sidebar search affordance). Debounces input,
// hits /search, and groups results by resource type.
//
// Keyboard:
//   ⌘K / Ctrl-K   open
//   Esc           close
//   ↑ / ↓         move selection
//   Enter         navigate to selected hit
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, Phone, Calendar, AlertCircle, X, ArrowRight } from 'lucide-react';
import { searchApi, type SearchHits } from '@/lib/api';
import { useVertical } from '@/lib/useVertical';

interface FlatHit {
  type: 'contact' | 'call' | 'appointment' | 'escalation';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const EMPTY: SearchHits = { contacts: [], calls: [], appointments: [], escalations: [] };

export function CommandPalette() {
  const router = useRouter();
  const vertical = useVertical();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHits>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchSeq = useRef(0);

  // ── Hotkey: ⌘K / Ctrl-K to open ─────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Focus the input whenever the palette opens ──────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setActiveIndex(0);
    } else {
      setQ('');
      setHits(EMPTY);
    }
  }, [open]);

  // ── Debounced search ────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setHits(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++fetchSeq.current;
    const t = setTimeout(async () => {
      try {
        const data = await searchApi.query(q.trim());
        // Drop stale responses if a newer query has fired.
        if (seq === fetchSeq.current) setHits(data);
      } catch {
        if (seq === fetchSeq.current) setHits(EMPTY);
      } finally {
        if (seq === fetchSeq.current) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  // ── Flatten hits into a single navigable list ───────────────
  const flat = useMemo<FlatHit[]>(() => {
    const list: FlatHit[] = [];
    for (const c of hits.contacts) {
      list.push({
        type: 'contact',
        id: c.id,
        title: `${c.firstName} ${c.lastName}`.trim() || c.phoneE164,
        subtitle: [c.phoneE164, c.email].filter(Boolean).join(' · '),
        href: `/contacts/${c.id}`,
      });
    }
    for (const call of hits.calls) {
      list.push({
        type: 'call',
        id: call.id,
        title: call.fromNumber,
        subtitle: call.summary ?? call.status,
        href: `/calls/${call.id}`,
      });
    }
    for (const a of hits.appointments) {
      list.push({
        type: 'appointment',
        id: a.id,
        title: a.appointmentType,
        subtitle: [a.providerName, a.startsAt && new Date(a.startsAt).toLocaleString()]
          .filter(Boolean)
          .join(' · '),
        href: `/appointments`,
      });
    }
    for (const e of hits.escalations) {
      list.push({
        type: 'escalation',
        id: e.id,
        title: e.reason,
        subtitle: `${e.priority} · ${e.status}`,
        href: `/escalations`,
      });
    }
    return list;
  }, [hits]);

  // Reset active row when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [flat.length]);

  function go(hit: FlatHit) {
    setOpen(false);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const hit = flat[activeIndex];
      if (hit) go(hit);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4 bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Search ${vertical.contactNounPlural}, calls, ${vertical.appointmentNounPlural}…`}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
          />
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <Hint text={`Type at least 2 characters. Try a name, phone, or ${vertical.appointmentNoun} type.`} />
          ) : loading ? (
            <Hint text="Searching…" />
          ) : flat.length === 0 ? (
            <Hint text="No matches." />
          ) : (
            <ul className="py-1">
              {flat.map((hit, i) => (
                <HitRow
                  key={`${hit.type}-${hit.id}`}
                  hit={hit}
                  active={i === activeIndex}
                  onClick={() => go(hit)}
                  onHover={() => setActiveIndex(i)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-3">
          <KeyHint>↑↓</KeyHint> navigate
          <KeyHint>↵</KeyHint> open
          <KeyHint>esc</KeyHint> close
        </div>
      </div>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <div className="px-4 py-6 text-sm text-gray-400 text-center">{text}</div>;
}

const ICONS = {
  contact: Users,
  call: Phone,
  appointment: Calendar,
  escalation: AlertCircle,
} as const;

const TYPE_LABEL = {
  contact: 'Contact',
  call: 'Call',
  appointment: 'Appointment',
  escalation: 'Escalation',
} as const;

function HitRow({
  hit,
  active,
  onClick,
  onHover,
}: {
  hit: FlatHit;
  active: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  const Icon = ICONS[hit.type];
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          active ? 'bg-brand-50' : 'hover:bg-gray-50'
        }`}
      >
        <Icon size={16} className={active ? 'text-brand-600' : 'text-gray-400'} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${active ? 'text-brand-900 font-medium' : 'text-gray-900'}`}>
            {hit.title}
          </p>
          <p className="text-xs text-gray-500 truncate">{hit.subtitle}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0">
          {TYPE_LABEL[hit.type]}
        </span>
        <ArrowRight size={13} className={`shrink-0 ${active ? 'text-brand-600' : 'text-gray-300'}`} />
      </button>
    </li>
  );
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-[10px] text-gray-600">
      {children}
    </kbd>
  );
}
