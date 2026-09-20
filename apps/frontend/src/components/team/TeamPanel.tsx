'use client';

import { useState } from 'react';
import { ShieldOff, ShieldCheck, Crown } from 'lucide-react';
import { useOrgMembers, useUpdateOrgMemberStatus, type OrgMember } from '@/hooks/use-org-members';
import { ROLE_LABELS } from '@variedreach-vdr/shared';
import { useAuthStore } from '@/store/auth-store';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { extractErrorMessage } from '@/lib/error-message';
import { cn } from '@/lib/cn';

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  ACTIVE: { label: 'Active', classes: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30' },
  SUSPENDED: { label: 'Suspended', classes: 'bg-red-500/10 text-red-400 ring-red-500/30' },
};

function RowSkeleton() {
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

export function TeamPanel({ organisationId }: { organisationId: string }) {
  const { data: members, isLoading } = useOrgMembers(organisationId);
  const updateStatus = useUpdateOrgMemberStatus(organisationId);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  async function handleToggleStatus(member: OrgMember) {
    const nextStatus = member.membershipStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (
      nextStatus === 'SUSPENDED' &&
      !window.confirm(
        `Suspend ${member.firstName} ${member.lastName}? They will immediately lose access to every data room in this organisation until reinstated.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await updateStatus.mutateAsync({ userId: member.userId, status: nextStatus });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-app-t3">Team</p>
        <p className="mt-0.5 text-sm text-app-t3">
          Everyone with access to this organisation, across every data room. Suspending someone here
          blocks them everywhere in the org immediately — it doesn&apos;t remove them from individual
          data rooms, which you still manage from each room&apos;s Members tab.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400 ring-1 ring-inset ring-red-500/30">
          {error}
        </p>
      )}

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
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Member</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Role</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  <RowSkeleton />
                  <RowSkeleton />
                  <RowSkeleton />
                </>
              ) : members && members.length > 0 ? (
                members.map((member) => {
                  const statusConfig = STATUS_CONFIG[member.membershipStatus] ?? STATUS_CONFIG.ACTIVE;
                  const isSuspended = member.membershipStatus === 'SUSPENDED';
                  return (
                    <tr key={member.userId} className="border-b border-app-border last:border-0 hover:bg-app-s2/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${member.firstName} ${member.lastName}`} size="sm" />
                          <div>
                            <p className="flex items-center gap-1.5 text-sm font-medium text-app-text">
                              {member.firstName} {member.lastName}
                              {member.isOwner && (
                                <Crown
                                  className="h-3 w-3 text-amber-400"
                                  aria-hidden="true"
                                />
                              )}
                            </p>
                            <p className="text-xs text-app-t3">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-app-t2">{ROLE_LABELS[member.role]}</span>
                      </td>
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
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          {member.userId === currentUser?.id ? (
                            <span className="text-xs text-app-t4">You</span>
                          ) : member.isOwner && !isSuperAdmin ? (
                            <span className="text-xs text-app-t4">Owner</span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(member)}
                              disabled={updateStatus.isPending}
                              title={isSuspended ? 'Reinstate member' : 'Suspend member'}
                              className={cn(
                                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                                isSuspended
                                  ? 'text-app-t3 hover:bg-emerald-500/10 hover:text-emerald-400'
                                  : 'text-app-t3 hover:bg-red-500/10 hover:text-red-400',
                              )}
                            >
                              {isSuspended ? (
                                <>
                                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                  Reinstate
                                </>
                              ) : (
                                <>
                                  <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                                  Suspend
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <p className="text-sm text-app-t3">No members yet.</p>
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
