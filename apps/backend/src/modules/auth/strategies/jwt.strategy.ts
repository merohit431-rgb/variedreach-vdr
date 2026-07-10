import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session is no longer valid');
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
