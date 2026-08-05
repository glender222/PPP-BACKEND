import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import type { AuthUser } from '../../common/authorization/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceAccess } from '../auth/decorators/resource-access.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DocumentService } from './document.service';
import {
  AnnulDocumentDto,
  ObserveDocumentDto,
  UploadDigitalDocumentDto,
  UploadDocumentDto,
} from './dto/document.dto';
import type { PdfUpload } from './pdf-validator.service';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller()
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get('practices/:id/documents')
  @Roles(Role.STUDENT, Role.COORDINATOR, Role.SUPERVISOR, Role.AUDITOR)
  @RequirePermission('document:read')
  @ResourceAccess({ permission: 'document:read', mode: 'load', resourceType: 'Practice' })
  list(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) practiceId: string,
  ): Promise<unknown[]> {
    return this.documents.listForPractice(actor, practiceId);
  }

  @Post('practices/:id/documents')
  @Roles(Role.STUDENT)
  @RequirePermission('document:write')
  @ResourceAccess({ permission: 'document:write', mode: 'load', resourceType: 'Practice' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['requirementSnapshotId', 'file'],
      properties: {
        requirementSnapshotId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  upload(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) practiceId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: PdfUpload | undefined,
  ): Promise<unknown> {
    return this.documents.uploadPdf(actor, practiceId, dto.requirementSnapshotId, file);
  }

  @Post('practices/:id/documents/digital')
  @Roles(Role.STUDENT)
  @RequirePermission('document:write')
  @ResourceAccess({ permission: 'document:write', mode: 'load', resourceType: 'Practice' })
  uploadDigital(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) practiceId: string,
    @Body() dto: UploadDigitalDocumentDto,
  ): Promise<unknown> {
    return this.documents.uploadDigital(actor, practiceId, dto);
  }

  @Post('documents/:id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.STUDENT)
  @RequirePermission('document:write')
  @ResourceAccess({ permission: 'document:write', mode: 'load', resourceType: 'Document' })
  submit(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.documents.submit(actor, id);
  }

  @Get('documents/:id/versions')
  @Roles(Role.STUDENT, Role.COORDINATOR, Role.SUPERVISOR, Role.AUDITOR)
  @RequirePermission('document:read')
  @ResourceAccess({ permission: 'document:read', mode: 'load', resourceType: 'Document' })
  versions(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.documents.versions(actor, id);
  }

  @Post('coordinator/documents/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COORDINATOR)
  @RequirePermission('document:review')
  @ResourceAccess({ permission: 'document:review', mode: 'load', resourceType: 'Document' })
  approve(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.documents.approve(actor, id);
  }

  @Post('coordinator/documents/:id/observe')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COORDINATOR)
  @RequirePermission('document:review')
  @ResourceAccess({ permission: 'document:review', mode: 'load', resourceType: 'Document' })
  observe(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ObserveDocumentDto,
  ): Promise<unknown> {
    return this.documents.observe(actor, id, dto.comentario);
  }

  @Post('coordinator/documents/:id/annul')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COORDINATOR)
  @RequirePermission('document:review')
  @ResourceAccess({ permission: 'document:review', mode: 'load', resourceType: 'Document' })
  annul(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnnulDocumentDto,
  ): Promise<unknown> {
    return this.documents.annul(actor, id, dto.motivo);
  }

  @Get('documents/versions/:versionId/download')
  @Roles(Role.STUDENT, Role.COORDINATOR, Role.SUPERVISOR, Role.AUDITOR)
  @RequirePermission('document:download')
  @ResourceAccess({
    permission: 'document:download',
    mode: 'load',
    resourceType: 'DocumentVersion',
    idParam: 'versionId',
  })
  async download(
    @CurrentUser() actor: AuthUser,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.documents.download(actor, versionId);
    const safeName = file.fileName.replace(/["\r\n]/g, '_');
    response
      .type('application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
      .send(file.content);
  }
}
