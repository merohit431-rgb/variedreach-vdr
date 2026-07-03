'use client';

import Link from 'next/link';
import { ArrowRight, FolderLock } from 'lucide-react';
import { useDataRooms, type DataRoom } from '@/hooks/use-data-rooms';
import { DATA_ROOM_TYPE_LABELS, type DataRoomType } from '@variedreach-vdr/shared';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

const STATUS_CONFIG: Record<DataRoom['status'], { dot: string; badge: string; label: string }> = {
  ACTIVE: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
    label: 'Active',
  },
  ARCHIVED: {
    dot: 'bg-app-s3',
    badge: 'bg-app-s2 text-app-t2 ring-app-border',
    label: 'Archived',
  },
  SUSPENDED: {
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-400 ring-red-500/30',
    label: 'Suspended',
  },
};

const TYPE_COLORS: Record<DataRoomType, string> = {
  CIRP: 'bg-blue-500/10 text-blue-300',
  LIQUIDATION: 'bg-orange-500/10 text-orange-300',
  MA_DUE_DILIGENCE: 'bg-violet-500/10 text-violet-300',
  OTHER: 'bg-app-s2 text-app-t2',
};

function formatBytes(bytesStr: string): string {
  const bytes = Number(bytesStr);
  if (bytes === 0) return '0 B';
  const gb = bytes / 1_073_741_824;
  if (gb >= 0.01) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1_048_576;
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

function DataRoomCard({ room }: { room: DataRoom }) {
  const status = STATUS_CONFIG[room.status];
  const typeColor = TYPE_COLORS[room.type as DataRoomType] ?? 'bg-app-s2 text-app-t2';

  return (
    <Link
      href={`/data-rooms/${room.id}`}
      className="group relative flex flex-col rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft transition-all hover:border-app-border2 hover:shadow-dark-soft"
    >
      {/* Top: type pill + status badge */}
      <div className="flex items-start justify-between gap-2">
        <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', typeColor)}>
          {DATA_ROOM_TYPE_LABELS[room.type as DataRoomType] ?? room.type}
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

      {/* Room name + case number */}
      <div className="mt-3 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold text-app-text transition-colors group-hover:text-blue-300">
          {room.name}
        </h3>
        {room.caseNumber && (
          <p className="mt-0.5 text-xs text-app-t3">Case: {room.caseNumber}</p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-app-border pt-3">
        <div className="flex items-center gap-2.5 text-xs text-app-t3">
          <span>{formatBytes(room.storageUsedBytes)}</span>
          <span aria-hidden="true">·</span>
          <span>Created {relativeDate(room.createdAt)}</span>
        </div>
        <ArrowRight
          className="h-3.5 w-3.5 flex-shrink-0 text-app-t4 opacity-0 transition-all group-hover:opacity-100 group-hover:text-app-primary"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

function DataRoomCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="mt-4 border-t border-app-border pt-3">
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function DataRoomList() {
  const { data: dataRooms, isLoading } = useDataRooms();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DataRoomCardSkeleton />
        <DataRoomCardSkeleton />
        <DataRoomCardSkeleton />
      </div>
    );
  }

  if (!dataRooms || dataRooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-app-border2 p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-s2">
          <FolderLock className="h-6 w-6 text-app-t3" aria-hidden="true" />
        </div>
        <p className="mt-3 text-sm font-semibold text-app-t2">No data rooms yet</p>
        <p className="mt-1 text-xs text-app-t3">Create your first data room to get started.</p>
        <Link
          href="/data-rooms/new"
          className="mt-5 rounded-lg bg-app-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500/100"
        >
          Create Data Room
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {dataRooms.map((room) => (
        <DataRoomCard key={room.id} room={room} />
      ))}
    </div>
  );
}
