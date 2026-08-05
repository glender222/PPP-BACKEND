import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  DocumentReviewDecisionType,
  DocumentStatus,
  Prisma,
  RequirementEvidenceKind,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthUser } from '../../common/authorization/auth-user';
import { type Permission } from '../../common/authorization/permissions';
import { ScopePolicyService } from '../../common/authorization/scope-policy.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { STORAGE_PORT, StoragePort } from '../../common/storage/storage.port';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadDigitalDocumentDto } from './dto/document.dto';
import { PdfUpload, PdfValidatorService } from './pdf-validator.service';

const documentInclude = Prisma.validator<Prisma.DocumentInclude>()({
  requirementSnapshot: {
    include: {
      practice: {
        include: {
          studentProfile: { select: { userId: true } },
          campusSchool: { select: { campusId: true, schoolId: true } },
        },
      },
    },
  },
  versions: {
    include: { fileAsset: true, review: true },
    orderBy: { version: 'asc' },
  },
});

type DocumentDetail = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scopePolicy: ScopePolicyService,
    private readonly pdfValidator: PdfValidatorService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async listForPractice(actor: AuthUser, practiceId: string): Promise<unknown[]> {
    const documents = await this.prisma.document.findMany({
      where: { requirementSnapshot: { practiceId } },
      include: documentInclude,
      orderBy: { requirementSnapshot: { code: 'asc' } },
    });
    if (documents.length === 0) {
      const practice = await this.prisma.practice.findUnique({
        where: { id: practiceId },
        include: {
          studentProfile: { select: { userId: true } },
          campusSchool: { select: { campusId: true, schoolId: true } },
        },
      });
      if (practice === null) {
        throw new BusinessException(HttpStatus.NOT_FOUND, 'Práctica no encontrada');
      }
      this.scopePolicy.assertResourceAccess(actor, 'document:read', {
        ownerId: practice.studentProfile.userId,
        campusId: practice.campusSchool.campusId,
        schoolId: practice.campusSchool.schoolId,
      });
      return [];
    }
    this.assertAccess(actor, 'document:read', documents[0]!);
    return documents.map((document) => this.toView(document));
  }

  async uploadPdf(
    actor: AuthUser,
    practiceId: string,
    requirementSnapshotId: string,
    uploadedFile: PdfUpload | undefined,
  ): Promise<unknown> {
    const file = this.pdfValidator.validate(uploadedFile);
    const document = await this.getDocumentBySnapshot(practiceId, requirementSnapshotId);
    this.assertAccess(actor, 'document:write', document);
    this.assertReplacementAllowed(document, RequirementEvidenceKind.PDF);
    const version = document.currentVersion + 1;
    const storageKey = `documents/${practiceId}/${randomUUID()}.pdf`;
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    await this.storage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
      metadata: { sha256, originalName: file.originalname },
    });
    await this.prisma.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: {
          storageKey,
          sha256,
          mimeType: file.mimetype,
          size: file.size,
          originalName: file.originalname,
          metadata: { technicalValidation: 'extension,mime,magic-bytes,size,non-empty' },
          uploadedById: actor.id,
        },
      });
      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          version,
          status: DocumentStatus.PENDING,
          fileAssetId: asset.id,
          metadata: {},
        },
      });
      await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.PENDING, currentVersion: version },
      });
      await this.audit.recordAudit(
        this.auditEntry(actor, document, 'DOCUMENT_VERSION_UPLOADED', { version, sha256 }),
        tx,
      );
    });
    return this.getView(document.id, actor);
  }

  async uploadDigital(
    actor: AuthUser,
    practiceId: string,
    dto: UploadDigitalDocumentDto,
  ): Promise<unknown> {
    const document = await this.getDocumentBySnapshot(practiceId, dto.requirementSnapshotId);
    this.assertAccess(actor, 'document:write', document);
    this.assertReplacementAllowed(document, RequirementEvidenceKind.DIGITAL_RECORD);
    if (Object.keys(dto.metadata).length === 0) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El registro digital no puede estar vacío',
      );
    }
    const version = document.currentVersion + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          version,
          status: DocumentStatus.PENDING,
          metadata: dto.metadata as Prisma.InputJsonValue,
        },
      });
      await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.PENDING, currentVersion: version },
      });
      await this.audit.recordAudit(
        this.auditEntry(actor, document, 'DOCUMENT_DIGITAL_VERSION_CREATED', { version }),
        tx,
      );
    });
    return this.getView(document.id, actor);
  }

  async submit(actor: AuthUser, documentId: string): Promise<unknown> {
    const document = await this.getDocument(documentId);
    this.assertAccess(actor, 'document:write', document);
    if (document.status === DocumentStatus.UNDER_REVIEW) {
      return this.toView(document);
    }
    const current = this.currentVersion(document);
    if (document.status !== DocumentStatus.PENDING || current.status !== DocumentStatus.PENDING) {
      this.invalidTransition(document.status, ['UNDER_REVIEW']);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.documentVersion.update({
        where: { id: current.id },
        data: { status: DocumentStatus.UNDER_REVIEW },
      });
      await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.UNDER_REVIEW },
      });
      await this.audit.recordAudit(
        this.auditEntry(actor, document, 'DOCUMENT_SUBMITTED', { version: current.version }),
        tx,
      );
    });
    return this.getView(document.id, actor);
  }

  versions(actor: AuthUser, documentId: string): Promise<unknown> {
    return this.getView(documentId, actor);
  }

  approve(actor: AuthUser, documentId: string): Promise<unknown> {
    return this.review(actor, documentId, DocumentReviewDecisionType.APPROVED);
  }

  observe(actor: AuthUser, documentId: string, comment: string): Promise<unknown> {
    return this.review(actor, documentId, DocumentReviewDecisionType.OBSERVED, comment);
  }

  annul(actor: AuthUser, documentId: string, comment: string): Promise<unknown> {
    return this.review(actor, documentId, DocumentReviewDecisionType.ANNULLED, comment);
  }

  async download(
    actor: AuthUser,
    versionId: string,
  ): Promise<{ content: Buffer; fileName: string }> {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: documentInclude }, fileAsset: true },
    });
    if (version === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Versión documental no encontrada');
    }
    this.assertAccess(actor, 'document:download', version.document);
    if (version.fileAsset === null) {
      throw new BusinessException(
        HttpStatus.CONFLICT,
        'La versión es un registro digital y no contiene un archivo descargable',
      );
    }
    const content = await this.storage.getObject(version.fileAsset.storageKey);
    await this.audit.recordAudit(
      this.auditEntry(actor, version.document, 'DOCUMENT_DOWNLOADED', {
        documentVersionId: version.id,
        sha256: version.fileAsset.sha256,
      }),
    );
    return { content, fileName: version.fileAsset.originalName };
  }

  private async review(
    actor: AuthUser,
    documentId: string,
    decision: DocumentReviewDecisionType,
    comment?: string,
  ): Promise<unknown> {
    const document = await this.getDocument(documentId);
    this.assertAccess(actor, 'document:review', document);
    const targetStatus = decision as unknown as DocumentStatus;
    if (document.status === targetStatus) {
      return this.toView(document);
    }
    if (document.status !== DocumentStatus.UNDER_REVIEW) {
      this.invalidTransition(document.status, [
        DocumentStatus.OBSERVED,
        DocumentStatus.APPROVED,
        DocumentStatus.ANNULLED,
      ]);
    }
    const current = this.currentVersion(document);
    await this.prisma.$transaction(async (tx) => {
      await tx.documentReview.create({
        data: {
          documentVersionId: current.id,
          reviewerId: actor.id,
          decision,
          comment,
        },
      });
      await tx.documentVersion.update({
        where: { id: current.id },
        data: { status: targetStatus },
      });
      await tx.document.update({ where: { id: document.id }, data: { status: targetStatus } });
      await this.audit.recordAudit(
        this.auditEntry(actor, document, `DOCUMENT_${decision}`, {
          version: current.version,
          comment,
        }),
        tx,
      );
    });
    return this.getView(document.id, actor);
  }

  private async getDocumentBySnapshot(
    practiceId: string,
    requirementSnapshotId: string,
  ): Promise<DocumentDetail> {
    const document = await this.prisma.document.findUnique({
      where: { requirementSnapshotId },
      include: documentInclude,
    });
    if (document?.requirementSnapshot.practiceId !== practiceId) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Requisito documental no encontrado');
    }
    return document;
  }

  private async getDocument(id: string): Promise<DocumentDetail> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: documentInclude,
    });
    if (document === null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, 'Documento no encontrado');
    }
    return document;
  }

  private async getView(id: string, actor: AuthUser): Promise<unknown> {
    const document = await this.getDocument(id);
    this.assertAccess(actor, 'document:read', document);
    return this.toView(document);
  }

  private assertReplacementAllowed(
    document: DocumentDetail,
    expectedKind: RequirementEvidenceKind,
  ): void {
    if (document.requirementSnapshot.evidenceKind !== expectedKind) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        `El requisito exige evidencia ${document.requirementSnapshot.evidenceKind}`,
      );
    }
    if (document.status !== DocumentStatus.PENDING && document.status !== DocumentStatus.OBSERVED) {
      this.invalidTransition(document.status, []);
    }
  }

  private currentVersion(document: DocumentDetail) {
    const version = document.versions.find((item) => item.version === document.currentVersion);
    if (version === undefined) {
      throw new BusinessException(
        HttpStatus.CONFLICT,
        'El documento aún no tiene una versión cargada',
      );
    }
    return version;
  }

  private assertAccess(actor: AuthUser, permission: Permission, document: DocumentDetail): void {
    const practice = document.requirementSnapshot.practice;
    this.scopePolicy.assertResourceAccess(actor, permission, {
      ownerId: practice.studentProfile.userId,
      campusId: practice.campusSchool.campusId,
      schoolId: practice.campusSchool.schoolId,
    });
  }

  private invalidTransition(status: DocumentStatus, allowedTransitions: DocumentStatus[]): never {
    throw new BusinessException(
      HttpStatus.CONFLICT,
      `Transición documental inválida desde ${status}`,
      { allowedTransitions },
    );
  }

  private toView(document: DocumentDetail): unknown {
    return {
      id: document.id,
      estado: document.status,
      versionActual: document.currentVersion,
      requisito: {
        id: document.requirementSnapshot.id,
        codigo: document.requirementSnapshot.code,
        nombre: document.requirementSnapshot.name,
        tipoEvidencia: document.requirementSnapshot.evidenceKind,
        obligatorio: document.requirementSnapshot.mandatory,
      },
      versiones: document.versions.map((version) => ({
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
    };
  }

  private auditEntry(
    actor: AuthUser,
    document: DocumentDetail,
    action: string,
    detail?: Record<string, unknown>,
  ) {
    return {
      actorId: actor.id,
      actorRole: actor.roles[0]?.role,
      campusId: document.requirementSnapshot.practice.campusSchool.campusId,
      action,
      entity: 'Document',
      entityId: document.id,
      result: 'SUCCESS',
      detail,
    };
  }
}
