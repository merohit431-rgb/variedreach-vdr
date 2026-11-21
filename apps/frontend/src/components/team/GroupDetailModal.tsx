'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, X, FolderTree } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import {
  useGroup,
  useUpdateGroup,
  useAddGroupMember,
  useRemoveGroupMember,
} from '@/hooks/use-groups';
import { useOrgMembers } from '@/hooks/use-org-members';
import { extractErrorMessage } from '@/lib/error-message';
import { cn } from '@/lib/cn';

export function GroupDetailModal({
  organisationId,
  groupId,
  onClose,
}: {
  organisationId: string;
  groupId: string | null;
  onClose: () => void;
}) {
  const { data: group, isLoading } = useGroup(organisationId, groupId);
  const { data: orgMembers } = useOrgMembers(organisationId);
  const updateGroup = useUpdateGroup(organisationId, groupId ?? '');
  const addMember = useAddGroupMember(organisationId, groupId ?? '');
  const removeMember = useRemoveGroupMember(organisationId, groupId ?? '');

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const memberIds = new Set(group?.members.map((m) => m.userId) ?? []);
  const addableMembers = (orgMembers ?? []).filter((m) => !memberIds.has(m.userId));

  async function handleRename(name: string) {
    setError(null);
    try {
      await updateGroup.mutateAsync({ name });
      setIsRenameOpen(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleToggleActive() {
    if (!group) return;
    if (
      group.isActive &&
      !window.confirm(
        `Deactivate ${group.name}? Every member immediately loses any folder access this group grants, across every data room.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await updateGroup.mutateAsync({ isActive: !group.isActive });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleAddMember() {
    if (!selectedUserId) return;
    setError(null);
    try {
      await addMember.mutateAsync(selectedUserId);
      setSelectedUserId('');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleRemoveMember(userId: string) {
    setError(null);
    try {
      await removeMember.mutateAsync(userId);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <Dialog
      open={Boolean(groupId)}
      onClose={onClose}
      title={group?.name ?? 'Group'}
      description="Manage membership and see where this group has folder access."
      className="max-w-lg"
    >
      {isLoading ? (
        <p className="text-sm text-app-t3">Loading…</p>
      ) : group ? (
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex items-center justify-between rounded-lg bg-app-s2 p-3">
            <button
              type="button"
              onClick={() => setIsRenameOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-app-text hover:text-app-primary"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Rename
            </button>
            <label className="flex cursor-pointer items-center gap-2">
              <span className="text-xs text-app-t3">{group.isActive ? 'Active' : 'Inactive'}</span>
              <div
                onClick={handleToggleActive}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  group.isActive ? 'bg-app-primary' : 'bg-app-s3',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-app-s1 shadow transition-transform',
                    group.isActive ? 'translate-x-4' : 'translate-x-0.5',
                  )}
                />
              </div>
            </label>
          </div>

          <PromptDialog
            open={isRenameOpen}
            title="Rename Group"
            label="Group name"
            initialValue={group.name}
            confirmLabel="Save"
            isLoading={updateGroup.isPending}
            onConfirm={handleRename}
            onCancel={() => setIsRenameOpen(false)}
          />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-t3">
              Members ({group.members.length})
            </p>
            <div className="space-y-1.5">
              {group.members.length > 0 ? (
                group.members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between rounded-md border border-app-border px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} size="sm" />
                      <div>
                        <p className="text-sm text-app-text">{m.name}</p>
                        <p className="text-xs text-app-t3">{m.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      disabled={removeMember.isPending}
                      title="Remove from group"
                      className="rounded-md p-1.5 text-app-t3 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-app-t3">No members yet.</p>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 rounded-md border border-app-border2 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="">Add a member…</option>
                {addableMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.firstName} {m.lastName} ({m.email})
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={handleAddMember} isLoading={addMember.isPending} disabled={!selectedUserId}>
                Add
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-t3">
              Assigned folders ({group.folderGrants.length})
            </p>
            {group.folderGrants.length > 0 ? (
              <div className="space-y-1.5">
                {group.folderGrants.map((g) => (
                  <Link
                    key={g.folderId}
                    href={`/data-rooms/${g.dataRoomId}`}
                    className="flex items-center justify-between rounded-md border border-app-border px-3 py-2 text-sm text-app-t2 transition-colors hover:bg-app-s2"
                  >
                    <span className="flex items-center gap-2">
                      <FolderTree className="h-3.5 w-3.5 text-app-t3" aria-hidden="true" />
                      {g.folderName}
                    </span>
                    <span className="text-xs text-app-t4">Open →</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-app-t3">
                This group has not been granted access to any folder yet.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
