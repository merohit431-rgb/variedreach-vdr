import Link from 'next/link';
import { DataRoomList } from '@/components/data-rooms/DataRoomList';

export default function DataRoomsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Data Rooms</h1>
        <Link
          href="/data-rooms/new"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Create Data Room
        </Link>
      </div>
      <DataRoomList />
    </div>
  );
}
