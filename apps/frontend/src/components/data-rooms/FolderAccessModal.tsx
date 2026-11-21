'use client';

import { useState } from 'react';
import { UserPlus, X, FolderTree } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import { extractErrorMessage } from '@/lib/error-message';
import { useFolderAccess, useGrantFolderAccess, useRevokeFolderAccess } from '@/hooks/use-folder-permissions';
import { useMembers } from '@/hooks/use-members';

export function FolderAccessModal({
  dataRoomId,
  folderId,
  folderName,
  onClose,
}: {
  dataRoomId: string;
  folderId: string | null;
  folderName: string;
  onClose: () => void;
}) {
  const { data: access, isLoading } = useFolderAccess(dataRoomId, folderId);
  const { data: members } = useMembers(dataRoomId);
  const grant = useGrantFolderAccess(dataRoomId, folderId ?? '');
  const revoke = useRevokeFolderAccess(dataRoomId, folderId ?? '');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const grantedUserIds = new Set(access?.explicitGrants.map((g) => g.userId) ?? []);
  const grantableMembers = (members ?? []).filter((m) => !grantedUserIds.has(m.userId));

  async function handleGrant() {
    if (!selectedUserId) return;
    setError(null);
    try {
      await grant.mutateAsync(selectedUserId);
      setSelectedUserId('');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleRevoke(userId: string) {
    setError(null);
    try {
      await revoke.mutateAsync(userId);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <Dialog
      open={Boolean(folderId)}
      onClose={onClose}
      title={`Folder access — ${folderName}`}
      description="Only the members listed below (plus room managers, always) can see or open this folder."
    >
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-app-t3">Loading…</p>
      ) : (
        <>
          {access?.effectiveSource.type === 'none' && access.explicitGrants.length === 0 && (
            <p className="mb-3 flex items-start gap-2 rounded-md bg-app-s2 p-3 text-xs text-app-t3">
              <FolderTree className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              No one has been granted this folder yet — only room managers can reach it until you
              add someone below.
            </p>
          )}
          {access?.effectiveSource.type === 'inherited' && (
            <p className="mb-3 flex items-start gap-2 rounded-md bg-app-s2 p-3 text-xs text-app-t3">
              <FolderTree className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              This folder has no grants of its own — it currently inherits access from{' '}
              <span className="font-medium text-app-t2">{access.effectiveSource.folderName}</span>.
              Granting someone below gives them access to this folder specifically.
            </p>
          )}

          <div className="space-y-2">
            {access?.explicitGrants.length ? (
              access.explicitGrants.map((g) => (
                <div
                  key={g.userId}
                  className="flex items-center justify-between rounded-md border border-app-border px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={g.name} size="sm" />
                    <div>
                      <p className="text-sm text-app-text">{g.name}</p>
                      <p className="text-xs text-app-t3">{g.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(g.userId)}
                    disabled={revoke.isPending}
                    title="Revoke access to this folder"
                    className="rounded-md p-1.5 text-app-t3 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-app-t3">No one has an explicit grant on this folder.</p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-app-border pt-4">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 rounded-md border border-app-border2 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">Select a member to grant…</option>
              {grantableMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.firstName} {m.user.lastName} ({m.user.email})
                </option>
              ))}
            </select>
            <Button onClick={handleGrant} isLoading={grant.isPending} disabled={!selectedUserId}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Grant
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
