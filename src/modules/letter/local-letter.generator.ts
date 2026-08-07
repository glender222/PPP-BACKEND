import { Injectable } from '@nestjs/common';
import { inflateSync, deflateSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  GeneratedLetterContent,
  LetterGeneratorInput,
  LetterGeneratorPort,
} from './letter-generator.port';

@Injectable()
export class LocalLetterGenerator implements LetterGeneratorPort {
  async generate(input: LetterGeneratorInput): Promise<GeneratedLetterContent> {
    const [positions, logo, signature, stamp] = await Promise.all([
      this.loadPositions(),
      readFile(this.assetPath('logo_upeu_ingenieria_sistemas.png')),
      readFile(this.assetPath('firma_directora.jpg')),
      readFile(this.assetPath('sello_directora.jpg')),
    ]);
    return {
      content: this.renderPdf(input, positions, logo, signature, stamp),
      mimeType: 'application/pdf',
    };
  }

  private renderPdf(
    input: LetterGeneratorInput,
    positions: LetterAssetPositions,
    logo: Buffer,
    signature: Buffer,
    stamp: Buffer,
  ): Buffer {
    const page = positions.page;
    const template = this.templateValues(input.template);
    const commands = [
      ...(input.preview ? [this.watermark(page)] : []),
      this.image('ImLogo', positions.assets['logo_upeu_ingenieria_sistemas.png'], page),
      ...(input.preview
        ? []
        : [
            this.image('ImSeal', this.moveDown(positions.assets['sello_directora.jpg'], 37), page),
            this.image(
              'ImSignature',
              this.moveDown(positions.assets['firma_directora.jpg'], 28),
              page,
            ),
          ]),
      this.centeredText(template.nationalYearPhrase, 112, 10, 'F2', page),
      this.text(
        `${template.dateLocation}, ${this.formatDate(input.issuedAt)}`,
        355,
        190,
        10,
        'F1',
        page,
      ),
      this.text(
        input.preview
          ? 'VISTA PREVIA - SIN VALIDEZ OFICIAL'
          : `Carta N° ${input.number ?? 'PENDIENTE'}/UPeU-FIA-INGENIERIA DE SISTEMAS-PPP`,
        35,
        272,
        11,
        'F2',
        page,
      ),
      this.text('Sr.', 35, 320, 11, 'F1', page),
      ...this.textBlock(
        [input.recipient, input.position, input.targetCompany],
        35,
        338,
        12,
        17,
        'F2',
        page,
      ),
      this.text('Presente. -', 35, 405, 11, 'F1', page),
      this.text('De mi especial consideración:', 35, 440, 11, 'F1', page),
      ...this.paragraph(
        'Es un placer saludarle y desearle nuestros mejores deseos de bienestar y prosperidad en su vida profesional como en su vida personal.',
        35,
        474,
        10,
        525,
        14,
        page,
      ),
      ...this.richParagraph(
        [
          { value: 'Es grato presentarle al estudiante ', font: 'F1' },
          { value: input.studentName, font: 'F2' },
          { value: ' con código de matrícula N° ', font: 'F1' },
          { value: input.studentCode, font: 'F2' },
          { value: ` del ${input.studentCycle ?? 'ciclo'} de la `, font: 'F1' },
          { value: 'E.P. Ingeniería de Sistemas', font: 'F2' },
          {
            value:
              ' de la Facultad de Ingeniería y Arquitectura de la Universidad Peruana Unión, quien viene gestionando una oportunidad para realizar sus prácticas Pre Profesionales, en el área de: ',
            font: 'F1',
          },
          { value: input.practiceArea, font: 'F2' },
          { value: ', de la distinguida entidad que usted representa.', font: 'F1' },
        ],
        35,
        530,
        10,
        525,
        14,
        page,
      ),
      ...this.paragraph(
        'Quedo muy agradecida por su gentil atención y por su apoyo que brinda a nuestros futuros profesionales.',
        35,
        620,
        10,
        525,
        14,
        page,
      ),
      this.text('Cordialmente,', 35, 652, 11, 'F1', page),
      ...(input.preview
        ? []
        : [
            this.centeredText(template.signerName, 754, 11, 'F1', page),
            this.centeredText(template.signerTitle, 772, 11, 'F2', page),
            this.centeredText(template.signerFaculty, 788, 10, 'F1', page),
          ]),
      this.centeredText(template.footer, 826, 7, 'F1', page),
    ];
    const content = Buffer.from(commands.join('\n'), 'latin1');
    const objects = [
      this.object('<< /Type /Catalog /Pages 2 0 R >>'),
      this.object('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      this.object(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width_pt} ${page.height_pt}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /ImLogo 7 0 R /ImSeal 8 0 R /ImSignature 9 0 R >> >> /Contents 6 0 R >>`,
      ),
      this.object(
        '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>',
      ),
      this.object(
        '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>',
      ),
      this.streamObject(`<< /Length ${content.length} >>`, content),
      this.pngObject(logo),
      this.jpegObject(stamp),
      this.jpegObject(signature),
    ];
    return this.assemblePdf(objects);
  }

