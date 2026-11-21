import { FoldersService } from './folders.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { FolderAccessService } from '../folder-access/folder-access.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { IStorageService } from '../storage/storage.interface';

interface TemplateFolderRow {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
}

function buildService(templateFolders: TemplateFolderRow[]) {
  const folderCreate = jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `id-${data.name}`,
    ...data,
  }));

  const prisma = {
    dataRoomTemplateFolder: {
      findMany: jest.fn().mockResolvedValue(templateFolders),
    },
    folder: { create: folderCreate },
  } as unknown as PrismaService;

  const service = new FoldersService(
    prisma,
    {} as DataRoomAccessService,
    {} as FolderAccessService,
    {} as AuditLogService,
    {} as IStorageService,
  );

  return { service, folderCreate };
}

// seedFromTemplate() replaced the old hardcoded CIRP-only seeding -- these
// tests cover the generic tree-walk that both CIRP and IPO (and any future
// template) now share.
describe('FoldersService.seedFromTemplate', () => {
  it('creates a nested branch using the REAL created parent id, not the template row id, and derives path/depth/sortOrder', async () => {
    const { service, folderCreate } = buildService([
      { id: 't-a', parentId: null, name: 'A', sortOrder: 0 },
      { id: 't-b', parentId: null, name: 'B', sortOrder: 1 },
      { id: 't-a1', parentId: 't-a', name: 'A1', sortOrder: 0 },
    ]);

    await service.seedFromTemplate('room-1', 'tpl-1', 'user-1');

    expect(folderCreate).toHaveBeenCalledTimes(3);

    const [callA, callA1, callB] = folderCreate.mock.calls.map((call) => call[0].data);

    expect(callA).toMatchObject({ name: 'A', parentId: null, path: '/A', depth: 0, sortOrder: 0, createdBy: 'user-1' });
    expect(callB).toMatchObject({ name: 'B', parentId: null, path: '/B', depth: 0, sortOrder: 1 });
    // The child must reference the newly-created folder's real id (id-A),
    // never the template folder's own id (t-a).
    expect(callA1).toMatchObject({ name: 'A1', parentId: 'id-A', path: '/A/A1', depth: 1, sortOrder: 0 });
  });

  it('creates an entire sibling subtree before moving to the next top-level sibling (depth-first)', async () => {
    const { service, folderCreate } = buildService([
      { id: 't-a', parentId: null, name: 'A', sortOrder: 0 },
      { id: 't-b', parentId: null, name: 'B', sortOrder: 1 },
      { id: 't-a1', parentId: 't-a', name: 'A1', sortOrder: 0 },
    ]);

    await service.seedFromTemplate('room-1', 'tpl-1', 'user-1');

    const createdNames = folderCreate.mock.calls.map((call) => call[0].data.name);
    expect(createdNames).toEqual(['A', 'A1', 'B']);
  });

  // CIRP-compatibility regression: the old CIRP_DEFAULT_FOLDERS constant was
  // a flat list, so every one of its rows must still land at depth 0 with no
  // parent now that it's rows in data_room_template_folders instead.
  it('keeps every folder flat (depth 0, no parent) for a template with no nesting, matching the old CIRP behaviour', async () => {
    const { service, folderCreate } = buildService([
      { id: 't-1', parentId: null, name: 'Admission Order', sortOrder: 0 },
      { id: 't-2', parentId: null, name: 'Claims', sortOrder: 1 },
      { id: 't-3', parentId: null, name: 'CoC Minutes', sortOrder: 2 },
    ]);

    await service.seedFromTemplate('room-1', 'cirp-tpl', 'user-1');

    for (const call of folderCreate.mock.calls) {
      expect(call[0].data.parentId).toBeNull();
      expect(call[0].data.depth).toBe(0);
    }
  });

  it('creates nothing for a template with no folder rows', async () => {
    const { service, folderCreate } = buildService([]);

    await service.seedFromTemplate('room-1', 'empty-tpl', 'user-1');

    expect(folderCreate).not.toHaveBeenCalled();
  });
});

// Folder tree: A, D (-> D1), C (-> C1, C2) -- a user granted only C1 should
// see C1 itself plus C (name-only ancestor, for breadcrumbs) but NOT A, D,
// D1, or C2 at all.
const TREE_FOLDERS = [
  { id: 'A', parentId: null, name: 'A', depth: 0, sortOrder: 0 },
  { id: 'D', parentId: null, name: 'D', depth: 0, sortOrder: 1 },
  { id: 'D1', parentId: 'D', name: 'D1', depth: 1, sortOrder: 0 },
  { id: 'C', parentId: null, name: 'C', depth: 0, sortOrder: 2 },
  { id: 'C1', parentId: 'C', name: 'C1', depth: 1, sortOrder: 0 },
  { id: 'C2', parentId: 'C', name: 'C2', depth: 1, sortOrder: 1 },
];

function buildTreeService(resolver: {
  unrestricted: boolean;
  canReach?: (id: string | null) => boolean;
  reachableFolderIds?: () => Set<string>;
}) {
  const folderFindMany = jest.fn().mockResolvedValue(TREE_FOLDERS);
  const getAccess = jest.fn().mockResolvedValue({ effectiveRole: 'PRA' });
  const buildResolver = jest.fn().mockResolvedValue(resolver);

  const prisma = { folder: { findMany: folderFindMany } } as unknown as PrismaService;
  const service = new FoldersService(
    prisma,
    { getAccess } as unknown as DataRoomAccessService,
    { buildResolver } as unknown as FolderAccessService,
    {} as AuditLogService,
    {} as IStorageService,
  );
  return { service };
}

describe('FoldersService.findTree -- hidden-folder visibility', () => {
  it('returns the full unfiltered list, all reachable, for an unrestricted room', async () => {
    const { service } = buildTreeService({ unrestricted: true });

    const result = await service.findTree('room-1', {} as never);

    expect(result).toHaveLength(6);
    expect(result.every((f) => f.reachable)).toBe(true);
  });

  it('shows a granted folder plus its name-only ancestors, and nothing from unrelated branches', async () => {
    const { service } = buildTreeService({
      unrestricted: false,
      canReach: (id) => id === 'C1',
      reachableFolderIds: () => new Set(['C1']),
    });

    const result = await service.findTree('room-1', {} as never);
    const ids = result.map((f) => f.id).sort();

    // C1 (reachable) + C (its ancestor, name-only) -- never A, D, D1, or C2.
    expect(ids).toEqual(['C', 'C1']);
    expect(result.find((f) => f.id === 'C1')!.reachable).toBe(true);
    expect(result.find((f) => f.id === 'C')!.reachable).toBe(false);
  });

  it('never includes a sibling of an ancestor that is not itself on the path to a reachable folder', async () => {
    const { service } = buildTreeService({
      unrestricted: false,
      canReach: (id) => id === 'D1',
      reachableFolderIds: () => new Set(['D1']),
    });

    const result = await service.findTree('room-1', {} as never);
    const ids = result.map((f) => f.id);

    expect(ids).not.toContain('C');
    expect(ids).not.toContain('C1');
    expect(ids).not.toContain('C2');
    expect(ids).not.toContain('A');
  });

  it('returns an empty list when nothing at all is reachable', async () => {
    const { service } = buildTreeService({ unrestricted: false, canReach: () => false, reachableFolderIds: () => new Set() });

    const result = await service.findTree('room-1', {} as never);

    expect(result).toEqual([]);
  });
});
