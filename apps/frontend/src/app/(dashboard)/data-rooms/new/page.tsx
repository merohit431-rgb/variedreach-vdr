import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreateDataRoomForm } from '@/components/data-rooms/CreateDataRoomForm';

export default function NewDataRoomPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/data-rooms"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-app-t3 transition-colors hover:text-app-t2"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Data Rooms
        </Link>
        <h1 className="mt-2 text-xl font-bold text-app-text">Create Data Room</h1>
        <p className="mt-0.5 text-sm text-app-t3">
          Set up a secure workspace for CIRP, M&amp;A due diligence, or other transactions.
        </p>
      </div>
      <div className="max-w-xl">
        <CreateDataRoomForm />
      </div>
    </div>
  );
}
