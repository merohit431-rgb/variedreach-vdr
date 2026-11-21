import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { DATA_ROOM_MANAGER_ROLES } from '../../common/constants/content-roles';

// A folder is reachable if folderId is null (the Data Room root -- files and
// folders with no parent are not subject to folder-ACL at all; this feature
// restricts access to FOLDERS and their contents, and the room root has no
// grantable identity of its own) OR the nearest-grant-boundary walk resolves
// to "yes" for this user. See FolderAccessGrant's own schema comment for the
// exact algorithm and why it is NOT "nearest ancestor where this user has a
// grant".
export interface FolderAccessResolver {
  readonly unrestricted: boolean;
  canReach(folderId: string | null): boolean;
  reachableFolderIds(): ReadonlySet<string>;
}

const UNRESTRICTED_RESOLVER: FolderAccessResolver = {
  unrestricted: true,
  canReach: () => true,
  reachableFolderIds: () => {
    throw new Error(
      'reachableFolderIds() is not meaningful on an unrestricted resolver -- callers must check .unrestricted first and skip filtering entirely rather than materialising "everything"',
    );
  },
};

@Injectable()
export class FolderAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // Builds a reusable, in-memory resolver for one (dataRoom, actor) pair --
  // one small set of queries, then O(depth) in-memory walks for every
  // subsequent canReach() call in the same request. effectiveRole is the
  // caller's already-resolved room-scoped role (from DataRoomAccessService),
  // not actor.role directly, so a roleOverride is honored the same way it is
  // everywhere else.
  async buildResolver(
    dataRoomId: string,
    actor: AuthenticatedUser,
    effectiveRole: UserRole,
  ): Promise<FolderAccessResolver> {
    const dataRoom = await this.prisma.dataRoom.findUnique({
      where: { id: dataRoomId },
      select: { folderAccessRestricted: true },
    });

    // Manager-tier roles bypass folder-ACL entirely -- the same
    // DATA_ROOM_MANAGER_ROLES set NDA already bypasses for the same reason:
    // they are the room's own internal administrators, not external
    // reviewers the restriction exists to scope down, and they are the ones
    // who grant/revoke everyone else's folder access in the first place.
    if (!dataRoom?.folderAccessRestricted || DATA_ROOM_MANAGER_ROLES.includes(effectiveRole)) {
      return UNRESTRICTED_RESOLVER;
    }

    const [folders, grants, myGroupMemberships] = await Promise.all([
      this.prisma.folder.findMany({
        where: { dataRoomId, deletedAt: null },
        select: { id: true, parentId: true },
      }),
      this.prisma.folderAccessGrant.findMany({
        where: { folder: { dataRoomId }, revokedAt: null },
        select: { folderId: true, userId: true, groupId: true },
      }),
      // Active membership in an active group, scoped to the actor's own org
      // (a group can only ever belong to one org, so this also guarantees a
      // group grant can never reach across organisations). Re-queried fresh
      // on every resolver build -- a removed membership or a deactivated
      // group is reflected on the very next request, nothing cached.
      this.prisma.groupMember.findMany({
        where: { userId: actor.id, removedAt: null, group: { organisationId: actor.organisationId, isActive: true } },
        select: { groupId: true },
      }),
    ]);

    const myGroupIds = new Set(myGroupMemberships.map((m) => m.groupId));
    const parentOf = new Map(folders.map((f) => [f.id, f.parentId]));
    // A folder is a "boundary" the moment ANY live grant exists on it --
    // user-type or group-type, regardless of whether the CURRENT actor is
    // covered by it. This is unchanged from the user-only version; only the
    // input sets below grew to also recognise group-type rows.
    const boundaryFolderIds = new Set(grants.map((g) => g.folderId));
    const myGrantedFolderIds = new Set(
      grants
        .filter((g) => g.userId === actor.id || (g.groupId !== null && myGroupIds.has(g.groupId)))
        .map((g) => g.folderId),
    );
    const cache = new Map<string, boolean>();

    const resolveOne = (folderId: string): boolean => {
      const cached = cache.get(folderId);
      if (cached !== undefined) return cached;

      let result: boolean;
      if (boundaryFolderIds.has(folderId)) {
        // This folder has its own explicit grant list -- authoritative for
        // this folder regardless of what any ancestor grants. Absence from
        // this list IS the restriction; the walk does not continue upward.
        result = myGrantedFolderIds.has(folderId);
      } else {
        // No grant boundary on this folder itself: inherit from the parent,
        // if any. A top-level folder (parentId: null) with no boundary of
        // its own has nothing left to inherit from -- default-deny.
        const parentId = parentOf.get(folderId);
        result = parentId != null && resolveOne(parentId);
      }

      cache.set(folderId, result);
      return result;
    };

    const canReach = (folderId: string | null): boolean => {
      if (folderId === null) return true;
      if (!parentOf.has(folderId)) return false; // not a folder in this room at all
      return resolveOne(folderId);
    };

    return {
      unrestricted: false,
      canReach,
      reachableFolderIds: () => {
        const reachable = new Set<string>();
        for (const id of parentOf.keys()) {
          if (resolveOne(id)) reachable.add(id);
        }
        return reachable;
      },
    };
  }

  // For a direct, single-target operation (open this folder, download this
  // file) -- NotFoundException with the exact same message getFolderOrThrow/
  // getFileOrThrow already use for a truly nonexistent id, so an unreachable
  // folder/file is byte-for-byte indistinguishable from one that was never
  // real. Also audits the denial (best-effort: a failure to write it never
  // masks the real 404, same pattern as the Download Original remediation).
  async assertReachable(
    resolver: FolderAccessResolver,
    folderId: string | null,
    notFoundMessage: string,
    ctx: {
      dataRoomId: string;
      actor: AuthenticatedUser;
      resourceType: 'Folder' | 'File' | 'Question';
      resourceId: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    if (resolver.unrestricted || resolver.canReach(folderId)) return;

    await this.auditLogService
      .record({
        action: 'FOLDER_ACCESS_DENIED',
        dataRoomId: ctx.dataRoomId,
        userId: ctx.actor.id,
        resourceType: ctx.resourceType,
        resourceId: ctx.resourceId,
        metadata: { folderId },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      })
      .catch(() => undefined);

    throw new NotFoundException(notFoundMessage);
  }
}
