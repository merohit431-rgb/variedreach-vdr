'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFolders } from '@/hooks/use-folders';
import { FolderTree } from '@/components/folders/FolderTree';
import { FileBrowser } from '@/components/files/FileBrowser';
import { isDataRoomManager } from '@variedreach-vdr/shared';

export default function DataRoomFilesPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: folders } = useFolders(id);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">{selectedFolder ? selectedFolder.path : 'All files'}</p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files in this data room"
            className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <FileBrowser dataRoomId={id} folderId={selectedFolderId} search={search} canManage={canManage} />
      </div>
    </div>
  );
}
