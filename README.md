# PPP Backend

Backend del Sistema de Practicas Preprofesionales (PPP) de la Universidad Peruana Union (UPeU). Provee una API REST para los procesos academicos y administrativos del MVP en los campus de Juliaca, Lima y Tarapoto.

## Estado actual

Implementado y cubierto por pruebas:

- Fundamentos: NestJS, TypeScript strict, PostgreSQL, Prisma, migraciones y seed idempotente.
- Identidad de desarrollo, sesiones JWT y perfiles de estudiante.
- Autorizacion centralizada por rol, campus, escuela, propiedad y asignacion.
- Catalogos institucionales, periodos, parametros configurables y auditoria append-only.
- Carta de presentacion: borrador, vista previa PDF, envio, observacion, correccion, reenvio, aprobacion, descarga privada, historial, notificaciones y auditoria.
- Generacion de PDF desde plantilla versionada con logo, firma y sello institucionales. Los datos de destinatario, empresa, area, estudiante, codigo y ciclo se rellenan desde datos del sistema.

Pendiente de implementacion: los modulos de empresa, expediente de practica, documentos, horas, supervisiones, evaluaciones, cierre, reconocimiento, dashboards, reportes e importacion. El alcance y el plan por fases estan en [`docs/backend/06-implementation-plan.md`](docs/backend/06-implementation-plan.md).

## Arquitectura y escalabilidad

El proyecto es un monolito modular NestJS. Se organiza por capacidades de negocio, no por pantallas ni roles, para mantener consistencia transaccional mientras el producto evoluciona.

- **Modulos de dominio:** Identity, Catalog, Letter, Audit y los modulos futuros definidos en el plan.
- **Aislamiento multicanal:** PostgreSQL unico con limites logicos por campus y escuela; el servicio de alcance se aplica en guards y se revalida en los servicios de dominio.
- **Integridad:** Prisma, migraciones versionadas y transacciones para mutaciones criticas, como aprobar una carta, crear su PDF y registrar auditoria.
- **Extensibilidad:** puertos reemplazables para autenticacion, almacenamiento de archivos, generacion de cartas y numeracion. En produccion se pueden conectar un proveedor institucional de identidad y almacenamiento de objetos sin alterar el dominio.
- **Configuracion por datos:** plantillas, parametros operativos, campus, escuelas y roles se mantienen como datos versionados o catalogos, no como constantes de negocio.
- **Trazabilidad:** `AuditEvent` es append-only; las descargas y transiciones relevantes se auditan.

El adaptador de autenticacion y el almacenamiento de archivos actuales son solo de desarrollo. La numeracion institucional y la plantilla oficial vigente permanecen configuraciones pendientes antes de produccion.

Las decisiones de arquitectura completas estan en [`docs/backend/05-architecture-decisions.md`](docs/backend/05-architecture-decisions.md).

## Requisitos

- Node.js 20 o superior.
- Corepack con pnpm.
- Docker y Docker Compose.

## Inicio local

1. Configure las variables de entorno de `.env.example` en un archivo local `.env`.
2. Inicie PostgreSQL:

```bash
docker compose up -d
```

3. Instale dependencias, aplique las migraciones existentes y cargue datos de desarrollo:

```bash
corepack pnpm install
corepack pnpm prisma:deploy
corepack pnpm prisma:seed
```

4. Inicie la API:

```bash
corepack pnpm start:dev
```

La API queda disponible en `http://localhost:3000/api/v1` y el estado del servicio en `GET /api/v1/health`.

## Scalar y OpenAPI

Con `ENABLE_API_DOCS=true`, la documentacion interactiva Scalar esta disponible en:

```text
http://localhost:3000/api/docs
```

Para autenticar solicitudes desde Scalar:

1. Ejecute `POST /api/v1/auth/login`.
2. Copie el valor `accessToken` de la respuesta.
3. Use **Authorize** e ingrese `Bearer <accessToken>`.

Usuarios de desarrollo sembrados:

| Rol | Correo |
|---|---|
| Estudiante Juliaca | `student.juliaca@upeu.edu.pe` |
| Secretaria Juliaca | `secretary.juliaca@upeu.edu.pe` |
| Coordinador Juliaca | `coordinator.juliaca@upeu.edu.pe` |
| Supervisor Juliaca | `supervisor.juliaca@upeu.edu.pe` |
| Auditor | `auditor@upeu.edu.pe` |
| Administrador | `system.admin@upeu.edu.pe` |

La contrasena de desarrollo por defecto es `PppDev!2026`; se configura mediante `DEV_AUTH_PASSWORD`. El proveedor `dev` esta prohibido en produccion.

### Flujo de carta de presentacion

1. Como estudiante, cree la solicitud con `POST /letters`.
2. Revise el borrador con `GET /letters/{id}/preview` y envie con `POST /letters/{id}/submit`.
3. Como Secretaria del mismo campus, consulte `GET /secretary/letters`.
4. Observe con `POST /secretary/letters/{id}/observe` o apruebe con `POST /secretary/letters/{id}/approve`.
5. Una aprobacion genera el PDF final. El estudiante autorizado puede descargarlo mediante `GET /letters/{id}/download`.

El detalle de rutas, DTOs, codigos de error y autorizacion esta en [`docs/backend/04-api-contract.md`](docs/backend/04-api-contract.md).

## Verificacion

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm build
```

Las pruebas e2e usan la base de datos local y el seed de desarrollo. No las ejecute contra datos compartidos o de produccion.

## Documentacion

`docs/` es la fuente de verdad del comportamiento del proyecto:

- [`docs/backend/00-scope.md`](docs/backend/00-scope.md): alcance y reglas rectoras.
- [`docs/backend/01-domain-model.md`](docs/backend/01-domain-model.md): entidades e invariantes.
- [`docs/backend/02-authorization-matrix.md`](docs/backend/02-authorization-matrix.md): roles y limites de acceso.
- [`docs/backend/03-state-machines.md`](docs/backend/03-state-machines.md): transiciones explicitas.
- [`docs/backend/04-api-contract.md`](docs/backend/04-api-contract.md): contrato HTTP.
- [`docs/backend/05-architecture-decisions.md`](docs/backend/05-architecture-decisions.md): decisiones de arquitectura.
- [`docs/backend/06-implementation-plan.md`](docs/backend/06-implementation-plan.md): fases y criterios de entrega.
