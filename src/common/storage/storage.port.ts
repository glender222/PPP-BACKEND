export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StoragePort {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(key: string): Promise<Buffer>;
}
