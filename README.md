# PPP Backend

Backend del Sistema de Practicas Preprofesionales (PPP) de la Universidad Peruana Union (UPeU). Provee una API REST para los procesos academicos y administrativos del MVP en los campus de Juliaca, Lima y Tarapoto.

## Estado actual

Implementado y cubierto por pruebas en las fases base:

- Fundamentos: NestJS, TypeScript strict, PostgreSQL, Prisma, migraciones y seed idempotente.
- Identidad de desarrollo, sesiones JWT y perfiles de estudiante.
- Autorizacion centralizada por rol, campus, escuela, propiedad y asignacion.
- Catalogos institucionales, periodos, parametros configurables y auditoria append-only.
- Carta de presentacion: borrador con marca de agua diagonal `BORRADOR`, vista previa PDF, envio, observacion, correccion, reenvio, configuracion de firma por Secretaria (`GET/PUT /secretary/signature-config`), aprobacion con validacion estricta de firma/sello, descarga privada, historial, notificaciones y auditoria.
- Generacion de PDF desde plantilla versionada con logo, firma y sello institucionales. Omitidos en vista previa e incrustados con coordenadas exactas al aprobar. Los datos de destinatario, empresa, area, estudiante, codigo y ciclo se rellenan desde datos del sistema.

La entrega actual incorpora un subconjunto de las fases 2 y 3 con cobertura unitaria y e2e para sus reglas críticas:

- Empresas reutilizables y representantes como contactos sin cuenta: `GET/POST /companies` y `POST /companies/{id}/representatives`.
- Practicas propias en `PREPARATION`, ligadas a estudiante, empresa, representante, periodo academico y campus-escuela, con snapshot del representante: `POST /practices`, `GET /practices/mine`, `GET/PUT /practices/{id}`.
- Requisitos iniciales congelados al crear la practica y checklist derivado: `GET /practices/{id}/requirements`.
- Evidencia PDF o registro digital versionado: `POST /practices/{id}/documents`, `POST /practices/{id}/documents/digital`, `POST /documents/{id}/submit`, `GET /documents/{id}/versions` y acciones `approve`/`observe`/`annul` del coordinador por documento.
- Autorizacion y activacion por coordinador del mismo campus-escuela: `POST /practices/{id}/authorize` y `POST /practices/{id}/activate`.
- Descarga privada y auditada de versiones PDF: `GET /documents/versions/{versionId}/download`.

Permanecen planificados los estados posteriores de la practica y los modulos de horas, supervisiones, evaluaciones, cierre, reconocimiento, dashboards, reportes e importacion. El alcance y el plan por fases estan en [`docs/backend/06-implementation-plan.md`](docs/backend/06-implementation-plan.md).

## Avance por etapas

### Base completada hasta carta de presentacion

Antes del avance actual ya estaban terminados:

- Inicio de sesion de desarrollo con JWT, usuarios, roles y perfiles.
- Aislamiento por campus, escuela, propietario y rol.
- Catalogos institucionales, periodos academicos y auditoria.
- Flujo completo de carta: crear borrador, previsualizar PDF, enviar, observar, corregir, reenviar, aprobar y descargar.
- Plantilla versionada con logo, firma, sello, numeracion reemplazable y almacenamiento privado local.

### Implementado despues de la carta

#### 1. Empresas y representantes

- `Company` es reutilizable y puede buscarse por RUC o nombre.
- `CompanyRepresentative` registra contactos empresariales sin crear cuentas de usuario.
- Una empresa puede tener varios representantes.
- Actualizar una empresa o representante no modifica las practicas existentes.
- Cambiar de empresa significa crear otra `Practice`; la anterior nunca se sobrescribe.

#### 2. Practicas

- Cada `Practice` pertenece a un estudiante, empresa, representante, periodo y `CampusSchool` activo.
- Al crearla se guarda un snapshot JSON del representante para conservar el dato historico.
- Un estudiante puede tener varias practicas independientes.
- La practica empieza en `PREPARATION` y usa version para actualizaciones con control optimista.
- `PracticeStatusHistory` y `AuditEvent` registran la creacion y cada transicion de forma atomica.
- Actualmente estan operativas las transiciones `PREPARATION -> AUTHORIZED -> ACTIVE`.

#### 3. Requisitos iniciales

Al crear una practica se congelan definiciones vigentes en `PracticeRequirementSnapshot`. Los cuatro requisitos iniciales obligatorios sembrados son:

| Codigo | Evidencia |
|---|---|
| `ACCEPTANCE_LETTER` | Carta de aceptacion en PDF |
| `PPP_AGREEMENT` | Convenio de PPP en PDF |
| `WORK_PLAN` | Plan de trabajo en PDF |
| `COMPANY_INFORMATION` | Informacion de empresa como registro digital |

Cada snapshot tiene un solo `Document`. Cambiar posteriormente el catalogo `DocumentRequirementDefinition` no altera los requisitos de una practica creada.

#### 4. Gestion documental

- Cada carga o reemplazo crea una nueva `DocumentVersion`.
- Flujo soportado: `PENDING -> UNDER_REVIEW -> OBSERVED | APPROVED | ANNULLED`.
- Un documento observado se corrige cargando una nueva version `PENDING` y enviandola nuevamente.
- `DocumentReview` siempre referencia la version exacta revisada.
- Un documento aprobado no puede reemplazarse ni eliminarse fisicamente.
- Los registros digitales usan metadata JSON y no crean archivos ficticios.

#### 5. Archivos y seguridad

