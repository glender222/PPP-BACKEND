import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AcademicPeriodState,
  DocumentStatus,
  LetterRequestStatus,
  PracticeStatus,
  Prisma,
  RequirementStage,
  Role,
} from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { ScopePolicyService } from '../../common/authorization/scope-policy.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivatePracticeDto,
  CreatePracticeDto,
  PracticeQueryDto,
  UpdatePracticeDto,
} from './dto/practice.dto';

export const practiceDetailInclude = Prisma.validator<Prisma.PracticeInclude>()({
  studentProfile: {
    select: {
      userId: true,
      code: true,
      user: { select: { userProfile: { select: { fullName: true } } } },
    },
  },
  company: { select: { id: true, ruc: true, legalName: true, foreign: true } },
  companyRepresentative: true,
  academicPeriod: true,
  campusSchool: {
    include: {
      campus: { select: { id: true, code: true, name: true } },
      school: { select: { id: true, code: true, name: true } },
    },
  },
  letterRequest: { select: { id: true, status: true, number: true } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  requirementSnapshots: {
    orderBy: { code: 'asc' },
    include: {
      document: {
        include: {
          versions: {
            orderBy: { version: 'asc' },
            include: { fileAsset: true, review: true },
          },
        },
      },
    },
  },
});

export type PracticeDetail = Prisma.PracticeGetPayload<{ include: typeof practiceDetailInclude }>;

@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scopePolicy: ScopePolicyService,
  ) {}

  async create(actor: AuthUser, dto: CreatePracticeDto): Promise<unknown> {
    this.scopePolicy.assertPermission(actor, 'practice:create');
    const student = await this.prisma.studentProfile.findUnique({ where: { userId: actor.id } });
    if (!student?.complete) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El perfil del estudiante debe estar completo',
      );
    }
    const [representative, period, campusSchool, definitions, letter] = await Promise.all([
      this.prisma.companyRepresentative.findUnique({
        where: { id: dto.companyRepresentativeId },
        include: { company: true },
      }),
      this.prisma.academicPeriod.findUnique({ where: { id: dto.academicPeriodId } }),
      this.prisma.campusSchool.findUnique({
        where: { campusId_schoolId: { campusId: student.campusId, schoolId: student.schoolId } },
      }),
      this.prisma.documentRequirementDefinition.findMany({
        where: { active: true, stage: RequirementStage.INITIAL },
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
      }),
      dto.letterRequestId === undefined
        ? Promise.resolve(null)
        : this.prisma.letterRequest.findUnique({ where: { id: dto.letterRequestId } }),
    ]);
    if (representative?.companyId !== dto.companyId || !representative?.active) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El representante no pertenece a la empresa o no está activo',
      );
    }
    if (period?.campusId !== student.campusId || period.state !== AcademicPeriodState.OPEN) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El periodo debe estar abierto y pertenecer al campus del estudiante',
      );
    }
    if (!campusSchool?.active) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'La escuela no está activa en el campus del estudiante',
      );
    }
    if (
      dto.letterRequestId !== undefined &&
      (letter?.studentProfileId !== student.id || letter.status !== LetterRequestStatus.APPROVED)
    ) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'La carta debe estar aprobada y pertenecer al estudiante',
      );
    }
    const startDate = new Date(dto.fechaInicio);
    const endDate = new Date(dto.fechaFin);
    this.assertDateRange(startDate, endDate);
    const activeDefinitions = this.latestDefinitions(definitions);
    if (activeDefinitions.length === 0) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'No existen requisitos iniciales vigentes',
      );
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const practice = await tx.practice.create({
        data: {
          studentProfileId: student.id,
          companyId: dto.companyId,
          companyRepresentativeId: representative.id,
          representativeSnapshot: {
            id: representative.id,
            nombre: representative.fullName,
            cargo: representative.position,
            correo: representative.email,
            telefono: representative.phone,
            otrosDatosContacto: representative.metadata,
          },
          academicPeriodId: period.id,
          campusSchoolId: campusSchool.id,
          letterRequestId: dto.letterRequestId,
          areaRole: dto.areaCargo.trim(),
          startDate,
          endDate,
          schedule: dto.horario.trim(),
          modality: dto.modalidad.trim(),
          statusHistory: {
            create: { toStatus: PracticeStatus.PREPARATION, actorId: actor.id },
          },
          requirementSnapshots: {
            create: activeDefinitions.map((definition) => ({
              requirementDefinitionId: definition.id,
              code: definition.code,
              name: definition.name,
              evidenceKind: definition.evidenceKind,
              stage: definition.stage,
              mandatory: definition.mandatory,
              definitionVersion: definition.version,
              document: { create: { currentVersion: 0 } },
            })),
          },
        },
      });
      await this.audit.recordAudit(
        this.auditEntry(actor, campusSchool.campusId, 'PRACTICE_CREATED', practice.id),
        tx,
      );
      return practice.id;
    });
    return this.getDetail(actor, id);
  }

  async listMine(actor: AuthUser, query: PracticeQueryDto): Promise<unknown[]> {
    this.scopePolicy.assertPermission(actor, 'practice:read');
    const practices = await this.prisma.practice.findMany({
      where: {
        studentProfile: { userId: actor.id },
        ...(query.estado === undefined ? {} : { status: query.estado }),
        ...(query.academicPeriodId === undefined
          ? {}
          : { academicPeriodId: query.academicPeriodId }),
      },
      include: practiceDetailInclude,
      orderBy: { createdAt: 'desc' },
    });
    return practices.map((practice) => this.toView(practice));
  }

  async listScoped(actor: AuthUser, query: PracticeQueryDto): Promise<unknown[]> {
    this.scopePolicy.assertPermission(actor, 'practice:read');
    const scopes = actor.roles.filter(
      (assignment) => assignment.role === Role.COORDINATOR && assignment.campusId !== null,
    );
    const q = query.q?.trim();
    const practices = await this.prisma.practice.findMany({
      where: {
        OR: scopes.map((scope) => ({
          campusSchool: {
            campusId: scope.campusId!,
            ...(scope.schoolId === null ? {} : { schoolId: scope.schoolId }),
          },
        })),
        ...(query.estado === undefined ? {} : { status: query.estado }),
        ...(query.academicPeriodId === undefined
          ? {}
          : { academicPeriodId: query.academicPeriodId }),
        ...(q === undefined || q === ''
          ? {}
          : {
              OR: [
                { company: { legalName: { contains: q, mode: 'insensitive' } } },
                {
                  studentProfile: {
                    user: {
                      userProfile: { fullName: { contains: q, mode: 'insensitive' } },
                    },
                  },
                },
              ],
            }),
      },
      include: practiceDetailInclude,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return practices.map((practice) => this.toView(practice));
  }

  async getDetail(actor: AuthUser, id: string): Promise<unknown> {
    const practice = await this.getPractice(id);
    this.assertAccess(actor, 'practice:read', practice);
    return this.toView(practice);
  }

  async requirements(actor: AuthUser, id: string): Promise<unknown[]> {
    const practice = await this.getPractice(id);
    this.assertAccess(actor, 'practice:read', practice);
    return this.requirementViews(practice);
  }

  async update(actor: AuthUser, id: string, dto: UpdatePracticeDto): Promise<unknown> {
    const practice = await this.getPractice(id);
    this.assertAccess(actor, 'practice:write', practice);
    if (practice.status !== PracticeStatus.PREPARATION) {
      this.invalidTransition(practice.status, ['authorize']);
    }
    const startDate =
      dto.fechaInicio === undefined ? practice.startDate : new Date(dto.fechaInicio);
    const endDate = dto.fechaFin === undefined ? practice.endDate : new Date(dto.fechaFin);
    this.assertDateRange(startDate, endDate);
    const updated = await this.prisma.practice.updateMany({
      where: { id, version: dto.version, status: PracticeStatus.PREPARATION },
      data: {
        ...(dto.areaCargo === undefined ? {} : { areaRole: dto.areaCargo.trim() }),
        ...(dto.fechaInicio === undefined ? {} : { startDate }),
        ...(dto.fechaFin === undefined ? {} : { endDate }),
        ...(dto.horario === undefined ? {} : { schedule: dto.horario.trim() }),
        ...(dto.modalidad === undefined ? {} : { modality: dto.modalidad.trim() }),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new BusinessException(
        HttpStatus.CONFLICT,
        'La práctica fue modificada por otra solicitud; vuelve a cargarla',
      );
    }
    return this.getDetail(actor, id);
  }

  authorize(actor: AuthUser, id: string): Promise<unknown> {
    return this.transition(actor, id, PracticeStatus.PREPARATION, PracticeStatus.AUTHORIZED);
  }

  activate(actor: AuthUser, id: string, dto: ActivatePracticeDto): Promise<unknown> {
    return this.transition(
      actor,
      id,
      PracticeStatus.AUTHORIZED,
      PracticeStatus.ACTIVE,
      dto.justificacion,
    );
  }

  private async transition(
    actor: AuthUser,
    id: string,
    from: PracticeStatus,
    to: PracticeStatus,
    comment?: string,
  ): Promise<unknown> {
    const permission =
      to === PracticeStatus.AUTHORIZED ? 'practice:authorize' : 'practice:activate';
    const practice = await this.getPractice(id);
    this.assertAccess(actor, permission, practice);
    if (practice.status === to) {
      return this.toView(practice);
    }
    if (practice.status !== from) {
      this.invalidTransition(practice.status, [to.toLowerCase()]);
    }
    this.assertInitialRequirementsApproved(practice);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.practice.updateMany({
        where: { id, status: from },
        data: { status: to, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new BusinessException(HttpStatus.CONFLICT, 'La práctica cambió de estado');
      }
      await tx.practiceStatusHistory.create({
        data: { practiceId: id, fromStatus: from, toStatus: to, actorId: actor.id, comment },
      });
      await this.audit.recordAudit(
        this.auditEntry(
          actor,
          practice.campusSchool.campusId,
          to === PracticeStatus.AUTHORIZED ? 'PRACTICE_AUTHORIZED' : 'PRACTICE_ACTIVATED',
          id,
        ),
        tx,
      );
    });
    return this.getDetail(actor, id);
  }

  private assertInitialRequirementsApproved(practice: PracticeDetail): void {
    const missing = practice.requirementSnapshots
      .filter(
        (snapshot) =>
          snapshot.stage === RequirementStage.INITIAL &&
          snapshot.mandatory &&
          snapshot.document?.status !== DocumentStatus.APPROVED,
      )
      .map((snapshot) => ({ id: snapshot.id, code: snapshot.code, name: snapshot.name }));
    if (missing.length > 0) {
      throw new BusinessException(
        HttpStatus.CONFLICT,
        'La práctica tiene requisitos iniciales obligatorios sin aprobar',
        { details: { missingRequirements: missing } },
      );
    }
  }

  private latestDefinitions<T extends { code: string; version: number }>(definitions: T[]): T[] {
    const latest = new Map<string, T>();
    for (const definition of definitions) {
      if (!latest.has(definition.code)) {
        latest.set(definition.code, definition);
      }
    }
    return [...latest.values()];
  }

  private async getPractice(id: string): Promise<PracticeDetail> {
    const practice = await this.prisma.practice.findUnique({
      where: { id },
      include: practiceDetailInclude,
    });
    if (practice === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Práctica no encontrada');
    }
    return practice;
  }

  private assertAccess(
    actor: AuthUser,
    permission: Parameters<ScopePolicyService['assertResourceAccess']>[1],
    practice: PracticeDetail,
  ): void {
    this.scopePolicy.assertResourceAccess(actor, permission, {
      campusId: practice.campusSchool.campusId,
      schoolId: practice.campusSchool.schoolId,
      ownerId: practice.studentProfile.userId,
    });
  }

  private assertDateRange(startDate: Date, endDate: Date): void {
    if (
      Number.isNaN(startDate.valueOf()) ||
      Number.isNaN(endDate.valueOf()) ||
      endDate <= startDate
    ) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }
  }

  private invalidTransition(status: PracticeStatus, allowedTransitions: string[]): never {
    throw new BusinessException(HttpStatus.CONFLICT, `Transición inválida desde ${status}`, {
      allowedTransitions,
    });
  }

  private toView(practice: PracticeDetail): unknown {
    return {
      id: practice.id,
      estado: practice.status,
      version: practice.version,
      estudiante: {
        id: practice.studentProfileId,
        codigo: practice.studentProfile.code,
        nombre: practice.studentProfile.user.userProfile?.fullName ?? '',
      },
      empresa: {
        id: practice.company.id,
        ruc: practice.company.ruc,
        razonSocial: practice.company.legalName,
        esExtranjera: practice.company.foreign,
      },
      representanteSnapshot: practice.representativeSnapshot,
      periodo: practice.academicPeriod,
      campusSchool: practice.campusSchool,
      carta: practice.letterRequest,
      areaCargo: practice.areaRole,
      fechaInicio: practice.startDate,
      fechaFin: practice.endDate,
      horario: practice.schedule,
      modalidad: practice.modality,
      requisitos: this.requirementViews(practice),
      historial: practice.statusHistory,
      createdAt: practice.createdAt,
      updatedAt: practice.updatedAt,
    };
  }

  private requirementViews(practice: PracticeDetail): unknown[] {
    return practice.requirementSnapshots.map((snapshot) => ({
      id: snapshot.id,
      codigo: snapshot.code,
      nombre: snapshot.name,
      tipoEvidencia: snapshot.evidenceKind,
      etapa: snapshot.stage,
      obligatorio: snapshot.mandatory,
      versionDefinicion: snapshot.definitionVersion,
      documento:
        snapshot.document === null
          ? null
          : {
              id: snapshot.document.id,
              estado: snapshot.document.status,
              versionActual: snapshot.document.currentVersion,
              versiones: snapshot.document.versions.map((version) => ({
                id: version.id,
                version: version.version,
                estado: version.status,
                metadata: version.metadata,
                archivo:
                  version.fileAsset === null
                    ? null
                    : {
                        nombre: version.fileAsset.originalName,
                        mime: version.fileAsset.mimeType,
                        tamaño: version.fileAsset.size,
                        sha256: version.fileAsset.sha256,
                      },
                revision: version.review,
                createdAt: version.createdAt,
              })),
            },
    }));
  }

  private auditEntry(actor: AuthUser, campusId: string, action: string, entityId: string) {
    return {
      actorId: actor.id,
      actorRole: actor.roles[0]?.role,
      campusId,
      action,
      entity: 'Practice',
      entityId,
      result: 'SUCCESS',
    };
  }
}
