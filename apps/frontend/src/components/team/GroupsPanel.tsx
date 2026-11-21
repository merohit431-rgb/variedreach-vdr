'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { useGroups, useCreateGroup } from '@/hooks/use-groups';
import { extractErrorMessage } from '@/lib/error-message';
import { cn } from '@/lib/cn';
import { GroupDetailModal } from './GroupDetailModal';

function GroupRowSkeleton() {
  return (
    <tr className="border-b border-app-border last:border-0">
      <td className="px-4 py-3"><Skeleton className="h-3 w-32" /></td>
      <td className="px-4 py-3"><Skeleton className="h-3 w-10" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
    </tr>
  );
}

export function GroupsPanel({ organisationId }: { organisationId: string }) {
  const { data: groups, isLoading } = useGroups(organisationId);
  const createGroup = useCreateGroup(organisationId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(name: string) {
    setError(null);
    try {
      await createGroup.mutateAsync(name);
      setIsCreateOpen(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-t3">Groups</p>
          <p className="mt-0.5 text-sm text-app-t3">
            Grant folder access to a whole team at once instead of member-by-member — e.g. Legal
            Team, Finance Team, Audit Team.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Users className="h-4 w-4" aria-hidden="true" />
          New Group
        </Button>
      </div>

      <PromptDialog
        open={isCreateOpen}
        title="New Group"
        description="Name it after the team it represents — you'll add members and grant folder access next."
        label="Group name"
        confirmLabel="Create"
        isLoading={createGroup.isPending}
        onConfirm={handleCreate}
        onCancel={() => setIsCreateOpen(false)}
      />

      <GroupDetailModal
        organisationId={organisationId}
        groupId={selectedGroupId}
        onClose={() => setSelectedGroupId(null)}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="overflow-hidden rounded-xl border border-app-border bg-app-s1 shadow-dark-soft">
        <div className="border-b border-app-border px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-app-t3">
            Groups
            {groups && (
              <span className="ml-2 rounded-full bg-app-s2 px-2 py-0.5 text-xs font-medium text-app-t2">
                {groups.length}
              </span>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-app-border bg-app-s2 text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Group</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Members</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  <GroupRowSkeleton />
                  <GroupRowSkeleton />
                </>
              ) : groups && groups.length > 0 ? (
                groups.map((group) => (
                  <tr key={group.id} className="border-b border-app-border last:border-0 hover:bg-app-s2/60">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className="text-left text-sm font-medium text-app-text hover:text-app-primary"
                      >
                        {group.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-app-t2">{group.memberCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                          group.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
                            : 'bg-app-s3 text-app-t3 ring-app-border',
                        )}
                      >
                        {group.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center">
                    <p className="text-sm text-app-t3">No groups yet.</p>
                    <p className="mt-1 text-xs text-app-t3">
                      Use &quot;New Group&quot; above to create the first one.
                    </p>
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
