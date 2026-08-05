import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  LetterRequestStatus,
  LetterReviewDecisionType,
  Prisma,
  Role,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuthUser } from '../../common/authorization/auth-user';
import { type Permission } from '../../common/authorization/permissions';
import { ScopePolicyService } from '../../common/authorization/scope-policy.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLetterDto, UpdateLetterDto } from './dto/letter.dto';
import { LETTER_FILE_STORAGE, LetterFileStoragePort } from './letter-file-storage.port';
import { LETTER_GENERATOR, LetterGeneratorPort } from './letter-generator.port';
import { LETTER_NUMBERING, LetterNumberingPort } from './letter-numbering.port';

const detailInclude = Prisma.validator<Prisma.LetterRequestInclude>()({
  studentProfile: {
    select: {
      userId: true,
      complete: true,
      code: true,
      cycle: true,
      user: { select: { userProfile: { select: { fullName: true } } } },
    },
  },
  templateVersion: { select: { content: true } },
  revisions: { include: { decisions: true }, orderBy: { version: 'asc' } },
  stateHistory: { orderBy: { createdAt: 'asc' } },
  generatedFile: true,
});

type LetterDetail = Prisma.LetterRequestGetPayload<{ include: typeof detailInclude }>;
interface LetterSnapshot {
  recipient: string;
  position: string;
  targetCompany: string;
  practiceArea: string;
  templateData: Record<string, unknown>;
  studentName: string;
  studentCode: string;
  studentCycle: string | null;
  issuedAt: string;
}

export interface LetterView {
  id: string;
  estado: LetterRequestStatus;
  destinatario: string;
  cargo: string;
  empresaObjetivo: string;
  areaPractica: string;
  datosPlantilla: unknown;
  numero: string | null;
  createdAt: Date;
  updatedAt: Date;
  revisiones: {
    id: string;
    version: number;
    contenido: unknown;
    createdAt: Date;
    decisiones: { id: string; decision: LetterReviewDecisionType; comment: string | null; createdAt: Date }[];
  }[];
  historial: {
    id: string;
    desde: LetterRequestStatus | null;
    hacia: LetterRequestStatus;
    actorId: string | null;
    comentario: string | null;
    createdAt: Date;
  }[];
  archivoFinal: {
    fileName: string;
    number: string;
    mimeType: string;
    size: number;
    sha256: string;
    generatedAt: Date;
  } | null;
}

