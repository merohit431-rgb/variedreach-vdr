import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { QuestionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { DATA_ROOM_MANAGER_ROLES } from '../../common/constants/content-roles';

@Injectable()
export class QnaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly dataRoomAccess: DataRoomAccessService,
  ) {}

  async list(dataRoomId: string, actor: AuthenticatedUser) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor);
    const isManager = DATA_ROOM_MANAGER_ROLES.includes(effectiveRole);

    const questions = await this.prisma.question.findMany({
      where: {
        dataRoomId,
        deletedAt: null,
        ...(isManager ? {} : {
          OR: [
            { isPrivate: false },
            { askedBy: actor.id },
          ],
        }),
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
    actor: AuthenticatedUser,
  ) {
    await this.dataRoomAccess.getAccess(dataRoomId, actor);

    const created = await this.prisma.question.create({
      data: {
        dataRoomId,
        askedBy: actor.id,
        question,
        isPrivate,
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

    return created;
  }

  async updateStatus(
    dataRoomId: string,
    questionId: string,
    status: QuestionStatus,
    actor: AuthenticatedUser,
  ) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor);
    const isManager = DATA_ROOM_MANAGER_ROLES.includes(effectiveRole);

    const q = await this.prisma.question.findFirst({
      where: { id: questionId, dataRoomId, deletedAt: null },
    });
    if (!q) throw new NotFoundException('Question not found');

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
  ) {
    const { effectiveRole } = await this.dataRoomAccess.assertRoomManager(dataRoomId, actor);

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

    return ans;
  }

  async editAnswer(
    dataRoomId: string,
    questionId: string,
    answerId: string,
    answerText: string,
    actor: AuthenticatedUser,
  ) {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor);

    const ans = await this.prisma.answer.findFirst({
      where: { id: answerId, questionId, deletedAt: null },
    });
    if (!ans) throw new NotFoundException('Answer not found');

    return this.prisma.answer.update({
      where: { id: answerId },
      data: { answer: answerText },
    });
  }

  async deleteQuestion(dataRoomId: string, questionId: string, actor: AuthenticatedUser) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor);
    const isManager = DATA_ROOM_MANAGER_ROLES.includes(effectiveRole);

    const q = await this.prisma.question.findFirst({
      where: { id: questionId, dataRoomId, deletedAt: null },
    });
    if (!q) throw new NotFoundException('Question not found');

    if (q.askedBy !== actor.id && !isManager) {
      throw new ForbiddenException('You cannot delete this question');
    }

    await this.prisma.question.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });
  }
}
