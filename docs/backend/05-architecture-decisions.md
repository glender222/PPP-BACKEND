# 05 — Decisiones de arquitectura (ADR)

> Estado: Aceptadas. Cada ADR registra contexto, decisión, alternativas y consecuencias.

## Resumen

| # | Decisión | Estado |
|---|---|---|
| ADR-001 | Monolito modular | Aceptada |
| ADR-002 | Prisma + PostgreSQL | Aceptada |
| ADR-003 | Autenticación desacoplada del proveedor institucional | Aceptada |
| ADR-004 | Almacenamiento privado de archivos | Aceptada |
| ADR-005 | Generación de PDF | Aceptada |
| ADR-006 | Auditoría inmutable | Aceptada |
| ADR-007 | Aislamiento por campus y escuela | Aceptada |
| ADR-008 | Requisitos congelados y evidencia versionada | Aceptada |

---

## ADR-001 — Monolito modular

**Estado:** Aceptada.

**Contexto.** El MVP cubre un dominio académico pequeño-medio en tres campus, con una sola escuela activa. Las opciones consideradas fueron: microservicios, monolito modular y módulos por rol/pantalla. Los equipos de un solo producto no justifican la complejidad operativa de microservicios; separar módulos por rol duplica lógica de dominio y rompe los agregados (expediente).

**Decisión.** Un solo proceso NestJS (monolito) organizado en **módulos por capacidad de negocio** (Identity, Catalog, Letter, Company, Practice, Document, Hours, Supervision, Evaluation, Closing, Monitoring, Audit), no por rol ni por pantalla. Cada módulo expone su API y sus servicios; el dominio se comparte mediante interfaces y reglas de transición centralizadas.

**Consecuencias.**
- (+) Despliegue simple, transacciones entre módulos dentro de la misma base, menor latencia.
- (+) Los agregados (expediente, carta, documento) se mantienen íntegros.
- (−) Límite de escalado horizontal por proceso; aceptable para 100 sesiones concurrentes (RNF-05).
- (−) Requiere disciplina de límites de módulo para no degenerar en "código espagueti" (guardado por revisión en CI).

**Alternativas descartadas:** microservicios (complejidad injustificada, sin event sourcing); módulos por rol (duplicación y acoplamiento a pantallas).

---

## ADR-002 — Prisma + PostgreSQL

**Estado:** Aceptada.

**Contexto.** Se requiere un solo modelo relacional con integridad fuerte: cardinalidades, unicidad (RUC, correo, un documento por snapshot), transacciones atómicas entre estados e historiales, y consultas agregadas para dashboards. Los requisitos (RNF-04, RNF-08) exigen versionado, inmutabilidad y configuración por datos.

**Decisión.** PostgreSQL como única base de datos (una instancia para los tres campus; el aislamiento es lógico, DEC-01). Prisma como capa de acceso a datos: esquema declarativo, migraciones versionadas, tipado estricto y transacciones interactivas para acciones compuestas (aprobar carta = estado + PDF + auditoría).

**Consecuencias.**
- (+) Tipado de extremo a extremo (prisma generado) con TypeScript strict.
- (+) Migraciones auditables y reversibles; seed de catálogos (campus, escuela, roles, meta 700 h).
- (+) Indexación y filtrado por ámbito (campus, periodo, estado) para RNF-05.
- (−) Prisma intermedia el SQL; consultas muy analíticas pueden requerir SQL crudo (se permite bajo revisión, limitado a módulo Monitoring).
- (−) Los parámetros versionados (`SystemParameter`) impiden "hardcode"; exige disciplina de configuración.

---

## ADR-003 — Autenticación desacoplada del proveedor institucional

**Estado:** Aceptada.

**Contexto.** El backlog exige "correo institucional" y rechaza la dependencia de Lamb Academic (DEC-03, HU-01), pero **el proveedor institucional, el dominio de correo y el protocolo no están definidos** (CFG-01, CFG-02, DEC-08). No se debe inventar el proveedor.

**Decisión.** Definir una interfaz `IdentityProvider` reemplazable con operaciones mínimas: `verifyCredentials`, `resolveIdentityByEmail`, `issueSession`. El dominio solo conoce el correo institucional y un identificador externo `proveedorExternoId`. Se provee un adaptador `DevIdentityProvider` (credenciales simuladas, validación de dominio configurable) para desarrollo y testing; el adaptador institucional real se implementa al confirmarse el proveedor, **sin cambios en el dominio ni en el modelo de datos**.

