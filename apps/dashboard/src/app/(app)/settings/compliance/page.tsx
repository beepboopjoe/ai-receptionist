'use client';
// ============================================================
// Settings → Compliance
//
// HIPAA compliance hub. Owner-only actions (sign BAA, toggle
// HIPAA mode, set data retention). All authenticated users can
// view the read-only checklist and BAA status.
//
// Sections:
//   1. BAA Status (sign / view)
//   2. HIPAA Mode toggle (post-BAA)
//   3. Data Retention settings
//   4. Technical Controls checklist (static)
//   5. Recent Compliance Events
// ============================================================
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { complianceApi } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useTenant } from '@/lib/TenantProvider';

// ── BAA text (abbreviated summary for display) ────────────────────────────────
const BAA_SUMMARY = `This Business Associate Agreement ("BAA") is entered into between the Covered Entity
(you, the healthcare practice or covered entity identified in your account) and the
Business Associate (our platform and its affiliates).

PURPOSE: As your AI receptionist and scheduling platform, we may receive, store, or
transmit Protected Health Information ("PHI") including patient names, phone numbers,
appointment details, and call recordings made in connection with your dental or healthcare
practice.

OUR OBLIGATIONS:
• We will not use or disclose PHI except as required to provide the services or as required
  by law.
• We will use appropriate safeguards — including encryption in transit (TLS 1.2+),
  encryption at rest (AES-256), and role-based access controls — to prevent unauthorized
  use or disclosure.
• We will report any breach of unsecured PHI to you within 60 days of discovery.
• We will ensure any subcontractors who receive PHI agree to the same obligations.
• We will make PHI available for amendment, accounting of disclosures, and access as
  required by HIPAA.
• We will return or destroy PHI upon termination of the service agreement.

YOUR OBLIGATIONS:
• You are solely responsible for obtaining necessary patient authorizations under applicable
  law before using the platform to process PHI.
• You will notify us of any changes in your privacy practices that may affect our obligations.
• You will not instruct us to use or disclose PHI in a manner that violates HIPAA.

This BAA is effective upon your electronic acceptance and will remain in effect until the
underlying service agreement is terminated. This BAA is incorporated by reference into your
Terms of Service.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const EVENT_LABELS: Record<string, string> = {
  baa_accepted:        'BAA signed',
  hipaa_mode_enabled:  'HIPAA mode enabled',
  hipaa_mode_disabled: 'HIPAA mode disabled',
  retention_changed:   'Data retention updated',
  settings_changed:    'Compliance settings changed',
};

const EVENT_COLORS: Record<string, string> = {
  baa_accepted:        'badge-green',
  hipaa_mode_enabled:  'badge-blue',
  hipaa_mode_disabled: 'badge-yellow',
  retention_changed:   'badge-blue',
  settings_changed:    'badge-gray',
};

// ── Technical control items ───────────────────────────────────────────────────
function ControlItem({
  done,
  label,
  note,
}: {
  done: boolean;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {done ? (
        <CheckCircle2 size={18} className="text-green-500 mt-0.5 shrink-0" />
      ) : (
        <Circle size={18} className="text-gray-300 mt-0.5 shrink-0" />
      )}
      <div>
        <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>
          {label}
        </p>
        {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-brand-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CompliancePage() {
  const toast = useToast();
  const { tenant } = useTenant();

  const {
    data: status,
    isLoading,
    mutate,
  } = useSWR('compliance-status', () => complianceApi.getStatus());

  const { data: eventsData, isLoading: eventsLoading } = useSWR(
    'compliance-events',
    () => complianceApi.getEvents()
  );

  // BAA acceptance state
  const [baaExpanded, setBaaExpanded] = useState(false);
  const [baaChecked, setBaaChecked] = useState(false);
  const [signingBaa, setSigningBaa] = useState(false);

  // HIPAA mode state
  const [savingMode, setSavingMode] = useState(false);

  // Retention state
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [savingRetention, setSavingRetention] = useState(false);

  const currentRetention = retentionDays ?? status?.dataRetentionDays ?? 2555;

  async function handleSignBaa() {
    if (!baaChecked) {
      toast.error('Please check the acceptance box before signing.');
      return;
    }
    setSigningBaa(true);
    try {
      await complianceApi.acceptBaa();
      await mutate();
      toast.success('BAA signed — HIPAA mode has been enabled.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign BAA');
    } finally {
      setSigningBaa(false);
    }
  }

  async function handleToggleHipaaMode(enabled: boolean) {
    setSavingMode(true);
    try {
      await complianceApi.updateSettings({ hipaaMode: enabled });
      await mutate();
      toast.success(enabled ? 'HIPAA mode enabled' : 'HIPAA mode disabled');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSavingMode(false);
    }
  }

  async function handleSaveRetention(e: React.FormEvent) {
    e.preventDefault();
    if (retentionDays === null) return;
    if (retentionDays < 365 || retentionDays > 3650) {
      toast.error('Retention must be between 365 and 3,650 days');
      return;
    }
    setSavingRetention(true);
    try {
      await complianceApi.updateSettings({ dataRetentionDays: retentionDays });
      await mutate();
      setRetentionDays(null);
      toast.success('Data retention updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update retention');
    } finally {
      setSavingRetention(false);
    }
  }

  const events = eventsData?.data ?? [];

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Compliance</h1>
        <p className="text-gray-500 mt-1">
          HIPAA Business Associate Agreement, session security, and data retention settings.
        </p>
      </div>

      {/* ── Section 1: BAA Status ─────────────────────────────────────────── */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-brand-600" />
          <h2 className="font-semibold text-gray-900">Business Associate Agreement (BAA)</h2>
        </div>

        {isLoading ? (
          <ListRowSkeleton rows={2} />
        ) : status?.baaAccepted ? (
          /* ── Signed state ── */
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-start gap-3">
            <ShieldCheck size={20} className="text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-900 text-sm">BAA signed</p>
              <p className="text-sm text-green-700 mt-0.5">
                Accepted by{' '}
                <span className="font-medium">{status.baaSignerEmail ?? 'account owner'}</span>
                {status.baaAcceptedAt && (
                  <> on {fmt(status.baaAcceptedAt)}</>
                )}
              </p>
              <p className="text-xs text-green-600 mt-2">
                This agreement is permanently recorded. Contact{' '}
                <a
                  href="mailto:compliance@aireceptionist.com"
                  className="underline hover:text-green-800"
                >
                  compliance@aireceptionist.com
                </a>{' '}
                if you need a copy for your records.
              </p>
            </div>
          </div>
        ) : (
          /* ── Unsigned state ── */
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <ShieldAlert size={20} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">BAA not yet signed</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  If your practice is subject to HIPAA (e.g. dental, medical, mental health),
                  you must sign a BAA before processing patient information through this
                  platform. Review and sign below.
                </p>
              </div>
            </div>

            {/* BAA accordion */}
            <button
              type="button"
              onClick={() => setBaaExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <span className="flex items-center gap-2">
                <FileText size={15} />
                Read the Business Associate Agreement
              </span>
              {baaExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>

            {baaExpanded && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 max-h-72 overflow-y-auto">
                <pre className="text-xs text-gray-700 font-sans whitespace-pre-wrap leading-relaxed">
                  {BAA_SUMMARY}
                </pre>
              </div>
            )}

            {/* Acceptance checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={baaChecked}
                onChange={(e) => setBaaChecked(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700">
                I have read and accept the Business Associate Agreement on behalf of{' '}
                <span className="font-semibold">{tenant?.name ?? 'my organization'}</span>, and I
                am authorized to bind my organization to this agreement.
              </span>
            </label>

            <button
              type="button"
              onClick={handleSignBaa}
              disabled={!baaChecked || signingBaa}
              className="btn-primary disabled:opacity-50"
            >
              <ShieldCheck size={16} />
              {signingBaa ? 'Signing…' : 'Sign BAA'}
            </button>
          </div>
        )}
      </section>

      {/* ── Section 2: HIPAA Mode ─────────────────────────────────────────── */}
      {status?.baaAccepted && (
        <section className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock size={18} className="text-brand-600" />
            HIPAA Mode
          </h2>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 font-medium">Idle session timeout</p>
              <p className="text-sm text-gray-500 mt-0.5">
                When enabled, users will be automatically signed out after{' '}
                <strong>15 minutes</strong> of inactivity. A warning appears at the 13-minute
                mark. Required for practices subject to the HIPAA Workstation Security rule.
              </p>
            </div>
            <Toggle
              checked={status.hipaaMode}
              onChange={handleToggleHipaaMode}
              disabled={savingMode}
            />
          </div>

          {status.hipaaMode && (
            <div className="rounded-lg bg-brand-50 border border-brand-100 px-4 py-3 text-sm text-brand-800 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-brand-600 shrink-0" />
              HIPAA mode is active — all sessions time out after 15 minutes of inactivity.
            </div>
          )}
        </section>
      )}

      {/* ── Section 3: Data Retention ─────────────────────────────────────── */}
      {status?.baaAccepted && (
        <section className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Data Retention</h2>
          <p className="text-sm text-gray-500">
            How long call logs, contact records, and appointment history are retained before
            automatic deletion. HIPAA requires a minimum of 6 years (2,190 days) for most
            medical records. We recommend 7 years (2,555 days) as a safe default.
          </p>

          <form onSubmit={handleSaveRetention} className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Retention period (days)
              </label>
              <input
                type="number"
                min={365}
                max={3650}
                value={retentionDays ?? status?.dataRetentionDays ?? 2555}
                onChange={(e) => setRetentionDays(parseInt(e.target.value, 10))}
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">
                Min 365 (1 yr) · Rec 2,555 (7 yr) · Max 3,650 (10 yr)
              </p>
            </div>
            <button
              type="submit"
              disabled={savingRetention || retentionDays === null}
              className="btn-primary disabled:opacity-50"
            >
              {savingRetention ? 'Saving…' : 'Save'}
            </button>
          </form>

          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-500" />
            Reducing the retention window will schedule deletion of older data. This cannot
            be undone.
          </div>
        </section>
      )}

      {/* ── Section 4: Technical Controls ────────────────────────────────── */}
      <section className="card p-6 space-y-2">
        <h2 className="font-semibold text-gray-900">Technical Controls</h2>
        <p className="text-sm text-gray-500 mb-2">
          These platform-level safeguards are active for all accounts and are part of our
          HIPAA security posture.
        </p>
        <div className="divide-y divide-gray-50">
          <ControlItem
            done
            label="Encryption in transit"
            note="TLS 1.2+ on all API and dashboard connections"
          />
          <ControlItem
            done
            label="Encryption at rest"
            note="AES-256 managed by Railway (PostgreSQL data volume)"
          />
          <ControlItem
            done
            label="Role-based access control"
            note="Owner / Admin / Staff roles with least-privilege defaults"
          />
          <ControlItem
            done
            label="Complete audit log"
            note="Every admin action recorded with actor, timestamp, and diff"
          />
          <ControlItem
            done
            label="Tenant data isolation"
            note="All queries scoped by tenant_id; cross-tenant access is impossible"
          />
          <ControlItem
            done
            label="Secure team invitations"
            note="Time-limited tokens, hashed server-side"
          />
          <ControlItem
            done={status?.hipaaMode ?? false}
            label="Idle session timeout (15 min)"
            note={
              status?.hipaaMode
                ? 'Active — sessions expire after 15 minutes of inactivity'
                : 'Enable HIPAA Mode above to activate'
            }
          />
        </div>

        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Need a Security Assessment Report or penetration test summary for your audit?{' '}
            <a
              href="mailto:compliance@aireceptionist.com"
              className="text-brand-600 hover:underline"
            >
              Contact compliance@aireceptionist.com
            </a>
          </p>
        </div>
      </section>

      {/* ── Section 5: Compliance Events ─────────────────────────────────── */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Compliance Event Log</h2>
          <Link
            href="/settings/audit-log"
            className="text-xs text-brand-600 hover:underline flex items-center gap-1"
          >
            Full audit log <ExternalLink size={11} />
          </Link>
        </div>

        {eventsLoading ? (
          <ListRowSkeleton rows={3} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={Shield}
            label="No compliance events yet"
            hint="BAA acceptance, HIPAA mode changes, and retention updates will appear here."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {events.slice(0, 10).map((evt) => (
              <div key={evt.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${EVENT_COLORS[evt.eventType] ?? 'badge-gray'}`}>
                      {EVENT_LABELS[evt.eventType] ?? evt.eventType}
                    </span>
                    {evt.actorEmail && (
                      <span className="text-xs text-gray-500 truncate">{evt.actorEmail}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{fmt(evt.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
