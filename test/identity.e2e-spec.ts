import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; state: string };
  roles: { role: string; campusId: string | null; schoolId: string | null }[];
}

interface CampusView {
  id: string;
  name: string;
  code: string;
}

interface PeriodView {
  id: string;
  campusId: string;
  name: string;
  state: string;
}

interface AuditEventView {
  id: string;
  action: string;
  entity: string;
  detail: unknown;
  createdAt: string;
}

const DEV_PASSWORD_FALLBACK = 'PppDev!2026';

describe('Identidad, organización y autorización (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let devPassword: string;
  let adminToken: string;
  let studentToken: string;
  let secretaryToken: string;
  let coordinatorLimaToken: string;
  let coordinatorJuliacaToken: string;
  let auditorToken: string;
  let juliacaCampusId: string;
  let limaCampusId: string;
  let sistemasSchoolId: string;
  let juliacaPeriodId: string;

  async function loginAs(email: string): Promise<LoginResponse> {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: devPassword })
      .expect(200);
    return res.body as LoginResponse;
  }

  function bearer(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    devPassword = process.env.DEV_AUTH_PASSWORD ?? DEV_PASSWORD_FALLBACK;

    adminToken = (await loginAs('system.admin@upeu.edu.pe')).accessToken;
    studentToken = (await loginAs('student.juliaca@upeu.edu.pe')).accessToken;
    secretaryToken = (await loginAs('secretary.juliaca@upeu.edu.pe')).accessToken;
    coordinatorLimaToken = (await loginAs('coordinator.lima@upeu.edu.pe')).accessToken;
    coordinatorJuliacaToken = (await loginAs('coordinator.juliaca@upeu.edu.pe')).accessToken;
    auditorToken = (await loginAs('auditor@upeu.edu.pe')).accessToken;

    const campusesRes = await request(server)
      .get('/api/v1/catalog/campuses')
      .set(bearer(adminToken))
      .expect(200);
    const campuses = campusesRes.body as CampusView[];
    juliacaCampusId = campuses.find((c) => c.code === 'JULIACA')!.id;
    limaCampusId = campuses.find((c) => c.code === 'LIMA')!.id;

    const schoolsRes = await request(server)
      .get(`/api/v1/catalog/schools?campusId=${juliacaCampusId}`)
      .set(bearer(adminToken))
      .expect(200);
    sistemasSchoolId = (schoolsRes.body as { id: string; code: string }[]).find(
      (s) => s.code === 'ING-SISTEMAS',
    )!.id;

    const periodsRes = await request(server)
      .get('/api/v1/catalog/periods')
      .set(bearer(adminToken))
      .expect(200);
    juliacaPeriodId = (periodsRes.body as PeriodView[]).find(
      (p) => p.campusId === juliacaCampusId && p.name === '2026-I',
    )!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('autenticación', () => {
    it('login con credenciales dev emite token para un usuario seed', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'student.juliaca@upeu.edu.pe', password: devPassword })
        .expect(200);
      const body = res.body as LoginResponse;
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user.email).toBe('student.juliaca@upeu.edu.pe');
    });

    it('login con contraseña incorrecta devuelve 401 con envelope', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'student.juliaca@upeu.edu.pe', password: 'incorrecta' })
        .expect(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          error: 'Unauthorized',
          message: expect.any(String) as string,
        }),
      );
    });

    it('GET /me sin token devuelve 401', async () => {
      await request(server).get('/api/v1/me').expect(401);
    });

    it('GET /me devuelve identidad, roles y perfiles', async () => {
      const res = await request(server).get('/api/v1/me').set(bearer(studentToken)).expect(200);
      const body = res.body as { user: { email: string }; roles: { role: string }[] };
      expect(body.user.email).toBe('student.juliaca@upeu.edu.pe');
      expect(body.roles.map((r) => r.role)).toEqual(['STUDENT']);
    });

    it('GET /auth/me es equivalente a /me', async () => {
      const res = await request(server)
        .get('/api/v1/auth/me')
        .set(bearer(studentToken))
        .expect(200);
      expect((res.body as { user: { email: string } }).user.email).toBe(
        'student.juliaca@upeu.edu.pe',
      );
    });
  });

  describe('matriz de autorización', () => {
    it('estudiante no accede a la administración de usuarios (403)', async () => {
      await request(server).get('/api/v1/admin/users').set(bearer(studentToken)).expect(403);
      await request(server)
        .get('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
        .set(bearer(studentToken))
        .expect(403);
      await request(server).get('/api/v1/catalog/periods').set(bearer(studentToken)).expect(403);
    });

    it('secretaria no consulta periodos de otro campus ni administración (403)', async () => {
      await request(server).get('/api/v1/catalog/periods').set(bearer(secretaryToken)).expect(403);
      await request(server).get('/api/v1/admin/users').set(bearer(secretaryToken)).expect(403);
    });

    it('coordinador de Lima no crea periodos en otro campus (403)', async () => {
      const res = await request(server)
        .post('/api/v1/catalog/periods')
        .set(bearer(coordinatorLimaToken))
        .send({
          name: `E2E-otro-campus-${Date.now()}`,
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          campusId: juliacaCampusId,
        })
        .expect(403);
      expect(res.body).toEqual(expect.objectContaining({ statusCode: 403, error: 'Forbidden' }));
    });

    it('coordinador de Lima no abre periodos de otro campus (403)', async () => {
      await request(server)
        .post(`/api/v1/catalog/periods/${juliacaPeriodId}/open`)
        .set(bearer(coordinatorLimaToken))
        .expect(403);
    });

    it('coordinador gestiona periodos solo de su campus', async () => {
      const name = `E2E-lima-${Date.now()}`;
      const created = await request(server)
        .post('/api/v1/catalog/periods')
        .set(bearer(coordinatorLimaToken))
        .send({
          name,
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          campusId: limaCampusId,
        })
        .expect(201);
      const period = created.body as PeriodView;
      expect(period.campusId).toBe(limaCampusId);
      expect(period.state).toBe('DRAFT');

      await request(server)
        .post(`/api/v1/catalog/periods/${period.id}/open`)
        .set(bearer(coordinatorLimaToken))
        .expect(200);

      const listRes = await request(server)
        .get('/api/v1/catalog/periods')
        .set(bearer(coordinatorLimaToken))
        .expect(200);
      const list = listRes.body as PeriodView[];
      expect(list.some((p) => p.id === period.id)).toBe(true);
      expect(list.some((p) => p.campusId === juliacaCampusId)).toBe(false);

      const juliacaListRes = await request(server)
        .get('/api/v1/catalog/periods')
        .set(bearer(coordinatorJuliacaToken))
        .expect(200);
      const juliacaList = juliacaListRes.body as PeriodView[];
      expect(juliacaList.some((p) => p.id === period.id)).toBe(false);
    });

    it('auditor no ejecuta mutaciones y lee la bitácora global (403/200)', async () => {
      await request(server)
        .post('/api/v1/catalog/periods')
        .set(bearer(auditorToken))
        .send({
          name: `E2E-auditor-${Date.now()}`,
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          campusId: juliacaCampusId,
        })
        .expect(403);
      await request(server).get('/api/v1/admin/users').set(bearer(auditorToken)).expect(403);
      await request(server).get('/api/v1/audit/events').set(bearer(auditorToken)).expect(200);
    });
  });

  describe('administración de usuarios y asignaciones (SYSTEM_ADMIN)', () => {
    let createdUserId: string;
    const email = `e2e.${Date.now()}@upeu.edu.pe`;
    const code = `E2E-${Date.now()}`;

    it('lista usuarios y crea uno con perfil de estudiante', async () => {
      const listRes = await request(server)
        .get('/api/v1/admin/users')
        .set(bearer(adminToken))
        .expect(200);
      const emails = (listRes.body as { email: string }[]).map((u) => u.email);
      expect(emails).toContain('system.admin@upeu.edu.pe');
      expect(emails).toContain('student.lima@upeu.edu.pe');

      const createdRes = await request(server)
        .post('/api/v1/admin/users')
        .set(bearer(adminToken))
        .send({
          email,
          fullName: 'Usuario E2E',
          studentProfile: {
            code,
            dni: '76543210',
            cycle: 'X',
            campusId: juliacaCampusId,
            schoolId: sistemasSchoolId,
          },
        })
        .expect(201);
      const created = createdRes.body as { id: string; email: string; state: string };
      createdUserId = created.id;
      expect(created.email).toBe(email);
      expect(created.state).toBe('ACTIVE');
    });

    it('asigna rol con ámbito inválido (422) y luego con ámbito válido (201)', async () => {
      await request(server)
        .post(`/api/v1/admin/users/${createdUserId}/role-assignments`)
        .set(bearer(adminToken))
        .send({ role: 'COORDINATOR' })
        .expect(422);

      const assignedRes = await request(server)
        .post(`/api/v1/admin/users/${createdUserId}/role-assignments`)
        .set(bearer(adminToken))
        .send({ role: 'STUDENT' })
        .expect(201);
      const assigned = assignedRes.body as { roles: { role: string }[] };
      expect(assigned.roles.map((r) => r.role)).toContain('STUDENT');
    });

    it('auditoría registra creación y cambio de roles', async () => {
      const auditRes = await request(server)
        .get('/api/v1/audit/events')
        .set(bearer(adminToken))
        .expect(200);
      const events = auditRes.body as AuditEventView[];
      const userCreated = events.find((e) => e.action === 'USER_CREATED');
      const roleAssigned = events.find((e) => e.action === 'ROLE_ASSIGNED');
      expect(userCreated).toBeDefined();
      expect(roleAssigned).toBeDefined();
      expect(userCreated!.entity).toBe('User');
      expect(roleAssigned!.entity).toBe('RoleAssignment');
    });

    it('usuario creado puede iniciar sesión con el proveedor dev', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: devPassword })
        .expect(200);
      expect((res.body as LoginResponse).user.email).toBe(email);
    });

    it('desactivación bloquea el login y la reactivación lo habilita', async () => {
      await request(server)
        .post(`/api/v1/admin/users/${createdUserId}/deactivate`)
        .set(bearer(adminToken))
        .expect(200);
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: devPassword })
        .expect(401);

      await request(server)
        .post(`/api/v1/admin/users/${createdUserId}/activate`)
        .set(bearer(adminToken))
        .expect(200);
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: devPassword })
        .expect(200);
    });

    it('coordinador ve solo la bitácora de su campus', async () => {
      const res = await request(server)
        .get('/api/v1/audit/events')
        .set(bearer(coordinatorJuliacaToken))
        .expect(200);
      const events = res.body as AuditEventView[];
      const crossCampus = events.find(
        (e) =>
          e.action === 'ACADEMIC_PERIOD_CREATED' &&
          e.detail !== null &&
          typeof e.detail === 'object' &&
          (e.detail as { name?: string }).name?.startsWith('E2E-lima-'),
      );
      expect(crossCampus).toBeUndefined();
    });
  });
});