**Consecuencias.**
- (+) El login (HU-01) se desarrolla y prueba sin depender del proveedor real.
- (+) El registro de la decisión institucional queda como configuración (no bloqueante).
- (−) Riesgo de divergencia de contrato del proveedor real; mitigado por la interfaz mínima y pruebas de contrato.
- (−) El "primer acceso crea/vincula cuenta" depende de los atributos que entregue el proveedor (correo como clave natural).

**Alternativas descartadas:** acoplar a Lamb Academic (DEC-03); inventar un proveedor concreto (viola la instrucción).

---

## ADR-004 — Almacenamiento privado de archivos

**Estado:** Aceptada.

**Contexto.** Los expedientes contienen PDF sensibles (convenios firmados, informes, resoluciones). RNF-03 exige: sin URLs públicas permanentes, entregas autorizadas, descargas auditadas y validación técnica previa. La infraestructura de almacenamiento final es pendiente (DEC-08).

**Decisión.** Los archivos se almacenan **fuera de PostgreSQL** mediante un adaptador `FileStorage` reemplazable (sistema de archivos local en dev; objeto storage en producción). En la base solo vive `FileAsset` con `storageKey`, `sha256`, MIME, tamaño, nombre original y metadata; nunca bytes. Cada descarga pasa por un endpoint autenticado y autorizado; las versiones documentales usan `GET /documents/versions/{versionId}/download` y generan `AuditEvent`. Para PDF la validación es exclusivamente técnica: extensión `.pdf`, MIME `application/pdf`, magic bytes `%PDF`, contenido no vacío y máximo configurable. No realiza OCR ni valida firma o semántica.

**Consecuencias.**
- (+) Cumple RNF-03 y RNF-04 (aprobados nunca se sobrescriben ni eliminan físicamente).
- (+) El cambio de proveedor de almacenamiento no toca el dominio.
- (−) El respaldo documental requiere RPO/RTO coordinados con la base (RNF-06).
- (−) La cuarentena de archivos inválidos requiere limpieza periódica (tarea programada).

---

## ADR-005 — Generación de PDF

**Estado:** Aceptada.

**Contexto.** La carta se **genera desde plantilla** (RN-03, HU-06); el estudiante no sube archivo. La plantilla oficial vigente y la **numeración final son configuración pendiente** (CFG-03, CFG-04). También se generan reportes PDF (HU-42).

**Decisión.** Motor de generación con **plantillas versionadas** (recurso renderizable por campus/escuela y versión vigente) y un **servicio de numeración pluggable** (`LetterNumberingStrategy`): en desarrollo emite numeración temporal; en producción se configura la regla institucional sin rediseño. El flujo distingue **vista previa (borrador, no válida)** del **documento final** generado atómicamente al aprobar (HU-07, TK-026), almacenado como `GeneratedLetterFile` con hash y ruta privada. La plantilla inicial usa logo, firma, sello y coordenadas A4 en `carta_presentacion_assets/`; sus textos institucionales son datos de `LetterTemplateVersion`. El módulo depende de `LetterGeneratorPort`; desarrollo usa un generador local determinista reemplazable. Los reportes PDF reutilizan el mismo motor con plantillas de reporte.

**Consecuencias.**
- (+) La carta nunca se edita manualmente; el formato institucional queda garantizado por plantilla.
- (+) La numeración real se incorpora por configuración, no por código.
- (−) La fidelidad tipográfica depende de la plantilla oficial (pendiente de confirmar vigencia, CFG-04).
- (−) Generación de PDF en el ciclo de aprobación: se mantiene en el mismo proceso (monolito) con operación atómica; si el render tarda, se evalúa generación asíncrona con estado intermedio (fuera de MVP salvo evidencia de rendimiento).

**Alternativas descartadas:** cargar la carta por el estudiante (RN-03); numeración fija en código (config pendiente).

---

## ADR-006 — Auditoría inmutable

**Estado:** Aceptada.

**Contexto.** HU-44 exige bitácora "que no puede modificarse desde la aplicación"; RNF-04 exige trazabilidad transaccional; los coordinadores consultan su campus y el auditor los tres. La integridad debe resistir incluso a acceso administrativo erróneo.

**Decisión.** Tabla `AuditEvent` **append-only** sin operaciones de update/delete disponibles (Prisma sin permisos de borrado; FK restrictivas hacia actores; sin endpoint de mutación). Cada evento registra actor, rol, campus, acción, entidad, identificador, resultado y detalle JSON; se escribe **en la misma transacción** que la acción crítica (I-15). `PracticeStatusHistory` también es append-only y cada transición de práctica escribe historial, auditoría y nuevo estado atómicamente. Opcionalmente se encadenan hashes (SHA-256 del evento previo) para detectar alteraciones externas; la verificación es una tarea de auditoría fuera de la app.

