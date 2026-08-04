'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { useFolders, type FolderNode } from '@/hooks/use-folders';
import { useWorkspaceStore } from '@/store/workspace-store';
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
  const { selectedFolderId, search, setSelectedFolder, ensureRoom } = useWorkspaceStore();

  // Folder selection is owned by the room-scoped Sidebar; entering a
  // different room clears any selection carried over from the last one.
  useEffect(() => {
    ensureRoom(id);
  }, [id, ensureRoom]);

  const canUpload = Boolean(access?.canUploadContent);
  const canDelete = Boolean(access?.canDeleteContent);
  const canDownload = Boolean(access?.canDownload);

  const ancestorChain = getAncestorChain(folders ?? [], selectedFolderId);
  const breadcrumbItems = collapseBreadcrumbItems([
    { label: 'Home', onClick: () => setSelectedFolder(id, null) },
    ...ancestorChain.map((folder) => ({
      label: folder.name,
      onClick: () => setSelectedFolder(id, folder.id),
    })),
  ]);

  return (
    <>
      <div className="mb-4">
        <Breadcrumb items={breadcrumbItems} />
      </div>
      <FileBrowser
        dataRoomId={id}
        folderId={selectedFolderId}
        search={search}
        canUpload={canUpload}
        canDelete={canDelete}
        canDownload={canDownload}
      />
    </>
  );
}
