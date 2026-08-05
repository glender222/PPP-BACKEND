import { Injectable } from '@nestjs/common';
import { LetterNumberingPort } from './letter-numbering.port';

@Injectable()
export class LocalLetterNumberingService implements LetterNumberingPort {
  nextNumber(requestId: string): Promise<string> {
    return Promise.resolve(`DEV-${requestId.replaceAll('-', '').slice(0, 8).toUpperCase()}`);
  }
}
