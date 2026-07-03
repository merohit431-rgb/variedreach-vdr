'use client';

import { useState, FormEvent } from 'react';
import { UserPlus, RotateCcw, Mail, Trash2 } from 'lucide-react';
import {
  useMembers,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
  useResetMemberPassword,
  useResendInvite,
} from '@/hooks/use-members';
import { USER_ROLES, ROLE_LABELS, type UserRole } from '@variedreach-vdr/shared';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { extractErrorMessage } from '@/lib/error-message';
import { cn } from '@/lib/cn';

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  ACTIVE: { label: 'Active', classes: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30' },
  PENDING_INVITE: { label: 'Pending invite', classes: 'bg-amber-500/10 text-amber-400 ring-amber-500/30' },
  SUSPENDED: { label: 'Suspended', classes: 'bg-red-500/10 text-red-400 ring-red-500/30' },
};

function MemberRowSkeleton() {
  return (
    <tr className="border-b border-app-border last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-36" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
      <td className="px-4 py-3" />
    </tr>
  );
}

export function MembersPanel({ dataRoomId, canManage }: { dataRoomId: string; canManage: boolean }) {
  const { data: members, isLoading } = useMembers(dataRoomId);
  const inviteMember = useInviteMember(dataRoomId);
  const updateRole = useUpdateMemberRole(dataRoomId);
  const removeMember = useRemoveMember(dataRoomId);
  const resetPassword = useResetMemberPassword(dataRoomId);
  const resendInvite = useResendInvite(dataRoomId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('PRA');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const result = await inviteMember.mutateAsync({ email, role });
      setEmail('');
      setNotice(
        result.emailSent
          ? `Invitation sent to ${email}`
          : `Member added, but the invitation email failed to send to ${email}. Use "Resend invite" to try again.`,
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleResetPassword(userId: string, userEmail: string) {
    setError(null);
    setNotice(null);
    try {
      await resetPassword.mutateAsync(userId);
      setNotice(`Password reset email sent to ${userEmail}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleResendInvite(userId: string, userEmail: string) {
    setError(null);
    setNotice(null);
    try {
      const result = await resendInvite.mutateAsync(userId);
      setNotice(
        result.emailSent
          ? `Invitation resent to ${userEmail}`
          : `Could not resend the invitation email to ${userEmail}. Try again shortly.`,
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      {/* Invite form */}
      {canManage && (
        <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-app-t3">
            Invite Member
          </p>
          <form onSubmit={handleInvite} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label htmlFor="invite-email" className="block text-xs font-medium text-app-t2">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="mt-1.5 w-full rounded-lg border border-app-border px-3 py-2 text-sm text-app-text placeholder:text-app-t4 focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="block text-xs font-medium text-app-t2">
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1.5 rounded-lg border border-app-border px-3 py-2 text-sm text-app-text focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
              >
                {USER_ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviteMember.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-app-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500/100 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {inviteMember.isPending ? 'Inviting…' : 'Invite'}
            </button>
          </form>
        </div>
      )}

      {/* Feedback messages */}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400 ring-1 ring-inset ring-red-500/30">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
          {notice}
        </p>
      )}

      {/* Members table */}
      <div className="overflow-hidden rounded-xl border border-app-border bg-app-s1 shadow-dark-soft">
        <div className="border-b border-app-border px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-app-t3">
            Members
            {members && (
              <span className="ml-2 rounded-full bg-app-s2 px-2 py-0.5 text-xs font-medium text-app-t2">
                {members.length}
              </span>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-app-border bg-app-s2 text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">
                  Member
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">
                  Role
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">
                  Status
                </th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  <MemberRowSkeleton />
                  <MemberRowSkeleton />
                  <MemberRowSkeleton />
                </>
              ) : members && members.length > 0 ? (
                members.map((member) => {
                  const statusConfig =
                    STATUS_CONFIG[member.user.status] ?? STATUS_CONFIG.ACTIVE;
                  const displayRole = member.roleOverride ?? member.user.role;

                  return (
                    <tr
                      key={member.userId}
                      className="border-b border-app-border last:border-0 hover:bg-app-s2/60"
                    >
                      {/* Member info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={`${member.user.firstName} ${member.user.lastName}`}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-medium text-app-text">
                              {member.user.firstName} {member.user.lastName}
                            </p>
                            <p className="text-xs text-app-t3">{member.user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        {canManage ? (
                          <select
                            value={displayRole}
                            onChange={(e) =>
                              updateRole.mutate({
                                userId: member.userId,
                                role: e.target.value as UserRole,
                              })
                            }
                            className="rounded-lg border border-app-border px-2.5 py-1.5 text-xs font-medium text-app-t2 focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
                          >
                            {USER_ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-app-t2">{ROLE_LABELS[displayRole]}</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                            statusConfig.classes,
                          )}
                        >
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Actions */}
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {member.user.status === 'PENDING_INVITE' && (
                              <button
                                onClick={() =>
                                  handleResendInvite(member.userId, member.user.email)
                                }
                                title="Resend invite"
                                className="rounded-md p-1.5 text-app-t3 transition-colors hover:bg-app-s2 hover:text-app-t2"
                              >
                                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleResetPassword(member.userId, member.user.email)
                              }
                              title="Reset password"
                              className="rounded-md p-1.5 text-app-t3 transition-colors hover:bg-app-s2 hover:text-app-t2"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => removeMember.mutate(member.userId)}
                              title="Remove member"
                              className="rounded-md p-1.5 text-app-t3 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="px-4 py-10 text-center">
                    <p className="text-sm text-app-t3">No members yet.</p>
                    {canManage && (
                      <p className="mt-1 text-xs text-app-t3">
                        Use the form above to invite the first member.
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
