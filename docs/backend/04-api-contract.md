# 04 — Contrato de API

> REST bajo `/api/v1`. Endpoints de acción explícita (`/submit`, `/observe`, `/approve`, `/authorize`, `/close`, `/reopen`…). Ningún PATCH arbitrario de `status`.

## 1. Convenciones globales

| Tema | Convención |
|---|---|
| Prefijo | `/api/v1` en toda ruta. |
| Formato | JSON; fechas ISO-8601; archivos `multipart/form-data`. |
| Errores | Envelope estándar: `{ "statusCode", "error", "message", "details?", "allowedTransitions?" }`. |
| Códigos | `400` validación, `401` sesión, `403` acceso cruzado/rol, `404` no existe (o ocultación), `409` transición inválida o conflicto, `413` archivo grande, `422` regla de negocio/archivo inválido, `500` inesperado. |
| Idempotencia | `Idempotency-Key` en acciones de envío (submit/resubmit/approve…) para evitar duplicados (TK-030). |
| Paginación | `?page&limit` (máx 100); respuesta con `{ data, meta }`. |
| Filtros | `?campusId&schoolId&periodId&estado&studentId&companyId&supervisorId&q`. |
| Auditoría | Toda transición persiste `AuditEvent`; las transiciones de práctica incluyen `PracticeStatusHistory` en la misma transacción. Toda descarga autorizada se audita. |
| Transiciones | Listadas por endpoint en la columna "Transición". |

## 2. Módulo identidad y perfil

| Método | Ruta | Actor | Ámbito | DTO (req) | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| POST | `/auth/login` | Público | — | `LoginDto { correo, contraseña/proveedor, tenant? }` | `{ accessToken, user, roles }` | 400, 401, 403 (dominio no permitido) | Crea/vincula cuenta por correo (HU-01) |
| POST | `/auth/logout` | Autenticado | Propio | `LogoutDto { refreshToken? }` | `204` | 401 | Revoca sesión |
| GET | `/auth/me` | Autenticado | Propio | — | `{ user, roles[], profile? }` | 401 | — |
| POST | `/students/me/profile` | STUDENT | Propio | `CompleteProfileDto { nombres, codigo, documento, ciclo, campusId, schoolId }` | `201 { profile }` | 400, 403, 422 | Completa perfil; bloquea trámites si incompleto |
| PUT | `/students/me/profile` | STUDENT | Propio | `UpdateProfileDto` (parcial controlado) | `200 { profile }` | 400, 403, 409 | Cambios auditados (HU-02) |

## 3. Módulo catálogos y periodos

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| GET | `/catalog/campuses` | Autenticado | Global lectura | — | `[CampusDto]` | 401 | — |
| GET | `/catalog/schools` | Autenticado | Global lectura | `?campusId` | `[SchoolDto]` (activas) | 401 | — |
| GET | `/catalog/periods` | COORDINATOR | Campus | `?estado` | `[PeriodDto]` | 401, 403 | — |
| POST | `/catalog/periods` | COORDINATOR | Campus | `CreatePeriodDto { nombre, fechaInicio, fechaFin }` | `201` | 400, 403, 409 | — (HU-04) |
| POST | `/catalog/periods/{id}/open` | COORDINATOR | Campus | `{}` | `200` | 403, 404, 409 | Abre periodo |
| POST | `/catalog/periods/{id}/close` | COORDINATOR | Campus | `{}` | `200` | 403, 404, 409 | Cierra periodo: impide nuevas prácticas |
| GET | `/catalog/parameters` | SYSTEM_ADMIN | Global | — | `[ParameterDto]` | 401, 403 | — |
| PUT | `/catalog/parameters/{key}/version` | SYSTEM_ADMIN | Global | `UpdateParameterDto { valor }` | `200` (nueva versión) | 400, 403 | Versiona parámetro (meta 700 h) |

