import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LETTER_FILE_STORAGE } from './letter-file-storage.port';
import { LocalLetterFileStorage } from './local-letter-file.storage';
import { LETTER_GENERATOR } from './letter-generator.port';
import { LocalLetterGenerator } from './local-letter.generator';
import { LETTER_NUMBERING } from './letter-numbering.port';
import { LocalLetterNumberingService } from './local-letter-numbering.service';
import { LetterController } from './letter.controller';
import { LetterService } from './letter.service';

@Module({
  imports: [AuditModule],
  controllers: [LetterController],
  providers: [
    LetterService,
    LocalLetterGenerator,
    LocalLetterFileStorage,
    LocalLetterNumberingService,
    { provide: LETTER_GENERATOR, useExisting: LocalLetterGenerator },
    { provide: LETTER_FILE_STORAGE, useExisting: LocalLetterFileStorage },
    { provide: LETTER_NUMBERING, useExisting: LocalLetterNumberingService },
  ],
})
export class LetterModule {}
