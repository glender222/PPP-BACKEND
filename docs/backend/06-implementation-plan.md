# 06 — Plan de implementación

> Fases alineadas al sprinting del backlog (S0–S7). El detalle técnico de los sprints es una propuesta y puede recalibrarse con la velocidad real del equipo.

## 1. Fundamentos técnicos obligatorios

| Tema | Estándar |
|---|---|
| Lenguaje | TypeScript **strict** (`strict: true`, no implicit any, no unchecked index access evitado). |
| Framework | NestJS (monolito modular, ADR-001). |
| Acceso a datos | Prisma + PostgreSQL (ADR-002); migraciones versionadas; seed reproducible. |
| Validación | class-validator + DTO por contrato (04). |
| Errores | Envelope único (04 §1); `allowedTransitions` en 409. |
| Idempotencia | `Idempotency-Key` en acciones de envío (TK-030). |
| Autorización | Guard de rol + servicio de ámbito central (ADR-007, matriz 02). |
| Transiciones | Servicio por máquina de estado (03); sin PATCH de `status`. |
| Auditoría | `AuditEvent` en la misma transacción (I-15, ADR-006). |
| Pruebas | Unitarias por servicio de transición; e2e por módulo; matriz de acceso cruzado (TK-012). |
| Lint/format | ESLint + Prettier, revisión en CI. |
| Config | Variables de entorno tipadas (config de Nest) + `SystemParameter` para lo operativo (meta 700 h). |

## 2. Fases de implementación (backend)

### Fase 0 — Fundamentos, acceso y seguridad base (S0)

| Entregable | Historias |
|---|---|
| Bootstrap NestJS + Prisma + PostgreSQL; esquema base (identity, estructura institucional, parámetros) | HU-01, HU-02, HU-03 |
| `IdentityProvider` (interfaz + Dev adapter, ADR-003), login/logout/sesión, dominios configurados (CFG-02) | HU-01 |
| Perfil de estudiante (alta/consulta/actualización controlada, auditoría de cambios) | HU-02 |
| Roles, permisos, `UserRole` con campus; guard de rol; servicio de ámbito; pruebas de acceso cruzado → 403 | HU-03 |
| Catálogos: campus, escuela (activa solo Sistemas), roles, parámetros (meta PPP 700) | HU-02, HU-03, RNF-08 |
| Auditoría base (`AuditEvent` append-only) | HU-44 (base) |

**Criterio de salida:** los cinco roles inician sesión (dev provider), se aíslan por ámbito y ningún cruce obtiene datos (TK-004, TK-008, TK-012).

### Fase 1 — Carta de presentación y Secretaría (S1)

| Entregable | Historias |
|---|---|
| Periodos (CRUD coordinador campus; apertura/cierre) | HU-04 |
| Solicitud de carta: borrador, envío, bandeja Secretaría, aprobar/observar/anular, corregir/reenviar, versiones | HU-05, HU-07, HU-08 |
| Plantillas de carta versionadas; motor de generación PDF; vista previa borrador vs final; numeración pluggable (CFG-03/04) | HU-06 |
| Descarga privada de carta aprobada + auditoría de descarga | HU-09 |

**Criterio de salida:** ciclo completo carta (solicitar→generar→observar→corregir→aprobar→descargar) con aislamiento por campus (TK-020, TK-024, TK-028, TK-032, TK-036).

### Fase 2 — Empresa, práctica y autorización (S2)

| Entregable | Historias |
|---|---|
| Empresa reutilizable con búsqueda por RUC; unicidad; extranjera sin RUC | HU-10 |
| Expediente de práctica (crear/editar En preparación); vínculo carta aprobada "cuando corresponda" | HU-11 |
| Vista consolidada de prácticas del estudiante con horas sumadas (derivadas) | HU-12 |
| Checklist de inicio (calculado) | HU-13 |
| Autorización/activación de práctica con bloqueos | HU-18 |
| Suspender/cancelar/reactivar con motivo | HU-19 |
| Validación técnica de archivos base (MIME/tamaño/estructura PDF) | HU-15 (base) |

**Criterio de salida:** práctica solo se autoriza con checklist completo (TK-044, TK-048, TK-052, TK-072, TK-076).

### Fase 3 — Documentos, versiones y excepciones (S3)

| Entregable | Historias |
|---|---|
| Carga de documentos por tipo documental (carta de aceptación, convenio, plan); control de reemplazo | HU-14 |
| Validación técnica automática completa (cuarentena de inválidos, mensajes accionables) | HU-15 |
| Bandeja de revisión del coordinador: aprobar/observar/anular con comentario obligatorio | HU-16 |
| Historial de versiones y observaciones vinculadas; inmutabilidad de aprobados | HU-17 |
| `FileMeta` + adaptador `FileStorage` privado; descargas temporales auditadas | RNF-03, HU-17 |

**Criterio de salida:** ninguna carga inválida llega a revisión humana; versiones y comentarios trazables (TK-056, TK-060, TK-064, TK-068).

### Fase 4 — Docentes, horas y supervisiones (S4)

| Entregable | Historias |
|---|---|
| Docentes (Staff activos por campus); asignación/reasignación con historial | HU-20, HU-21 |
| Bitácora de horas: borrador, envío, validar/observar, corrección, límites (0<h≤24, fechas) | HU-22, HU-23 |
| Resumen de horas por estado y consolidado; meta configurable; sin mezclar proyección social | HU-24 |
| Programación de supervisiones (tipos, duplicidad, fechas) | HU-25 |
| Registro y finalización de supervisión por docente asignado | HU-26 |
| Reprogramación y vencimiento derivado | HU-27 |

