import {
  PrismaClient,
  Role,
  RoleAssignmentState,
  AcademicPeriodState,
  SchoolState,
  RequirementEvidenceKind,
  RequirementStage,
} from '@prisma/client';

const prisma = new PrismaClient();

interface SeedRole {
  role: Role;
  campusCode?: string;
  schoolCode?: string;
}

interface SeedUser {
  email: string;
  fullName: string;
  roles: SeedRole[];
  student?: { code: string; dni: string; cycle: string; campusCode: string; schoolCode: string };
}

const CAMPUSES: { code: string; name: string }[] = [
  { code: 'JULIACA', name: 'Juliaca' },
  { code: 'LIMA', name: 'Lima (Ñaña)' },
  { code: 'TARAPOTO', name: 'Tarapoto' },
];

const SCHOOLS: { code: string; name: string; state: SchoolState }[] = [
  { code: 'ING-SISTEMAS', name: 'Ingeniería de Sistemas', state: SchoolState.ACTIVE },
  { code: 'ING-CIVIL', name: 'Ingeniería Civil', state: SchoolState.INACTIVE },
];

const SEED_USERS: SeedUser[] = [
  {
    email: 'system.admin@upeu.edu.pe',
    fullName: 'Administrador del Sistema',
    roles: [{ role: Role.SYSTEM_ADMIN }],
  },
  {
    email: 'auditor@upeu.edu.pe',
    fullName: 'Auditor Institucional',
    roles: [{ role: Role.AUDITOR }],
  },
  {
    email: 'coordinator.juliaca@upeu.edu.pe',
    fullName: 'Coordinadora Juliaca',
    roles: [{ role: Role.COORDINATOR, campusCode: 'JULIACA', schoolCode: 'ING-SISTEMAS' }],
  },
  {
    email: 'coordinator.lima@upeu.edu.pe',
    fullName: 'Coordinador Lima',
    roles: [{ role: Role.COORDINATOR, campusCode: 'LIMA', schoolCode: 'ING-SISTEMAS' }],
  },
  {
    email: 'coordinator.tarapoto@upeu.edu.pe',
    fullName: 'Coordinadora Tarapoto',
    roles: [{ role: Role.COORDINATOR, campusCode: 'TARAPOTO', schoolCode: 'ING-SISTEMAS' }],
  },
  {
    email: 'secretary.juliaca@upeu.edu.pe',
    fullName: 'Secretaria Juliaca',
    roles: [{ role: Role.SECRETARY, campusCode: 'JULIACA', schoolCode: 'ING-SISTEMAS' }],
  },
  {
    email: 'supervisor.juliaca@upeu.edu.pe',
    fullName: 'Supervisor Juliaca',
    roles: [{ role: Role.SUPERVISOR, campusCode: 'JULIACA', schoolCode: 'ING-SISTEMAS' }],
  },
  {
    email: 'supervisor.lima@upeu.edu.pe',
    fullName: 'Supervisora Lima',
    roles: [{ role: Role.SUPERVISOR, campusCode: 'LIMA', schoolCode: 'ING-SISTEMAS' }],
  },
  {
    email: 'student.juliaca@upeu.edu.pe',
    fullName: 'Estudiante Juliaca',
    roles: [{ role: Role.STUDENT }],
    student: {
      code: '2024-0001',
      dni: '71234567',
      cycle: 'IX',
      campusCode: 'JULIACA',
      schoolCode: 'ING-SISTEMAS',
    },
  },
  {
    email: 'student.juliaca2@upeu.edu.pe',
    fullName: 'Estudiante Juliaca 2',
    roles: [{ role: Role.STUDENT }],
    student: {
      code: '2024-0002',
      dni: '71234568',
      cycle: 'IX',
      campusCode: 'JULIACA',
      schoolCode: 'ING-SISTEMAS',
    },
  },
  {
    email: 'student.lima@upeu.edu.pe',
    fullName: 'Estudiante Lima',
    roles: [{ role: Role.STUDENT }],
    student: {
      code: '2024-0003',
      dni: '71234569',
      cycle: 'IX',
      campusCode: 'LIMA',
      schoolCode: 'ING-SISTEMAS',
    },
  },
];

