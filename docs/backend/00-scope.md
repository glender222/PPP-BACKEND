# 00 — Alcance del sistema y fuentes

> Sistema de Prácticas Preprofesionales (PPP) — UPeU.
> Versión del documento: 1.0 — 2026-08-04.
> Estado: referencia de alcance para el backend del MVP.

## 1. Orden de autoridad de las fuentes

Para resolver cualquier ambigüedad durante el diseño e implementación se aplica este orden:

1. **Alcance y decisiones confirmadas** (instrucción de arquitectura y `DEC-01` a `DEC-08`).
2. **Product Backlog, matriz documental, permisos, reglas y estados** (hojas del `Product_Backlog_PPP_MVP_Completo.xlsx`).
3. **Documentos históricos del proceso** (`DOC-01` a `DOC-16`), solo como evidencia de proceso.
4. **Diseños de interfaz**, únicamente para descubrir acciones y consultas; nunca para fijar reglas.

### 1.1. Valores demostrativos descartados

Los valores que aparecen en expedientes, fichas o interfaces de ejemplo son demostrativos y **no se convierten en reglas**:

- 400 horas, 868 horas, 50 horas de proyección social (gestión de proyección social fuera del MVP).
- Nombres, códigos, ciclos y periodos de los expedientes reales (p. ej. "102-2021", "System Strategy").
- Contadores, notas de ejemplo (p. ej. nota 18) y números de resolución (p. ej. "Res. N° 1077").

La única meta cuantitativa adoptada es la **meta de PPP configurable, inicializada en 700 horas** (RN-07, DEC-05).

## 2. Alcance confirmado (MVP)

| Área | Decisión |
|---|---|
| Aplicación | Web responsive, una sola aplicación para los tres campus; sin app nativa. |
| Campus y escuela | Ingeniería de Sistemas en **tres campus**; estructura configurable para otras escuelas, **no activadas** en el MVP. |
| Base de datos | **Una sola base de datos**; no se separa una base por campus. |
| Expediente | **Una práctica equivale a un expediente independiente**. |
| Acumulación | Un estudiante puede **acumular horas validadas de varias prácticas**. |
| Secretaría | Participa dentro del sistema (cuenta y bandeja de cartas de su campus). |
| Carta | Se **genera desde plantilla**; el estudiante **no sube la carta**. |
| Empresa | **Sin cuenta**; participa mediante documentos firmados externamente. |
| Documentos | PDF con revisiones, observaciones y versiones; aprobados inmutables. |
| Supervisión | Programación y registro de supervisiones por el docente asignado. |
| Evaluación empresarial | Cargada como **PDF firmado externamente**. |
| Cierre | Cierre por práctica y documento individual indispensable de reconocimiento. |
| Auditoría | Auditor institucional con acceso **global de solo lectura**. |
| Identidad | Correo institucional, sin dependencia de Lamb Academic. |
| Autorización | Siempre considera rol, campus, escuela, propiedad o asignación. |
| Totales | Horas y dashboards **derivados de los registros válidos**, nunca cifras editables. |

## 3. Roles

| Rol | Alcance operativo |
|---|---|
| `SYSTEM_ADMIN` | Administra estructura, accesos, parámetros y seguridad. **No adquiere automáticamente permisos operativos de coordinador.** |
| `AUDITOR` | Consulta global de los tres campus, **solo lectura; nunca modifica datos**. |
| `COORDINATOR` | Opera sobre su campus (autorizaciones, revisiones, cierre). |
| `SECRETARY` | Bandeja y revisión de cartas de su campus. |
| `SUPERVISOR` | Docente supervisor: prácticas asignadas (supervisiones y evaluaciones). |
| `STUDENT` | Propiedad sobre su perfil, solicitudes, expedientes y registros. |

Nota: el backlog (DEC-01) menciona "cinco roles internos" (estudiante, secretaría, docente, coordinador, auditor). `SYSTEM_ADMIN` se incorpora como **rol técnico de plataforma**, sin funciones de negocio; ambos conceptos conviven (ver contradicción C-01).

## 4. Fuera del alcance del MVP