**Criterio de salida:** totales conciliables con detalle (TK-088, TK-092, TK-096, TK-100, TK-104, TK-108).

### Fase 5 — Evaluaciones (S5)

| Entregable | Historias |
|---|---|
| Instrumentos versionados: dimensiones, ítems, escalas 1–5/NA (seed con fichas actuales por validar, CFG-05) | HU-31 |
| Evaluación docente: borrador, finalización, congelación de plantilla, reapertura con motivo | HU-28 |
| Evaluación empresarial: carga PDF firmado, metadatos (nota 0–20), aprobar/observar, versiones | HU-29 |
| Resumen por práctica y alertas de discrepancia de horas declaradas vs validadas | HU-30 |

**Criterio de salida:** NA excluido del cálculo; dos versiones de plantilla coexisten sin alterar históricos (TK-112, TK-116, TK-120, TK-124).

### Fase 6 — Cierre y reconocimiento (S6)

| Entregable | Historias |
|---|---|
| Carga de informe final y constancia/certificado en etapa de cierre | HU-32, HU-33 |
| Checklist de cierre calculado con bloqueos y comparación de horas | HU-34 |
| Finalización y reapertura de práctica (motivo) | HU-35 |
| Cálculo reproducible de progreso/cumplimiento/reconocimiento; frontera 699/700 | HU-36 |
| Registro/anulación del documento individual de reconocimiento | HU-37 |

**Criterio de salida:** ninguna práctica se finaliza con bloqueos; el reconocimiento exige requisito Cumplido (TK-128, TK-132, TK-136, TK-140, TK-144, TK-148).

### Fase 7 — Dashboards, reportes, auditoría y migración (S7)

| Entregable | Historias |
|---|---|
| Dashboard del estudiante | HU-38 |
| Dashboard operativo del coordinador (indicadores enlazados, filtros) | HU-39 |
| Notificaciones internas (eventos únicos, ámbito, lectura) | HU-40 |
| Búsqueda histórica con filtros y aislamiento | HU-41 |
| Reportes (proceso/anual) y exportaciones Excel/PDF auditadas | HU-42 |
| Dashboard consolidado del auditor (3 campus, solo lectura, drill-down) | HU-43 |
| Bitácora completa consultable por ámbito; encadenado de hashes opcional | HU-44 |
| Importación controlada de prácticas activas (validación previa, confirmación, idempotencia) | HU-45 |

**Criterio de salida:** KPIs reconciliados con listados; el auditor no tiene ninguna acción de escritura; exportaciones auditadas (TK-152, TK-156, TK-160, TK-164, TK-168, TK-172, TK-176, TK-180).

## 3. Orden sugerido de esquema Prisma (etapas de migración)

1. `Campus`, `School`, `SchoolCampus`, `SystemParameter`.
2. `User`, `Role`, `UserRole`, `StudentProfile`, `StaffProfile`.
3. `AuditEvent`, `Notification`.
4. `LetterTemplate`, `LetterRequest`, `LetterVersion`, `LetterDocument`, `FileMeta`.
5. `Company`, `Period`, `Practice`, `PracticeAssignment`, `ImportBatch`.
6. `DocumentType`, `Document`, `DocumentVersion`, `DocumentReview`.
7. `HourRecord`, `HourReview`.
8. `Supervision`, `SupervisionReschedule`, `SupervisionResult`.
9. `EvaluationTemplate`, `EvaluationDimension`, `EvaluationItem`, `Evaluation`, `EvaluationResponse`, `CompanyEvaluation`.
10. `RecognitionRecord`.

Cada migración incluye su seed de catálogo asociado.

## 4. Definición de "done" por historia (backend)

1. Esquema migrado y seed coherente.
2. Endpoints del contrato 04 implementados con DTOs y errores estándar.
3. Transiciones aplican la máquina de estado 03 con guardas.
4. Autorización por matriz 02 verificada (prueba de acceso cruzado → 403/409).
5. Auditoría de acciones críticas en la misma transacción.
6. Pruebas unitarias de transiciones + e2e del flujo principal.
7. Lint y format sin errores; TypeScript strict compila.

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Ámbitos mal aplicados en consultas agregadas | Servicio de ámbito central + checklist de revisión en CI (ADR-007). |
| Frontera progreso vs cumplimiento confundida | Estados derivados calculados por una única función de cálculo (HU-36); pruebas de frontera 699/700 (TK-144). |
| Numeración/plantilla de carta pendiente (CFG-03/04) | Estrategias pluggable y plantillas versionadas; se entrega con numeración temporal. |
| Proveedor de identidad real difiere (CFG-01) | Interfaz mínima + pruebas de contrato; adaptador dev hasta decisión. |
| Crecimiento de `AuditEvent` y archivos | Retención definida con RNF-06; encadenado opcional; limpieza de cuarentena programada. |
| Instrumentos de evaluación vigentes por validar (CFG-05) | Modelo versionado; carga inicial reproduce fichas actuales sin rediseño. |
| Rendimiento de dashboards | Índices por ámbito/periodo; agregaciones en SQL; paginación; benchmarks de RNF-05. |

## 6. Verificación final del backend

- Matriz de acceso cruzado automatizada (TK-012).
- Reconciliación de totales con detalle de expedientes (criterio 7 del MVP).
- Simulación de escenarios completos por rol (carta → práctica → horas → cierre → reconocimiento).
- Prueba de inmutabilidad: aprobados y `AuditEvent` sin rutas de mutación.
- Smoke de 100 sesiones concurrentes (RNF-05).
