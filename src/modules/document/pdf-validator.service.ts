import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception';
import { TypedConfigService } from '../../config/typed-config.service';

export interface PdfUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class PdfValidatorService {
  constructor(private readonly config: TypedConfigService) {}

  validate(file: PdfUpload | undefined): PdfUpload {
    if (file === undefined || file.size === 0 || file.buffer.length === 0) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, 'El archivo PDF está vacío');
    }
    if (file.size > this.config.get('MAX_PDF_SIZE_BYTES')) {
      throw new BusinessException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'El archivo PDF supera el tamaño máximo',
      );
    }
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El archivo debe tener extensión .pdf',
      );
    }
    if (file.mimetype.toLowerCase() !== 'application/pdf') {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El MIME debe ser application/pdf',
      );
    }
    if (!file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El archivo no contiene una cabecera PDF válida',
      );
    }
    return file;
  }
}
