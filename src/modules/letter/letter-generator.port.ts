export interface LetterGeneratorInput {
  requestId: string;
  number?: string;
  issuedAt: string;
  recipient: string;
  position: string;
  targetCompany: string;
  practiceArea: string;
  studentName: string;
  studentCode: string;
  studentCycle: string | null;
  templateData: Record<string, unknown>;
  template: Record<string, unknown>;
  preview: boolean;
}

export interface GeneratedLetterContent {
  content: Buffer;
  mimeType: 'application/pdf';
}

export interface LetterGeneratorPort {
  generate(input: LetterGeneratorInput): Promise<GeneratedLetterContent>;
}

export const LETTER_GENERATOR = Symbol('LETTER_GENERATOR');
