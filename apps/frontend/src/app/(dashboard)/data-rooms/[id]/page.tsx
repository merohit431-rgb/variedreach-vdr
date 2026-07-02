'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { useFolders, type FolderNode } from '@/hooks/use-folders';
import { FolderTree } from '@/components/folders/FolderTree';
import { FileBrowser } from '@/components/files/FileBrowser';
import { NdaGateModal } from '@/components/data-rooms/NdaGateModal';
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
    <NdaGateModal dataRoomId={id}>
      <div className="flex gap-5">
        <FolderTree
          dataRoomId={id}
          selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId}
          canUpload={canUpload}
          canDelete={canDelete}
          canDownload={canDownload}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Breadcrumb items={breadcrumbItems} />
            <div className="relative flex-shrink-0">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files…"
                className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
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
    </NdaGateModal>
  );
}
