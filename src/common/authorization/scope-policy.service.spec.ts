import { Role, UserState } from '@prisma/client';
import { BusinessException } from '../exceptions/business.exception';
import { AuthUser } from './auth-user';
import { Permission } from './permissions';
import { ScopePolicyService, ScopedResource } from './scope-policy.service';

const policy = new ScopePolicyService();

function actor(
  role: Role,
  campusId: string | null = null,
  schoolId: string | null = null,
): AuthUser {
  return {
    id: 'actor-1',
    email: 'actor@upeu.edu.pe',
    fullName: 'Actor de prueba',
    state: UserState.ACTIVE,
    roles: [{ assignmentId: 'ra-1', role, campusId, schoolId }],
  };
}

const JULIACA = 'campus-juliaca';
const LIMA = 'campus-lima';
const SISTEMAS = 'school-sistemas';

const WRITE_PERMISSIONS: readonly Permission[] = [
  'practice:authorize',
  'practice:write',
  'hours:validate',
  'document:review',
  'letter:review',
  'supervision:complete',
  'academic-period:write',
  'user:create',
  'user:activate',
  'user:assign-role',
];

const BUSINESS_APPROVAL_PERMISSIONS: readonly Permission[] = [
  'practice:authorize',
  'practice:write',
  'hours:validate',
  'document:review',
  'letter:review',
  'supervision:complete',
];

describe('ScopePolicyService — escenarios obligatorios de la matriz', () => {
  it('Estudiante no consulta otro estudiante', () => {
    const student = actor(Role.STUDENT);
    const otherPractice: ScopedResource = { campusId: JULIACA, ownerId: 'student-juliaca-2' };

    expect(policy.canAccessResource(student, 'practice:read', otherPractice)).toBe(false);
    expect(() => policy.assertResourceAccess(student, 'practice:read', otherPractice)).toThrow(
      BusinessException,
    );
  });

  it('Estudiante accede solo a sus propios recursos', () => {
    const student = actor(Role.STUDENT);
    expect(
      policy.canAccessResource(student, 'practice:read', { campusId: JULIACA, ownerId: 'actor-1' }),
    ).toBe(true);
  });

  it('Secretaría no consulta otro campus', () => {
    const secretary = actor(Role.SECRETARY, JULIACA, SISTEMAS);

    expect(
      policy.canAccessResource(secretary, 'letter:review', { campusId: LIMA, schoolId: SISTEMAS }),
    ).toBe(false);
    expect(() =>
      policy.assertResourceAccess(secretary, 'letter:review', {
        campusId: LIMA,
        schoolId: SISTEMAS,
      }),
    ).toThrow(BusinessException);
    expect(
      policy.canAccessResource(secretary, 'letter:review', {
        campusId: JULIACA,
        schoolId: SISTEMAS,
      }),
    ).toBe(true);
  });

  it('Secretaría no opera sobre otra escuela de su campus', () => {
    const secretary = actor(Role.SECRETARY, JULIACA, SISTEMAS);
    expect(
      policy.canAccessResource(secretary, 'letter:review', {
        campusId: JULIACA,
        schoolId: 'school-civil',
      }),
    ).toBe(false);
  });

  it('Coordinador no modifica otro campus', () => {
    const coordinator = actor(Role.COORDINATOR, LIMA, SISTEMAS);

    expect(
      policy.canAccessResource(coordinator, 'academic-period:write', { campusId: JULIACA }),
    ).toBe(false);
    expect(() =>
      policy.assertResourceAccess(coordinator, 'academic-period:write', { campusId: JULIACA }),
    ).toThrow(BusinessException);
    expect(policy.canAccessResource(coordinator, 'academic-period:write', { campusId: LIMA })).toBe(
      true,
    );
  });

  it('Supervisor no consulta prácticas no asignadas', () => {
    const supervisor = actor(Role.SUPERVISOR, JULIACA, SISTEMAS);
    const unassignedPractice: ScopedResource = {
      campusId: JULIACA,
      supervisorId: 'supervisor-otro',
      assignmentActive: true,
    };

    expect(policy.canAccessResource(supervisor, 'supervision:complete', unassignedPractice)).toBe(
      false,
    );
    expect(() =>
      policy.assertResourceAccess(supervisor, 'supervision:complete', unassignedPractice),
    ).toThrow(BusinessException);
  });

  it('Supervisor accede solo a prácticas asignadas y con asignación vigente', () => {
    const supervisor = actor(Role.SUPERVISOR, JULIACA, SISTEMAS);

    expect(
      policy.canAccessResource(supervisor, 'supervision:complete', {
        campusId: JULIACA,
        supervisorId: 'actor-1',
        assignmentActive: true,
      }),
    ).toBe(true);
    expect(
      policy.canAccessResource(supervisor, 'supervision:complete', {
        campusId: JULIACA,
        supervisorId: 'actor-1',
        assignmentActive: false,
      }),
    ).toBe(false);
  });

  it('Auditor no ejecuta ninguna mutación', () => {
    const auditor = actor(Role.AUDITOR);
    for (const permission of WRITE_PERMISSIONS) {
      expect(policy.hasPermission(auditor, permission)).toBe(false);
    }
    expect(() => policy.assertPermission(auditor, 'practice:authorize')).toThrow(BusinessException);
  });

  it('Auditor lee en los tres campus', () => {
    const auditor = actor(Role.AUDITOR);
    expect(policy.canAccessResource(auditor, 'practice:read', { campusId: JULIACA })).toBe(true);
    expect(policy.canAccessResource(auditor, 'practice:read', { campusId: LIMA })).toBe(true);
  });

  it('SYSTEM_ADMIN no aprueba trámites por ser administrador', () => {
    const admin = actor(Role.SYSTEM_ADMIN);
    for (const permission of BUSINESS_APPROVAL_PERMISSIONS) {
      expect(policy.hasPermission(admin, permission)).toBe(false);
    }
    expect(() => policy.assertPermission(admin, 'letter:review')).toThrow(BusinessException);
  });

  it('SYSTEM_ADMIN administra estructura, usuarios y periodos (ámbito institucional)', () => {
    const admin = actor(Role.SYSTEM_ADMIN);
    expect(policy.hasPermission(admin, 'user:create')).toBe(true);
    expect(policy.hasPermission(admin, 'user:assign-role')).toBe(true);
    expect(policy.hasPermission(admin, 'academic-period:write')).toBe(true);
    expect(policy.canAccessResource(admin, 'academic-period:write', { campusId: JULIACA })).toBe(
      true,
    );
    expect(policy.canAccessResource(admin, 'academic-period:write', { campusId: LIMA })).toBe(true);
  });

  it('Coordinador autoriza prácticas solo en su campus', () => {
    const coordinator = actor(Role.COORDINATOR, JULIACA, SISTEMAS);
    expect(policy.hasPermission(coordinator, 'practice:authorize')).toBe(true);
    expect(
      policy.canAccessResource(coordinator, 'practice:authorize', {
        campusId: JULIACA,
        schoolId: SISTEMAS,
      }),
    ).toBe(true);
    expect(
      policy.canAccessResource(coordinator, 'practice:authorize', {
        campusId: LIMA,
        schoolId: SISTEMAS,
      }),
    ).toBe(false);
  });

  it('No concede permisos que el catálogo no define', () => {
    const student = actor(Role.STUDENT);
    expect(policy.hasPermission(student, 'letter:review')).toBe(false);
    expect(policy.hasPermission(student, 'user:read')).toBe(false);
  });
});
