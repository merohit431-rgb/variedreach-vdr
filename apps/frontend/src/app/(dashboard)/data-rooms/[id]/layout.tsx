'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import {
  Archive,
  Trash2,
  FileText,
  Users,
  Database,
  Activity as ActivityIcon,
  Download,
  FileUp,
  UserPlus,
  History,
} from 'lucide-react';
import {
  useDataRoom,
  useDataRoomAccess,
  useDataRoomStats,
  useSetDataRoomArchived,
  useDeleteDataRoom,
} from '@/hooks/use-data-rooms';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import {
  DATA_ROOM_TYPE_LABELS,
  AUDIT_ACTION_LABELS,
  type DataRoomType,
  type AuditActionType,
} from '@variedreach-vdr/shared';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { getStorageLevel, STORAGE_LEVEL_STYLES, type StorageLevel } from '@/lib/storage-status';

const STATUS_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  ACTIVE: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'ACTIVE' },
  ARCHIVED: { dot: 'bg-app-t4', text: 'text-app-t3', label: 'ARCHIVED' },
  SUSPENDED: { dot: 'bg-red-500', text: 'text-red-400', label: 'SUSPENDED' },
};

const TYPE_PILL: Record<DataRoomType, string> = {
  CIRP: 'bg-blue-500/15 text-blue-300',
  LIQUIDATION: 'bg-orange-500/15 text-orange-300',
  MA_DUE_DILIGENCE: 'bg-violet-500/15 text-violet-300',
  OTHER: 'bg-app-s2 text-app-t3',
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function bytesToGb(bytes: string): number {
  return Number(bytes) / 1024 ** 3;
}

function StatCard({
  icon: Icon,
  iconClasses,
  label,
  value,
  sub,
  bar,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClasses: string;
  label: string;
  value: string;
  sub?: string;
  bar?: number;
}) {
  return (
    <div className="rounded-xl border border-app-border bg-app-s1 p-4 shadow-dark-soft">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', iconClasses)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-app-t4">{label}</p>
          <p className="truncate text-xl font-bold tracking-tight text-app-text">{value}</p>
          {sub && <p className="truncate text-[11px] text-app-t4">{sub}</p>}
        </div>
      </div>
      {bar !== undefined && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-app-s3">
          <div
            className={cn('h-full rounded-full', STORAGE_LEVEL_STYLES[getStorageLevel(bar)].bar)}
            style={{ width: `${Math.min(100, bar)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function getActionIcon(action: string): { icon: React.ComponentType<{ className?: string }>; classes: string } {
  const upper = action.toUpperCase();
  if (upper.includes('DOWNLOAD')) return { icon: Download, classes: 'bg-blue-500/15 text-blue-400' };
  if (upper.includes('UPLOAD') || upper.includes('CREATE'))
    return { icon: FileUp, classes: 'bg-emerald-500/15 text-emerald-400' };
  if (upper.includes('DELETE')) return { icon: Trash2, classes: 'bg-red-500/15 text-red-400' };
  if (upper.includes('INVITE') || upper.includes('MEMBER'))
    return { icon: UserPlus, classes: 'bg-violet-500/15 text-violet-300' };
  return { icon: History, classes: 'bg-app-s2 text-app-t3' };
}

function ActivityFeedPanel({ dataRoomId }: { dataRoomId: string }) {
  const { data } = useAuditLogs(dataRoomId, { page: 1, limit: 5 });
  const entries = data?.data ?? [];

  return (
    <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-app-t4">
          Activity feed
        </p>
        <Link
          href={`/data-rooms/${dataRoomId}/activity`}
          className="text-xs font-medium text-app-primary transition-colors hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-4 space-y-4">
        {entries.length === 0 && <p className="text-xs text-app-t4">No activity recorded yet.</p>}
        {entries.map((entry) => {
          const meta = getActionIcon(entry.action);
          const resourceName =
            entry.metadata && typeof entry.metadata.name === 'string' ? entry.metadata.name : null;
          return (
            <div key={entry.id} className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                  meta.classes,
                )}
              >
                <meta.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs leading-snug text-app-t2">
                  <span className="font-semibold text-app-text">
                    {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System'}
                  </span>{' '}
                  {(AUDIT_ACTION_LABELS[entry.action as AuditActionType] ?? entry.action).toLowerCase()}
                  {resourceName && <span className="text-app-t3"> · {resourceName}</span>}
                </p>
                <p className="mt-0.5 text-[10px] text-app-t4">{relativeTime(entry.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STORAGE_LEVEL_HEX: Record<StorageLevel, string> = {
  ok: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  full: '#ef4444',
};

function StoragePanel({ usedBytes, limitGb }: { usedBytes: string; limitGb: number }) {
  const usedGb = bytesToGb(usedBytes);
  const percent = limitGb > 0 ? Math.min(100, Math.round((usedGb / limitGb) * 100)) : 0;
  const level = getStorageLevel(percent);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-app-t4">Storage usage</p>
      <div className="mt-4 flex items-center gap-4">
        <svg viewBox="0 0 72 72" className="h-16 w-16 flex-shrink-0" aria-hidden="true">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="#1a2440" strokeWidth="7" />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={STORAGE_LEVEL_HEX[level]}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(circumference * percent) / 100} ${circumference}`}
            transform="rotate(-90 36 36)"
          />
          <text x="36" y="41" textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="700">
            {percent}%
          </text>
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-app-text">
            {usedGb.toFixed(usedGb >= 10 ? 0 : 1)} GB{' '}
            <span className="font-normal text-app-t4">of {limitGb} GB used</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-app-s3">
            <div
              className={cn('h-full rounded-full', STORAGE_LEVEL_STYLES[level].bar)}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-app-border bg-app-s1 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function DataRoomLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  // The overview cards (Documents / Members / Storage / Last Activity) live on
  // the room's Settings page only. The Files page and every other sub-page
  // share this same layout but start directly with their own content (upload /
  // filters / search / listing), so the cards are mounted conditionally rather
  // than duplicating the layout per route.
  const isSettingsPage = pathname === `/data-rooms/${id}/settings`;
  const { data: dataRoom, isLoading } = useDataRoom(id);
  const { data: access } = useDataRoomAccess(id);
  const { data: stats } = useDataRoomStats(id);
  const setArchived = useSetDataRoomArchived(id);
  const deleteDataRoom = useDeleteDataRoom();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = Boolean(access?.canManageRoom);

  if (isLoading || !dataRoom) {
    return <WorkspaceSkeleton />;
  }

  const status = STATUS_CONFIG[dataRoom.status] ?? STATUS_CONFIG.ACTIVE;
  const typePill = TYPE_PILL[dataRoom.type as DataRoomType] ?? TYPE_PILL.OTHER;

  async function handleDelete() {
    try {
      await deleteDataRoom.mutateAsync(dataRoom!.id);
      router.push('/data-rooms');
    } catch {
      setError('Failed to delete data room. Please try again.');
      setShowDeleteDialog(false);
    }
  }

  return (
    <div className="flex gap-6">
      {/* Main column */}
      <div className="min-w-0 flex-1">
        {/* Workspace header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-app-text">
              {dataRoom.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold', typePill)}>
                {DATA_ROOM_TYPE_LABELS[dataRoom.type as DataRoomType] ?? dataRoom.type}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1.5 text-[11px] font-semibold tracking-wide',
                  status.text,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                {status.label}
              </span>
              {dataRoom.caseNumber && (
                <span className="text-xs text-app-t4">Case: {dataRoom.caseNumber}</span>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => setArchived.mutate(dataRoom.status !== 'ARCHIVED')}
                disabled={setArchived.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-app-t2 transition-colors hover:border-app-border2 hover:bg-app-s2 disabled:opacity-50"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                {dataRoom.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        {/* Overview cards -- Settings page only. */}
        {isSettingsPage && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FileText}
            iconClasses="bg-blue-500/15 text-blue-400"
            label="Documents"
            value={stats ? stats.documents.toLocaleString() : '—'}
          />
          {/* Member count and organisation storage are management information
              -- only room managers see them. Non-managers get Documents +
              Last activity only. */}
          {canManage && (
            <StatCard
              icon={Users}
              iconClasses="bg-violet-500/15 text-violet-300"
              label="Members"
              value={stats && stats.members != null ? String(stats.members) : '—'}
            />
          )}
          {canManage && (
            <StatCard
              icon={Database}
              iconClasses="bg-app-primary/15 text-app-primary"
              label="Storage"
              value={
                stats && stats.storageUsedBytes != null
                  ? `${bytesToGb(stats.storageUsedBytes).toFixed(1)} GB`
                  : '—'
              }
              sub={stats && stats.storageLimitGb != null ? `of ${stats.storageLimitGb} GB used` : undefined}
              bar={
                stats && stats.storageUsedBytes != null && stats.storageLimitGb
                  ? (bytesToGb(stats.storageUsedBytes) / stats.storageLimitGb) * 100
                  : undefined
              }
            />
          )}
          <StatCard
            icon={ActivityIcon}
            iconClasses="bg-amber-500/15 text-amber-400"
            label="Last activity"
            value={stats ? relativeTime(stats.lastActivityAt) : '—'}
            sub={
              stats?.lastActivityAction
                ? (AUDIT_ACTION_LABELS[stats.lastActivityAction as AuditActionType] ??
                  stats.lastActivityAction)
                : 'No activity yet'
            }
          />
        </div>
        )}

        {/* Page content -- Files and all other pages start directly here with
            no overview cards above (cards render only on Settings). */}
        <div className={isSettingsPage ? 'pt-6' : 'pt-5'}>{children}</div>
      </div>

      {/* Right rail */}
      <aside className="hidden w-72 flex-shrink-0 space-y-4 xl:block">
        <ActivityFeedPanel dataRoomId={id} />
        {canManage && stats && stats.storageUsedBytes != null && stats.storageLimitGb != null && (
          <StoragePanel usedBytes={stats.storageUsedBytes} limitGb={stats.storageLimitGb} />
        )}
      </aside>

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
