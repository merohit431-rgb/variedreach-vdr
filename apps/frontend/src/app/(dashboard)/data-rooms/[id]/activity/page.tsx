'use client';

import { useParams } from 'next/navigation';
import { AuditLogTable } from '@/components/audit-logs/AuditLogTable';

export default function DataRoomActivityPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="pt-4">
      <AuditLogTable dataRoomId={id} />
    </div>
  );
}
