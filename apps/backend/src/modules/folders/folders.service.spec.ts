import { FoldersService } from './folders.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
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
