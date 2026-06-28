import { CreateDataRoomForm } from '@/components/data-rooms/CreateDataRoomForm';

export default function NewDataRoomPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Create Data Room</h1>
      <CreateDataRoomForm />
    </div>
  );
}
