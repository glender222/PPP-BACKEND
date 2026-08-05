export interface LetterNumberingPort {
  nextNumber(requestId: string): Promise<string>;
}

export const LETTER_NUMBERING = Symbol('LETTER_NUMBERING');
