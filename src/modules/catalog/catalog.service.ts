import { HttpStatus, Injectable } from '@nestjs/common';
import { AcademicPeriodState, Role } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePeriodDto } from './dto/catalog.dto';

export interface CampusView {
  id: string;
  name: string;
  code: string;
  state: string;
}

export interface SchoolView {
  id: string;
  name: string;
  code: string;
  state: string;
}

export interface PeriodView {
  id: string;
  campusId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  state: AcademicPeriodState;
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listCampuses(): Promise<CampusView[]> {
    const campuses = await this.prisma.campus.findMany({ orderBy: { name: 'asc' } });
    return campuses.map((campus) => ({
      id: campus.id,
      name: campus.name,
      code: campus.code,
      state: campus.state,
    }));
  }

  async listSchools(campusId?: string): Promise<SchoolView[]> {
    if (campusId === undefined) {
      const schools = await this.prisma.school.findMany({
        where: { state: 'ACTIVE' },
        orderBy: { name: 'asc' },
      });
      return schools.map((school) => ({
        id: school.id,
        name: school.name,
        code: school.code,
        state: school.state,
      }));
    }
    const campusSchools = await this.prisma.campusSchool.findMany({
      where: { campusId, active: true },
      include: { school: true },
      orderBy: { school: { name: 'asc' } },
    });
    return campusSchools.map((campusSchool) => ({
      id: campusSchool.school.id,
      name: campusSchool.school.name,
      code: campusSchool.school.code,
      state: campusSchool.school.state,
    }));
  }

  async listPeriods(user: AuthUser): Promise<PeriodView[]> {
    const isAdmin = user.roles.some((assignment) => assignment.role === Role.SYSTEM_ADMIN);
    const campusIds = user.roles
      .map((assignment) => assignment.campusId)
      .filter((campusId): campusId is string => campusId !== null);

    const periods = await this.prisma.academicPeriod.findMany({
      where: isAdmin ? undefined : { campusId: { in: campusIds } },
      orderBy: [{ campusId: 'asc' }, { startDate: 'desc' }],
    });
    return periods.map((period) => ({
      id: period.id,
      campusId: period.campusId,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
      state: period.state,
    }));
  }

  async createPeriod(actor: AuthUser, dto: CreatePeriodDto): Promise<PeriodView> {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }
    const id = await this.prisma.$transaction(async (tx) => {
      const period = await tx.academicPeriod.create({
        data: {
          campusId: dto.campusId,
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          state: AcademicPeriodState.DRAFT,
        },
      });
      await this.audit.recordAudit(
        {
          actorId: actor.id,
          actorRole: actor.roles[0]?.role,
          campusId: dto.campusId,
          action: 'ACADEMIC_PERIOD_CREATED',
          entity: 'AcademicPeriod',
          entityId: period.id,
          result: 'SUCCESS',
          detail: { name: dto.name, startDate: dto.startDate, endDate: dto.endDate },
        },
        tx,
      );
      return period.id;
    });
    return this.getPeriod(id);
  }

  async openPeriod(actor: AuthUser, periodId: string): Promise<PeriodView> {
    const period = await this.prisma.academicPeriod.findUnique({ where: { id: periodId } });
    if (period === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Periodo académico no encontrado');
    }
    if (period.state !== AcademicPeriodState.DRAFT) {
      throw new BusinessException(
        HttpStatus.CONFLICT,
        `No se puede abrir un periodo en estado ${period.state}`,
        { allowedTransitions: ['close'] },
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.academicPeriod.update({
        where: { id: periodId },
        data: { state: AcademicPeriodState.OPEN },
      });
      await this.audit.recordAudit(
        {
          actorId: actor.id,
          actorRole: actor.roles[0]?.role,
          campusId: period.campusId,
          action: 'ACADEMIC_PERIOD_OPENED',
          entity: 'AcademicPeriod',
          entityId: periodId,
          result: 'SUCCESS',
        },
        tx,
      );
    });
    return this.getPeriod(periodId);
  }

  async closePeriod(actor: AuthUser, periodId: string): Promise<PeriodView> {
    const period = await this.prisma.academicPeriod.findUnique({ where: { id: periodId } });
    if (period === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Periodo académico no encontrado');
    }
    if (period.state !== AcademicPeriodState.OPEN) {
      throw new BusinessException(
        HttpStatus.CONFLICT,
        `No se puede cerrar un periodo en estado ${period.state}`,
        { allowedTransitions: ['open'] },
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.academicPeriod.update({
        where: { id: periodId },
        data: { state: AcademicPeriodState.CLOSED },
      });
      await this.audit.recordAudit(
        {
          actorId: actor.id,
          actorRole: actor.roles[0]?.role,
          campusId: period.campusId,
          action: 'ACADEMIC_PERIOD_CLOSED',
          entity: 'AcademicPeriod',
          entityId: periodId,
          result: 'SUCCESS',
        },
        tx,
      );
    });
    return this.getPeriod(periodId);
  }

  private async getPeriod(periodId: string): Promise<PeriodView> {
    const period = await this.prisma.academicPeriod.findUniqueOrThrow({ where: { id: periodId } });
    return {
      id: period.id,
      campusId: period.campusId,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
      state: period.state,
    };
  }
}
