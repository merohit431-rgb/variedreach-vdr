import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { AuthenticatedUser, JwtPayload } from '../types/jwt-payload.interface';
import { isSubscriptionLapsed } from '../../../common/utils/subscription.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret')!,
    });
  }

  // Re-checked against the DB on every request (not just trusting the JWT
  // claims) so a suspend/role-change/delete takes effect on the very next
  // request, per the PRD's "immediate session termination" requirement.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      // Phase 3B.2: only audited when the user row actually exists and is
      // specifically non-ACTIVE (not for a deleted/never-existed user,
      // which this same branch also rejects but isn't "suspension") -- a
      // genuinely existing suspended account's already-issued token being
      // rejected is the event Step 7 asks to capture.
      if (user && !user.deletedAt) {
        await this.auditLogService
          .record({ action: 'LOGIN_DENIED_SUSPENDED', userId: user.id, metadata: { stage: 'session_validation', level: 'user' } })
          .catch(() => undefined);
      }
      throw new UnauthorizedException('Session is no longer valid');
    }

    // SUPER_ADMIN is org-agnostic -- no membership needed, and nothing in
    // super-admin.service.ts scopes a query by their organisationId.
    if (user.role === 'SUPER_ADMIN') {
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    }

    // Role/org for the ACTIVE membership (the org this session/token was
    // scoped to at login or the last workspace switch), not the legacy
    // User columns -- this is what lets one identity hold a different role
    // in each organisation it belongs to. Suspending/removing a membership
    // takes effect on the very next request, same guarantee as before.
    const membership = await this.prisma.organisationMembership.findUnique({
      where: { userId_organisationId: { userId: user.id, organisationId: payload.organisationId } },
      include: { organisation: { include: { subscription: true } } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      await this.auditLogService
        .record({ action: 'LOGIN_DENIED_SUSPENDED', userId: user.id, organisationId: payload.organisationId, metadata: { stage: 'session_validation', level: 'membership' } })
        .catch(() => undefined);
      throw new UnauthorizedException('Session is no longer valid');
    }

    // Org-level Super Admin deactivation/archive -- same immediate-effect
    // guarantee as a membership suspend, but blocks every member of the org
    // at once rather than needing each one suspended individually.
    if (!membership.organisation || membership.organisation.deletedAt || membership.organisation.status !== 'ACTIVE') {
      throw new UnauthorizedException('This organisation is not currently active');
    }

    // A lapsed subscription is a separate path to the same effective
    // lockout as org.status = SUSPENDED -- see isSubscriptionLapsed's own
    // comment for why an org with no subscription row is never blocked here.
    if (isSubscriptionLapsed(membership.organisation.subscription)) {
      throw new UnauthorizedException('This organisation\'s subscription is not active');
    }

    return {
      id: user.id,
      email: user.email,
      role: membership.role,
      organisationId: membership.organisationId,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