## 4. Módulo carta de presentación

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| POST | `/letters` | STUDENT | Propio | `CreateLetterDto { destinatario, cargo, empresaObjetivo, areaPractica, datosPlantilla }` | `201 { letter }` (Borrador) | 400, 403, 422 | — |
| GET | `/letters/mine` | STUDENT | Propio | `?estado` | `[LetterSummaryDto]` | 401, 403 | — |
| GET | `/letters/{id}` | Propietario; COORDINATOR campus; SECRETARY campus; AUDITOR global | Según rol | — | `LetterDetailDto { versiones[], observaciones }` | 401, 403, 404 | — |
| PUT | `/letters/{id}` | STUDENT | Propio | `UpdateLetterDto` | `200` | 400, 403, 404, 409 | Solo Borrador u Observada editable |
| POST | `/letters/{id}/submit` | STUDENT | Propio | `{ Idempotency-Key }` | `200 { estado: ENVIADA }` | 400, 403, 409 | Borrador → Enviada |
| GET | `/letters/{id}/preview` | Propietario; SECRETARY campus | Según rol | `?templateVersion` | `200 application/pdf` (borrador) | 401, 403, 404 | — (no equivale a aprobada) |
| POST | `/letters/{id}/resubmit` | STUDENT | Propio | `{ datosPlantilla, Idempotency-Key }` | `200 { estado: REENVIADA }` | 400, 403, 404, 409 | Observada → Reenviada (nueva versión) |
| GET | `/letters/{id}/history` | Propietario; COORDINATOR campus; SECRETARY campus; AUDITOR global | Según rol | — | `LetterDetailDto { historial[], revisiones[], decisiones[] }` | 401, 403, 404 | — |
| GET | `/secretary/letters` | SECRETARY | Campus | `?estado=ENVIADA\|REENVIADA` | `[LetterSummaryDto]` | 401, 403 | — |
| POST | `/secretary/letters/{id}/approve` | SECRETARY | Campus | `{}` | `201 { letter, documentoPdf }` | 403, 404, 409, 422 | Enviada/Reenviada → Aprobada (valida firma/sello activa y genera PDF atómico) |
| POST | `/secretary/letters/{id}/observe` | SECRETARY | Campus | `ObserveDto { comentario }` | `200` | 400, 403, 404, 409 | Enviada/Reenviada → Observada |
| POST | `/secretary/letters/{id}/annul` | SECRETARY | Campus | `AnnulDto { motivo }` | `200` | 400, 403, 404, 409 | Enviada/Reenviada → Anulada |
| GET | `/letters/{id}/download` | Propietario; SECRETARY campus; COORDINATOR campus; AUDITOR global | Según rol | — | `application/pdf` (temporal) | 401, 403, 404, 409 (no Aprobada) | Descarga auditada (RNF-03) |
| GET | `/secretary/signature-config` | SECRETARY | Campus | — | `SignatureConfigView` | 401, 403 | Consulta firma, sello y datos del firmante del campus |
| PUT | `/secretary/signature-config` | SECRETARY | Campus | `UpdateSignatureConfigDto` + file (multipart) | `SignatureConfigView` | 400, 401, 403 | Actualiza firma, sello y datos del firmante (crea nueva versión) |

## 5. Módulo empresa

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| GET | `/companies` | STUDENT; COORDINATOR | Propio/campus | `?q&ruc` | `[CompanyDto]` | 401, 403 | — (coincidencia por RUC antes de crear) |
| POST | `/companies` | STUDENT; COORDINATOR | Propio/campus | `CreateCompanyDto { ruc?, razonSocial, direccion, contacto?, area?, esExtranjera }` | `201 { company }` | 400, 409 (RUC duplicado), 403 | — |
| PUT | `/companies/{id}` | Creador; COORDINATOR | Propio/campus | `UpdateCompanyDto` | `200` | 400, 403, 404, 409 | Cambio del catálogo auditado; no muta prácticas existentes (HU-10) |
| POST | `/companies/{id}/representatives` | STUDENT; COORDINATOR | Propio/campus | `CreateCompanyRepresentativeDto { nombre, cargo?, correo?, telefono?, otrosDatosContacto? }` | `201 { representative }` | 400, 403, 404 | Crea contacto sin cuenta de usuario |

