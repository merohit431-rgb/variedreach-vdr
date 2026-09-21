'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { useDeletedDataRooms, useRestoreDataRoom } from '@/hooks/use-data-rooms';
import { extractErrorMessage } from '@/lib/error-message';

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// Deleted rooms have no other discovery path anywhere in the product --
// findAll/findOne both filter deletedAt: null -- so this collapsed section
// is the entire UI for a feature that previously had zero way to reach it
// through the API at all (see restore() and findDeleted() on the backend).
// Manager-only, matching the same gate the "Create Data Room" button above
// it already uses.
export function DeletedDataRooms() {
  const [expanded, setExpanded] = useState(false);
  const { data: deletedRooms, isLoading } = useDeletedDataRooms(expanded);
  const restoreDataRoom = useRestoreDataRoom();
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleRestore(id: string) {
    setError(null);
    setRestoringId(id);
    try {
      await restoreDataRoom.mutateAsync(id);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="border-t border-app-border pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-app-t3 hover:text-app-t2"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Deleted data rooms
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {error && <p className="text-xs text-red-400">{error}</p>}
          {isLoading && <p className="text-xs text-app-t4">Loading…</p>}
          {!isLoading && (!deletedRooms || deletedRooms.length === 0) && (
            <p className="text-xs text-app-t4">No deleted data rooms.</p>
          )}
          {deletedRooms?.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-app-border bg-app-s1 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-app-text">{room.name}</p>
                <p className="text-xs text-app-t4">
                  Deleted {room.deletedAt ? relativeDate(room.deletedAt) : 'recently'}
                </p>
              </div>
              <button
                onClick={() => handleRestore(room.id)}
                disabled={restoringId === room.id}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-app-t2 transition-colors hover:border-app-border2 hover:bg-app-s2 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {restoringId === room.id ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
