import { HttpStatus, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BusinessException } from '../exceptions/business.exception';
import { ActiveRoleAssignment, AuthUser } from './auth-user';
import { Permission, PermissionDefinition, PERMISSION_CATALOG } from './permissions';

export interface ScopedResource {
  campusId?: string | null;
  schoolId?: string | null;
  ownerId?: string | null;
  supervisorId?: string | null;
  assignmentActive?: boolean;
}

@Injectable()
export class ScopePolicyService {
  hasPermission(user: AuthUser, permission: Permission): boolean {
    const definition: PermissionDefinition = PERMISSION_CATALOG[permission];
    return definition !== undefined && user.roles.some((a) => definition.roles.includes(a.role));
  }

  assertPermission(user: AuthUser, permission: Permission): void {
    if (!this.hasPermission(user, permission)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, `Permiso requerido: ${permission}`, {
        error: 'Forbidden',
      });
    }
  }

  canAccessResource(user: AuthUser, permission: Permission, resource: ScopedResource): boolean {
    const definition: PermissionDefinition = PERMISSION_CATALOG[permission];
    if (definition === undefined) {
      return false;
    }
    const matching = user.roles.filter((assignment) => definition.roles.includes(assignment.role));
    return matching.some((assignment) => this.canAccessWithAssignment(user, assignment, resource));
  }

  assertResourceAccess(user: AuthUser, permission: Permission, resource: ScopedResource): void {
    if (!this.canAccessResource(user, permission, resource)) {
      throw new BusinessException(
        HttpStatus.FORBIDDEN,
        'El recurso está fuera de tu ámbito de acceso',
        { error: 'Forbidden', details: { requiredPermission: permission } },
      );
    }
  }

  private canAccessWithAssignment(
    user: AuthUser,
    assignment: ActiveRoleAssignment,
    resource: ScopedResource,
  ): boolean {
    switch (assignment.role) {
      case Role.STUDENT:
        return (
          resource.ownerId !== undefined &&
          resource.ownerId !== null &&
          resource.ownerId === user.id
        );
      case Role.COORDINATOR:
      case Role.SECRETARY:
        if (assignment.campusId === null || resource.campusId !== assignment.campusId) {
          return false;
        }
        if (
          assignment.schoolId !== null &&
          resource.schoolId !== undefined &&
          resource.schoolId !== null &&
          resource.schoolId !== assignment.schoolId
        ) {
          return false;
        }
        return true;
      case Role.SUPERVISOR:
        return resource.supervisorId === user.id && resource.assignmentActive !== false;
      case Role.AUDITOR:
      case Role.SYSTEM_ADMIN:
        return true;
    }
  }
}