`Company` y `CompanyRepresentative` son reutilizables. Ninguna actualización de estos catálogos cambia una práctica existente ni su `representativeSnapshot`; usar otra empresa requiere `POST /practices`.

## 6. Módulo práctica (expediente)

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| POST | `/practices` | STUDENT | Propio | `CreatePracticeDto { companyId, companyRepresentativeId, academicPeriodId, areaCargo, fechaInicio, fechaFin, horario, modalidad, letterRequestId? }` | `201 { practice, requirements[] }` (`PREPARATION`) | 400, 403, 409, 422 (perfil incompleto) | Captura representante y requisitos iniciales activos (HU-11) |
| GET | `/practices/mine` | STUDENT | Propio | `?estado&academicPeriodId` | `[PracticeSummaryDto]` | 401, 403 | — |
| GET | `/practices` | COORDINATOR | CampusSchool | `?estado&academicPeriodId&q&supervisorId` | `[PracticeSummaryDto]` paginado | 401, 403 | — |
| GET | `/practices/{id}` | Propietario; COORDINATOR mismo CampusSchool; SUPERVISOR asignado; AUDITOR global | Según rol | — | `PracticeDetailDto { empresa, representanteSnapshot, periodo, campusSchool, carta, requisitos[], horas, supervisiones, evaluaciones, checklist }` | 401, 403, 404 | — |
| PUT | `/practices/{id}` | STUDENT propietario | Propio | `UpdatePracticeDto` (solo `PREPARATION`; excluye empresa y representante) | `200` | 400, 403, 404, 409 | — (optimistic lock por versión) |
| GET | `/practices/{id}/requirements` | Propietario; COORDINATOR mismo CampusSchool; SUPERVISOR asignado; AUDITOR global | Según rol | — | `[PracticeRequirementDto { snapshot, document, currentVersion? }]` | 401, 403, 404 | Checklist derivado de snapshots inmutables |
| POST | `/practices/{id}/authorize` | COORDINATOR | Mismo CampusSchool | `{ Idempotency-Key }` | `200 { estado: AUTHORIZED }` | 403, 404, 409 (requisitos iniciales), 422 | `PREPARATION` → `AUTHORIZED` |
| POST | `/practices/{id}/activate` | COORDINATOR | Mismo CampusSchool | `{ justificacion? }` | `200 { estado: ACTIVE }` | 403, 404, 409 (revalida requisitos iniciales) | `AUTHORIZED` → `ACTIVE` |
| POST | `/practices/{id}/suspend` | COORDINATOR | Campus | `SuspendDto { motivo, fechaEfectiva }` | `200` | 400, 403, 404, 409 | Activa → Suspendida |
| POST | `/practices/{id}/reactivate` | COORDINATOR | Campus | `ReactivateDto { motivo }` | `200` | 400, 403, 404, 409 | Suspendida → Activa |
| POST | `/practices/{id}/cancel` | COORDINATOR | Campus | `CancelDto { motivo, fechaEfectiva }` | `200` | 400, 403, 404, 409 | → Cancelada (conserva historial) |
| POST | `/practices/{id}/beginClosing` | COORDINATOR | Campus | `{}` | `200` | 403, 404, 409 | Activa → En cierre |
| POST | `/practices/{id}/close` | COORDINATOR | Campus | `{ Idempotency-Key }` | `200 { estado: FINALIZADA }` | 403, 404, 409 (checklist con bloqueos) | En cierre → Finalizada |
| POST | `/practices/{id}/reopen` | COORDINATOR | Campus | `ReopenDto { motivo }` | `200` | 400, 403, 404, 409 | Finalizada/En cierre → Activa |
| GET | `/practices/{id}/checklist` | Propietario; COORDINATOR; SUPERVISOR asignado; AUDITOR | Según rol | `?etapa=INICIO\|CIERRE` | `ChecklistDto { elementos[], bloqueos[] }` | 401, 403, 404 | — (calculado, sin mutación) |
| POST | `/practices/{id}/supervisor` | COORDINATOR | Campus | `AssignSupervisorDto { supervisorId, motivo? }` | `201` | 400, 403, 404, 409 | Asigna; docente activo del campus (HU-20) |
| POST | `/practices/{id}/supervisor/reassign` | COORDINATOR | Campus | `ReassignDto { supervisorId, motivo }` | `200` | 400, 403, 404, 409 | Reasigna conservando historial |
| GET | `/supervisors` | COORDINATOR | Campus | `?estado=ACTIVO` | `[StaffDto]` | 401, 403 | — |

