import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { PutObjectInput, StoragePort } from './storage.port';

@Injectable()
export class LocalStorageAdapter implements StoragePort {
  private readonly basePath = resolve(process.cwd(), 'data', 'uploads');

  async putObject(input: PutObjectInput): Promise<void> {
    const path = this.resolveKey(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body, { flag: 'wx' });
  }

  getObject(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  private resolveKey(key: string): string {
    const path = resolve(this.basePath, key);
    if (path !== this.basePath && !path.startsWith(`${this.basePath}${sep}`)) {
      throw new Error('Clave de almacenamiento inválida');
    }
    return path;
  }
}
