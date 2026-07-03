'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  type LucideIcon,
  LayoutDashboard,
  FolderLock,
  FolderOpen,
  Folder,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  History,
  Users,
  BarChart3,
  MessagesSquare,
  Settings,
  Receipt,
  Plus,
  X,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { useDataRoomAccess, useDataRoomStats } from '@/hooks/use-data-rooms';
import { useFolders, useCreateFolder, type FolderNode } from '@/hooks/use-folders';
import { ROLE_LABELS, EXTERNAL_ROLES, type UserRole } from '@variedreach-vdr/shared';
import { cn } from '@/lib/cn';

const TOP_LEVEL_FOLDER_LIMIT = 8;
const ROOM_PATH_PATTERN = /^\/data-rooms\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type NavSection = { label?: string; items: NavItem[] };

function getAppNavSections(role: UserRole): NavSection[] {
  const isExternal = EXTERNAL_ROLES.includes(role);

  if (isExternal) {
    return [
      {
        items: [
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/data-rooms', label: 'My Assignments', icon: FolderLock },
        ],
      },
    ];
  }

  const sections: NavSection[] = [
    {
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/data-rooms', label: 'Data Rooms', icon: FolderLock },
      ],
    },
  ];

  if (role === 'ORG_ADMIN') {
    sections.push({
      label: 'Administration',
      items: [
        { href: '/roles', label: 'Roles & Permissions', icon: ShieldCheck },
        { href: '/settings/billing', label: 'Billing', icon: Receipt },
      ],
    });
  }

  return sections;
}

function getRoomNavSections(base: string, canManage: boolean): NavSection[] {
  return [
    {
      items: [
        { href: base, label: 'Files', icon: FolderOpen, exact: true },
        { href: `${base}/activity`, label: 'Activity', icon: History },
        ...(canManage ? [{ href: `${base}/members`, label: 'Members', icon: Users }] : []),
        ...(canManage ? [{ href: `${base}/reports`, label: 'Reports', icon: BarChart3 }] : []),
        { href: `${base}/qna`, label: 'Q&A', icon: MessagesSquare },
        ...(canManage ? [{ href: `${base}/settings`, label: 'Settings', icon: Settings }] : []),
      ],
    },
  ];
}

