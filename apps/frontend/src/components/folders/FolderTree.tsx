'use client';

import { useMemo, useState, DragEvent } from 'react';
import { useFolders, useCreateFolder, useUpdateFolder, useDeleteFolder, FolderNode } from '@/hooks/use-folders';
import { useUpdateFile } from '@/hooks/use-files';

interface TreeNode extends FolderNode {
  children: TreeNode[];
}

function buildTree(folders: FolderNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(folders.map((f) => [f.id, { ...f, children: [] }]));
  const roots: TreeNode[] = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

interface FolderTreeProps {
  dataRoomId: string;
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  canUpload: boolean;
  canDelete: boolean;
}

export function FolderTree({
  dataRoomId,
  selectedFolderId,
  onSelect,
  canUpload,
  canDelete,
}: FolderTreeProps) {
  const { data: folders, isLoading } = useFolders(dataRoomId);
  const createFolder = useCreateFolder(dataRoomId);
  const updateFolder = useUpdateFolder(dataRoomId);
  const deleteFolder = useDeleteFolder(dataRoomId);
  const updateFile = useUpdateFile(dataRoomId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(folders ?? []), [folders]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleCreateRoot() {
    const name = window.prompt('New folder name');
    if (name) createFolder.mutate({ name });
  }

  function handleCreateChild(parentId: string) {
    const name = window.prompt('New folder name');
    if (name) createFolder.mutate({ name, parentId });
  }

  function handleRename(node: TreeNode) {
    const name = window.prompt('Rename folder', node.name);
    if (name && name !== node.name) updateFolder.mutate({ folderId: node.id, name });
  }

  function handleDelete(node: TreeNode) {
    if (node.children.length > 0) {
      alert('This folder has subfolders — delete those first.');
      return;
    }
    if (window.confirm(`Delete "${node.name}"?`)) {
      deleteFolder.mutate(node.id);
      if (selectedFolderId === node.id) onSelect(null);
    }
  }

  function handleDrop(event: DragEvent, targetId: string | null) {
    event.preventDefault();
    setDragOverId(null);

    const folderId = event.dataTransfer.getData('text/folder-id');
    if (folderId && folderId !== targetId) {
      updateFolder.mutate({ folderId, parentId: targetId });
      return;
    }

    const fileId = event.dataTransfer.getData('text/file-id');
    if (fileId) {
      updateFile.mutate({ fileId, folderId: targetId });
    }
  }

  function renderNode(node: TreeNode) {
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedFolderId === node.id;

    return (
      <li key={node.id}>
        <div
          draggable={canUpload}
          onDragStart={(e) => e.dataTransfer.setData('text/folder-id', node.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(node.id);
          }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => handleDrop(e, node.id)}
          className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm ${
            isSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          } ${dragOverId === node.id ? 'ring-1 ring-slate-400' : ''}`}
        >
          <button
            onClick={() => toggle(node.id)}
            className="w-4 text-slate-400"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.children.length > 0 ? (isExpanded ? '▾' : '▸') : ''}
          </button>
          <button onClick={() => onSelect(node.id)} className="flex-1 truncate text-left">
            {node.name}
          </button>
          {(canUpload || canDelete) && (
            <span className="hidden gap-1 group-hover:flex">
              {canUpload && (
                <button
                  onClick={() => handleCreateChild(node.id)}
                  title="New subfolder"
                  className="text-xs text-slate-400 hover:text-slate-900"
                >
                  +
                </button>
              )}
              {canUpload && (
                <button
                  onClick={() => handleRename(node)}
                  title="Rename"
                  className="text-xs text-slate-400 hover:text-slate-900"
                >
                  ✎
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDelete(node)}
                  title="Delete"
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </span>
          )}
        </div>
        {isExpanded && node.children.length > 0 && (
          <ul className="ml-4 border-l border-slate-100 pl-2">{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading folders…</p>;
  }

  return (
    <div className="w-64 flex-shrink-0">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-slate-500">Folders</p>
        {canUpload && (
          <button onClick={handleCreateRoot} className="text-xs text-slate-500 hover:text-slate-900">
            + New
          </button>
        )}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverId('__root__');
        }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => handleDrop(e, null)}
        className={`rounded-md ${dragOverId === '__root__' ? 'ring-1 ring-slate-400' : ''}`}
      >
        <button
          onClick={() => onSelect(null)}
          className={`mb-1 block w-full rounded-md px-2 py-1 text-left text-sm ${
            selectedFolderId === null ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          All files
        </button>
        <ul className="space-y-0.5">{tree.map(renderNode)}</ul>
      </div>
    </div>
  );
}
