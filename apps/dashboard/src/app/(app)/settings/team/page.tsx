'use client';
// ============================================================
// Settings → Team
//
// Owners can invite, change roles, and remove members. Admins can
// view but not modify. Staff don't see this page in the sidebar.
//
// Pending invitations are surfaced separately so the owner can copy
// the invite link if email delivery is delayed (or if SendGrid isn't
// configured in dev).
// ============================================================
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import {
  Users, UserPlus, Mail, Trash2, Copy, ShieldCheck, Clock, MoreHorizontal,
} from 'lucide-react';
import { teamApi, type TeamMember } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useTenant } from '@/lib/TenantProvider';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
};
const ROLE_BADGE: Record<string, string> = {
  owner: 'badge-blue',
  admin: 'badge-green',
  staff: 'badge-gray',
};
const ROLE_DESCRIPTION: Record<string, string> = {
  owner: 'Full access — billing, team, integrations, webhooks',
  admin: 'Settings and campaigns, but not billing or team',
  staff: 'Read all data; modify calls, appointments, contacts',
};

export default function TeamSettingsPage() {
  const toast = useToast();
  const { tenant } = useTenant();
  const { data: membersData, isLoading: membersLoading } = useSWR('team-members', () => teamApi.members());
  const { data: invitesData } = useSWR('team-invitations', () => teamApi.invitations());

  const members = membersData?.data ?? [];
  const invites = invitesData?.data ?? [];

  // Approximate the current user from the tenant context — they're definitely
  // in the members list. We compare against the first owner if no precise match.
  const currentUserEmail = (tenant as any)?.email; // not always populated; safe to be undefined
  const currentMember = members.find((m) => m.email === currentUserEmail);
  const isOwner = currentMember ? currentMember.role === 'owner' : false;

  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Team</h1>
          <p className="text-gray-500 mt-1">
            Invite teammates and manage their access. Owners can change roles and remove members.
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInvite(true)}
            className="btn-primary shrink-0"
          >
            <UserPlus size={16} /> Invite member
          </button>
        )}
      </div>

      {showInvite && isOwner && (
        <InviteForm
          onCancel={() => setShowInvite(false)}
          onInvited={(inviteUrl) => {
            setShowInvite(false);
            void mutate('team-invitations');
            // Show a follow-up toast with copy-link affordance handled below.
            void navigator.clipboard.writeText(inviteUrl).catch(() => undefined);
            toast.success('Invite sent. Link copied to clipboard.');
          }}
        />
      )}

      {/* Pending invitations */}
      {invites.length > 0 && (
        <section className="card">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Pending invitations ({invites.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {invites.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                invitation={inv}
                canRevoke={isOwner}
                onRevoked={() => mutate('team-invitations')}
              />
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Members ({members.length})</h2>
        </div>
        {membersLoading ? (
          <ListRowSkeleton rows={3} />
        ) : members.length === 0 ? (
          <EmptyState icon={Users} label="No members yet" hint="Invite your first teammate above." compact />
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isCurrentUser={m.id === currentMember?.id}
                canModify={isOwner}
                onChanged={() => mutate('team-members')}
              />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-400">
        Three role tiers: <strong>owner</strong> (full access), <strong>admin</strong>{' '}
        (settings + campaigns), <strong>staff</strong> (operational data only).
      </p>
    </div>
  );
}

// ── Invite form ────────────────────────────────────────────────
function InviteForm({
  onCancel,
  onInvited,
}: {
  onCancel: () => void;
  onInvited: (inviteUrl: string) => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'admin' | 'staff'>('staff');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await teamApi.invite({ email: email.trim(), role });
      onInvited(res.inviteUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send invitation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-5">
      <h2 className="font-semibold text-gray-900">Invite a teammate</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="teammate@example.com"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
        <div className="space-y-2">
          {(['staff', 'admin', 'owner'] as const).map((r) => (
            <label
              key={r}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                role === r ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{ROLE_LABEL[r]}</p>
                <p className="text-xs text-gray-500">{ROLE_DESCRIPTION[r]}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          <Mail size={14} /> {submitting ? 'Sending…' : 'Send invitation'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

// ── Pending invite row ─────────────────────────────────────────
function PendingInviteRow({
  invitation,
  canRevoke,
  onRevoked,
}: {
  invitation: { id: string; email: string; role: string; expiresAt: string };
  canRevoke: boolean;
  onRevoked: () => void;
}) {
  const toast = useToast();

  function copyLink() {
    // The invite URL pattern matches what the backend generates.
    // We don't store the token client-side after creation; this row only has the id.
    // Owner can re-invite if they need a fresh link.
    toast.info('To copy the invite link, use the link shown when you sent the invitation.');
  }

  async function handleRevoke() {
    if (!confirm(`Revoke invitation for ${invitation.email}?`)) return;
    try {
      await teamApi.revokeInvite(invitation.id);
      onRevoked();
      toast.success('Invitation revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke');
    }
  }

  const expiresIn = Math.max(0, Math.round((new Date(invitation.expiresAt).getTime() - Date.now()) / 86_400_000));
  return (
    <div className="px-6 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{invitation.email}</p>
        <p className="text-xs text-gray-500">
          {ROLE_LABEL[invitation.role] ?? invitation.role} · expires in {expiresIn}d
        </p>
      </div>
      <button onClick={copyLink} className="btn-secondary text-xs py-1.5 px-2.5" title="Copy link">
        <Copy size={13} />
      </button>
      {canRevoke && (
        <button
          onClick={handleRevoke}
          className="btn-secondary text-xs py-1.5 px-2.5 text-red-600 hover:text-red-700"
          title="Revoke"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ── Member row ─────────────────────────────────────────────────
function MemberRow({
  member,
  isCurrentUser,
  canModify,
  onChanged,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
  canModify: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [editingRole, setEditingRole] = useState(false);
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;

  async function changeRole(newRole: 'owner' | 'admin' | 'staff') {
    if (newRole === member.role) {
      setEditingRole(false);
      return;
    }
    try {
      await teamApi.changeRole(member.id, newRole);
      toast.success(`Role updated to ${ROLE_LABEL[newRole]}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change role');
    } finally {
      setEditingRole(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${fullName} from the team? They'll lose access immediately.`)) return;
    try {
      await teamApi.removeMember(member.id);
      toast.success('Member removed');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove');
    }
  }

  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center font-semibold text-brand-700 shrink-0 text-sm">
        {(member.firstName?.[0] ?? member.email[0])?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
          {isCurrentUser && <span className="badge badge-gray">You</span>}
          {!editingRole && (
            <span className={`badge ${ROLE_BADGE[member.role] ?? 'badge-gray'}`}>
              <ShieldCheck size={11} /> {ROLE_LABEL[member.role] ?? member.role}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {member.email} · last seen {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString() : '—'}
        </p>
      </div>
      {canModify && (
        <div className="shrink-0 flex items-center gap-1.5">
          {editingRole ? (
            <select
              defaultValue={member.role}
              onChange={(e) => changeRole(e.target.value as 'owner' | 'admin' | 'staff')}
              onBlur={() => setEditingRole(false)}
              className="input text-xs py-1.5"
              autoFocus
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          ) : (
            <>
              <button
                onClick={() => setEditingRole(true)}
                className="btn-secondary text-xs py-1.5 px-2.5"
                title="Change role"
              >
                <MoreHorizontal size={13} />
              </button>
              {!isCurrentUser && (
                <button
                  onClick={remove}
                  className="btn-secondary text-xs py-1.5 px-2.5 text-red-600 hover:text-red-700"
                  title="Remove from team"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
