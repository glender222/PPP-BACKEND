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

interface CompanyResponse {
  id: string;
  razonSocial: string;
  representantes: { id: string }[];
}

interface DocumentView {
  id: string;
  estado: string;
  versionActual: number;
  requisito: { id: string; tipoEvidencia: 'PDF' | 'DIGITAL_RECORD' };
  versiones: { id: string; version: number; estado: string }[];
}

interface RequirementView {
  id: string;
  tipoEvidencia: 'PDF' | 'DIGITAL_RECORD';
  documento: DocumentView;
}

interface PracticeResponse {
  id: string;
  estado: string;
  version: number;
  empresa: { id: string };
  requisitos: RequirementView[];
}

const DEV_PASSWORD_FALLBACK = 'PppDev!2026';

describe('Empresas, prácticas y documentos (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let studentToken: string;
  let otherStudentToken: string;
  let coordinatorJuliacaToken: string;
  let coordinatorLimaToken: string;
  let periodId: string;

  function bearer(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  async function login(email: string): Promise<string> {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: process.env.DEV_AUTH_PASSWORD ?? DEV_PASSWORD_FALLBACK })
      .expect(200);
    return (response.body as LoginResponse).accessToken;
  }

  async function createCompany(token: string, suffix: string): Promise<CompanyResponse> {
    const response = await request(server)
      .post('/api/v1/companies')
      .set(bearer(token))
      .send({
        ruc: `${Date.now()}${suffix}`,
        razonSocial: `Empresa E2E ${suffix}`,
        direccion: 'Jr. Pruebas 123',
        contacto: 'contacto@empresa.test',
        area: 'Tecnología',
        esExtranjera: false,
        representante: {
          nombre: `Representante ${suffix}`,
          cargo: 'Gerencia',
          correo: 'representante@empresa.test',
        },
      })
      .expect(201);
    return response.body as CompanyResponse;
  }

  async function createPractice(
    company: CompanyResponse,
    suffix: string,
  ): Promise<PracticeResponse> {
    const response = await request(server)
      .post('/api/v1/practices')
      .set(bearer(studentToken))
      .send({
        companyId: company.id,
        companyRepresentativeId: company.representantes[0]!.id,
        academicPeriodId: periodId,
        areaCargo: `Desarrollo ${suffix}`,
        fechaInicio: '2026-02-01T00:00:00.000Z',
        fechaFin: '2026-06-30T00:00:00.000Z',
        horario: '08:00-14:00',
        modalidad: 'PRESENCIAL',
      })
      .expect(201);
    return response.body as PracticeResponse;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    [studentToken, otherStudentToken, coordinatorJuliacaToken, coordinatorLimaToken] =
      await Promise.all([
        login('student.juliaca@upeu.edu.pe'),
        login('student.juliaca2@upeu.edu.pe'),
        login('coordinator.juliaca@upeu.edu.pe'),
        login('coordinator.lima@upeu.edu.pe'),
      ]);
    const campus = await prisma.campus.findUniqueOrThrow({ where: { code: 'JULIACA' } });
    const period = await prisma.academicPeriod.findUniqueOrThrow({
      where: { campusId_name: { campusId: campus.id, name: '2026-I' } },
    });
    periodId = period.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('conserva prácticas independientes al usar otra empresa', async () => {
    const suffix = `${Date.now()}`;
    const firstCompany = await createCompany(studentToken, `${suffix}-A`);
    const secondCompany = await createCompany(studentToken, `${suffix}-B`);
    const firstPractice = await createPractice(firstCompany, 'A');
    const secondPractice = await createPractice(secondCompany, 'B');

    expect(firstPractice.id).not.toBe(secondPractice.id);
    expect(firstPractice.empresa.id).toBe(firstCompany.id);
    expect(secondPractice.empresa.id).toBe(secondCompany.id);

    const persistedFirst = await request(server)
      .get(`/api/v1/practices/${firstPractice.id}`)
      .set(bearer(studentToken))
      .expect(200);
    expect((persistedFirst.body as PracticeResponse).empresa.id).toBe(firstCompany.id);

    await request(server)
      .get(`/api/v1/practices/${firstPractice.id}`)
      .set(bearer(otherStudentToken))
      .expect(403);
    await request(server)
      .get(`/api/v1/practices/${firstPractice.id}`)
      .set(bearer(coordinatorLimaToken))
      .expect(403);
  });

  it('versiona, observa, aprueba y habilita autorización y activación', async () => {
    const company = await createCompany(studentToken, `${Date.now()}-FLOW`);
    const practice = await createPractice(company, 'FLOW');

    await request(server)
      .post(`/api/v1/practices/${practice.id}/authorize`)
      .set(bearer(coordinatorJuliacaToken))
      .expect(409);

    const pdfRequirements = practice.requisitos.filter(
      (requirement) => requirement.tipoEvidencia === 'PDF',
    );
    const digitalRequirement = practice.requisitos.find(
      (requirement) => requirement.tipoEvidencia === 'DIGITAL_RECORD',
    )!;
    expect(pdfRequirements).toHaveLength(3);

    await request(server)
      .post(`/api/v1/practices/${practice.id}/documents`)
      .set(bearer(studentToken))
      .field('requirementSnapshotId', pdfRequirements[0]!.id)
      .attach('file', Buffer.from('not-a-pdf'), {
        filename: 'invalido.pdf',
        contentType: 'application/pdf',
      })
      .expect(422);

    const uploadedDocuments: DocumentView[] = [];
    for (const [index, requirement] of pdfRequirements.entries()) {
      const uploaded = await request(server)
        .post(`/api/v1/practices/${practice.id}/documents`)
        .set(bearer(studentToken))
        .field('requirementSnapshotId', requirement.id)
        .attach('file', Buffer.from(`%PDF-1.4\nE2E-${index}`), {
          filename: `evidencia-${index}.pdf`,
          contentType: 'application/pdf',
        })
        .expect(201);
      uploadedDocuments.push(uploaded.body as DocumentView);
    }

    const digital = await request(server)
      .post(`/api/v1/practices/${practice.id}/documents/digital`)
      .set(bearer(studentToken))
      .send({
        requirementSnapshotId: digitalRequirement.id,
        metadata: { actividadEconomica: 'Desarrollo de software', trabajadores: 20 },
      })
      .expect(201);
    uploadedDocuments.push(digital.body as DocumentView);

    await request(server)
      .post(`/api/v1/coordinator/documents/${uploadedDocuments[0]!.id}/approve`)
      .set(bearer(coordinatorJuliacaToken))
      .expect(409);

    for (const document of uploadedDocuments) {
      await request(server)
        .post(`/api/v1/documents/${document.id}/submit`)
        .set(bearer(studentToken))
        .expect(200);
    }

    await request(server)
      .post(`/api/v1/coordinator/documents/${uploadedDocuments[0]!.id}/observe`)
      .set(bearer(coordinatorLimaToken))
      .send({ comentario: 'Fuera de campus' })
      .expect(403);

    await request(server)
      .post(`/api/v1/coordinator/documents/${uploadedDocuments[0]!.id}/observe`)
      .set(bearer(coordinatorJuliacaToken))
      .send({ comentario: 'Reemplazar por una versión legible.' })
      .expect(200);

    const replacement = await request(server)
      .post(`/api/v1/practices/${practice.id}/documents`)
      .set(bearer(studentToken))
      .field('requirementSnapshotId', pdfRequirements[0]!.id)
      .attach('file', Buffer.from('%PDF-1.4\nE2E-REPLACEMENT'), {
        filename: 'reemplazo.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const replacedDocument = replacement.body as DocumentView;
    expect(replacedDocument.versionActual).toBe(2);
    expect(replacedDocument.versiones.map((version) => version.estado)).toEqual([
      'OBSERVED',
      'PENDING',
    ]);

    await request(server)
      .post(`/api/v1/documents/${replacedDocument.id}/submit`)
      .set(bearer(studentToken))
      .expect(200);

    for (const document of [replacedDocument, ...uploadedDocuments.slice(1)]) {
      await request(server)
        .post(`/api/v1/coordinator/documents/${document.id}/approve`)
        .set(bearer(coordinatorJuliacaToken))
        .expect(200);
    }

    await request(server)
      .post(`/api/v1/practices/${practice.id}/documents`)
      .set(bearer(studentToken))
      .field('requirementSnapshotId', pdfRequirements[0]!.id)
      .attach('file', Buffer.from('%PDF-1.4\nNO-OVERWRITE'), {
        filename: 'no-overwrite.pdf',
        contentType: 'application/pdf',
      })
      .expect(409);

    const downloadVersion = replacedDocument.versiones[1]!.id;
    await request(server)
      .get(`/api/v1/documents/versions/${downloadVersion}/download`)
      .set(bearer(studentToken))
      .expect('content-type', /application\/pdf/)
      .expect(200);
    await request(server)
      .get(`/api/v1/documents/versions/${downloadVersion}/download`)
      .set(bearer(otherStudentToken))
      .expect(403);

    const authorized = await request(server)
      .post(`/api/v1/practices/${practice.id}/authorize`)
      .set(bearer(coordinatorJuliacaToken))
      .expect(200);
    expect((authorized.body as PracticeResponse).estado).toBe('AUTHORIZED');

    const activated = await request(server)
      .post(`/api/v1/practices/${practice.id}/activate`)
      .set(bearer(coordinatorJuliacaToken))
      .send({})
      .expect(200);
    expect((activated.body as PracticeResponse).estado).toBe('ACTIVE');

    await request(server)
      .put(`/api/v1/practices/${practice.id}`)
      .set(bearer(studentToken))
      .send({ version: (activated.body as PracticeResponse).version, horario: '09:00-15:00' })
      .expect(409);

    const histories = await prisma.practiceStatusHistory.findMany({
      where: { practiceId: practice.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(histories.map((history) => history.toStatus)).toEqual([
      'PREPARATION',
      'AUTHORIZED',
      'ACTIVE',
    ]);
  });
});
