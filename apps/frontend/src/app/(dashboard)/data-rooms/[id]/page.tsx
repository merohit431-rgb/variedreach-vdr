'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { useFolders } from '@/hooks/use-folders';
import { FolderTree } from '@/components/folders/FolderTree';
import { FileBrowser } from '@/components/files/FileBrowser';

export default function DataRoomFilesPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access } = useDataRoomAccess(id);
  const { data: folders } = useFolders(id);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const canUpload = Boolean(access?.canUploadContent);
  const canDelete = Boolean(access?.canDeleteContent);
  const availableDownloadFormats = access?.availableDownloadFormats ?? [];
  const selectedFolder = folders?.find((f) => f.id === selectedFolderId);

  return (
    <div className="flex gap-6 pt-4">
      <FolderTree
        dataRoomId={id}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        canUpload={canUpload}
        canDelete={canDelete}
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
        <FileBrowser
          dataRoomId={id}
          folderId={selectedFolderId}
          search={search}
          canUpload={canUpload}
          canDelete={canDelete}
          availableDownloadFormats={availableDownloadFormats}
        />
      </div>
    </div>
  );
}
