'use client';

import { useParams } from 'next/navigation';
import { ReportsView } from '@/components/reports/ReportsView';

export default function DataRoomReportsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="pt-4">
      <ReportsView dataRoomId={id} />
    </div>
  );
}
