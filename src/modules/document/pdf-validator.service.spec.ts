import { PdfValidatorService } from './pdf-validator.service';

describe('PdfValidatorService', () => {
  const service = new PdfValidatorService({
    get: () => 16,
  } as never);

  it('acepta un PDF técnico válido', () => {
    const file = {
      originalname: 'evidencia.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n'),
      size: 9,
    };
    expect(service.validate(file)).toBe(file);
  });

  it.each([
    [
      'extensión',
      {
        originalname: 'evidencia.txt',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-'),
        size: 5,
      },
    ],
    [
      'MIME',
      {
        originalname: 'evidencia.pdf',
        mimetype: 'text/plain',
        buffer: Buffer.from('%PDF-'),
        size: 5,
      },
    ],
    [
      'magic bytes',
      {
        originalname: 'evidencia.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('texto'),
        size: 5,
      },
    ],
    [
      'vacío',
      {
        originalname: 'evidencia.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(0),
        size: 0,
      },
    ],
    [
      'tamaño',
      {
        originalname: 'evidencia.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-123456789012'),
        size: 17,
      },
    ],
  ])('rechaza PDF por %s', (_reason, file) => {
    expect(() => service.validate(file)).toThrow();
  });
});