## 7. Módulo documentos

`DocumentRequirementDefinition` reemplaza `DocumentType`. Sus versiones enteras declaran `code`, `name`, `evidenceKind` (`PDF`/`DIGITAL_RECORD`), `stage` (`INITIAL`/`CLOSING`), `mandatory` y `active`. Al crear una práctica se copian las definiciones `INITIAL` activas a `PracticeRequirementSnapshot`; el catálogo posterior no altera el expediente y existe exactamente un `Document` por snapshot.

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| GET | `/practices/{id}/documents` | Propietario; COORDINATOR; SUPERVISOR asignado; AUDITOR | Según rol | — | `[DocumentDto { requirementSnapshot, versiones[], currentVersion }]` | 401, 403, 404 | — |
| POST | `/practices/{id}/documents` | STUDENT | Propio | `multipart: { requirementSnapshotId, file }` | `201 { document, version }` (`PENDING`) | 400, 413, 422 (validación técnica), 403, 404, 409 | Para snapshot `PDF`; carga/reemplazo crea nueva versión |
| POST | `/practices/{id}/documents/digital` | STUDENT | Propio | JSON `{ requirementSnapshotId, metadata }` | `201 { document, version }` (`PENDING`) | 400, 403, 404, 409, 422 | Para snapshot `DIGITAL_RECORD`; creación/reemplazo crea nueva versión |
| POST | `/documents/{documentId}/submit` | Propietario | Propio | `{ Idempotency-Key }` | `200 { estado: UNDER_REVIEW, versionId }` | 403, 404, 409 | `PENDING` → `UNDER_REVIEW` sobre la misma versión actual |
| GET | `/documents/{documentId}/versions` | Autorizado por ámbito | Según rol | — | `[DocumentVersionDto]` | 401, 403, 404 | — |
| POST | `/coordinator/documents/{documentId}/approve` | COORDINATOR | Mismo CampusSchool | `{ Idempotency-Key }` | `200` | 403, 404, 409 | Versión actual exacta `UNDER_REVIEW` → `APPROVED` (documento y versión inmutables) |
| POST | `/coordinator/documents/{documentId}/observe` | COORDINATOR | Mismo CampusSchool | `ObserveDto { comentario }` | `200` | 400, 403, 404, 409 | Versión actual exacta `UNDER_REVIEW` → `OBSERVED` |
| POST | `/coordinator/documents/{documentId}/annul` | COORDINATOR | Mismo CampusSchool | `AnnulDto { motivo }` | `200` | 400, 403, 404, 409 | Versión actual exacta `UNDER_REVIEW` → `ANNULLED` |
| GET | `/documents/versions/{versionId}/download` | Autorizado por ámbito | Según rol | — | `application/pdf` desde almacenamiento privado | 401, 403, 404, 409 (sin `FileAsset`) | Descarga autorizada y auditada |

La carga inicial de definiciones obligatorias es: carta de aceptación (`PDF`), convenio PPP (`PDF`), plan de trabajo (`PDF`) e información de empresa (`DIGITAL_RECORD`), todas `INITIAL`. Un reemplazo solo se permite desde `PENDING` u `OBSERVED`; desde `OBSERVED` crea otra versión `PENDING`, que luego debe enviarse. No existen endpoints de borrado. Para PDF se valida únicamente extensión `.pdf`, MIME `application/pdf`, bytes mágicos `%PDF`, archivo no vacío y máximo configurable; no se realiza OCR ni validación de firma o semántica. `FileAsset` guarda `storageKey`, `sha256`, MIME, tamaño, nombre original y metadata, nunca bytes. La carta generada usa su flujo propio (módulo 4).

