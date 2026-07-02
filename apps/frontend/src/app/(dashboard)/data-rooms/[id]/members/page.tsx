'use client';

import { useParams } from 'next/navigation';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { MembersPanel } from '@/components/data-rooms/MembersPanel';
import { NotAuthorized } from '@/components/shared/NotAuthorized';
import { Skeleton } from '@/components/ui/Skeleton';

function MembersPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <Skeleton className="h-3 w-24" />
        <div className="mt-4 flex flex-wrap gap-3">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-44" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DataRoomMembersPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access, isLoading } = useDataRoomAccess(id);

  if (isLoading) {
    return <MembersPageSkeleton />;
  }

  if (!access?.canManageRoom) {
    return <NotAuthorized />;
  }

  return <MembersPanel dataRoomId={id} canManage={access.canManageRoom} />;
}
