import { Injectable } from '@nestjs/common';
import { Prisma, Role, SecurityEventType } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string;
  actorRole?: Role;
  campusId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  result: string;
  detail?: Record<string, unknown>;
}

export interface SecurityEntry {
  userId?: string;
  type: SecurityEventType;
  detail?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAudit(entry: AuditEntry, client?: Prisma.TransactionClient): Promise<void> {
    const target = client ?? this.prisma;
    await target.auditEvent.create({
      data: {
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole ?? null,
        campusId: entry.campusId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        result: entry.result,
        detail:
          entry.detail === undefined
            ? Prisma.JsonNull
            : (entry.detail as unknown as Prisma.InputJsonValue),
      },
    });
  }

  async recordSecurity(entry: SecurityEntry): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        userId: entry.userId ?? null,
        type: entry.type,
        detail:
          entry.detail === undefined
            ? Prisma.JsonNull
            : (entry.detail as unknown as Prisma.InputJsonValue),
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }

  async listEvents(user: AuthUser): Promise<
    {
      id: string;
      actorId: string | null;
      actorRole: Role | null;
      campusId: string | null;
      action: string;
      entity: string;
      entityId: string;
      result: string;
      detail: unknown;
      createdAt: Date;
    }[]
  > {
    const campusIds = user.roles
      .map((assignment) => assignment.campusId)
      .filter((campusId): campusId is string => campusId !== null);
    const hasInstitutionalAuditScope = user.roles.some(
      (assignment) => assignment.role === Role.SYSTEM_ADMIN || assignment.role === Role.AUDITOR,
    );

    return this.prisma.auditEvent.findMany({
      where: hasInstitutionalAuditScope ? undefined : { campusId: { in: campusIds } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
