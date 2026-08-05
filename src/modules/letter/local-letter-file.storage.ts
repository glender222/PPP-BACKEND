import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { LetterFileStoragePort } from './letter-file-storage.port';

@Injectable()
export class LocalLetterFileStorage implements LetterFileStoragePort {
  private readonly basePath = resolve(process.cwd(), 'data', 'generated-letters');

  async store(fileName: string, content: Buffer): Promise<string> {
    await mkdir(this.basePath, { recursive: true });
    await writeFile(join(this.basePath, fileName), content);
    return fileName;
  }

  read(storagePath: string): Promise<Buffer> {
    return readFile(join(this.basePath, storagePath));
  }
}