- Aplicación móvil nativa.
- WhatsApp automatizado.
- Biometría y geolocalización.
- Integración actual con Lamb Academic (ni sincronización ni validación).
- Validación del curso mediante API (API de elegibilidad futura, no construida).
- Cuenta para representantes empresariales.
- Gestión de Consejo, sesiones, agendas y actas; resoluciones generales.
- Activación de otras escuelas.
- Elección de proveedor de infraestructura (decisión de implementación).
- Proyección social (50 horas): no se gestiona ni mezcla en el cálculo del MVP.
- Validación semántica de firmas/OCR (solo validación técnica de PDF).
- Fórmula combinada de nota final entre escala docente (1–5) y empresarial (0–20).

## 5. Reglas de negocio rectoras (síntesis de RN-01 a RN-15)

- El proceso operativo comienza con la solicitud de carta de presentación (RN-01).
- La carta se genera desde plantilla; el estudiante corrige datos observados y no re-subirá la carta (RN-03).
- Empresa sin cuenta; sus documentos firmados los carga el estudiante y los revisa el coordinador (RN-05).
- Solo horas **Validadas** suman al avance; el **cumplimiento** usa horas de prácticas **Finalizadas** (RN-06).
- Meta inicial **700 horas configurable** (RN-07).
- La validación automática es técnica; firma, sello y coherencia requieren revisión humana (RN-08).
- Documentos observados conservan comentarios y versiones; aprobados no se sobrescriben (RN-09).
- Secretaría y coordinador por campus; docente por asignación; auditor en tres campus sin editar (RN-10).
- Migración inicial solo de prácticas activas (RN-15, DEC-07).

## 6. Configuración pendiente, no bloqueante

Estos ítems se registran como configuración **pendiente** con diseño de interfaz reemplazable (ADR-003, ADR-005); no bloquean el desarrollo:

| ID | Pendiente | Impacto | Diseño previsto |
|---|---|---|---|
| CFG-01 | Proveedor institucional de identidad | Inicio de sesión (HU-01) | Interfaz `IdentityProvider` reemplazable; en desarrollo se usa un proveedor simulado/credenciales dev. |
| CFG-02 | Dominio(s) de correo institucional permitidos | Filtro de login (HU-01) | Lista configurable por parámetro; por defecto vacía = modo dev. |
| CFG-03 | Numeración final de cartas | Carta aprobada (HU-06/HU-07) | Regla de numeración pluggable + plantilla; la numeración institucional real se configura sin rediseño. |
| CFG-04 | Plantilla oficial vigente de carta (DOC-07 es histórica) | Generación PDF (HU-06) | Plantilla versionada por campus/escuela cargada como recurso. |
| CFG-05 | Formato vigente por validar de fichas de evaluación docente y empresa (DOC-02, DOC-03) | Carga inicial de instrumentos (HU-28) | Instrumentos modelados como datos versionados; la versión inicial reproduce las fichas actuales. |
| CFG-06 | Hosting, dominio público, respaldo y operación (DEC-08, RNF-06) | Despliegue | Sin efecto sobre modelo de datos ni API; parámetros RPO/RTO ajustables. |
| CFG-07 | Meta de horas y parámetros operativos | Cálculo de cumplimiento | Parámetros versionados gestionados por `SYSTEM_ADMIN`; valor inicial 700. |
| CFG-08 | Documento individual de reconocimiento: tipos y numeración | Reconocimiento (HU-37) | Catálogo de tipos + campos de número/fecha; sin integración con Consejo. |

## 7. Criterios de aceptación globales del MVP

1. Los cinco roles funcionales operan con aislamiento correcto por campus/asignación.
2. La carta se solicita, genera, observa, corrige, aprueba y descarga dentro del sistema.
3. Un estudiante gestiona varias prácticas sin mezclar expedientes y con horas consolidadas.
4. Documentos, horas, supervisiones y evaluaciones conservan estados, comentarios, versiones y auditoría.
5. El coordinador autoriza, monitorea, cierra prácticas y registra el reconocimiento individual.
6. El auditor consulta los tres campus en solo lectura.
7. Reportes y totales se reconcilian con el detalle de los expedientes.
