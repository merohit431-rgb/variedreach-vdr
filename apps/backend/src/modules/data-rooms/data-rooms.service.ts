import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { FoldersService } from '../folders/folders.service';
import { generateOpaqueToken } from '../../common/utils/crypto.util';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { CreateDataRoomDto } from './dto/create-data-room.dto';
import { UpdateDataRoomDto } from './dto/update-data-room.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.RP_LIQUIDATOR];

@Injectable()
export class DataRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
    private readonly foldersService: FoldersService,
  ) {}

  async create(dto: CreateDataRoomDto, actor: AuthenticatedUser) {
    const dataRoom = await this.prisma.dataRoom.create({
      data: {
        organisationId: actor.organisationId,
        name: dto.name,
        type: dto.type,
        caseNumber: dto.caseNumber,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdBy: actor.id,
        members: {
          create: { userId: actor.id, joinedAt: new Date() },
        },
      },
    });

    if (dataRoom.type === 'CIRP') {
      await this.foldersService.seedCirpTemplate(dataRoom.id, actor.id);
    }

    await this.auditLogService.record({
      action: 'DATA_ROOM_CREATED',
      dataRoomId: dataRoom.id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: dataRoom.id,
    });

    return dataRoom;
  }

  async findAll(actor: AuthenticatedUser) {
    const where: Prisma.DataRoomWhereInput = {
      organisationId: actor.organisationId,
      deletedAt: null,
      ...(ADMIN_ROLES.includes(actor.role) ? {} : { members: { some: { userId: actor.id, removedAt: null } } }),
    };

    return this.prisma.dataRoom.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id, organisationId: actor.organisationId, deletedAt: null },
    });

    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }

    await this.assertMember(dataRoom.id, actor);

    return dataRoom;
  }

  async update(id: string, dto: UpdateDataRoomDto, actor: AuthenticatedUser) {
    await this.assertManager(id, actor);

    const dataRoom = await this.prisma.dataRoom.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        caseNumber: dto.caseNumber,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.auditLogService.record({
      action: 'DATA_ROOM_UPDATED',
      dataRoomId: id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: id,
    });

    return dataRoom;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.assertManager(id, actor);

    await this.prisma.dataRoom.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditLogService.record({
      action: 'DATA_ROOM_DELETED',
      dataRoomId: id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: id,
    });
  }

  async setArchived(id: string, archived: boolean, actor: AuthenticatedUser) {
    await this.assertManager(id, actor);

    const dataRoom = await this.prisma.dataRoom.update({
      where: { id },
      data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
    });

    await this.auditLogService.record({
      action: 'DATA_ROOM_UPDATED',
      dataRoomId: id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: id,
      metadata: { status: dataRoom.status },
    });

    return dataRoom;
  }

  async listMembers(dataRoomId: string, actor: AuthenticatedUser) {
    await this.findOne(dataRoomId, actor);

    return this.prisma.dataRoomMember.findMany({
      where: { dataRoomId, removedAt: null },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true } } },
      orderBy: { invitedAt: 'asc' },
    });
  }

  async inviteMember(dataRoomId: string, dto: InviteMemberDto, actor: AuthenticatedUser) {
    const dataRoom = await this.assertManager(dataRoomId, actor);

    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user && user.organisationId !== actor.organisationId) {
      throw new ConflictException('This email is already registered to a different organisation');
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          organisationId: actor.organisationId,
          email: dto.email,
          password: generateOpaqueToken().hash, // unusable placeholder until invite is accepted
          firstName: dto.email.split('@')[0],
          lastName: '',
          role: dto.role,
          status: 'PENDING_INVITE',
        },
      });

      const { raw, hash } = generateOpaqueToken();
      const inviteHours = this.configService.get<number>('jwt.inviteExpiresHours')!;

      await this.prisma.inviteToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          invitedBy: actor.id,
          expiresAt: new Date(Date.now() + inviteHours * 60 * 60_000),
        },
      });

      const frontendUrl = this.configService.get<string>('app.frontendUrl');
      await this.mailService.sendInviteEmail(
        user.email,
        `${frontendUrl}/accept-invite?token=${raw}`,
        dataRoom.name,
        `${actor.firstName} ${actor.lastName}`,
      );
    }

    const member = await this.prisma.dataRoomMember.upsert({
      where: { dataRoomId_userId: { dataRoomId, userId: user.id } },
      update: { removedAt: null, roleOverride: dto.role },
      create: {
        dataRoomId,
        userId: user.id,
        invitedBy: actor.id,
        roleOverride: dto.role,
      },
    });

    await this.auditLogService.record({
      action: 'USER_INVITED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'User',
      resourceId: user.id,
      metadata: { invitedEmail: user.email, role: dto.role },
    });

    return member;
  }

  async updateMemberRole(dataRoomId: string, userId: string, role: UserRole, actor: AuthenticatedUser) {
    await this.assertManager(dataRoomId, actor);

    const member = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId } },
    });

    if (!member || member.removedAt) {
      throw new NotFoundException('Member not found in this data room');
    }

    const updated = await this.prisma.dataRoomMember.update({
      where: { dataRoomId_userId: { dataRoomId, userId } },
      data: { roleOverride: role },
    });

    await this.auditLogService.record({
      action: 'USER_ROLE_CHANGED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'User',
      resourceId: userId,
      metadata: { newRole: role },
    });

    return updated;
  }

  async removeMember(dataRoomId: string, userId: string, actor: AuthenticatedUser) {
    await this.assertManager(dataRoomId, actor);

    if (userId === actor.id) {
      throw new BadRequestException('You cannot remove yourself from a data room');
    }

    const member = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId } },
    });

    if (!member || member.removedAt) {
      throw new NotFoundException('Member not found in this data room');
    }

    await this.prisma.dataRoomMember.update({
      where: { dataRoomId_userId: { dataRoomId, userId } },
      data: { removedAt: new Date() },
    });

    await this.auditLogService.record({
      action: 'USER_REMOVED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'User',
      resourceId: userId,
    });
  }

  async resetMemberPassword(dataRoomId: string, userId: string, actor: AuthenticatedUser) {
    await this.assertManager(dataRoomId, actor);

    const member = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId } },
      include: { user: true },
    });

    if (!member || member.removedAt) {
      throw new NotFoundException('Member not found in this data room');
    }

    await this.authService.forgotPassword(member.user.email);
  }

  private async assertMember(dataRoomId: string, actor: AuthenticatedUser): Promise<void> {
    if (ADMIN_ROLES.includes(actor.role)) {
      return;
    }

    const membership = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId: actor.id } },
    });

    if (!membership || membership.removedAt) {
      throw new ForbiddenException('You do not have access to this data room');
    }
  }

  private async assertManager(dataRoomId: string, actor: AuthenticatedUser) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id: dataRoomId, organisationId: actor.organisationId, deletedAt: null },
    });

    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }

    if (!ADMIN_ROLES.includes(actor.role)) {
      throw new ForbiddenException('You do not have permission to manage this data room');
    }

    return dataRoom;
  }
}
