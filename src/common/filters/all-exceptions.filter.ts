import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { STATUS_CODES } from 'node:http';
import { Logger } from 'nestjs-pino';

interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  allowedTransitions?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
  status: HttpStatus;
  message: string;
} {
  switch (error.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        message: 'Ya existe un registro con los mismos datos únicos',
      };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Recurso no encontrado' };
    case 'P2003':
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Referencia inválida a un recurso relacionado',
      };
    default:
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor' };
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Logger,
    private readonly isProduction: boolean,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let details: unknown;
    let allowedTransitions: string[] | undefined;
    let shouldLog = true;

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (isRecord(payload)) {
        const rawMessage = payload.message;
        if (Array.isArray(rawMessage)) {
          message = rawMessage.join('; ');
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }
        details = payload.details;
        allowedTransitions = isStringArray(payload.allowedTransitions)
          ? payload.allowedTransitions
          : undefined;
      }
      status = exception.getStatus();
      shouldLog = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapping = mapPrismaError(exception);
      status = mapping.status;
      message = mapping.message;
      details = { code: exception.code, meta: exception.meta };
    } else {
      message = this.isProduction
        ? 'Error interno del servidor'
        : exception instanceof Error
          ? exception.message
          : String(exception);
    }

    const requestId = request.headers['x-request-id'] ?? randomUUID();
    response.setHeader('x-request-id', requestId);

    if (shouldLog) {
      this.logger.error({ err: exception, requestId }, 'Excepción no controlada');
    }
    const envelope: ErrorEnvelope = {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
    };
    if (details !== undefined) {
      envelope.details = details;
    }
    if (allowedTransitions !== undefined) {
      envelope.allowedTransitions = allowedTransitions;
    }

    response.status(status).json(envelope);
  }
}
