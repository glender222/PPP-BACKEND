import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/modules/prisma/prisma.service';

interface LoginResponse {
  accessToken: string;
}

interface LetterResponse {
  id: string;
  estado: string;
  revisiones: { version: number; decisiones: { decision: string; comment: string | null }[] }[];
  historial: { hacia: string }[];
  archivoFinal: { mimeType: string; size: number } | null;
}

const DEV_PASSWORD_FALLBACK = 'PppDev!2026';

describe('Carta de presentacion (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let devPassword: string;
  let studentJuliacaToken: string;
  let secondStudentJuliacaToken: string;
  let studentLimaToken: string;
  let secretaryJuliacaToken: string;

  async function loginAs(email: string): Promise<string> {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: devPassword })
      .expect(200);
    return (response.body as LoginResponse).accessToken;
  }

  function bearer(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  function letterPayload(suffix: string) {
    return {
      destinatario: `Gerencia ${suffix}`,
      cargo: 'Gerente de Recursos Humanos',
      empresaObjetivo: `Empresa ${suffix}`,
      areaPractica: 'Desarrollo de software',
      datosPlantilla: { referencia: suffix },
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    devPassword = process.env.DEV_AUTH_PASSWORD ?? DEV_PASSWORD_FALLBACK;
    [studentJuliacaToken, secondStudentJuliacaToken, studentLimaToken, secretaryJuliacaToken] =
      await Promise.all([
        loginAs('student.juliaca@upeu.edu.pe'),
        loginAs('student.juliaca2@upeu.edu.pe'),
        loginAs('student.lima@upeu.edu.pe'),
        loginAs('secretary.juliaca@upeu.edu.pe'),
      ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('recorre crear, enviar, observar, corregir, reenviar, aprobar y descargar', async () => {
    const suffix = `E2E-${Date.now()}`;
    const created = await request(server)
      .post('/api/v1/letters')
      .set(bearer(studentJuliacaToken))
      .send(letterPayload(suffix))
      .expect(201);
    const letterId = (created.body as LetterResponse).id;
    expect((created.body as LetterResponse).estado).toBe('DRAFT');

    await request(server)
      .put(`/api/v1/letters/${letterId}`)
      .set(bearer(studentJuliacaToken))
      .send({ cargo: 'Jefa de Recursos Humanos' })
      .expect(200);

    const preview = await request(server)
      .get(`/api/v1/letters/${letterId}/preview`)
      .set(bearer(studentJuliacaToken))
      .expect(200);
    expect(preview.headers['content-type']).toContain('application/pdf');

    await request(server)
      .get(`/api/v1/letters/${letterId}/download`)
      .set(bearer(studentJuliacaToken))
      .expect(409);

    const submitted = await request(server)
      .post(`/api/v1/letters/${letterId}/submit`)
      .set(bearer(studentJuliacaToken))
      .expect(200);
    expect((submitted.body as LetterResponse).estado).toBe('SUBMITTED');
    expect((submitted.body as LetterResponse).revisiones).toHaveLength(1);

    await request(server)
      .post(`/api/v1/letters/${letterId}/submit`)
      .set(bearer(studentJuliacaToken))
      .expect(200);

    const queue = await request(server)
      .get('/api/v1/secretary/letters?estado=SUBMITTED')
      .set(bearer(secretaryJuliacaToken))
      .expect(200);
    expect((queue.body as LetterResponse[]).map((letter) => letter.id)).toContain(letterId);

    const observed = await request(server)
      .post(`/api/v1/secretary/letters/${letterId}/observe`)
      .set(bearer(secretaryJuliacaToken))
      .send({ comentario: 'Precisa el cargo de la persona destinataria.' })
      .expect(200);
    expect((observed.body as LetterResponse).estado).toBe('OBSERVED');

    await request(server)
      .put(`/api/v1/letters/${letterId}`)
      .set(bearer(studentJuliacaToken))
      .send({ cargo: 'Gerente de Recursos Humanos' })
      .expect(200);

    const resubmitted = await request(server)
      .post(`/api/v1/letters/${letterId}/resubmit`)
      .set(bearer(studentJuliacaToken))
      .send({})
      .expect(200);
    expect((resubmitted.body as LetterResponse).estado).toBe('RESUBMITTED');
    expect((resubmitted.body as LetterResponse).revisiones).toHaveLength(2);

    const approved = await request(server)
      .post(`/api/v1/secretary/letters/${letterId}/approve`)
      .set(bearer(secretaryJuliacaToken))
      .expect(201);
    const approvedBody = approved.body as LetterResponse;
    expect(approvedBody.estado).toBe('APPROVED');
    expect(approvedBody.archivoFinal).toEqual(
      expect.objectContaining({ mimeType: 'application/pdf', size: expect.any(Number) as number }),
    );

    await request(server)
      .post(`/api/v1/secretary/letters/${letterId}/approve`)
      .set(bearer(secretaryJuliacaToken))
      .expect(201);

    const history = await request(server)
      .get(`/api/v1/letters/${letterId}/history`)
      .set(bearer(studentJuliacaToken))
      .expect(200);
    const historyBody = history.body as LetterResponse;
    expect(historyBody.historial.map((entry) => entry.hacia)).toEqual([
      'DRAFT',
      'SUBMITTED',
      'OBSERVED',
      'RESUBMITTED',
      'APPROVED',
    ]);
    expect(historyBody.revisiones[0]!.decisiones[0]).toMatchObject({
      decision: 'OBSERVED',
      comment: 'Precisa el cargo de la persona destinataria.',
    });

    const prisma = app.get(PrismaService);
    const auditActions = await prisma.auditEvent.findMany({
      where: { entity: 'LetterRequest', entityId: letterId },
      select: { action: true },
    });
    expect(auditActions.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'LETTER_SUBMITTED',
        'LETTER_OBSERVED',
        'LETTER_RESUBMITTED',
        'LETTER_APPROVED',
      ]),
    );
    expect(auditActions.filter((event) => event.action === 'LETTER_APPROVED')).toHaveLength(1);
    const notifications = await prisma.notification.findMany({
      where: { link: `/letters/${letterId}` },
      select: { type: true },
    });
    expect(notifications.map((notification) => notification.type)).toEqual(
      expect.arrayContaining(['LETTER_PENDING_REVIEW', 'LETTER_OBSERVED', 'LETTER_APPROVED']),
    );

    const downloaded = await request(server)
      .get(`/api/v1/letters/${letterId}/download`)
      .set(bearer(studentJuliacaToken))
      .expect(200);
    expect(downloaded.headers['content-type']).toContain('application/pdf');
    const downloadedContent = downloaded.body as Buffer;
    const pdfSource = downloadedContent.toString('latin1');
    expect(downloadedContent.slice(0, 4).toString()).toBe('%PDF');
    expect(pdfSource).toContain('/ImLogo');

    await request(server)
      .get(`/api/v1/letters/${letterId}/download`)
      .set(bearer(secondStudentJuliacaToken))
      .expect(403);
  });

  it('aisla cartas y archivos de otro campus', async () => {
    const created = await request(server)
      .post('/api/v1/letters')
      .set(bearer(studentLimaToken))
      .send(letterPayload(`LIMA-${Date.now()}`))
      .expect(201);
    const letterId = (created.body as LetterResponse).id;

    await request(server)
      .post(`/api/v1/letters/${letterId}/submit`)
      .set(bearer(studentLimaToken))
      .expect(200);

    const queue = await request(server)
      .get('/api/v1/secretary/letters')
      .set(bearer(secretaryJuliacaToken))
      .expect(200);
    expect((queue.body as LetterResponse[]).map((letter) => letter.id)).not.toContain(letterId);

    await request(server)
      .get(`/api/v1/letters/${letterId}`)
      .set(bearer(secretaryJuliacaToken))
      .expect(403);
    await request(server)
      .post(`/api/v1/secretary/letters/${letterId}/observe`)
      .set(bearer(secretaryJuliacaToken))
      .send({ comentario: 'No corresponde a mi campus.' })
      .expect(403);
  });

interface SignatureConfigResponse {
  signerName: string;
  signerTitle: string;
  active: boolean;
}

  it('gestiona la configuracion de firma exclusivamente para la Secretaria del campus', async () => {
    // 1. Obtener la configuracion inicial de la Secretaria de Juliaca
    const initialConfig = await request(server)
      .get('/api/v1/secretary/signature-config')
      .set(bearer(secretaryJuliacaToken))
      .expect(200);

    const initialBody = initialConfig.body as SignatureConfigResponse;
    expect(initialConfig.body).toHaveProperty('signerName');
    expect(initialConfig.body).toHaveProperty('signerTitle');
    expect(initialBody.active).toBe(true);

    // 2. Actualizar la configuracion de firma por la Secretaria de Juliaca
    const updated = await request(server)
      .put('/api/v1/secretary/signature-config')
      .set(bearer(secretaryJuliacaToken))
      .send({
        signerName: 'Dr. Carlos Eduardo Mendez Ruiz',
        signerTitle: 'Director de Carrera - Ingenieria de Sistemas',
        active: true,
      })
      .expect(200);

    const updatedBody = updated.body as SignatureConfigResponse;
    expect(updatedBody.signerName).toBe('Dr. Carlos Eduardo Mendez Ruiz');
    expect(updatedBody.signerTitle).toBe('Director de Carrera - Ingenieria de Sistemas');

    // 3. Estudiante intenta acceder o actualizar y recibe 403 Forbidden
    await request(server)
      .get('/api/v1/secretary/signature-config')
      .set(bearer(studentJuliacaToken))
      .expect(403);

    await request(server)
      .put('/api/v1/secretary/signature-config')
      .set(bearer(studentJuliacaToken))
      .send({
        signerName: 'Nombre Invalido',
        signerTitle: 'Cargo Invalido',
      })
      .expect(403);
  });
});

