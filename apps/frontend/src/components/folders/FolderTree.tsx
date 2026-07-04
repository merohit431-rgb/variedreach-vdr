'use client';

import { useEffect, useMemo, useRef, useState, DragEvent, KeyboardEvent, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronDown, Folder as FolderIcon, FolderOpen, FolderPlus, Pencil, Copy, Trash2 } from 'lucide-react';
import {
  useFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useCopyFolder,
  FolderNode,
} from '@/hooks/use-folders';
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

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

interface FolderTreeProps {
  dataRoomId: string;
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  canUpload: boolean;
  canDelete: boolean;
}

interface ContextMenuState {
  folderId: string;
  x: number;
  y: number;
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
  const copyFolder = useCopyFolder(dataRoomId);
  const updateFile = useUpdateFile(dataRoomId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const tree = useMemo(() => buildTree(folders ?? []), [folders]);

  // Visible (respecting current expand/collapse state), flattened in
  // display order -- this is what Up/Down arrow keys walk through.
  const visibleOrder = useMemo(() => {
    const order: TreeNode[] = [];
    function walk(nodes: TreeNode[]) {
      for (const node of nodes) {
        order.push(node);
        if (expanded.has(node.id) && node.children.length > 0) {
          walk(node.children);
        }
      }
    }
    walk(tree);
    return order;
  }, [tree, expanded]);

  useEffect(() => {
    if (!contextMenu) return;

    function close() {
      setContextMenu(null);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setContextMenu(null);
    }

    document.addEventListener('click', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function focusNode(id: string) {
    setFocusedId(id);
    nodeRefs.current.get(id)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, node: TreeNode) {
    const index = visibleOrder.findIndex((n) => n.id === node.id);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = visibleOrder[index + 1];
      if (next) focusNode(next.id);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = visibleOrder[index - 1];
      if (prev) focusNode(prev.id);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (node.children.length === 0) return;
      if (!expanded.has(node.id)) {
        toggle(node.id);
      } else {
        focusNode(node.children[0].id);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (expanded.has(node.id) && node.children.length > 0) {
        toggle(node.id);
      } else if (node.parentId) {
        focusNode(node.parentId);
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(node.id);
    }
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

  function handleCopy(node: TreeNode) {
    copyFolder.mutate({ folderId: node.id, targetParentId: node.parentId });
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

  const CONTEXT_MENU_WIDTH = 176;
  const CONTEXT_MENU_HEIGHT = 168;
  const VIEWPORT_MARGIN = 8;

  function openContextMenu(event: MouseEvent, folderId: string) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      folderId,
      x: Math.min(event.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - VIEWPORT_MARGIN),
      y: Math.min(event.clientY, window.innerHeight - CONTEXT_MENU_HEIGHT - VIEWPORT_MARGIN),
    });
  }

  function renderNode(node: TreeNode) {
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedFolderId === node.id;
    const hasChildren = node.children.length > 0;
    const isFocusable = focusedId ? focusedId === node.id : selectedFolderId === node.id || node === tree[0];

    return (
      <li key={node.id} role="none">
        <div
          ref={(el) => {
            if (el) nodeRefs.current.set(node.id, el);
            else nodeRefs.current.delete(node.id);
          }}
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
          tabIndex={isFocusable ? 0 : -1}
          draggable={canUpload}
          onDragStart={(e) => e.dataTransfer.setData('text/folder-id', node.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(node.id);
          }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => handleDrop(e, node.id)}
          onContextMenu={(e) => openContextMenu(e, node.id)}
          onFocus={() => setFocusedId(node.id)}
          onKeyDown={(e) => handleKeyDown(e, node)}
          className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-slate-400 ${
            isSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          } ${dragOverId === node.id ? 'ring-1 ring-slate-400' : ''}`}
        >
          <button
            onClick={() => toggle(node.id)}
            tabIndex={-1}
            className="flex w-4 flex-shrink-0 items-center justify-center text-slate-400"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            ) : null}
          </button>
          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          ) : (
            <FolderIcon className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          )}
          <button onClick={() => onSelect(node.id)} tabIndex={-1} className="flex-1 truncate text-left">
            {node.name}
          </button>
          {(canUpload || canDelete) && (
            <span className="hidden gap-1 group-hover:flex">
              {canUpload && (
                <button
                  onClick={() => handleCreateChild(node.id)}
                  tabIndex={-1}
                  title="New subfolder"
                  className="text-xs text-slate-400 hover:text-slate-900"
                >
                  +
                </button>
              )}
              {canUpload && (
                <button
                  onClick={() => handleRename(node)}
                  tabIndex={-1}
                  title="Rename"
                  className="text-xs text-slate-400 hover:text-slate-900"
                >
                  ✎
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDelete(node)}
                  tabIndex={-1}
                  title="Delete"
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <ul role="group" className="ml-4 border-l border-slate-100 pl-2">
            {node.children.map(renderNode)}
          </ul>
        )}
      </li>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading folders…</p>;
  }

  const contextNode = contextMenu ? findNode(tree, contextMenu.folderId) : null;

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
        <ul role="tree" className="space-y-0.5">
          {tree.map(renderNode)}
        </ul>
      </div>

      {contextMenu &&
        contextNode &&
        createPortal(
          <div
            role="menu"
            className="fixed z-50 w-44 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {canUpload && (
              <button
                role="menuitem"
                onClick={() => {
                  handleCreateChild(contextNode.id);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
              >
                <FolderPlus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                New subfolder
              </button>
            )}
            {canUpload && (
              <button
                role="menuitem"
                onClick={() => {
                  handleRename(contextNode);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                Rename
              </button>
            )}
            {canUpload && (
              <button
                role="menuitem"
                onClick={() => {
                  handleCopy(contextNode);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                Copy
              </button>
            )}
            {canDelete && (
              <button
                role="menuitem"
                onClick={() => {
                  handleDelete(contextNode);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