  private async loadPositions(): Promise<LetterAssetPositions> {
    const source = await readFile(this.assetPath('posiciones_pdf.json'), 'utf8');
    return JSON.parse(source) as LetterAssetPositions;
  }

  private assetPath(fileName: string): string {
    return join(process.cwd(), 'carta_presentacion_assets', fileName);
  }

  private templateValues(template: Record<string, unknown>): TemplateValues {
    return {
      nationalYearPhrase: this.stringValue(
        template.nationalYearPhrase,
        'Universidad Peruana Unión',
      ),
      dateLocation: this.stringValue(template.dateLocation, 'UPeU'),
      signerName: this.stringValue(template.signerName, 'Dirección de Escuela'),
      signerTitle: this.stringValue(template.signerTitle, 'DIRECCIÓN E.P. INGENIERÍA DE SISTEMAS'),
      signerFaculty: this.stringValue(
        template.signerFaculty,
        'FACULTAD DE INGENIERÍA Y ARQUITECTURA',
      ),
      footer: this.stringValue(template.footer, 'Universidad Peruana Unión'),
    };
  }

  private stringValue(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() !== '' ? value : fallback;
  }

  private watermark(page: PdfPage): string {
    const text = 'B O R R A D O R';
    return [
      'q',
      '0.88 0.88 0.88 rg',
      'BT',
      '/F2 50 Tf',
      `0.7071 0.7071 -0.7071 0.7071 120 ${Math.round(page.height_pt / 2)} cm`,
      `(${this.escape(text)}) Tj`,
      'ET',
      'Q',
    ].join('\n');
  }

  private image(name: string, rectangle: PdfRectangle, page: PdfPage): string {
    return `q ${rectangle.width} 0 0 ${rectangle.height} ${rectangle.x} ${page.height_pt - rectangle.y - rectangle.height} cm /${name} Do Q`;
  }

  private moveDown(rectangle: PdfRectangle, distance: number): PdfRectangle {
    return { ...rectangle, y: rectangle.y + distance };
  }

  private text(
    value: string,
    x: number,
    top: number,
    size: number,
    font: 'F1' | 'F2',
    page: PdfPage,
  ): string {
    return `BT /${font} ${size} Tf 1 0 0 1 ${x} ${page.height_pt - top} Tm (${this.escape(value)}) Tj ET`;
  }

  private centeredText(
    value: string,
    top: number,
    size: number,
    font: 'F1' | 'F2',
    page: PdfPage,
  ): string {
    const estimatedWidth = value.length * size * (font === 'F2' ? 0.55 : 0.5);
    return this.text(
      value,
      Math.max(25, (page.width_pt - estimatedWidth) / 2),
      top,
      size,
      font,
      page,
    );
  }

  private textBlock(
    lines: string[],
    x: number,
    top: number,
    size: number,
    lineHeight: number,
    font: 'F1' | 'F2',
    page: PdfPage,
  ): string[] {
    return lines.map((line, index) =>
      this.text(line, x, top + index * lineHeight, size, font, page),
    );
  }

