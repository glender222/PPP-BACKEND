import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { BusinessException } from '../exceptions/business.exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface MockHttp {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
  setHeader: jest.Mock;
}

function createMockHttp(): MockHttp {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const response = { json, status, setHeader } as unknown as Response;
  const request = { headers: {} } as Request;
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  return { host, json, status, setHeader };
}

function createFilter(isProduction = false): { filter: AllExceptionsFilter; logger: Logger } {
  const logger = { error: jest.fn() } as unknown as Logger;
  return { filter: new AllExceptionsFilter(logger, isProduction), logger };
}

describe('AllExceptionsFilter', () => {
  it('envuelve HttpException en el envelope estándar', () => {
    const { host, status, json } = createMockHttp();
    const { filter } = createFilter();

    filter.catch(new HttpException('Mensaje de prueba', HttpStatus.NOT_FOUND), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Mensaje de prueba',
    });
  });

  it('incluye details y allowedTransitions en BusinessException', () => {
    const { host, json } = createMockHttp();
    const { filter } = createFilter();

    filter.catch(
      new BusinessException(HttpStatus.CONFLICT, 'Transición inválida desde el estado actual', {
        details: { estadoActual: 'EN_PREPARACION' },
        allowedTransitions: ['cancel'],
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'Transición inválida desde el estado actual',
      details: { estadoActual: 'EN_PREPARACION' },
      allowedTransitions: ['cancel'],
    });
  });

  it('preserva details de errores de validación', () => {
    const { host, status, json } = createMockHttp();
    const { filter } = createFilter();

    filter.catch(
      new BadRequestException({
        message: 'Validación fallida',
        details: [{ property: 'nombre' }],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validación fallida',
        details: [{ property: 'nombre' }],
      }),
    );
  });

  it('normaliza mensajes de validación con arreglos', () => {
    const { host, json } = createMockHttp();
    const { filter } = createFilter();

    filter.catch(new BadRequestException(['error uno', 'error dos']), host);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'error uno; error dos' }));
  });

  it('oculta el mensaje interno en producción para errores no HTTP', () => {
    const { host, status, json } = createMockHttp();
    const { filter } = createFilter(true);

    filter.catch(new Error('detalle interno'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Error interno del servidor',
      }),
    );
  });

  it('expone el mensaje interno fuera de producción', () => {
    const { host, json } = createMockHttp();
    const { filter } = createFilter(false);

    filter.catch(new Error('detalle interno'), host);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'detalle interno' }));
  });

  it('establece x-request-id en la respuesta', () => {
    const { host, setHeader } = createMockHttp();
    const { filter } = createFilter();

    filter.catch(new HttpException('ups', HttpStatus.BAD_REQUEST), host);

    expect(setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
  });
});
