import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('ejecuta el chequeo de salud a través de Terminus', async () => {
    const check = jest.fn().mockResolvedValue({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });
    const health = { check } as unknown as HealthCheckService;
    const prismaIndicator = {} as unknown as PrismaHealthIndicator;
    const prisma = {} as unknown as PrismaService;
    const controller = new HealthController(health, prismaIndicator, prisma);

    await expect(controller.check()).resolves.toEqual(expect.objectContaining({ status: 'ok' }));
    expect(check).toHaveBeenCalledTimes(1);
  });
});
