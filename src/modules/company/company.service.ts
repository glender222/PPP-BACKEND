import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { ScopePolicyService } from '../../common/authorization/scope-policy.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CompanyQueryDto,
  CreateCompanyDto,
  CreateCompanyRepresentativeDto,
  UpdateCompanyDto,
} from './dto/company.dto';

const companyInclude = Prisma.validator<Prisma.CompanyInclude>()({
  representatives: { orderBy: { createdAt: 'asc' } },
  practices: {
    select: { campusSchool: { select: { campusId: true, schoolId: true } } },
  },
});

type CompanyDetail = Prisma.CompanyGetPayload<{ include: typeof companyInclude }>;

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scopePolicy: ScopePolicyService,
  ) {}

  async list(actor: AuthUser, query: CompanyQueryDto): Promise<unknown[]> {
    this.scopePolicy.assertPermission(actor, 'company:read');
    const q = query.q?.trim();
    const ruc = query.ruc?.trim();
    const companies = await this.prisma.company.findMany({
      where: {
        ...(ruc === undefined ? {} : { ruc }),
        ...(q === undefined || q === ''
          ? {}
          : {
              OR: [
                { legalName: { contains: q, mode: 'insensitive' } },
                { tradeName: { contains: q, mode: 'insensitive' } },
                { ruc: { contains: q } },
              ],
            }),
      },
      include: companyInclude,
      orderBy: { legalName: 'asc' },
      take: 100,
    });
    return companies.map((company) => this.toView(company));
  }

  async create(actor: AuthUser, dto: CreateCompanyDto): Promise<unknown> {
    this.scopePolicy.assertPermission(actor, 'company:create');
    const ruc = this.validateRuc(dto.esExtranjera, dto.ruc);
    const id = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          ruc,
          legalName: dto.razonSocial.trim(),
          tradeName: dto.nombreComercial?.trim(),
          address: dto.direccion.trim(),
          contact: dto.contacto?.trim(),
          businessArea: dto.area?.trim(),
          foreign: dto.esExtranjera,
          createdById: actor.id,
          ...(dto.representante === undefined
            ? {}
            : { representatives: { create: this.representativeData(dto.representante) } }),
        },
      });
      await this.audit.recordAudit(this.auditEntry(actor, 'COMPANY_CREATED', company.id), tx);
      return company.id;
    });
    return this.getView(id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateCompanyDto): Promise<unknown> {
    this.scopePolicy.assertPermission(actor, 'company:write');
    const company = await this.getCompany(id);
    this.assertCanManage(actor, company);
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: {
          ...(dto.razonSocial === undefined ? {} : { legalName: dto.razonSocial.trim() }),
          ...(dto.nombreComercial === undefined ? {} : { tradeName: dto.nombreComercial.trim() }),
          ...(dto.direccion === undefined ? {} : { address: dto.direccion.trim() }),
          ...(dto.contacto === undefined ? {} : { contact: dto.contacto.trim() }),
          ...(dto.area === undefined ? {} : { businessArea: dto.area.trim() }),
        },
      });
      await this.audit.recordAudit(this.auditEntry(actor, 'COMPANY_UPDATED', id), tx);
    });
    return this.getView(id);
  }

  async addRepresentative(
    actor: AuthUser,
    companyId: string,
    dto: CreateCompanyRepresentativeDto,
  ): Promise<unknown> {
    this.scopePolicy.assertPermission(actor, 'company:write');
    const company = await this.getCompany(companyId);
    this.assertCanManage(actor, company);
    const representative = await this.prisma.$transaction(async (tx) => {
      const created = await tx.companyRepresentative.create({
        data: { companyId, ...this.representativeData(dto) },
      });
      await this.audit.recordAudit(
        this.auditEntry(actor, 'COMPANY_REPRESENTATIVE_CREATED', created.id, {
          companyId,
        }),
        tx,
      );
      return created;
    });
    return this.representativeView(representative);
  }

  private validateRuc(foreign: boolean, value?: string): string | null {
    const normalized = value?.trim();
    const ruc = normalized === '' ? null : (normalized ?? null);
    if (foreign && ruc !== null) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Una empresa extranjera no debe registrar RUC',
      );
    }
    if (!foreign && ruc === null) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El RUC es obligatorio para una empresa nacional',
      );
    }
    return ruc;
  }

  private representativeData(dto: CreateCompanyRepresentativeDto) {
    return {
      fullName: dto.nombre.trim(),
      position: dto.cargo?.trim(),
      email: dto.correo?.trim(),
      phone: dto.telefono?.trim(),
      metadata: (dto.otrosDatosContacto ?? {}) as Prisma.InputJsonValue,
    };
  }

  private async getCompany(id: string): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: companyInclude,
    });
    if (company === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Empresa no encontrada');
    }
    return company;
  }

  private async getView(id: string): Promise<unknown> {
    return this.toView(await this.getCompany(id));
  }

  private assertCanManage(actor: AuthUser, company: CompanyDetail): void {
    if (company.createdById === actor.id) {
      return;
    }
    const coordinatorScopes = actor.roles.filter((role) => role.role === Role.COORDINATOR);
    const canManage = company.practices.some((practice) =>
      coordinatorScopes.some(
        (scope) =>
          scope.campusId === practice.campusSchool.campusId &&
          (scope.schoolId === null || scope.schoolId === practice.campusSchool.schoolId),
      ),
    );
    if (!canManage) {
      throw new BusinessException(HttpStatus.FORBIDDEN, 'La empresa está fuera de tu ámbito');
    }
  }

  private toView(company: CompanyDetail): unknown {
    return {
      id: company.id,
      ruc: company.ruc,
      razonSocial: company.legalName,
      nombreComercial: company.tradeName,
      direccion: company.address,
      contacto: company.contact,
      area: company.businessArea,
      esExtranjera: company.foreign,
      representantes: company.representatives.map((representative) =>
        this.representativeView(representative),
      ),
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  private representativeView(representative: {
    id: string;
    fullName: string;
    position: string | null;
    email: string | null;
    phone: string | null;
    metadata: unknown;
    active: boolean;
  }): unknown {
    return {
      id: representative.id,
      nombre: representative.fullName,
      cargo: representative.position,
      correo: representative.email,
      telefono: representative.phone,
      otrosDatosContacto: representative.metadata,
      activo: representative.active,
    };
  }

  private auditEntry(
    actor: AuthUser,
    action: string,
    entityId: string,
    detail?: Record<string, unknown>,
  ) {
    return {
      actorId: actor.id,
      actorRole: actor.roles[0]?.role,
      campusId: actor.roles.find((role) => role.campusId !== null)?.campusId,
      action,
      entity: 'Company',
      entityId,
      result: 'SUCCESS',
      detail,
    };
  }
}