async function main(): Promise<void> {
  const upeu = await prisma.institution.upsert({
    where: { code: 'UPEU' },
    update: { name: 'Universidad Peruana Unión', shortName: 'UPeU' },
    create: { code: 'UPEU', name: 'Universidad Peruana Unión', shortName: 'UPeU' },
  });

  const campuses = new Map<string, { id: string }>();
  for (const campus of CAMPUSES) {
    const created = await prisma.campus.upsert({
      where: { code: campus.code },
      update: { name: campus.name, institutionId: upeu.id },
      create: { code: campus.code, name: campus.name, institutionId: upeu.id },
    });
    campuses.set(campus.code, { id: created.id });
  }

  const faculty = await prisma.faculty.upsert({
    where: { institutionId_code: { institutionId: upeu.id, code: 'FIA' } },
    update: { name: 'Facultad de Ingeniería y Arquitectura' },
    create: {
      institutionId: upeu.id,
      code: 'FIA',
      name: 'Facultad de Ingeniería y Arquitectura',
    },
  });

  const schools = new Map<string, { id: string }>();
  for (const school of SCHOOLS) {
    const created = await prisma.school.upsert({
      where: { facultyId_code: { facultyId: faculty.id, code: school.code } },
      update: { name: school.name, state: school.state },
      create: { facultyId: faculty.id, code: school.code, name: school.name, state: school.state },
    });
    schools.set(school.code, { id: created.id });
  }

  for (const campus of CAMPUSES) {
    for (const school of SCHOOLS) {
      await prisma.campusSchool.upsert({
        where: {
          campusId_schoolId: {
            campusId: campuses.get(campus.code)!.id,
            schoolId: schools.get(school.code)!.id,
          },
        },
        update: { active: school.code === 'ING-SISTEMAS' },
        create: {
          campusId: campuses.get(campus.code)!.id,
          schoolId: schools.get(school.code)!.id,
          active: school.code === 'ING-SISTEMAS',
        },
      });
    }
  }

  for (const campus of CAMPUSES) {
    const templateContent = {
      nationalYearPhrase: 'Universidad Peruana Unión',
      dateLocation: campus.name,
      signerName: 'Mag. Geraldine Veronica Alvizuri Llerena',
      signerTitle: 'DIRECTORA E.P. INGENIERÍA DE SISTEMAS',
      signerFaculty: 'FACULTAD DE INGENIERÍA Y ARQUITECTURA',
      footer: 'Universidad Peruana Unión',
    };
    const template = await prisma.letterTemplate.upsert({
      where: {
        campusId_schoolId: {
          campusId: campuses.get(campus.code)!.id,
          schoolId: schools.get('ING-SISTEMAS')!.id,
        },
      },
      update: { name: 'Carta de presentacion PPP', active: true },
      create: {
        campusId: campuses.get(campus.code)!.id,
        schoolId: schools.get('ING-SISTEMAS')!.id,
        name: 'Carta de presentacion PPP',
        active: true,
      },
    });
    await prisma.letterTemplateVersion.upsert({
      where: { templateId_version: { templateId: template.id, version: 1 } },
      update: { isActive: true, content: templateContent },
      create: {
        templateId: template.id,
        version: 1,
        isActive: true,
        content: templateContent,
      },
    });
  }

  await prisma.pppPolicyVersion.upsert({
    where: {
      institutionId_key_version: { institutionId: upeu.id, key: 'PPP_HOURS_TARGET', version: 1 },
    },
    update: { value: 700, state: 'ACTIVE' },
    create: {
      institutionId: upeu.id,
      key: 'PPP_HOURS_TARGET',
      value: 700,
      version: 1,
      state: 'ACTIVE',
    },
  });

  const initialRequirements = [
    {
      code: 'ACCEPTANCE_LETTER',
      name: 'Carta de aceptación',
      evidenceKind: RequirementEvidenceKind.PDF,
    },
    {
      code: 'PPP_AGREEMENT',
      name: 'Convenio de PPP',
      evidenceKind: RequirementEvidenceKind.PDF,
    },
    {
      code: 'WORK_PLAN',
      name: 'Plan de trabajo',
      evidenceKind: RequirementEvidenceKind.PDF,
    },
    {
      code: 'COMPANY_INFORMATION',
      name: 'Información de la empresa',
      evidenceKind: RequirementEvidenceKind.DIGITAL_RECORD,
    },
  ];
  for (const requirement of initialRequirements) {
    await prisma.documentRequirementDefinition.upsert({
      where: { code_version: { code: requirement.code, version: 1 } },
      update: {
        name: requirement.name,
        evidenceKind: requirement.evidenceKind,
        stage: RequirementStage.INITIAL,
        mandatory: true,
        active: true,
      },
      create: {
        ...requirement,
        stage: RequirementStage.INITIAL,
        mandatory: true,
        version: 1,
        active: true,
      },
    });
  }

  for (const campus of CAMPUSES) {
    await prisma.academicPeriod.upsert({
      where: { campusId_name: { campusId: campuses.get(campus.code)!.id, name: '2026-I' } },
      update: {
        startDate: new Date('2026-01-05T00:00:00.000Z'),
        endDate: new Date('2026-07-31T00:00:00.000Z'),
        state: AcademicPeriodState.OPEN,
      },
      create: {
        campusId: campuses.get(campus.code)!.id,
        name: '2026-I',
        startDate: new Date('2026-01-05T00:00:00.000Z'),
        endDate: new Date('2026-07-31T00:00:00.000Z'),
        state: AcademicPeriodState.OPEN,
      },
    });
  }

  for (const seedUser of SEED_USERS) {
    let identity = await prisma.institutionalIdentity.findUnique({
      where: { institutionalEmail: seedUser.email },
    });
    if (identity === null) {
      const user = await prisma.user.create({ data: {} });
      await prisma.institutionalIdentity.create({
        data: { userId: user.id, institutionId: upeu.id, institutionalEmail: seedUser.email },
      });
      await prisma.userProfile.create({
        data: { userId: user.id, fullName: seedUser.fullName },
      });
      identity = await prisma.institutionalIdentity.findUniqueOrThrow({
        where: { institutionalEmail: seedUser.email },
      });
    } else {
      await prisma.userProfile.upsert({
        where: { userId: identity.userId },
        update: { fullName: seedUser.fullName },
        create: { userId: identity.userId, fullName: seedUser.fullName },
      });
    }

    for (const seedRole of seedUser.roles) {
      const campusId =
        seedRole.campusCode !== undefined ? campuses.get(seedRole.campusCode)!.id : null;
      const schoolId =
        seedRole.schoolCode !== undefined ? schools.get(seedRole.schoolCode)!.id : null;
      const existing = await prisma.roleAssignment.findFirst({
        where: {
          userId: identity.userId,
          role: seedRole.role,
          campusId,
          schoolId,
          state: RoleAssignmentState.ACTIVE,
        },
      });
      if (existing === null) {
        await prisma.roleAssignment.create({
          data: { userId: identity.userId, role: seedRole.role, campusId, schoolId },
        });
      }
    }

    if (seedUser.student !== undefined) {
      const campusId = campuses.get(seedUser.student.campusCode)!.id;
      const schoolId = schools.get(seedUser.student.schoolCode)!.id;
      await prisma.studentProfile.upsert({
        where: { userId: identity.userId },
        update: {
          code: seedUser.student.code,
          dni: seedUser.student.dni,
          cycle: seedUser.student.cycle,
          campusId,
          schoolId,
          complete: true,
        },
        create: {
          userId: identity.userId,
          code: seedUser.student.code,
          dni: seedUser.student.dni,
          cycle: seedUser.student.cycle,
          campusId,
          schoolId,
          complete: true,
        },
      });
    }
  }

  console.log('Seed idempotente completado');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
