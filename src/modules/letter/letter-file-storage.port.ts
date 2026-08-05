export interface LetterFileStoragePort {
  store(fileName: string, content: Buffer): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
}

export const LETTER_FILE_STORAGE = Symbol('LETTER_FILE_STORAGE');
