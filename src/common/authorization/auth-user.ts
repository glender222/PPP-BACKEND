import type { Request } from 'express';
import { Role, UserState } from '@prisma/client';

export interface ActiveRoleAssignment {
  assignmentId: string;
  role: Role;
  campusId: string | null;
  schoolId: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  state: UserState;
  roles: ActiveRoleAssignment[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
