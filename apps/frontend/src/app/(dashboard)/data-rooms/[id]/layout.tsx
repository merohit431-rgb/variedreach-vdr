'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Archive, Trash2 } from 'lucide-react';
import {
  useDataRoom,
  useDataRoomAccess,
  useSetDataRoomArchived,
  useDeleteDataRoom,
} from '@/hooks/use-data-rooms';
import { DATA_ROOM_TYPE_LABELS, type DataRoomType } from '@variedreach-vdr/shared';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  ACTIVE: {
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    label: 'Active',
  },
  ARCHIVED: {
    dot: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    label: 'Archived',
  },
  SUSPENDED: {
    dot: 'bg-red-400',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    label: 'Suspended',
  },
};

const TYPE_COLORS: Record<DataRoomType, string> = {
  CIRP: 'bg-blue-50 text-blue-700',
  LIQUIDATION: 'bg-orange-50 text-orange-700',
  MA_DUE_DILIGENCE: 'bg-violet-50 text-violet-700',
  OTHER: 'bg-slate-100 text-slate-600',
};

function WorkspaceHeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <div className="flex gap-1 border-b border-slate-200 pb-px">
        {[80, 64, 40, 64].map((w, i) => (
          <Skeleton key={i} className={`h-8 w-${w === 40 ? '10' : w === 64 ? '16' : '20'} rounded-md`} />
        ))}
      </div>
    </div>
  );
}

export default function DataRoomLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { data: dataRoom, isLoading } = useDataRoom(id);
  const { data: access } = useDataRoomAccess(id);
  const setArchived = useSetDataRoomArchived(id);
  const deleteDataRoom = useDeleteDataRoom();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = Boolean(access?.canManageRoom);

  if (isLoading || !dataRoom) {
    return (
      <div className="space-y-6">
        <WorkspaceHeaderSkeleton />
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
      </div>
    );
  }

  const status = STATUS_CONFIG[dataRoom.status] ?? STATUS_CONFIG.ACTIVE;
  const typeColor = TYPE_COLORS[dataRoom.type as DataRoomType] ?? 'bg-slate-100 text-slate-600';

  async function handleDelete() {
    try {
      await deleteDataRoom.mutateAsync(dataRoom!.id);
      router.push('/data-rooms');
    } catch {
      setError('Failed to delete data room. Please try again.');
      setShowDeleteDialog(false);
    }
  }

  const tabs = [
    { href: `/data-rooms/${id}`, label: 'Files' },
    { href: `/data-rooms/${id}/activity`, label: 'Activity' },
    { href: `/data-rooms/${id}/qna`, label: 'Q&A' },
    ...(canManage
      ? [
          { href: `/data-rooms/${id}/members`, label: 'Members' },
          { href: `/data-rooms/${id}/reports`, label: 'Reports' },
          { href: `/data-rooms/${id}/settings`, label: 'Settings' },
        ]
      : []),
  ];

  return (
    <div className="space-y-0">
      {/* Back navigation */}
      <Link
        href="/data-rooms"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Data Rooms
      </Link>

      {/* Workspace header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* Type + status row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', typeColor)}>
              {DATA_ROOM_TYPE_LABELS[dataRoom.type as DataRoomType] ?? dataRoom.type}
            </span>
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                status.badge,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>
          </div>

          {/* Room name */}
          <h1 className="mt-1.5 truncate text-xl font-bold text-slate-900">{dataRoom.name}</h1>

          {/* Metadata line */}
          <p className="mt-0.5 text-sm text-slate-400">
            {dataRoom.caseNumber && <span>Case: {dataRoom.caseNumber}</span>}
          </p>
        </div>

        {/* Management actions */}
        {canManage && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={() => setArchived.mutate(dataRoom.status !== 'ARCHIVED')}
              disabled={setArchived.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              {dataRoom.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Premium tab strip */}
      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      <div className="pt-5">{children}</div>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        title={`Delete "${dataRoom.name}"?`}
        description="All files, folders, and activity logs will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        isLoading={deleteDataRoom.isPending}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