  private paragraph(
    value: string,
    x: number,
    top: number,
    size: number,
    width: number,
    lineHeight: number,
    page: PdfPage,
  ): string[] {
    const charactersPerLine = Math.floor(width / (size * 0.48));
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (candidate.length > charactersPerLine && line !== '') {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line !== '') {
      lines.push(line);
    }
    return this.textBlock(lines, x, top, size, lineHeight, 'F1', page);
  }

  private richParagraph(
    segments: { value: string; font: 'F1' | 'F2' }[],
    x: number,
    top: number,
    size: number,
    width: number,
    lineHeight: number,
    page: PdfPage,
  ): string[] {
    const lines: { value: string; font: 'F1' | 'F2' }[][] = [];
    let line: { value: string; font: 'F1' | 'F2' }[] = [];
    let lineWidth = 0;
    for (const segment of segments) {
      for (const word of segment.value.match(/\S+/g) ?? []) {
        const value = line.length === 0 || /^[,.;:!?)]/.test(word) ? word : ` ${word}`;
        const tokenWidth = value.length * size * (segment.font === 'F2' ? 0.55 : 0.48);
        if (lineWidth + tokenWidth > width && line.length > 0) {
          lines.push(line);
          line = [];
          lineWidth = 0;
        }
        line.push({ value, font: segment.font });
        lineWidth += tokenWidth;
      }
    }
    if (line.length > 0) {
      lines.push(line);
    }
    return lines.map((parts, lineIndex) => {
      const commands = parts.map(
        (part) => `/${part.font} ${size} Tf (${this.escape(part.value)}) Tj`,
      );
      return `BT 1 0 0 1 ${x} ${page.height_pt - top - lineIndex * lineHeight} Tm ${commands.join(' ')} ET`;
    });
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    const months = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'setiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    return `${date.getUTCDate()} de ${months[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
  }

  private escape(value: string): string {
    return value.replace(/[\\()\r\n]/g, (character) =>
      character === '\n' || character === '\r' ? ' ' : `\\${character}`,
    );
  }

  private object(dictionary: string): Buffer {
    return Buffer.from(dictionary, 'ascii');
  }

  private streamObject(dictionary: string, stream: Buffer): Buffer {
    return Buffer.concat([
      Buffer.from(`${dictionary}\nstream\n`, 'ascii'),
      stream,
      Buffer.from('\nendstream', 'ascii'),
    ]);
  }

  private jpegObject(source: Buffer): Buffer {
    const { width, height } = this.jpegDimensions(source);
    return this.streamObject(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${source.length} >>`,
      source,
    );
  }

  private pngObject(source: Buffer): Buffer {
    const image = this.decodePng(source);
    const compressed = deflateSync(image.rgb);
    return this.streamObject(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>`,
      compressed,
    );
  }

  private jpegDimensions(source: Buffer): { width: number; height: number } {
    for (let offset = 2; offset < source.length - 9;) {
      if (source[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = source[offset + 1]!;
      const length = source.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        return { height: source.readUInt16BE(offset + 5), width: source.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
    throw new Error('No se pudieron leer las dimensiones de un asset JPG de la carta');
  }

  private decodePng(source: Buffer): { width: number; height: number; rgb: Buffer } {
    const width = source.readUInt32BE(16);
    const height = source.readUInt32BE(20);
    const bitDepth = source[24];
    const colorType = source[25];
    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
      throw new Error('El logo de la carta debe ser PNG RGB o RGBA de 8 bits');
    }
    const chunks: Buffer[] = [];
    for (let offset = 8; offset < source.length;) {
      const length = source.readUInt32BE(offset);
      const type = source.subarray(offset + 4, offset + 8).toString('ascii');
      if (type === 'IDAT') {
        chunks.push(source.subarray(offset + 8, offset + 8 + length));
      }
      offset += length + 12;
    }
    const channels = colorType === 6 ? 4 : 3;
    const inflated = inflateSync(Buffer.concat(chunks));
    const decoded = Buffer.alloc(width * height * channels);
    let sourceOffset = 0;
    for (let row = 0; row < height; row += 1) {
      const filter = inflated[sourceOffset++]!;
      for (let column = 0; column < width * channels; column += 1) {
        const raw = inflated[sourceOffset++]!;
        const index = row * width * channels + column;
        const left = column >= channels ? decoded[index - channels]! : 0;
        const up = row > 0 ? decoded[index - width * channels]! : 0;
        const upLeft =
          row > 0 && column >= channels ? decoded[index - width * channels - channels]! : 0;
        decoded[index] = this.unfilter(filter, raw, left, up, upLeft);
      }
    }
    const rgb = Buffer.alloc(width * height * 3);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const sourceIndex = pixel * channels;
      const targetIndex = pixel * 3;
      if (channels === 4) {
        const alpha = decoded[sourceIndex + 3]! / 255;
        rgb[targetIndex] = Math.round(decoded[sourceIndex]! * alpha + 255 * (1 - alpha));
        rgb[targetIndex + 1] = Math.round(decoded[sourceIndex + 1]! * alpha + 255 * (1 - alpha));
        rgb[targetIndex + 2] = Math.round(decoded[sourceIndex + 2]! * alpha + 255 * (1 - alpha));
      } else {
        const [red, green, blue] = [
          decoded[sourceIndex]!,
          decoded[sourceIndex + 1]!,
          decoded[sourceIndex + 2]!,
        ];
        // The supplied logo uses black RGB pixels for its transparent canvas.
        if (red < 15 && green < 15 && blue < 15) {
          rgb[targetIndex] = 255;
          rgb[targetIndex + 1] = 255;
          rgb[targetIndex + 2] = 255;
        } else {
          rgb[targetIndex] = red;
          rgb[targetIndex + 1] = green;
          rgb[targetIndex + 2] = blue;
        }
      }
    }
    return { width, height, rgb };
  }

  private unfilter(filter: number, raw: number, left: number, up: number, upLeft: number): number {
    switch (filter) {
      case 0:
        return raw;
      case 1:
        return (raw + left) & 0xff;
      case 2:
        return (raw + up) & 0xff;
      case 3:
        return (raw + Math.floor((left + up) / 2)) & 0xff;
      case 4: {
        const estimate = left + up - upLeft;
        const nearest = [left, up, upLeft].reduce((selected, candidate) =>
          Math.abs(candidate - estimate) < Math.abs(selected - estimate) ? candidate : selected,
        );
        return (raw + nearest) & 0xff;
      }
      default:
        throw new Error('El logo PNG usa un filtro no soportado');
    }
  }

  private assemblePdf(objects: Buffer[]): Buffer {
    const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'ascii')];
    const offsets: number[] = [0];
    let length = chunks[0]!.length;
    objects.forEach((object, index) => {
      const wrapped = Buffer.concat([
        Buffer.from(`${index + 1} 0 obj\n`, 'ascii'),
        object,
        Buffer.from('\nendobj\n', 'ascii'),
      ]);
      offsets.push(length);
      chunks.push(wrapped);
      length += wrapped.length;
    });
    const xref = [
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
      ...offsets.slice(1).map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`),
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
    ].join('');
    chunks.push(Buffer.from(xref, 'ascii'));
    return Buffer.concat(chunks);
  }
}

interface PdfPage {
  width_pt: number;
  height_pt: number;
}

interface PdfRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LetterAssetPositions {
  page: PdfPage;
  assets: {
    'logo_upeu_ingenieria_sistemas.png': PdfRectangle;
    'firma_directora.jpg': PdfRectangle;
    'sello_directora.jpg': PdfRectangle;
  };
}

interface TemplateValues {
  nationalYearPhrase: string;
  dateLocation: string;
  signerName: string;
  signerTitle: string;
  signerFaculty: string;
  footer: string;
}