@Injectable()
export class LetterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scopePolicy: ScopePolicyService,
    @Inject(LETTER_GENERATOR) private readonly generator: LetterGeneratorPort,
    @Inject(LETTER_FILE_STORAGE) private readonly storage: LetterFileStoragePort,
    @Inject(LETTER_NUMBERING) private readonly numbering: LetterNumberingPort,
  ) {}

  async create(actor: AuthUser, dto: CreateLetterDto): Promise<LetterView> {
    this.scopePolicy.assertPermission(actor, 'letter:create');
    const student = await this.getStudent(actor.id);
    const templateVersion = await this.prisma.letterTemplateVersion.findFirst({
      where: {
        isActive: true,
        template: { campusId: student.campusId, schoolId: student.schoolId, active: true },
      },
      orderBy: { version: 'desc' },
    });
    if (templateVersion === null) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, 'No existe una plantilla vigente para tu campus y escuela');
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const letter = await tx.letterRequest.create({
        data: {
          studentProfileId: student.id,
          campusId: student.campusId,
          schoolId: student.schoolId,
          templateVersionId: templateVersion.id,
          recipient: dto.destinatario,
          position: dto.cargo,
          targetCompany: dto.empresaObjetivo,
          practiceArea: dto.areaPractica,
          templateData: dto.datosPlantilla as Prisma.InputJsonValue,
        },
      });
      await tx.letterStateHistory.create({
        data: { letterRequestId: letter.id, toStatus: LetterRequestStatus.DRAFT, actorId: actor.id },
      });
      await this.audit.recordAudit(
        this.auditEntry(actor, student.campusId, 'LETTER_CREATED', letter.id),
        tx,
      );
      await this.notify(tx, [actor.id], 'LETTER_DRAFT_CREATED', 'Se creo el borrador de tu carta.', letter.id);
      return letter.id;
    });
    return this.getDetail(actor, id);
  }

  async listMine(actor: AuthUser, status?: LetterRequestStatus): Promise<LetterView[]> {
    this.scopePolicy.assertPermission(actor, 'letter:read');
    const letters = await this.prisma.letterRequest.findMany({
      where: { studentProfile: { userId: actor.id }, ...(status === undefined ? {} : { status }) },
      include: detailInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return letters.map((letter) => this.toView(letter));
  }

  async listSecretary(
    actor: AuthUser,
    status?: LetterRequestStatus,
    query?: string,
  ): Promise<LetterView[]> {
    this.scopePolicy.assertPermission(actor, 'letter:review');
    const scopes = actor.roles.filter(
      (assignment) =>
        assignment.role === Role.SECRETARY && assignment.campusId !== null && assignment.schoolId !== null,
    );
    const letters = await this.prisma.letterRequest.findMany({
      where: {
        OR: scopes.map((scope) => ({ campusId: scope.campusId!, schoolId: scope.schoolId! })),
        ...(status === undefined ? {} : { status }),
      },
      include: detailInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const normalizedQuery = query?.trim().toLowerCase();
    return letters
      .filter(
        (letter) =>
          normalizedQuery === undefined ||
          letter.recipient.toLowerCase().includes(normalizedQuery) ||
          letter.targetCompany.toLowerCase().includes(normalizedQuery),
      )
      .map((letter) => this.toView(letter));
  }

  async getDetail(actor: AuthUser, id: string): Promise<LetterView> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:read', letter);
    return this.toView(letter);
  }

  async update(actor: AuthUser, id: string, dto: UpdateLetterDto): Promise<LetterView> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:write', letter);
    const editableStatuses: LetterRequestStatus[] = [
      LetterRequestStatus.DRAFT,
      LetterRequestStatus.OBSERVED,
    ];
    if (!editableStatuses.includes(letter.status)) {
      this.invalidTransition(letter.status);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.letterRequest.update({
        where: { id },
        data: {
          ...(dto.destinatario === undefined ? {} : { recipient: dto.destinatario }),
          ...(dto.cargo === undefined ? {} : { position: dto.cargo }),
          ...(dto.empresaObjetivo === undefined ? {} : { targetCompany: dto.empresaObjetivo }),
          ...(dto.areaPractica === undefined ? {} : { practiceArea: dto.areaPractica }),
          ...(dto.datosPlantilla === undefined
            ? {}
            : { templateData: dto.datosPlantilla as Prisma.InputJsonValue }),
        },
      });
      await this.audit.recordAudit(this.auditEntry(actor, letter.campusId, 'LETTER_UPDATED', id), tx);
    });
    return this.getDetail(actor, id);
  }

  async submit(actor: AuthUser, id: string): Promise<LetterView> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:write', letter);
    if (letter.status === LetterRequestStatus.SUBMITTED) {
      return this.toView(letter);
    }
    this.requireStatus(letter.status, [LetterRequestStatus.DRAFT]);
    if (!letter.studentProfile.complete) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, 'Debes completar tu perfil antes de enviar la carta');
    }
    this.assertComplete(this.toSnapshot(letter));
    const recipients = await this.secretaryIds(letter.campusId, letter.schoolId);
    await this.transitionWithRevision(
      actor,
      letter,
      LetterRequestStatus.SUBMITTED,
      'LETTER_SUBMITTED',
      undefined,
      recipients,
      'LETTER_PENDING_REVIEW',
      'Tienes una carta pendiente de revision.',
    );
    return this.getDetail(actor, id);
  }

  async resubmit(actor: AuthUser, id: string, dto: UpdateLetterDto): Promise<LetterView> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:write', letter);
    if (letter.status === LetterRequestStatus.RESUBMITTED) {
      return this.toView(letter);
    }
    this.requireStatus(letter.status, [LetterRequestStatus.OBSERVED]);
    const updated = this.applyDto(this.toSnapshot(letter), dto);
    this.assertComplete(updated);
    const recipients = await this.secretaryIds(letter.campusId, letter.schoolId);
    await this.prisma.$transaction(async (tx) => {
      const revision = await tx.letterRequestRevision.count({ where: { letterRequestId: id } });
      await tx.letterRequest.update({
        where: { id },
        data: {
          recipient: updated.recipient,
          position: updated.position,
          targetCompany: updated.targetCompany,
          practiceArea: updated.practiceArea,
          templateData: updated.templateData as Prisma.InputJsonValue,
          status: LetterRequestStatus.RESUBMITTED,
        },
      });
      await tx.letterRequestRevision.create({
        data: { letterRequestId: id, version: revision + 1, content: this.snapshot(updated) },
      });
      await this.recordTransition(
        tx,
        actor,
        letter,
        LetterRequestStatus.RESUBMITTED,
        'LETTER_RESUBMITTED',
      );
      await this.notify(
        tx,
        recipients,
        'LETTER_PENDING_REVIEW',
        'Tienes una carta reenviada pendiente de revision.',
        id,
      );
    });
    return this.getDetail(actor, id);
  }

  async observe(actor: AuthUser, id: string, comment: string): Promise<LetterView> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:review', letter);
    this.requireStatus(letter.status, [LetterRequestStatus.SUBMITTED, LetterRequestStatus.RESUBMITTED]);
    await this.review(
      actor,
      letter,
      LetterRequestStatus.OBSERVED,
      LetterReviewDecisionType.OBSERVED,
      this.requiredComment(comment, 'La observacion exige un comentario'),
    );
    return this.getDetail(actor, id);
  }

  async annul(actor: AuthUser, id: string, reason: string): Promise<LetterView> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:review', letter);
    this.requireStatus(letter.status, [LetterRequestStatus.SUBMITTED, LetterRequestStatus.RESUBMITTED]);
    await this.review(
      actor,
      letter,
      LetterRequestStatus.ANNULLED,
      LetterReviewDecisionType.ANNULLED,
      this.requiredComment(reason, 'La anulacion exige un motivo'),
    );
    return this.getDetail(actor, id);
  }

  async approve(actor: AuthUser, id: string): Promise<LetterView> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:review', letter);
    if (letter.status === LetterRequestStatus.APPROVED) {
      return this.toView(letter);
    }
    this.requireStatus(letter.status, [LetterRequestStatus.SUBMITTED, LetterRequestStatus.RESUBMITTED]);
    const revision = letter.revisions.at(-1);
    if (revision === undefined) {
      throw new BusinessException(HttpStatus.CONFLICT, 'La carta enviada no tiene una revision para aprobar');
    }
    const snapshot = revision.content as unknown as LetterSnapshot;
    const number = await this.numbering.nextNumber(letter.id);
    const generated = await this.generator.generate({
      ...snapshot,
      requestId: id,
      number,
      template: this.templateContent(letter.templateVersion.content),
      preview: false,
    });
    const fileName = `letter-${id}-${revision.version}.pdf`;
    const storagePath = await this.storage.store(fileName, generated.content);
    const sha256 = createHash('sha256').update(generated.content).digest('hex');
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.letterRequest.findUniqueOrThrow({ where: { id } });
      this.requireStatus(current.status, [LetterRequestStatus.SUBMITTED, LetterRequestStatus.RESUBMITTED]);
      await tx.letterRequest.update({
        where: { id },
        data: { status: LetterRequestStatus.APPROVED, number },
      });
      await tx.generatedLetterFile.create({
        data: {
          letterRequestId: id,
          revisionId: revision.id,
          templateVersionId: letter.templateVersionId,
          number,
          fileName,
          mimeType: generated.mimeType,
          size: generated.content.length,
          sha256,
          storagePath,
        },
      });
      await tx.letterReviewDecision.create({
        data: {
          letterRequestId: id,
          revisionId: revision.id,
          reviewerId: actor.id,
          decision: LetterReviewDecisionType.APPROVED,
        },
      });
      await this.recordTransition(tx, actor, letter, LetterRequestStatus.APPROVED, 'LETTER_APPROVED');
      await this.notify(tx, [letter.studentProfile.userId], 'LETTER_APPROVED', 'Tu carta fue aprobada y esta disponible para descarga.', id);
    });
    return this.getDetail(actor, id);
  }

  async preview(actor: AuthUser, id: string): Promise<Buffer> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:preview', letter);
    const generated = await this.generator.generate({
      ...this.toSnapshot(letter),
      requestId: id,
      template: this.templateContent(letter.templateVersion.content),
      preview: true,
    });
    return generated.content;
  }

  async download(actor: AuthUser, id: string): Promise<Buffer> {
    const letter = await this.getLetter(id);
    this.assertAccess(actor, 'letter:download', letter);
    if (letter.status !== LetterRequestStatus.APPROVED || letter.generatedFile === null) {
      throw new BusinessException(HttpStatus.CONFLICT, 'Solo una carta aprobada puede descargarse como documento final', {
        allowedTransitions: ['approve'],
      });
    }
    const content = await this.storage.read(letter.generatedFile.storagePath);
    await this.prisma.$transaction(async (tx) => {
      await this.audit.recordAudit(this.auditEntry(actor, letter.campusId, 'LETTER_DOWNLOADED', id), tx);
    });
    return content;
  }

  private async review(
    actor: AuthUser,
    letter: LetterDetail,
    status: 'OBSERVED' | 'ANNULLED',
    decision: 'OBSERVED' | 'ANNULLED',
    comment: string,
  ): Promise<void> {
    const revision = letter.revisions.at(-1);
    if (revision === undefined) {
      throw new BusinessException(HttpStatus.CONFLICT, 'La carta enviada no tiene una revision para revisar');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.letterRequest.update({ where: { id: letter.id }, data: { status } });
      await tx.letterReviewDecision.create({
        data: { letterRequestId: letter.id, revisionId: revision.id, reviewerId: actor.id, decision, comment },
      });
      await this.recordTransition(
        tx,
        actor,
        letter,
        status,
        decision === LetterReviewDecisionType.OBSERVED ? 'LETTER_OBSERVED' : 'LETTER_ANNULLED',
        comment,
      );
      await this.notify(
        tx,
        [letter.studentProfile.userId],
        status === LetterRequestStatus.OBSERVED ? 'LETTER_OBSERVED' : 'LETTER_ANNULLED',
        status === LetterRequestStatus.OBSERVED
          ? 'Tu carta fue observada y requiere correccion.'
          : 'Tu carta fue anulada.',
        letter.id,
      );
    });
  }

  private async transitionWithRevision(
    actor: AuthUser,
    letter: LetterDetail,
    status: 'SUBMITTED',
    auditAction: string,
    comment: string | undefined,
    recipients: string[],
    notificationType: string,
    notification: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const revision = await tx.letterRequestRevision.count({ where: { letterRequestId: letter.id } });
      await tx.letterRequest.update({ where: { id: letter.id }, data: { status } });
      await tx.letterRequestRevision.create({
        data: {
          letterRequestId: letter.id,
          version: revision + 1,
          content: this.snapshot(this.toSnapshot(letter)),
        },
      });
      await this.recordTransition(tx, actor, letter, status, auditAction, comment);
      await this.notify(tx, recipients, notificationType, notification, letter.id);
    });
  }

  private async recordTransition(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    letter: LetterDetail,
    toStatus: LetterRequestStatus,
    action: string,
    comment?: string,
  ): Promise<void> {
    await tx.letterStateHistory.create({
      data: {
        letterRequestId: letter.id,
        fromStatus: letter.status,
        toStatus,
        actorId: actor.id,
        comment,
      },
    });
    await this.audit.recordAudit(this.auditEntry(actor, letter.campusId, action, letter.id, comment), tx);
  }

  private async notify(
    tx: Prisma.TransactionClient,
    userIds: string[],
    type: string,
    message: string,
    letterId: string,
  ): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return;
    }
    await tx.notification.createMany({
      data: uniqueUserIds.map((userId) => ({ userId, type, message, link: `/letters/${letterId}` })),
    });
  }

  private async secretaryIds(campusId: string, schoolId: string): Promise<string[]> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: { role: Role.SECRETARY, state: 'ACTIVE', campusId, schoolId },
      select: { userId: true },
    });
    return assignments.map((assignment) => assignment.userId);
  }

  private async getStudent(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (student === null) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, 'No tienes un perfil de estudiante para solicitar una carta');
    }
    return student;
  }

  private async getLetter(id: string): Promise<LetterDetail> {
    const letter = await this.prisma.letterRequest.findUnique({ where: { id }, include: detailInclude });
    if (letter === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Solicitud de carta no encontrada');
    }
    return letter;
  }

  private assertAccess(actor: AuthUser, permission: Permission, letter: LetterDetail): void {
    this.scopePolicy.assertResourceAccess(actor, permission, {
      campusId: letter.campusId,
      schoolId: letter.schoolId,
      ownerId: letter.studentProfile.userId,
    });
  }

  private requireStatus(current: LetterRequestStatus, allowed: LetterRequestStatus[]): void {
    if (!allowed.includes(current)) {
      this.invalidTransition(current);
    }
  }

  private invalidTransition(current: LetterRequestStatus): never {
    const transitions: Record<LetterRequestStatus, string[]> = {
      DRAFT: ['submit'],
      SUBMITTED: ['observe', 'approve', 'annul'],
      OBSERVED: ['resubmit'],
      RESUBMITTED: ['observe', 'approve', 'annul'],
      APPROVED: [],
      ANNULLED: [],
    };
    throw new BusinessException(HttpStatus.CONFLICT, `La carta no permite esta accion desde el estado ${current}`, {
      allowedTransitions: transitions[current],
    });
  }

  private assertComplete(letter: LetterSnapshot): void {
    const values = [letter.recipient, letter.position, letter.targetCompany, letter.practiceArea];
    if (values.some((value) => value.trim() === '')) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, 'Completa los campos obligatorios de la carta antes de enviarla');
    }
  }

  private requiredComment(value: string, message: string): string {
    const comment = value.trim();
    if (comment === '') {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return comment;
  }

  private applyDto(letter: LetterSnapshot, dto: UpdateLetterDto): LetterSnapshot {
    return {
      recipient: dto.destinatario ?? letter.recipient,
      position: dto.cargo ?? letter.position,
      targetCompany: dto.empresaObjetivo ?? letter.targetCompany,
      practiceArea: dto.areaPractica ?? letter.practiceArea,
      templateData: dto.datosPlantilla ?? letter.templateData,
      studentName: letter.studentName,
      studentCode: letter.studentCode,
      studentCycle: letter.studentCycle,
      issuedAt: letter.issuedAt,
    };
  }

  private snapshot(letter: LetterSnapshot): Prisma.InputJsonValue {
    return {
      recipient: letter.recipient,
      position: letter.position,
      targetCompany: letter.targetCompany,
      practiceArea: letter.practiceArea,
      templateData: letter.templateData as Prisma.InputJsonValue,
      studentName: letter.studentName,
      studentCode: letter.studentCode,
      studentCycle: letter.studentCycle,
      issuedAt: letter.issuedAt,
    };
  }

  private toSnapshot(letter: {
    recipient: string;
    position: string;
    targetCompany: string;
    practiceArea: string;
    templateData: unknown;
    createdAt: Date;
    studentProfile: {
      code: string;
      cycle: string | null;
      user: { userProfile: { fullName: string } | null };
    };
  }): LetterSnapshot {
    if (
      letter.templateData === null ||
      typeof letter.templateData !== 'object' ||
      Array.isArray(letter.templateData)
    ) {
      throw new BusinessException(HttpStatus.CONFLICT, 'Los datos de plantilla de la carta no son validos');
    }
    return {
      recipient: letter.recipient,
      position: letter.position,
      targetCompany: letter.targetCompany,
      practiceArea: letter.practiceArea,
      templateData: letter.templateData as Record<string, unknown>,
      studentName: letter.studentProfile.user.userProfile?.fullName ?? 'Estudiante UPeU',
      studentCode: letter.studentProfile.code,
      studentCycle: letter.studentProfile.cycle,
      issuedAt: letter.createdAt.toISOString(),
    };
  }

  private templateContent(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new BusinessException(HttpStatus.CONFLICT, 'La configuracion de la plantilla de carta no es valida');
    }
    return value as Record<string, unknown>;
  }

  private auditEntry(
    actor: AuthUser,
    campusId: string,
    action: string,
    entityId: string,
    comment?: string,
  ) {
    return {
      actorId: actor.id,
      actorRole: actor.roles[0]?.role,
      campusId,
      action,
      entity: 'LetterRequest',
      entityId,
      result: 'SUCCESS',
      ...(comment === undefined ? {} : { detail: { comment } }),
    };
  }

  private toView(letter: LetterDetail): LetterView {
    return {
      id: letter.id,
      estado: letter.status,
      destinatario: letter.recipient,
      cargo: letter.position,
      empresaObjetivo: letter.targetCompany,
      areaPractica: letter.practiceArea,
      datosPlantilla: letter.templateData,
      numero: letter.number,
      createdAt: letter.createdAt,
      updatedAt: letter.updatedAt,
      revisiones: letter.revisions.map((revision) => ({
        id: revision.id,
        version: revision.version,
        contenido: revision.content,
        createdAt: revision.createdAt,
        decisiones: revision.decisions.map((decision) => ({
          id: decision.id,
          decision: decision.decision,
          comment: decision.comment,
          createdAt: decision.createdAt,
        })),
      })),
      historial: letter.stateHistory.map((item) => ({
        id: item.id,
        desde: item.fromStatus,
        hacia: item.toStatus,
        actorId: item.actorId,
        comentario: item.comment,
        createdAt: item.createdAt,
      })),
      archivoFinal:
        letter.generatedFile === null
          ? null
          : {
              fileName: letter.generatedFile.fileName,
              number: letter.generatedFile.number,
              mimeType: letter.generatedFile.mimeType,
              size: letter.generatedFile.size,
              sha256: letter.generatedFile.sha256,
              generatedAt: letter.generatedFile.generatedAt,
            },
    };
  }
}
