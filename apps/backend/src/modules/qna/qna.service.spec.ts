import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionStatus, UserRole } from '@prisma/client';
import { QnaService } from './qna.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { FolderAccessService, FolderAccessResolver } from '../folder-access/folder-access.service';
import type { NotificationService } from '../notifications/notification.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const ASKER = { id: 'asker-1', organisationId: 'org-1', firstName: 'A', lastName: 'Sker', role: 'PRA' } as AuthenticatedUser;
const OTHER_MEMBER = { id: 'member-2', organisationId: 'org-1', firstName: 'O', lastName: 'Ther', role: 'PRA' } as AuthenticatedUser;
const MANAGER = { id: 'manager-1', organisationId: 'org-1', firstName: 'M', lastName: 'Gr', role: 'RP_LIQUIDATOR' } as AuthenticatedUser;

const UNRESTRICTED: FolderAccessResolver = {
  unrestricted: true,
  canReach: () => true,
  reachableFolderIds: () => {
    throw new Error('not meaningful on an unrestricted resolver');
  },
};

function restrictedResolver(reachable: string[]): FolderAccessResolver {
  const ids = new Set(reachable);
  return {
    unrestricted: false,
    canReach: (folderId) => folderId === null || ids.has(folderId),
    reachableFolderIds: () => ids,
  };
}

function buildService(opts: {
  effectiveRole?: UserRole;
  resolver?: FolderAccessResolver;
  question?: unknown;
  questions?: unknown[];
  assertRoomManager?: jest.Mock;
}) {
  const getAccess = jest.fn().mockResolvedValue({ effectiveRole: opts.effectiveRole ?? UserRole.PRA });
  const assertRoomManager =
    opts.assertRoomManager ?? jest.fn().mockResolvedValue({ effectiveRole: opts.effectiveRole ?? UserRole.RP_LIQUIDATOR });
  const buildResolver = jest.fn().mockResolvedValue(opts.resolver ?? UNRESTRICTED);
  const assertReachable = jest.fn().mockImplementation(async (resolver: FolderAccessResolver, folderId: string | null, message: string) => {
    if (resolver.unrestricted || resolver.canReach(folderId)) return;
    throw new NotFoundException(message);
  });

  const questionFindMany = jest.fn().mockResolvedValue(opts.questions ?? []);
  const questionFindFirst = jest.fn().mockResolvedValue('question' in opts ? opts.question : null);
  const questionCreate = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'q-new', ...data }));
  const questionUpdate = jest.fn().mockResolvedValue({});
  const answerCreate = jest.fn().mockResolvedValue({ id: 'ans-1' });
  const answerFindFirst = jest.fn().mockResolvedValue({ id: 'ans-1', questionId: 'q-1', deletedAt: null });
  const answerUpdate = jest.fn().mockResolvedValue({});
  const record = jest.fn().mockResolvedValue({});
  const notifyCreate = jest.fn().mockResolvedValue({});
  const notifyManagers = jest.fn().mockResolvedValue({});

  const prisma = {
    question: { findMany: questionFindMany, findFirst: questionFindFirst, create: questionCreate, update: questionUpdate },
    answer: { create: answerCreate, findFirst: answerFindFirst, update: answerUpdate },
  } as unknown as PrismaService;

  const service = new QnaService(
    prisma,
    { record } as unknown as AuditLogService,
    { getAccess, assertRoomManager } as unknown as DataRoomAccessService,
    { buildResolver, assertReachable } as unknown as FolderAccessService,
    { create: notifyCreate, createForRoomManagers: notifyManagers } as unknown as NotificationService,
  );

  return {
    service,
    getAccess,
    assertRoomManager,
    buildResolver,
    assertReachable,
    questionFindMany,
    questionFindFirst,
    questionCreate,
    questionUpdate,
    answerCreate,
    answerFindFirst,
    record,
  };
}

describe('QnaService.ask -- folder association (Phase 3A.1)', () => {
  it('creates a room-general question (folderId: null) by default -- fully backward compatible', async () => {
    const { service, questionCreate, buildResolver } = buildService({});

    await service.ask('room-1', 'What is the EBITDA?', false, null, ASKER);

    expect(questionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ folderId: null }) }),
    );
    expect(buildResolver).not.toHaveBeenCalled(); // no folder check needed when folderId is null
  });

  it('creates a folder-scoped question when the asker can reach that folder', async () => {
    const { service, questionCreate, assertReachable } = buildService({
      resolver: restrictedResolver(['folder-1']),
    });

    await service.ask('room-1', 'About this folder', false, 'folder-1', ASKER);

    expect(assertReachable).toHaveBeenCalledWith(
      expect.anything(),
      'folder-1',
      'Folder not found',
      expect.objectContaining({ resourceType: 'Folder', resourceId: 'folder-1' }),
    );
    expect(questionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ folderId: 'folder-1' }) }),
    );
  });

  it('rejects tagging a question to a folder the asker cannot reach -- "Folder not found", not a permission error', async () => {
    const { service, questionCreate } = buildService({ resolver: restrictedResolver([]) });

    await expect(service.ask('room-1', 'Sneaky', false, 'restricted-folder', ASKER)).rejects.toThrow(
      'Folder not found',
    );
    expect(questionCreate).not.toHaveBeenCalled();
  });
});

