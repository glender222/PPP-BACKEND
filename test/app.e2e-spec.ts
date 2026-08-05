import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

interface HealthBody {
  status: string;
  info: { database: { status: string } };
}

describe('App (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('responde 200 con estado ok y la base de datos arriba', async () => {
      const res = await request(server).get('/api/v1/health').expect(200);
      const body = res.body as HealthBody;
      expect(body.status).toBe('ok');
      expect(body.info.database.status).toBe('up');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('rutas inexistentes', () => {
    it('devuelve el envelope estándar 404', async () => {
      const res = await request(server).get('/api/v1/no-existe').expect(404);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 404,
          error: 'Not Found',
          message: expect.any(String) as string,
        }),
      );
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('documentación interactiva', () => {
    it('sirve Scalar/OpenAPI en /api/docs', async () => {
      await request(server).get('/api/docs').expect(200);
    });
  });
});