**Consecuencias.**
- (+) Trazabilidad íntegra y consultable por ámbito (coordinador campus, auditor global, admin global).
- (+) Detección de manipulación física de la base si se habilita el encadenado.
- (−) Costo de almacenamiento creciente; se define retención junto a RNF-06 (pendiente de infraestructura).
- (−) Errores de código quedan grabados para siempre: exige alto cuidado en mensajes y tipos de acción.

---

## ADR-007 — Aislamiento por campus y escuela

**Estado:** Aceptada.

**Contexto.** DEC-01 establece tres campus con datos segregados y auditoría consolidada; RN-10 limita a Secretaría/Coordinador por campus; la escuela está preparada para otras facultades sin activarse. El error típico es filtrar solo por rol y olvidar el ámbito organizacional.

**Decisión.** El ámbito es **parte estructural del modelo**: la asignación de rol y `StudentProfile` resuelven campus y escuela, y `Practice` pertenece directamente a `CampusSchool`. Toda consulta y comando contrasta el ámbito del recurso con el del actor mediante un **servicio de ámbito central** (único punto de cálculo), aplicado en el guard (negación rápida) y revalidado en el servicio (defensa en profundidad). La oferta activa se valida contra `CampusSchool.active`. El auditor usa un permiso especial `TRES_CAMPUS` solo-lectura; el `SYSTEM_ADMIN` gestiona estructura sin heredar operaciones.

**Consecuencias.**
- (+) Cumple RNF-02 (accesos cruzados → 403) y los criterios 1 y 6 del MVP.
- (+) Activar otra escuela es una operación de datos (`CampusSchool.active`), no de código.
- (−) Cada nueva consulta agregada debe declarar su ámbito; se aplica revisión de pares con checklist de ámbito en CI.
- (−) El sistema tolera "campus" mal asignados en datos de prueba; los seeds deben respetar el mismo servicio de ámbito.

---

## ADR-008 — Requisitos congelados y evidencia versionada

**Estado:** Aceptada.

**Contexto.** Los requisitos cambian con el tiempo, pero una práctica debe conservar el checklist con el que fue creada. Además, una evidencia puede ser archivo PDF o información digital estructurada, y las observaciones deben quedar ligadas a la versión revisada.

**Decisión.** `DocumentRequirementDefinition` reemplaza `DocumentType` y se versiona por entero con `code`, `name`, `evidenceKind`, `stage`, `mandatory` y `active`. Al crear una práctica, las definiciones `INITIAL` activas se copian a `PracticeRequirementSnapshot` inmutables; el checklist se deriva de ellas. Cada snapshot tiene exactamente un `Document`. Una carga o reemplazo crea una nueva `DocumentVersion` `PENDING` y actualiza el estado actual del documento; `submit` mueve esa misma versión a `UNDER_REVIEW`. Aprobar, observar o anular revisa la versión actual exacta. Una observada solo se corrige con otra versión `PENDING`; documento y versión aprobados son inmutables y no tienen ruta de borrado.

`Company` y `CompanyRepresentative` son catálogos reutilizables, pero `Practice` conserva sus referencias y un `representativeSnapshot` JSON tomado al crear. Ningún cambio del catálogo muta prácticas existentes y cambiar de empresa crea otra práctica.

**Consecuencias.**
- (+) Versionar o desactivar definiciones no altera expedientes históricos.
- (+) PDF y registros digitales comparten revisión y trazabilidad sin inventar archivos para datos estructurados.
- (+) La autorización de la práctica se calcula de forma reproducible sobre snapshots iniciales obligatorios aprobados.
- (−) Crear una práctica requiere copiar definiciones y crear sus documentos 1:1 dentro de una transacción.

---

## Configuración pendiente asociada (no bloqueante)

| ADR | Pendiente | Impacto en producción |
|---|---|---|
| 003 | Proveedor institucional, dominio(s) de correo (CFG-01/02) | Sustituir `DevIdentityProvider`; definir atributos del proveedor. |
| 004 | Proveedor de almacenamiento y respaldo (CFG-06, RNF-06) | Implementar adaptador de objeto storage; RPO/RTO. |
| 005 | Plantilla oficial y numeración de cartas (CFG-03/04) | Cargar plantilla real y regla de numeración. |
| 005/007 | Formatos vigentes de evaluación (CFG-05) | Cargar instrumentos iniciales versionados. |
