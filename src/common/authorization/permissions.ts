import { Role } from '@prisma/client';

export interface PermissionDefinition {
  roles: readonly Role[];
}

const ALL_ROLES: readonly Role[] = [
  Role.SYSTEM_ADMIN,
  Role.AUDITOR,
  Role.COORDINATOR,
  Role.SECRETARY,
  Role.SUPERVISOR,
  Role.STUDENT,
];

export const PERMISSION_CATALOG = {
  'auth:me': { roles: ALL_ROLES },
  'campus:read': { roles: ALL_ROLES },
  'school:read': { roles: ALL_ROLES },
  'academic-period:read': { roles: [Role.COORDINATOR, Role.SYSTEM_ADMIN] },
  'academic-period:write': { roles: [Role.COORDINATOR, Role.SYSTEM_ADMIN] },
  'user:read': { roles: [Role.SYSTEM_ADMIN] },
  'user:create': { roles: [Role.SYSTEM_ADMIN] },
  'user:activate': { roles: [Role.SYSTEM_ADMIN] },
  'user:assign-role': { roles: [Role.SYSTEM_ADMIN] },
  'audit:read': { roles: [Role.SYSTEM_ADMIN, Role.AUDITOR, Role.COORDINATOR] },
  'practice:read': { roles: [Role.COORDINATOR, Role.SUPERVISOR, Role.AUDITOR, Role.STUDENT] },
  'practice:authorize': { roles: [Role.COORDINATOR] },
  'practice:write': { roles: [Role.COORDINATOR] },
  'hours:validate': { roles: [Role.COORDINATOR] },
  'hours:write': { roles: [Role.STUDENT] },
  'document:review': { roles: [Role.COORDINATOR] },
  'letter:create': { roles: [Role.STUDENT] },
  'letter:read': { roles: [Role.STUDENT, Role.SECRETARY, Role.COORDINATOR, Role.AUDITOR] },
  'letter:write': { roles: [Role.STUDENT] },
  'letter:preview': { roles: [Role.STUDENT, Role.SECRETARY] },
  'letter:review': { roles: [Role.SECRETARY] },
  'letter:download': { roles: [Role.STUDENT, Role.SECRETARY, Role.COORDINATOR, Role.AUDITOR] },
  'supervision:complete': { roles: [Role.SUPERVISOR] },
} as const satisfies Record<string, PermissionDefinition>;

export type Permission = keyof typeof PERMISSION_CATALOG;
