'use client';
// ============================================================
// /leads/discover — Phase 12.7. Find leads via Apify Google Maps
// Scraper. Customer fills the search form → cost preview → start
// run → poll progress → review results → import to a draft campaign.
// ============================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Search,
  MapPin,
  Star,
  Phone,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import {
  leadDiscoveryApi,
  type LeadDiscoveryParams,
  type LeadDiscoveryJob,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useFeatureFlags } from '@/lib/featureFlags';
import { LockedFeature } from '@/components/ui/locked-feature';
import { SectionAgent } from '@/components/dashboard/section-agent';

const RADIUS_OPTIONS = [5, 10, 25, 50];
const MAX_OPTIONS = [25, 50, 100, 250];

export default function LeadDiscoveryPage() {
  const router = useRouter();
  const toast = useToast();
  const { has, loading: flagsLoading } = useFeatureFlags();
  const outboundEnabled = flagsLoading ? true : has('outbound_campaigns');

  // ── Form state ────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [minRating, setMinRating] = useState(0);
  const [requirePhone, setRequirePhone] = useState(true);
  const [maxResults, setMaxResults] = useState(50);

  const [estimate, setEstimate] = useState<{ leads: number; cents: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const formValid = query.trim().length > 0 && locationQuery.trim().length > 0;

  function searchParams(): LeadDiscoveryParams {
    return {
      query: query.trim(),
      locationQuery: locationQuery.trim(),
      radiusMiles,
      minRating: minRating > 0 ? minRating : undefined,
      requirePhone,
      maxResults,
    } as LeadDiscoveryParams;
  }

  // Debounced cost preview
  useEffect(() => {
    if (!formValid) {
      setEstimate(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const result = await leadDiscoveryApi.preview(searchParams());
        setEstimate({ leads: result.estimatedLeads, cents: result.costCents });
      } catch {
        setEstimate(null);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, locationQuery, radiusMiles, minRating, requirePhone, maxResults, formValid]);

  async function handleStart() {
    if (!formValid) return;
    setStarting(true);
    try {
      const result = await leadDiscoveryApi.start(searchParams());
      setActiveJobId(result.jobId);
      toast.success('Discovery started. Results in a couple minutes.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Discovery failed to start');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionAgent section="lead-discovery" />

      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Lead Discovery</h1>
        <p className="text-gray-500 mt-1">
          Tell us who you want to call. We scrape Google Maps, you review, you launch.
        </p>
      </div>

      {/* TCPA banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm text-amber-900">
          <p className="font-semibold">These will be cold leads — verify TCPA compliance.</p>
          <p className="mt-1 leading-relaxed">
            Recipients may be on Do Not Call lists. We recommend reviewing each lead and confirming
            you have a permissible purpose before calling.
          </p>
        </div>
      </div>

      {!outboundEnabled ? (
        <LockedFeature requiredPlan="growth" reason="outbound_locked" label="Lead Discovery is a Growth+ feature">
          <SearchForm
            query={query}
            setQuery={setQuery}
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            radiusMiles={radiusMiles}
            setRadiusMiles={setRadiusMiles}
            minRating={minRating}
            setMinRating={setMinRating}
            requirePhone={requirePhone}
            setRequirePhone={setRequirePhone}
            maxResults={maxResults}
            setMaxResults={setMaxResults}
            estimate={estimate}
            formValid={formValid}
            starting={starting}
            onStart={handleStart}
          />
        </LockedFeature>
      ) : (
        <SearchForm
          query={query}
          setQuery={setQuery}
          locationQuery={locationQuery}
          setLocationQuery={setLocationQuery}
          radiusMiles={radiusMiles}
          setRadiusMiles={setRadiusMiles}
          minRating={minRating}
          setMinRating={setMinRating}
          requirePhone={requirePhone}
          setRequirePhone={setRequirePhone}
          maxResults={maxResults}
          setMaxResults={setMaxResults}
          estimate={estimate}
          formValid={formValid}
          starting={starting}
          onStart={handleStart}
        />
      )}

      {activeJobId && (
        <ActiveJobCard
          jobId={activeJobId}
          onImported={(campaignId) => {
            router.push(`/campaigns/${campaignId}`);
          }}
        />
      )}

      <JobHistory />
    </div>
  );
}

// ── Search form ──────────────────────────────────────────────────────────────

interface FormProps {
  query: string;
  setQuery: (v: string) => void;
  locationQuery: string;
  setLocationQuery: (v: string) => void;
  radiusMiles: number;
  setRadiusMiles: (v: number) => void;
  minRating: number;
  setMinRating: (v: number) => void;
  requirePhone: boolean;
  setRequirePhone: (v: boolean) => void;
  maxResults: number;
  setMaxResults: (v: number) => void;
  estimate: { leads: number; cents: number } | null;
  formValid: boolean;
  starting: boolean;
  onStart: () => void;
}

function SearchForm(p: FormProps) {
  return (
    <div className="card p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            What are you looking for?
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={p.query}
              onChange={(e) => p.setQuery(e.target.value)}
              placeholder="dentists, coffee shops, hair salons…"
              className="input pl-9"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Describe the business type the way you&apos;d search Google Maps.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Where?</label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={p.locationQuery}
              onChange={(e) => p.setLocationQuery(e.target.value)}
              placeholder="Chicago, IL"
              className="input pl-9"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            City + state or ZIP works best.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Radius</label>
          <select
            value={p.radiusMiles}
            onChange={(e) => p.setRadiusMiles(Number(e.target.value))}
            className="input"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} miles
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min rating</label>
          <select
            value={p.minRating}
            onChange={(e) => p.setMinRating(Number(e.target.value))}
            className="input"
          >
            <option value={0}>Any</option>
            <option value={3.0}>3.0+</option>
            <option value={3.5}>3.5+</option>
            <option value={4.0}>4.0+</option>
            <option value={4.5}>4.5+</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max results</label>
          <select
            value={p.maxResults}
            onChange={(e) => p.setMaxResults(Number(e.target.value))}
            className="input"
          >
            {MAX_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={p.requirePhone}
              onChange={(e) => p.setRequirePhone(e.target.checked)}
              className="rounded border-gray-300"
            />
            Phone number required
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <div className="text-sm">
          {p.estimate ? (
            <span className="text-gray-700">
              ≈ <span className="font-bold tabular-nums">{p.estimate.leads}</span> leads ·{' '}
              <span className="font-bold tabular-nums text-brand-700">
                ${(p.estimate.cents / 100).toFixed(2)}
              </span>{' '}
              max
            </span>
          ) : (
            <span className="text-gray-400">Cost preview appears when the form is filled in.</span>
          )}
        </div>
        <button
          type="button"
          onClick={p.onStart}
          disabled={!p.formValid || p.starting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {p.starting ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Starting…
            </>
          ) : (
            <>
              <Search size={14} /> Start discovery
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Active job card ──────────────────────────────────────────────────────────

function ActiveJobCard({
  jobId,
  onImported,
}: {
  jobId: string;
  onImported: (campaignId: string) => void;
}) {
  const { data: job, isLoading } = useSWR(
    ['discovery-job', jobId],
    () => leadDiscoveryApi.get(jobId),
    {
      refreshInterval: (latest) => {
        if (!latest) return 5_000;
        return latest.status === 'running' || latest.status === 'pending' ? 5_000 : 0;
      },
    }
  );

  if (isLoading || !job) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          Waiting for discovery results…
        </div>
      </div>
    );
  }

  if (job.status === 'pending' || job.status === 'running') {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-brand-600" />
          <div>
            <p className="font-semibold text-sm text-gray-900">
              Scraping in progress…
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Apify is collecting matches. Usually finishes in 1–3 minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (job.status === 'failed') {
    return (
      <div className="card p-5 border-red-200 bg-red-50">
        <p className="font-semibold text-sm text-red-800">Discovery failed</p>
        <p className="text-xs text-red-700 mt-1">{job.errorMessage ?? 'Unknown error'}</p>
      </div>
    );
  }

  return <ResultsTable job={job} onImported={onImported} />;
}

// ── Results table with row-level selection ───────────────────────────────────

function ResultsTable({
  job,
  onImported,
}: {
  job: LeadDiscoveryJob;
  onImported: (campaignId: string) => void;
}) {
  const toast = useToast();
  const records = (job.rawResults ?? []) as Array<Record<string, any>>;
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(records.map((_, i) => i))
  );
  const [importing, setImporting] = useState(false);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(records.map((_, i) => i)));
  }
  function selectNone() {
    setSelected(new Set());
  }

  async function handleImport() {
    if (selected.size === 0) {
      toast.error('Select at least one lead first');
      return;
    }
    setImporting(true);
    try {
      const result = await leadDiscoveryApi.import(job.id, {
        selectedIndices: Array.from(selected),
      });
      toast.success(`Created draft campaign with ${result.leadsImported} leads.`);
      onImported(result.campaignId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const costCents = selected.size * 99; // matches LEAD_DISCOVERY_PRICE_CENTS

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-sm text-gray-900">
            {records.length} leads found
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Uncheck any you don&apos;t want before importing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 underline"
          >
            Select none
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
        {records.map((r, i) => (
          <label
            key={i}
            className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggle(i)}
              className="mt-1 rounded border-gray-300"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {r['title'] ?? 'Unknown business'}
                </p>
                {r['totalScore'] != null && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    {Number(r['totalScore']).toFixed(1)}
                  </span>
                )}
                {r['categoryName'] && (
                  <span className="text-[11px] text-gray-400">· {r['categoryName']}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                {r['phone'] && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={11} /> {r['phone']}
                  </span>
                )}
                {r['address'] && <span className="truncate">{r['address']}</span>}
                {r['website'] && (
                  <a
                    href={r['website'] as string}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-brand-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Site <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50">
        <p className="text-sm text-gray-700">
          <span className="font-bold tabular-nums">{selected.size}</span> selected ·{' '}
          <span className="text-brand-700 font-bold tabular-nums">
            ${(costCents / 100).toFixed(2)}
          </span>
        </p>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing || selected.size === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white text-sm font-semibold px-5 py-2 hover:bg-brand-700 transition-colors disabled:opacity-60"
        >
          {importing ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Importing…
            </>
          ) : (
            <>
              <CheckCircle size={14} /> Add to a new campaign
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Past jobs history ────────────────────────────────────────────────────────

function JobHistory() {
  const { data } = useSWR('lead-discovery-history', () => leadDiscoveryApi.list());
  const jobs = data?.data ?? [];
  if (jobs.length === 0) return null;

  return (
    <div className="card">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-900">Past discoveries</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {jobs.slice(0, 10).map((j) => {
          const sp = j.searchParams;
          return (
            <div key={j.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {sp.query}{' '}
                  <span className="text-gray-400 font-normal">in {sp.locationQuery}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(j.createdAt).toLocaleDateString()} ·{' '}
                  {j.status === 'imported'
                    ? `${j.leadsImported} imported · $${(j.costCents / 100).toFixed(2)}`
                    : `${j.leadsFound} found`}
                </p>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  j.status === 'imported'
                    ? 'bg-emerald-50 text-emerald-700'
                    : j.status === 'succeeded'
                      ? 'bg-blue-50 text-blue-700'
                      : j.status === 'failed'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-50 text-gray-600'
                }`}
              >
                {j.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