function NavLinks({
  sections,
  pathname,
  isCollapsed,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  isCollapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <>
      {sections.map((section, si) => (
        <div key={si} className={si > 0 ? 'mt-4' : undefined}>
          {!isCollapsed && section.label && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-app-t4">
              {section.label}
            </p>
          )}
          {isCollapsed && si > 0 && <div className="mx-3 mb-3 mt-1 border-t border-app-border" />}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isCollapsed && 'justify-center px-0 py-2.5',
                    isActive
                      ? 'bg-app-primary/15 text-white'
                      : 'text-app-t3 hover:bg-app-s2 hover:text-app-text',
                  )}
                >
                  {isActive && (
                    <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-app-primary" />
                  )}
                  <item.icon
                    className={cn(
                      'h-[18px] w-[18px] flex-shrink-0',
                      isActive ? 'text-app-primary' : 'text-app-t4 group-hover:text-app-t2',
                    )}
                    aria-hidden="true"
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              return (
                <div key={item.href}>
                  {isCollapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function FolderRow({
  folder,
  depth,
  count,
  isSelected,
  hasChildren,
  isExpanded,
  onToggle,
  onSelect,
}: {
  folder: FolderNode;
  depth: number;
  count: number;
  isSelected: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-lg pr-2 transition-colors',
        isSelected ? 'bg-app-primary/15' : 'hover:bg-app-s2',
      )}
      style={{ paddingLeft: `${depth * 14}px` }}
    >
      <button
        onClick={hasChildren ? onToggle : onSelect}
        aria-label={hasChildren ? (isExpanded ? 'Collapse folder' : 'Expand folder') : undefined}
        className="flex h-7 w-5 flex-shrink-0 items-center justify-center text-app-t4"
        tabIndex={hasChildren ? 0 : -1}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )
        ) : (
          <span className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px]',
          isSelected ? 'font-semibold text-white' : 'text-app-t3 group-hover:text-app-t2',
        )}
      >
        <Folder
          className={cn('h-3.5 w-3.5 flex-shrink-0', isSelected ? 'text-app-primary' : 'text-app-t4')}
          aria-hidden="true"
        />
        <span className="truncate">{folder.name}</span>
      </button>
      {count > 0 && (
        <span
          className={cn(
            'flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
            isSelected ? 'bg-app-primary/25 text-blue-300' : 'bg-app-s2 text-app-t4',
          )}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function RoomFolderSection({ roomId, onNavigate }: { roomId: string; onNavigate: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: folders } = useFolders(roomId);
  const { data: stats } = useDataRoomStats(roomId);
  const { data: access } = useDataRoomAccess(roomId);
  const createFolder = useCreateFolder(roomId);
  const { selectedFolderId, setSelectedFolder } = useWorkspaceStore();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const filesPath = `/data-rooms/${roomId}`;
  const onFilesPage = pathname === filesPath;

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, FolderNode[]>();
    for (const folder of folders ?? []) {
      const list = map.get(folder.parentId) ?? [];
      list.push(folder);
      map.set(folder.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
    return map;
  }, [folders]);

  // Subtree file counts: the stats endpoint returns direct-child counts per
  // folder; the badge shows the whole subtree so "F. Financials · 184" means
  // everything inside it.
  const subtreeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!stats) return counts;
    const visit = (id: string): number => {
      let total = stats.folderCounts[id] ?? 0;
      for (const child of childrenOf.get(id) ?? []) total += visit(child.id);
      counts[id] = total;
      return total;
    };
    for (const root of childrenOf.get(null) ?? []) visit(root.id);
    return counts;
  }, [childrenOf, stats]);

  // Keep the ancestors of the selected folder expanded so the active folder
  // is always visible after navigation.
  useEffect(() => {
    if (!selectedFolderId || !folders) return;
    const byId = new Map(folders.map((f) => [f.id, f]));
    const next = new Set(expanded);
    let current = byId.get(selectedFolderId);
    while (current?.parentId) {
      next.add(current.parentId);
      current = byId.get(current.parentId);
    }
    if (next.size !== expanded.size) setExpanded(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId, folders]);

  function selectFolder(id: string | null) {
    setSelectedFolder(roomId, id);
    if (!onFilesPage) router.push(filesPath);
    onNavigate();
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateFolder() {
    const name = window.prompt('New folder name');
    if (name) createFolder.mutate({ name, parentId: selectedFolderId ?? undefined });
  }

  function renderTree(parentId: string | null, depth: number): React.ReactNode {
    let nodes = childrenOf.get(parentId) ?? [];
    const isRootLevel = parentId === null;
    const hiddenCount = isRootLevel && !showAll ? Math.max(0, nodes.length - TOP_LEVEL_FOLDER_LIMIT) : 0;
    if (hiddenCount > 0) nodes = nodes.slice(0, TOP_LEVEL_FOLDER_LIMIT);

    return (
      <>
        {nodes.map((folder) => {
          const hasChildren = (childrenOf.get(folder.id) ?? []).length > 0;
          const isExpanded = expanded.has(folder.id);
          return (
            <div key={folder.id}>
              <FolderRow
                folder={folder}
                depth={depth}
                count={subtreeCounts[folder.id] ?? 0}
                isSelected={onFilesPage && selectedFolderId === folder.id}
                hasChildren={hasChildren}
                isExpanded={isExpanded}
                onToggle={() => toggleExpanded(folder.id)}
                onSelect={() => selectFolder(folder.id)}
              />
              {hasChildren && isExpanded && renderTree(folder.id, depth + 1)}
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium text-app-t4 transition-colors hover:text-app-t2"
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            Show {hiddenCount} more
          </button>
        )}
      </>
    );
  }

  return (
    <div className="mt-5 border-t border-app-border pt-4">
      <div className="mb-1.5 flex items-center justify-between px-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-app-t4">Folders</p>
        {access?.canUploadContent && (
          <button
            onClick={handleCreateFolder}
            aria-label="New folder"
            className="rounded-md p-1 text-app-t4 transition-colors hover:bg-app-s2 hover:text-app-t2"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* All files */}
      <div
        className={cn(
          'group flex items-center rounded-lg pr-2 transition-colors',
          onFilesPage && selectedFolderId === null ? 'bg-app-primary/15' : 'hover:bg-app-s2',
        )}
      >
        <button
          onClick={() => selectFolder(null)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-[26px] text-left text-[13px]',
            onFilesPage && selectedFolderId === null
              ? 'font-semibold text-white'
              : 'text-app-t3 group-hover:text-app-t2',
          )}
        >
          <FolderOpen
            className={cn(
              'h-3.5 w-3.5 flex-shrink-0',
              onFilesPage && selectedFolderId === null ? 'text-app-primary' : 'text-app-t4',
            )}
            aria-hidden="true"
          />
          <span className="truncate">All files</span>
        </button>
        {stats && stats.documents > 0 && (
          <span
            className={cn(
              'flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              onFilesPage && selectedFolderId === null
                ? 'bg-app-primary/25 text-blue-300'
                : 'bg-app-s2 text-app-t4',
            )}
          >
            {stats.documents}
          </span>
        )}
      </div>

      {renderTree(null, 0)}
    </div>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const roomId = pathname.match(ROOM_PATH_PATTERN)?.[1] ?? null;
  const { data: roomAccess } = useDataRoomAccess(roomId ?? '');

  const sections = roomId
    ? getRoomNavSections(`/data-rooms/${roomId}`, Boolean(roomAccess?.canManageRoom))
    : getAppNavSections(user?.role ?? 'RP_LIQUIDATOR');

  const canCreateRoom = user && !EXTERNAL_ROLES.includes(user.role);

  const content = (
    <>
      {/* Logo header */}
      <div
        className={cn(
          'flex h-16 flex-shrink-0 items-center border-b border-app-border',
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        <Logo size="sm" variant="light" showSubtitle={!isCollapsed} iconOnly={isCollapsed} />
        <button
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="rounded-md p-1.5 text-app-t4 hover:bg-app-s2 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Primary action / back link */}
      {!isCollapsed && (
        <div className="flex-shrink-0 px-3 pt-3">
          {roomId ? (
            <Link
              href="/data-rooms"
              onClick={onCloseMobile}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-app-t4 transition-colors hover:bg-app-s2 hover:text-app-t2"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              All Data Rooms
            </Link>
          ) : (
            canCreateRoom && (
              <Link
                href="/data-rooms/new"
                onClick={onCloseMobile}
                className="flex items-center justify-center gap-2 rounded-lg bg-app-primary px-3 py-2.5 text-sm font-semibold text-white shadow-dark-soft transition-colors hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Data Room
              </Link>
            )
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <NavLinks
          sections={sections}
          pathname={pathname}
          isCollapsed={isCollapsed}
          onNavigate={onCloseMobile}
        />
        {roomId && !isCollapsed && <RoomFolderSection roomId={roomId} onNavigate={onCloseMobile} />}
      </nav>

      {/* User info + collapse toggle */}
      <div className="flex-shrink-0 border-t border-app-border p-3">
        {user && !isCollapsed && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2">
            <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-app-t2">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[10px] text-app-t4">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
        )}
        {user && isCollapsed && (
          <div className="mb-2 flex justify-center">
            <Tooltip label={`${user.firstName} ${user.lastName} — ${ROLE_LABELS[user.role]}`}>
              <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
            </Tooltip>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-app-t4 hover:bg-app-s2 hover:text-app-t2 lg:flex',
            isCollapsed && 'justify-center',
          )}
        >
          {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!isCollapsed && 'Collapse'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden h-screen flex-shrink-0 flex-col border-r border-app-border bg-app-s1 transition-all duration-200 lg:flex',
          isCollapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {content}
      </aside>

      {/* Mobile off-canvas drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col bg-app-s1 shadow-dark-popover animate-slide-up">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
