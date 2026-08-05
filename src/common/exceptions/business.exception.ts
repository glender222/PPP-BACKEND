import { HttpException } from '@nestjs/common';

export interface BusinessExceptionOptions {
  error?: string;
  details?: unknown;
  allowedTransitions?: string[];
}

export class BusinessException extends HttpException {
  constructor(status: number, message: string, options: BusinessExceptionOptions = {}) {
    const response: Record<string, unknown> = {
      message,
      ...(options.error !== undefined && { error: options.error }),
      ...(options.details !== undefined && { details: options.details }),
      ...(options.allowedTransitions !== undefined && {
        allowedTransitions: options.allowedTransitions,
      }),
    };
    super(response, status);
  }
}