- `StoragePort` define un contrato de objetos por `key`, compatible con un futuro adaptador S3 u otro object storage.
- Desarrollo usa `LocalStorageAdapter` y guarda los bytes en `data/uploads/`.
- PostgreSQL conserva `FileAsset`: `storageKey`, SHA-256, MIME, tamano, nombre original y metadata.
- Todo PDF se valida por extension, MIME, cabecera `%PDF`, contenido no vacio y `MAX_PDF_SIZE_BYTES`.
- Las descargas pasan por autenticacion, autorizacion por recurso y auditoria.
- No se realiza OCR, validacion automatica de firmas ni validacion semantica del contenido.

#### 6. Autorizacion de la practica

El coordinador del mismo `CampusSchool` solo puede autorizar y activar cuando todos los requisitos iniciales obligatorios estan en `APPROVED`. Intentar una transicion antes de completar el checklist devuelve `409 Conflict` con detalle accionable.

### Frontera actual

El backend llega hasta una practica `ACTIVE` con sus requisitos iniciales aprobados. Todavia no estan implementados los comandos posteriores de suspension, reactivacion, cancelacion, cierre y reapertura, ni horas, asignacion de supervisor, supervisiones, evaluaciones, reconocimiento, dashboards o reportes.

## Arquitectura y escalabilidad

El proyecto es un monolito modular NestJS. Se organiza por capacidades de negocio, no por pantallas ni roles, para mantener consistencia transaccional mientras el producto evoluciona.

- **Modulos de dominio:** Identity, Catalog, Letter, Company, Practice, Document, Audit y los modulos futuros definidos en el plan.
- **Aislamiento multicanal:** PostgreSQL unico con limites logicos por campus y escuela; el servicio de alcance se aplica en guards y se revalida en los servicios de dominio.
- **Integridad:** Prisma, migraciones versionadas y transacciones para mutaciones criticas, como aprobar una carta, crear su PDF y registrar auditoria.
- **Extensibilidad:** puertos reemplazables para autenticacion, almacenamiento de archivos, generacion de cartas y numeracion. En produccion se pueden conectar un proveedor institucional de identidad y almacenamiento de objetos sin alterar el dominio.
- **Configuracion por datos:** plantillas, parametros operativos, campus, escuelas y roles se mantienen como datos versionados o catalogos, no como constantes de negocio.
- **Trazabilidad:** `AuditEvent` y `PracticeStatusHistory` son append-only; las transiciones de practica los escriben atomicamente y todas las descargas se auditan.

Los requisitos documentales se definen con versiones enteras y se copian a snapshots inmutables al crear cada practica. Existe un documento por snapshot; reemplazar evidencia crea una version `PENDING`, enviarla mueve esa misma version a `UNDER_REVIEW`, y la revision siempre apunta a la version actual exacta. Los aprobados son inmutables y no existe ruta de borrado.

Los bytes de los PDF permanecen fuera de PostgreSQL. `FileAsset` conserva solo `storageKey`, SHA-256, MIME, tamano, nombre original y metadata. La validacion PDF es exclusivamente tecnica: extension `.pdf`, MIME `application/pdf`, magic bytes `%PDF`, archivo no vacio y maximo configurable; no realiza OCR ni valida firmas o contenido.

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
2. Revise el borrador con `GET /letters/{id}/preview` (incluye marca de agua diagonal `BORRADOR` de fondo y omite sello/firma) y envie con `POST /letters/{id}/submit`.
3. Como Secretaria del mismo campus, consulte `GET /secretary/letters`.
4. Como Secretaria del mismo campus, consulte o configure los datos del Director (nombre, cargo, facultad) y suba la imagen de firma/sello con `GET/PUT /secretary/signature-config`.
5. Observe con `POST /secretary/letters/{id}/observe` o apruebe con `POST /secretary/letters/{id}/approve` (valida obligatoriamente que la Escuela tenga cargada y activa la firma/sello oficial).
6. Una aprobacion genera el PDF final inmutable. El estudiante autorizado puede descargarlo mediante `GET /letters/{id}/download`.

### Flujo posterior: empresa, practica y documentos

1. Como estudiante, cree la empresa con `POST /companies`; puede incluir un representante inicial.
2. Si necesita otro contacto, use `POST /companies/{id}/representatives`.
3. Cree la practica con `POST /practices`, usando empresa, representante y periodo academico.
4. Consulte los snapshots creados con `GET /practices/{id}/requirements`.
5. Para cada requisito PDF, use `POST /practices/{id}/documents` como `multipart/form-data` con `requirementSnapshotId` y `file`.
6. Para informacion de empresa, use `POST /practices/{id}/documents/digital` con `requirementSnapshotId` y `metadata`.
7. Envie cada documento con `POST /documents/{documentId}/submit`.
8. Como coordinador del mismo campus-escuela, apruebe u observe desde los endpoints de `/coordinator/documents/{documentId}`.
9. Si queda observado, el estudiante carga otra version y la vuelve a enviar.
10. Cuando los cuatro requisitos esten aprobados, use `POST /practices/{id}/authorize` y luego `POST /practices/{id}/activate`.

Los endpoints anteriores aparecen agrupados como **Companies**, **Practices** y **Documents** en Scalar.

El detalle de rutas, DTOs, codigos de error y autorizacion esta en [`docs/backend/04-api-contract.md`](docs/backend/04-api-contract.md).

## Verificacion

Estado de la ultima verificacion completa:

- 34 pruebas unitarias aprobadas.
- 24 pruebas e2e aprobadas.
- Lint y build aprobados.
- Cinco migraciones aplicadas y schema sincronizado.

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
