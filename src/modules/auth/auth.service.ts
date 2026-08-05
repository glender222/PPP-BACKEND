import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleAssignmentState, UserState } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import type { MeResponse } from './auth.controller';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async verifyToken(token: string): Promise<AuthUser> {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return this.loadAuthUser(payload.sub);
  }

  async loadAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        institutionalIdentity: true,
        userProfile: true,
        roleAssignments: { where: { state: RoleAssignmentState.ACTIVE } },
      },
    });
    if (user === null) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (user.state !== UserState.ACTIVE) {
      throw new ForbiddenException('Usuario inactivo');
    }
    return {
      id: user.id,
      email: user.institutionalIdentity?.institutionalEmail ?? '',
      fullName: user.userProfile?.fullName ?? null,
      state: user.state,
      roles: user.roleAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        role: assignment.role,
        campusId: assignment.campusId,
        schoolId: assignment.schoolId,
      })),
    };
  }

  async me(user: AuthUser): Promise<MeResponse> {
    const [userProfile, studentProfile] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId: user.id } }),
      this.prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    ]);
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        state: user.state,
      },
      roles: user.roles,
      userProfile:
        userProfile === null
          ? null
          : {
              fullName: userProfile.fullName,
              displayName: userProfile.displayName,
              campusId: userProfile.campusId,
            },
      studentProfile:
        studentProfile === null
          ? null
          : {
              code: studentProfile.code,
              dni: studentProfile.dni,
              cycle: studentProfile.cycle,
              campusId: studentProfile.campusId,
              schoolId: studentProfile.schoolId,
              complete: studentProfile.complete,
            },
    };
  }
}
