import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuestionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { FolderAccessService } from '../folder-access/folder-access.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { DATA_ROOM_MANAGER_ROLES } from '../../common/constants/content-roles';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class QnaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly dataRoomAccess: DataRoomAccessService,
    private readonly folderAccess: FolderAccessService,
    private readonly notificationService: NotificationService,
  ) {}

  async list(dataRoomId: string, actor: AuthenticatedUser, search?: string, clientIp?: string) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor, clientIp);
    const isManager = DATA_ROOM_MANAGER_ROLES.includes(effectiveRole);
    const resolver = await this.folderAccess.buildResolver(dataRoomId, actor, effectiveRole);

    // Two independent restrictions, ANDed (nested under a shared AND rather
    // than flattened into one OR, since a question must satisfy BOTH the
    // existing privacy rule AND the new folder rule, not either alone).
    // folderId: null is room-general and always passes -- this is what
    // keeps every historical question visible exactly as before. For a
    // manager, or a Data Room that never turned on folder-ACL,
    // buildResolver() already returns the unrestricted resolver, so the
    // folder clause is skipped and this query is byte-for-byte unchanged.
    const restrictions: Prisma.QuestionWhereInput[] = [];
    if (!isManager) {
      restrictions.push({ OR: [{ isPrivate: false }, { askedBy: actor.id }] });
    }
    if (!resolver.unrestricted) {
      restrictions.push({
        OR: [{ folderId: null }, { folderId: { in: [...resolver.reachableFolderIds()] } }, { askedBy: actor.id }],
      });
    }

    const questions = await this.prisma.question.findMany({
      where: {
        dataRoomId,
        deletedAt: null,
        ...(search ? { question: { contains: search, mode: 'insensitive' } } : {}),
        ...(restrictions.length > 0 ? { AND: restrictions } : {}),
      },
      include: {
        asker: { select: { id: true, firstName: true, lastName: true, role: true } },
        answers: {
          where: { deletedAt: null },
          include: {
            answerer: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return questions;
  }

  async ask(
    dataRoomId: string,
    question: string,
    isPrivate: boolean,
    folderId: string | null,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor, clientIp);

    // Tagging a question with a folder requires the asker to already be
    // able to reach that folder themselves -- the same rule files.service.ts
    // applies to the target folder of an upload. Without this, a member
    // could use a question's folder tag as a write-side-channel way to
    // reference a folder they cannot otherwise see.
    if (folderId !== null) {
      const resolver = await this.folderAccess.buildResolver(dataRoomId, actor, effectiveRole);
      await this.folderAccess.assertReachable(resolver, folderId, 'Folder not found', {
        dataRoomId,
        actor,
        resourceType: 'Folder',
        resourceId: folderId,
        ipAddress: clientIp,
      });
    }

    const created = await this.prisma.question.create({
      data: {
        dataRoomId,
        askedBy: actor.id,
        question,
        isPrivate,
        folderId,
      },
      include: {
        asker: { select: { id: true, firstName: true, lastName: true, role: true } },
        answers: true,
      },
    });

    await this.auditLogService.record({
      action: 'QUESTION_ASKED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Question',
      resourceId: created.id,
    });

    // Notify room managers (fire-and-forget — never fail the main response)
    this.notificationService.createForRoomManagers(
      dataRoomId,
      {
        type: 'QUESTION_ASKED',
        title: 'New question posted',
        message: `${actor.firstName} ${actor.lastName} asked: "${question.slice(0, 80)}${question.length > 80 ? '…' : ''}"`,
        metadata: { questionId: created.id, isPrivate },
      },
      actor.id,
    ).catch(() => undefined);

    return created;
  }

  async updateStatus(
    dataRoomId: string,
    questionId: string,
    status: QuestionStatus,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor, clientIp);
    const isManager = DATA_ROOM_MANAGER_ROLES.includes(effectiveRole);

    const q = await this.prisma.question.findFirst({
      where: { id: questionId, dataRoomId, deletedAt: null },
    });
    if (!q) throw new NotFoundException('Question not found');
    await this.assertQuestionAccessible(dataRoomId, q, actor, effectiveRole, clientIp);

    // Only the asker may withdraw their own question; managers may reject/re-open
    if (status === QuestionStatus.WITHDRAWN) {
      if (q.askedBy !== actor.id) {
        throw new ForbiddenException('Only the question author can withdraw it');
      }
    } else if (!isManager) {
      throw new ForbiddenException('Only room managers can change question status');
    }

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: { status },
    });

    await this.auditLogService.record({
      action: 'QUESTION_STATUS_CHANGED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Question',
      resourceId: questionId,
      metadata: { status },
    });

    return updated;
  }

  async answer(
    dataRoomId: string,
    questionId: string,
    answerText: string,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    // No folder-reachability check here: assertRoomManager() already limits
    // this entire method to DATA_ROOM_MANAGER_ROLES, the same set that
    // bypasses folder-ACL everywhere else, so a manager answering a
    // folder-scoped question is always allowed by the existing bypass rule.
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor, clientIp);

    const q = await this.prisma.question.findFirst({
      where: { id: questionId, dataRoomId, deletedAt: null },
    });
    if (!q) throw new NotFoundException('Question not found');

    const ans = await this.prisma.answer.create({
      data: { questionId, answeredBy: actor.id, answer: answerText },
      include: {
        answerer: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    // Automatically mark question as ANSWERED when an answer is posted
    await this.prisma.question.update({
      where: { id: questionId },
      data: { status: QuestionStatus.ANSWERED },
    });

    await this.auditLogService.record({
      action: 'QUESTION_ANSWERED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Question',
      resourceId: questionId,
      metadata: { answerId: ans.id },
    });

    // Notify the question asker (if not the same person answering)
    if (q.askedBy !== actor.id) {
      this.notificationService.create({
        userId: q.askedBy,
        type: 'QUESTION_ANSWERED',
        dataRoomId,
        title: 'Your question was answered',
        message: `${actor.firstName} ${actor.lastName} answered your question.`,
        metadata: { questionId, answerId: ans.id },
      }).catch(() => undefined);
    }

    return ans;
  }

  async editAnswer(
    dataRoomId: string,
    questionId: string,
    answerId: string,
    answerText: string,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    // Same reasoning as answer(): manager-only, and managers already bypass
    // folder-ACL, so no additional folder check is needed here.
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor, clientIp);

    const ans = await this.prisma.answer.findFirst({
      where: { id: answerId, questionId, deletedAt: null },
    });
    if (!ans) throw new NotFoundException('Answer not found');

    const updated = await this.prisma.answer.update({
      where: { id: answerId },
      data: { answer: answerText },
    });

    await this.auditLogService.record({
      action: 'QUESTION_ANSWER_EDITED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Question',
      resourceId: questionId,
      metadata: { answerId },
    });

    return updated;
  }

  async deleteQuestion(dataRoomId: string, questionId: string, actor: AuthenticatedUser, clientIp?: string) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor, clientIp);
    const isManager = DATA_ROOM_MANAGER_ROLES.includes(effectiveRole);

    const q = await this.prisma.question.findFirst({
      where: { id: questionId, dataRoomId, deletedAt: null },
    });
    if (!q) throw new NotFoundException('Question not found');
    await this.assertQuestionAccessible(dataRoomId, q, actor, effectiveRole, clientIp);

    if (q.askedBy !== actor.id && !isManager) {
      throw new ForbiddenException('You cannot delete this question');
    }

    await this.prisma.question.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });

    await this.auditLogService.record({
      action: 'QUESTION_DELETED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Question',
      resourceId: questionId,
      metadata: { question: q.question },
    });
  }

  // Hidden-existence check for a single, known question -- the same
  // property FolderAccessService already guarantees for folders/files: an
  // unreachable question throws the exact "Question not found" a genuinely
  // missing one would, so a non-manager can never distinguish "exists in a
  // folder I can't reach" from "never existed". The asker always bypasses
  // (mirrors the existing isPrivate rule: the author already knows their
  // own question exists, so there is nothing left to hide from them); a
  // manager bypasses because buildResolver() already returns the
  // unrestricted resolver for DATA_ROOM_MANAGER_ROLES. Called after the
  // existence findFirst and before any role/authorship branching in every
  // method that takes a single questionId.
  private async assertQuestionAccessible(
    dataRoomId: string,
    question: { id: string; folderId: string | null; askedBy: string },
    actor: AuthenticatedUser,
    effectiveRole: UserRole,
    clientIp?: string,
  ): Promise<void> {
    if (question.askedBy === actor.id) return;

    const resolver = await this.folderAccess.buildResolver(dataRoomId, actor, effectiveRole);
    await this.folderAccess.assertReachable(resolver, question.folderId, 'Question not found', {
      dataRoomId,
      actor,
      resourceType: 'Question',
      resourceId: question.id,
      ipAddress: clientIp,
    });
  }
}
