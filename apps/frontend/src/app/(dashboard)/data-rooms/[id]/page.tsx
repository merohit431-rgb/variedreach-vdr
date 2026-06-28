'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFolders } from '@/hooks/use-folders';
import { FolderTree } from '@/components/folders/FolderTree';
import { isDataRoomManager } from '@variedreach-vdr/shared';

export default function DataRoomFilesPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: folders } = useFolders(id);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const canManage = Boolean(user && isDataRoomManager(user.role));
  const selectedFolder = folders?.find((f) => f.id === selectedFolderId);

  return (
    <div className="flex gap-6 pt-4">
      <FolderTree
        dataRoomId={id}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        canManage={canManage}
      />
      <div className="flex-1">
        <p className="mb-3 text-sm text-slate-500">{selectedFolder ? selectedFolder.path : 'All files'}</p>
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          No files yet.
        </div>
      </div>
    </div>
  );
}
