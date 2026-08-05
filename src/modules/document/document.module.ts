import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { PdfValidatorService } from './pdf-validator.service';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [DocumentController],
  providers: [DocumentService, PdfValidatorService],
})
export class DocumentModule {}