## 8. Módulo horas

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| GET | `/practices/{id}/hours` | Propietario; COORDINATOR; SUPERVISOR asignado; AUDITOR | Según rol | `?estado&desde&hasta` | `[HourRecordDto]` | 401, 403, 404 | — |
| POST | `/practices/{id}/hours` | STUDENT | Propio | `CreateHourDto { fecha, descripcion, horas, evidenciaFile? }` | `201` (Borrador) | 400 (0<h≤24), 403, 404, 409 (práctica no Activa), 422 (fecha fuera de rango) | — (HU-22) |
| PUT | `/hours/{id}` | Propietario | Propio | `UpdateHourDto` | `200` | 400, 403, 404, 409 (solo Borrador/Observado) | — |
| POST | `/hours/{id}/submit` | Propietario | Propio | `{ Idempotency-Key }` | `200 { estado: ENVIADO }` | 403, 404, 409 | Borrador → Enviado |
| POST | `/hours/{id}/resubmit` | Propietario | Propio | `{ correcciones, Idempotency-Key }` | `200 { estado: ENVIADO }` | 403, 404, 409 | Observado → Enviado (nueva versión) |
| POST | `/coordinator/hours/{id}/validate` | COORDINATOR | Campus | `{}` | `200 { estado: VALIDADO }` | 403, 404, 409 | Enviado → Validado (suma al total) |
| POST | `/coordinator/hours/{id}/observe` | COORDINATOR | Campus | `ObserveDto { comentario }` | `200` | 400, 403, 404, 409 | Enviado → Observado |
| GET | `/students/me/hours/summary` | STUDENT | Propio | — | `{ porEstado{}, porPractica[], totalValidado, faltante, meta }` | 401, 403 | — (derivado, HU-24) |

## 9. Módulo supervisiones

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| GET | `/practices/{id}/supervisions` | Propietario; COORDINATOR; SUPERVISOR asignado; AUDITOR | Según rol | `?tipo&estado` | `[SupervisionDto]` | 401, 403, 404 | — |
| POST | `/practices/{id}/supervisions` | COORDINATOR | Campus | `CreateSupervisionDto { tipo, docenteId, fechaProgramada, advertenciaJustificada? }` | `201` (Programada) | 400, 403, 404, 409 (duplicado tipo activo) | — (HU-25) |
| POST | `/supervisions/{id}/reschedule` | COORDINATOR | Campus | `RescheduleDto { nuevaFecha, motivo }` | `200` | 400, 403, 404, 409 | Programada/Vencida → Reprogramada |
| POST | `/supervisions/{id}/complete` | SUPERVISOR asignado | Asignado | `CompleteSupervisionDto { fechaReal, modalidad, observaciones, acuerdos, evidenciaFile? }` | `200 { estado: REALIZADA }` | 400, 403, 404, 409 | Programada/Reprogramada/Vencida → Realizada |
| POST | `/supervisions/{id}/annul` | COORDINATOR | Campus | `AnnulDto { motivo }` | `200` | 400, 403, 404, 409 | Programada → Anulada |
| GET | `/supervisor/supervisions` | SUPERVISOR | Asignado | `?estado=PROGRAMADA\|VENCIDA` | `[SupervisionDto]` | 401, 403 | — (panel del docente, HU-21) |