describe('QnaService.list -- folder-based confidentiality filtering', () => {
  it('a manager\'s query is byte-for-byte unchanged -- no AND clause added at all', async () => {
    const { service, questionFindMany } = buildService({ effectiveRole: UserRole.RP_LIQUIDATOR, resolver: UNRESTRICTED });

    await service.list('room-1', MANAGER);

    const where = questionFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ dataRoomId: 'room-1', deletedAt: null });
  });

  it('an unrestricted Data Room (folder-ACL never enabled) adds no folder clause for a non-manager either', async () => {
    const { service, questionFindMany } = buildService({ effectiveRole: UserRole.PRA, resolver: UNRESTRICTED });

    await service.list('room-1', OTHER_MEMBER);

    const where = questionFindMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(1); // only the pre-existing privacy restriction
    expect(where.AND[0]).toEqual({ OR: [{ isPrivate: false }, { askedBy: 'member-2' }] });
  });

  it('a restricted room ANDs both the privacy rule and the folder-reachability rule for a non-manager', async () => {
    const { service, questionFindMany } = buildService({
      effectiveRole: UserRole.PRA,
      resolver: restrictedResolver(['folder-1']),
    });

    await service.list('room-1', OTHER_MEMBER);

    const where = questionFindMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[1]).toEqual({
      OR: [{ folderId: null }, { folderId: { in: ['folder-1'] } }, { askedBy: 'member-2' }],
    });
  });

  it('the folder-reachability OR includes askedBy -- the asker always sees their own question regardless of current folder reachability', async () => {
    const { service, questionFindMany } = buildService({
      effectiveRole: UserRole.PRA,
      resolver: restrictedResolver([]), // nothing reachable
    });

    await service.list('room-1', ASKER);

    const folderClause = questionFindMany.mock.calls[0][0].where.AND[1];
    expect(folderClause.OR).toContainEqual({ askedBy: 'asker-1' });
  });
});

