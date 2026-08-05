import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Role, RoleAssignmentState, UserState } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRoleDto, CreateUserDto } from './dto/identity.dto';

export interface UserAdminView {
  id: string;
  state: UserState;
  email: string;
  fullName: string;
  roles: { assignmentId: string; role: Role; campusId: string | null; schoolId: string | null }[];
  studentProfile: {
    code: string;
    dni: string;
    cycle: string | null;
    campusId: string;
    schoolId: string;
    complete: boolean;
  } | null;
}

const CAMPUS_SCOPED_ROLES: readonly Role[] = [Role.COORDINATOR, Role.SECRETARY, Role.SUPERVISOR];

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listUsers(): Promise<UserAdminView[]> {
    const users = await this.prisma.user.findMany({
      include: {
        institutionalIdentity: true,
        userProfile: true,
        studentProfile: true,
        roleAssignments: { where: { state: RoleAssignmentState.ACTIVE } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => this.toView(user));
  }

  async getUser(userId: string): Promise<UserAdminView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        institutionalIdentity: true,
        userProfile: true,
        studentProfile: true,
        roleAssignments: { where: { state: RoleAssignmentState.ACTIVE } },
      },
    });
    if (user === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Usuario no encontrado');
    }
    return this.toView(user);
  }

  async createUser(actor: AuthUser, dto: CreateUserDto): Promise<UserAdminView> {
    const email = dto.email.toLowerCase().trim();
    const upeu = await this.prisma.institution.findUnique({ where: { code: 'UPEU' } });
    if (upeu === null) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'La institución no está configurada',
      );
    }

    const userId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { state: UserState.ACTIVE } });
      await tx.institutionalIdentity.create({
        data: { userId: created.id, institutionId: upeu.id, institutionalEmail: email },
      });
      await tx.userProfile.create({ data: { userId: created.id, fullName: dto.fullName } });

      if (dto.studentProfile !== undefined) {
        await this.assertCampusSchoolActive(
          tx,
          dto.studentProfile.campusId,
          dto.studentProfile.schoolId,
        );
        await tx.studentProfile.create({
          data: {
            userId: created.id,
            code: dto.studentProfile.code,
            dni: dto.studentProfile.dni,
            cycle: dto.studentProfile.cycle ?? null,
            campusId: dto.studentProfile.campusId,
            schoolId: dto.studentProfile.schoolId,
            complete: true,
          },
        });
      }

      for (const roleDto of dto.roles ?? []) {
        await this.assertRoleAssignmentValid(tx, created.id, roleDto);
        await tx.roleAssignment.create({
          data: {
            userId: created.id,
            role: roleDto.role,
            campusId: roleDto.campusId ?? null,
            schoolId: roleDto.schoolId ?? null,
            assignedById: actor.id,
          },
        });
      }

      await this.audit.recordAudit(
        {
          actorId: actor.id,
          actorRole: actor.roles[0]?.role,
          action: 'USER_CREATED',
          entity: 'User',
          entityId: created.id,
          result: 'SUCCESS',
          detail: { email },
        },
        tx,
      );
      return created.id;
    });

    return this.getUser(userId);
  }

  async assignRole(actor: AuthUser, userId: string, dto: AssignRoleDto): Promise<UserAdminView> {
    await this.prisma.$transaction(async (tx) => {
      await this.assertRoleAssignmentValid(tx, userId, dto);
      const assignment = await tx.roleAssignment.create({
        data: {
          userId,
          role: dto.role,
          campusId: dto.campusId ?? null,
          schoolId: dto.schoolId ?? null,
          assignedById: actor.id,
        },
      });
      await this.audit.recordAudit(
        {
          actorId: actor.id,
          actorRole: actor.roles[0]?.role,
          action: 'ROLE_ASSIGNED',
          entity: 'RoleAssignment',
          entityId: assignment.id,
          result: 'SUCCESS',
          detail: {
            userId,
            role: dto.role,
            campusId: dto.campusId ?? null,
            schoolId: dto.schoolId ?? null,
          },
        },
        tx,
      );
    });
    return this.getUser(userId);
  }

  async deactivateRoleAssignment(actor: AuthUser, assignmentId: string): Promise<UserAdminView> {
    const assignment = await this.prisma.roleAssignment.findUnique({ where: { id: assignmentId } });
    if (assignment === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Asignación de rol no encontrada');
    }
    if (assignment.state === RoleAssignmentState.INACTIVE) {
      throw new BusinessException(HttpStatus.CONFLICT, 'La asignación de rol ya está inactiva');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.roleAssignment.update({
        where: { id: assignmentId },
        data: { state: RoleAssignmentState.INACTIVE },
      });
      await this.audit.recordAudit(
        {
          actorId: actor.id,
          actorRole: actor.roles[0]?.role,
          action: 'ROLE_DEACTIVATED',
          entity: 'RoleAssignment',
          entityId: assignmentId,
          result: 'SUCCESS',
          detail: { userId: assignment.userId, role: assignment.role },
        },
        tx,
      );
    });
    return this.getUser(assignment.userId);
  }

  async setUserState(actor: AuthUser, userId: string, state: UserState): Promise<UserAdminView> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Usuario no encontrado');
    }
    if (user.state === state) {
      throw new BusinessException(HttpStatus.CONFLICT, `El usuario ya está en estado ${state}`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { state } });
      await this.audit.recordAudit(
        {
          actorId: actor.id,
          actorRole: actor.roles[0]?.role,
          action: state === UserState.ACTIVE ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          entity: 'User',
          entityId: userId,
          result: 'SUCCESS',
          detail: { previousState: user.state },
        },
        tx,
      );
    });
    return this.getUser(userId);
  }

  private async assertRoleAssignmentValid(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: AssignRoleDto,
  ): Promise<void> {
    if (CAMPUS_SCOPED_ROLES.includes(dto.role)) {
      if (dto.campusId === undefined || dto.schoolId === undefined) {
        throw new BusinessException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          `El rol ${dto.role} requiere ámbito campus-escuela`,
        );
      }
      await this.assertCampusSchoolActive(tx, dto.campusId, dto.schoolId);
    } else if (dto.campusId !== undefined || dto.schoolId !== undefined) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        `El rol ${dto.role} no admite ámbito campus-escuela`,
      );
    }

    if (dto.role === Role.STUDENT) {
      const profile = await tx.studentProfile.findUnique({ where: { userId } });
      if (profile === null) {
        throw new BusinessException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'El usuario requiere un perfil de estudiante para este rol',
        );
      }
    }

    const duplicate = await tx.roleAssignment.findFirst({
      where: {
        userId,
        role: dto.role,
        campusId: dto.campusId ?? null,
        schoolId: dto.schoolId ?? null,
        state: RoleAssignmentState.ACTIVE,
      },
    });
    if (duplicate !== null) {
      throw new BusinessException(
        HttpStatus.CONFLICT,
        'La asignación de rol ya existe para este usuario',
      );
    }
  }

  private async assertCampusSchoolActive(
    tx: Prisma.TransactionClient,
    campusId: string,
    schoolId: string,
  ): Promise<void> {
    const campusSchool = await tx.campusSchool.findUnique({
      where: { campusId_schoolId: { campusId, schoolId } },
    });
    if (!campusSchool?.active) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'La escuela no está activa en ese campus',
      );
    }
  }

  private toView(user: {
    id: string;
    state: UserState;
    institutionalIdentity: { institutionalEmail: string } | null;
    userProfile: { fullName: string } | null;
    studentProfile: {
      code: string;
      dni: string;
      cycle: string | null;
      campusId: string;
      schoolId: string;
      complete: boolean;
    } | null;
    roleAssignments: {
      id: string;
      role: Role;
      campusId: string | null;
      schoolId: string | null;
    }[];
  }): UserAdminView {
    return {
      id: user.id,
      state: user.state,
      email: user.institutionalIdentity?.institutionalEmail ?? '',
      fullName: user.userProfile?.fullName ?? '',
      roles: user.roleAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        role: assignment.role,
        campusId: assignment.campusId,
        schoolId: assignment.schoolId,
      })),
      studentProfile:
        user.studentProfile === null
          ? null
          : {
              code: user.studentProfile.code,
              dni: user.studentProfile.dni,
              cycle: user.studentProfile.cycle,
              campusId: user.studentProfile.campusId,
              schoolId: user.studentProfile.schoolId,
              complete: user.studentProfile.complete,
            },
    };
  }
}