## 10. Módulo evaluaciones

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| GET | `/evaluations/templates` | Autenticado | Según rol | `?fase&vigente=true` | `[TemplateDto { dimensiones[], items[] }]` | 401 | — |
| POST | `/practices/{id}/evaluations` | SUPERVISOR asignado | Asignado | `CreateEvaluationDto { fase, templateVersionId }` | `201` (En proceso, borrador) | 400, 403, 404, 409 | Pendiente → En proceso (HU-28) |
| PUT | `/evaluations/{id}/responses` | SUPERVISOR asignado | Asignado | `SaveResponsesDto { respuestas: [{ itemId, valor\|NA }] }` | `200` | 400, 403, 404, 409 (finalizada) | Borrador (sin transición) |
| POST | `/evaluations/{id}/finalize` | SUPERVISOR asignado | Asignado | `{ Idempotency-Key }` | `200 { estado: FINALIZADA }` | 400, 403, 404, 409 | En proceso → Finalizada (congela plantilla) |
| POST | `/evaluations/{id}/reopen` | COORDINATOR | Campus | `ReopenDto { motivo }` | `200` | 400, 403, 404, 409 | Finalizada → Reabierta |
| POST | `/practices/{id}/company-evaluation` | STUDENT | Propio | `multipart: { file (PDF firmado), empresa, supervisorEmpresarial, periodo, dias, horasDeclaradas, notaGeneral (0–20) }` | `201` (Pendiente) | 400, 413, 422, 403, 404, 409 | — (HU-29) |
| POST | `/coordinator/company-evaluations/{id}/approve` | COORDINATOR | Campus | `{}` | `200` | 403, 404, 409 | En revisión → Aprobado |
| POST | `/coordinator/company-evaluations/{id}/observe` | COORDINATOR | Campus | `ObserveDto { comentario }` | `200` | 400, 403, 404, 409 | En revisión → Observado (nueva versión) |
| GET | `/practices/{id}/evaluations/summary` | Propietario; COORDINATOR; SUPERVISOR asignado; AUDITOR | Según rol | — | `{ fases[], empresarial{}, alertas[] }` | 401, 403, 404 | — (alertas de discrepancia de horas, HU-30) |

## 11. Módulo cierre y reconocimiento

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| POST | `/practices/{id}/documents` (snapshot `CLOSING` con evidencia PDF) | STUDENT | Propio | `multipart` (ver módulo 7) | `201` (`PENDING`) | 400, 413, 422, 403, 404, 409 | — (HU-32, HU-33; planificado) |
| GET | `/practices/{id}/closing-checklist` | Propietario; COORDINATOR; SUPERVISOR asignado; AUDITOR | Según rol | — | `ClosingChecklistDto { documentoCierre, supervisiones, evaluaciones, horasDeclaradasVsValidadas, bloqueos[] }` | 401, 403, 404 | — (HU-34, sin mutación) |
| POST | `/recognitions` | COORDINATOR | Campus | `CreateRecognitionDto { studentProfileId, tipo, numero, fecha, file }` | `201` (Registrado) | 400, 403, 404, 409 (requisito no Cumplido), 422 | Cumplido → Reconocido (HU-37) |
| GET | `/recognitions/{studentId}` | COORDINATOR; AUDITOR; propio estudiante | Según rol | — | `RecognitionDto` | 401, 403, 404 | — |
| POST | `/recognitions/{id}/annul` | COORDINATOR | Campus | `AnnulDto { motivo }` | `200` | 400, 403, 404, 409 | Reconocido → Cumplido (historial conservado) |
| GET | `/students/me/ppp-status` | STUDENT | Propio | — | `{ progreso, cumplimiento, meta, estadoGeneral }` | 401, 403 | — (derivado, HU-36) |

