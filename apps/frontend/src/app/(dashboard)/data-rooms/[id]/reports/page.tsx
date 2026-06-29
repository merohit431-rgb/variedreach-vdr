'use client';

import { useParams } from 'next/navigation';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { ReportsView } from '@/components/reports/ReportsView';
import { NotAuthorized } from '@/components/shared/NotAuthorized';

export default function DataRoomReportsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access, isLoading } = useDataRoomAccess(id);

  if (isLoading) {
    return <p className="pt-4 text-sm text-slate-400">Loading…</p>;
  }

  if (!access?.canManageRoom) {
    return (
      <div className="pt-4">
        <NotAuthorized />
      </div>
    );
  }

  return (
    <div className="pt-4">
      <ReportsView dataRoomId={id} />
    </div>
  );
}