describe('QnaService hidden-existence: updateStatus / deleteQuestion on a folder-restricted question', () => {
  it('updateStatus: a non-asker, non-manager gets "Question not found" for a question in an unreachable folder -- not a 403', async () => {
    const { service } = buildService({
      effectiveRole: UserRole.PRA,
      resolver: restrictedResolver([]), // folder-1 unreachable to OTHER_MEMBER
      question: { id: 'q-1', dataRoomId: 'room-1', askedBy: 'asker-1', folderId: 'folder-1', deletedAt: null },
    });

    const rejection = service.updateStatus('room-1', 'q-1', QuestionStatus.REJECTED, OTHER_MEMBER);
    await expect(rejection).rejects.toThrow(NotFoundException);
    await expect(rejection).rejects.toThrow('Question not found');
  });

  it('updateStatus: the SAME call for a genuinely nonexistent question throws the identical message -- indistinguishable', async () => {
    const { service } = buildService({ effectiveRole: UserRole.PRA, question: null });

    await expect(
      service.updateStatus('room-1', 'does-not-exist', QuestionStatus.REJECTED, OTHER_MEMBER),
    ).rejects.toThrow('Question not found');
  });

  it('updateStatus: the ASKER can still withdraw their own question even if their folder access was later revoked', async () => {
    const { service, questionUpdate } = buildService({
      effectiveRole: UserRole.PRA,
      resolver: restrictedResolver([]), // asker's own folder access no longer reaches folder-1
      question: { id: 'q-1', dataRoomId: 'room-1', askedBy: 'asker-1', folderId: 'folder-1', deletedAt: null },
    });

    await service.updateStatus('room-1', 'q-1', QuestionStatus.WITHDRAWN, ASKER);

    expect(questionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: QuestionStatus.WITHDRAWN } }),
    );
  });

  it('updateStatus: a manager can change status on a folder-restricted question -- bypasses the folder check entirely', async () => {
    const { service, buildResolver, questionUpdate } = buildService({
      effectiveRole: UserRole.RP_LIQUIDATOR,
      resolver: UNRESTRICTED,
      question: { id: 'q-1', dataRoomId: 'room-1', askedBy: 'asker-1', folderId: 'folder-1', deletedAt: null },
    });

    await service.updateStatus('room-1', 'q-1', QuestionStatus.REJECTED, MANAGER);

    expect(buildResolver).toHaveBeenCalled();
    expect(questionUpdate).toHaveBeenCalled();
  });

  it('updateStatus: a question with folderId null is always reachable regardless of resolver state', async () => {
    const { service } = buildService({
      effectiveRole: UserRole.PRA,
      resolver: restrictedResolver([]), // nothing reachable, but...
      question: { id: 'q-1', dataRoomId: 'room-1', askedBy: 'asker-1', folderId: null, deletedAt: null },
    });

    // Non-manager, non-asker changing status is still rejected by the
    // PRE-EXISTING role rule -- but it must fail with the role error, not
    // "Question not found", proving the folder check passed for a
    // room-general question.
    await expect(
      service.updateStatus('room-1', 'q-1', QuestionStatus.REJECTED, OTHER_MEMBER),
    ).rejects.toThrow('Only room managers can change question status');
  });

  it('deleteQuestion: a non-asker, non-manager gets "Question not found" for a restricted-folder question', async () => {
    const { service } = buildService({
      effectiveRole: UserRole.PRA,
      resolver: restrictedResolver([]),
      question: { id: 'q-1', dataRoomId: 'room-1', askedBy: 'asker-1', folderId: 'folder-1', deletedAt: null, question: 'secret' },
    });

    await expect(service.deleteQuestion('room-1', 'q-1', OTHER_MEMBER)).rejects.toThrow('Question not found');
  });

  it('deleteQuestion: the asker can delete their own folder-restricted question', async () => {
    const { service, questionUpdate } = buildService({
      effectiveRole: UserRole.PRA,
      resolver: restrictedResolver([]),
      question: { id: 'q-1', dataRoomId: 'room-1', askedBy: 'asker-1', folderId: 'folder-1', deletedAt: null, question: 'mine' },
    });

    await service.deleteQuestion('room-1', 'q-1', ASKER);

    expect(questionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { deletedAt: expect.any(Date) } }));
  });
});

describe('QnaService.answer / editAnswer -- manager-only, folder-ACL bypass by construction', () => {
  it('answer: never calls buildResolver -- assertRoomManager alone already gates the entire method to the bypass-tier roles', async () => {
    const { service, buildResolver, answerCreate } = buildService({
      effectiveRole: UserRole.RP_LIQUIDATOR,
      question: { id: 'q-1', dataRoomId: 'room-1', askedBy: 'asker-1', folderId: 'folder-1', deletedAt: null },
    });

    await service.answer('room-1', 'q-1', 'The answer', MANAGER);

    expect(buildResolver).not.toHaveBeenCalled();
    expect(answerCreate).toHaveBeenCalled();
  });

  it('answer: a non-manager is rejected by assertRoomManager before the question is even fetched', async () => {
    const assertRoomManager = jest.fn().mockRejectedValue(new ForbiddenException('Your role does not allow this action'));
    const { service, questionFindFirst } = buildService({ assertRoomManager });

    await expect(service.answer('room-1', 'q-1', 'x', OTHER_MEMBER)).rejects.toThrow(ForbiddenException);
    expect(questionFindFirst).not.toHaveBeenCalled();
  });

  it('editAnswer: never calls buildResolver either', async () => {
    const { service, buildResolver } = buildService({ effectiveRole: UserRole.RP_LIQUIDATOR });

    await service.editAnswer('room-1', 'q-1', 'ans-1', 'Updated answer', MANAGER);

    expect(buildResolver).not.toHaveBeenCalled();
  });
});

describe('QnaService regression: pre-existing isPrivate behaviour is untouched', () => {
  it('list: a private question is still excluded for a non-asker, non-manager, even in a fully unrestricted room', async () => {
    const { service, questionFindMany } = buildService({ effectiveRole: UserRole.PRA, resolver: UNRESTRICTED });

    await service.list('room-1', OTHER_MEMBER);

    expect(questionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ OR: [{ isPrivate: false }, { askedBy: 'member-2' }] }],
        }),
      }),
    );
  });

  it('ask: isPrivate still defaults false and is stored exactly as before, independent of folderId', async () => {
    const { service, questionCreate } = buildService({});

    await service.ask('room-1', 'Q', false, null, ASKER);

    expect(questionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isPrivate: false, folderId: null }) }),
    );
  });
});