## 12. Módulo monitoreo, reportes y auditoría

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| GET | `/dashboard/me` | STUDENT | Propio | — | `{ carta, practicas[], pendientes[], alertas[] }` | 401, 403 | — (HU-38) |
| GET | `/dashboard/coordinator` | COORDINATOR | Campus | `?periodId&estado&q` | `{ indicadores[], listados }` | 401, 403 | — (HU-39) |
| GET | `/dashboard/supervisor` | SUPERVISOR | Asignado | `?estado` | `{ practicasAsignadas[], supervisiones[], pendientes[] }` | 401, 403 | — (HU-21) |
| GET | `/dashboard/secretary` | SECRETARY | Campus | `?estado` | `{ bandejaCartas[], contadores }` | 401, 403 | — |
| GET | `/dashboard/auditor` | AUDITOR | Tres campus | `?campusId&periodId&schoolId&estado` | `{ consolidado, porCampus[] }` | 401, 403 | — (HU-43) |
| GET | `/reports/process` | COORDINATOR | Campus | `?periodId&formato=EXCEL\|PDF` | `application/octet-stream` | 401, 403 | Exportación auditada (HU-42) |
| GET | `/reports/annual` | COORDINATOR | Campus | `?anio&formato` | archivo | 401, 403 | Exportación auditada |
| GET | `/reports/consolidated` | AUDITOR | Tres campus | `?periodId&formato` | archivo | 401, 403 | — |
| GET | `/audit/events` | COORDINATOR (campus) / AUDITOR (global) / SYSTEM_ADMIN (global) | Según rol | `?entidad&entidadId&accion&desde&hasta&page` | `[AuditEventDto]` | 401, 403 | — (HU-44, inmutable) |
| GET | `/notifications` | Autenticado | Propio | `?leida` | `[NotificationDto]` | 401 | — (HU-40) |
| POST | `/notifications/{id}/read` | Autenticado | Propio | `{}` | `200` | 401, 403, 404 | No leída → Leída |

## 13. Módulo administración e importación

| Método | Ruta | Actor | Ámbito | DTO | Respuesta | Errores | Transición |
|---|---|---|---|---|---|---|---|
| GET/POST/PUT | `/admin/campuses`, `/admin/schools`, `/admin/school-campuses`, `/admin/users`, `/admin/roles` | SYSTEM_ADMIN | Global | DTOs CRUD controlados | `200/201` | 401, 403, 409 | — (estructura y accesos) |
| POST | `/imports/validate` | COORDINATOR | Campus | `multipart: plantilla.xlsx` | `200 { validas[], errores[], resumen }` | 400, 403, 422 | — (HU-45, validación previa) |
| POST | `/imports/confirm` | COORDINATOR | Campus | `{ batchId, Idempotency-Key }` | `201 { importadas[], total }` | 400, 403, 404, 409 | Crea prácticas activas con horas de avance (origen auditado) |

## 14. Ejemplos de acción

```http
POST /api/v1/practices/{id}/authorize
Authorization: Bearer <token>
Idempotency-Key: 8f14e45f-ceea-4e31-b7b5-9a1c9e2f3d4a

→ 200 { "id": "prac_1", "estado": "AUTORIZADA" }
→ 409 { "error": "Conflict",
        "message": "La práctica no cumple el checklist de inicio: faltan documentos aprobados",
        "allowedTransitions": ["cancel"] }
```

```http
POST /api/v1/coordinator/hours/{id}/observe
Authorization: Bearer <token>

{ "comentario": "Falta evidencia del 12/07; verificar horario real" }

→ 200 { "id": "hr_5", "estado": "OBSERVADO" }
```

## 15. Mapa de transiciones por endpoint (resumen)

| Máquina | Endpoints que transicionan |
|---|---|
| Solicitud de carta | `/letters/{id}/submit`, `/resubmit`, `/secretary/letters/{id}/approve`, `/observe`, `/annul` |
| Documento | `/practices/{id}/documents`, `/practices/{id}/documents/digital` (crean versión), `/documents/{id}/submit`, `/coordinator/documents/{id}/approve`, `/observe`, `/annul` |
| Horas | `/practices/{id}/hours` (crea), `/hours/{id}/submit`, `/resubmit`, `/coordinator/hours/{id}/validate`, `/observe` |
| Supervisión | `/practices/{id}/supervisions` (crea), `/supervisions/{id}/reschedule`, `/complete`, `/annul` |
| Evaluación | `/practices/{id}/evaluations` (crea), `/evaluations/{id}/finalize`, `/reopen` |
| Práctica | `/practices/{id}/authorize`, `/activate`, `/suspend`, `/reactivate`, `/cancel`, `/beginClosing`, `/close`, `/reopen` |
| Cumplimiento PPP | `/recognitions` (registra), `/recognitions/{id}/annul` |
