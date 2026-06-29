'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { useFolders, FolderNode } from '@/hooks/use-folders';
import { FolderTree } from '@/components/folders/FolderTree';
import { FileBrowser } from '@/components/files/FileBrowser';
import { Breadcrumb, collapseBreadcrumbItems } from '@/components/ui/Breadcrumb';

function getAncestorChain(folders: FolderNode[], folderId: string | null): FolderNode[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: FolderNode[] = [];

  let current = folderId ? byId.get(folderId) : undefined;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return chain;
}

export default function DataRoomFilesPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access } = useDataRoomAccess(id);
  const { data: folders } = useFolders(id);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const canUpload = Boolean(access?.canUploadContent);
  const canDelete = Boolean(access?.canDeleteContent);
  const canDownload = Boolean(access?.canDownload);

  const ancestorChain = getAncestorChain(folders ?? [], selectedFolderId);
  const breadcrumbItems = collapseBreadcrumbItems([
    { label: 'Home', onClick: () => setSelectedFolderId(null) },
    ...ancestorChain.map((folder) => ({
      label: folder.name,
      onClick: () => setSelectedFolderId(folder.id),
    })),
  ]);

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
        <div className="mb-3 flex items-center justify-between gap-4">
          <Breadcrumb items={breadcrumbItems} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files in this data room"
            className="w-64 flex-shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <FileBrowser
          dataRoomId={id}
          folderId={selectedFolderId}
          search={search}
          canUpload={canUpload}
          canDelete={canDelete}
          canDownload={canDownload}
        />
      </div>
    </div>
  );
}
