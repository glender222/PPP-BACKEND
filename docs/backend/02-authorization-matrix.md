# 02 — Matriz de autorización

> Toda decisión de acceso evalúa: **rol + ámbito + recurso + condición**. Las respuestas ante acceso cruzado son `403 Forbidden` (RNF-02); en consultas de identidad sensible puede devolverse `404` para no revelar existencia (ver A-05).

## 1. Modelo de autorización

Cada permiso es una tupla:

```
(rol, ámbito, recurso, condición, escritura/lectura, respuesta ante acceso cruzado)
```

| Componente | Valores |
|---|---|
| Rol | `SYSTEM_ADMIN`, `AUDITOR`, `COORDINATOR`, `SECRETARY`, `SUPERVISOR`, `STUDENT` |
| Ámbito | `PROPIO` (propiedad), `ASIGNADO` (asignación de supervisión), `CAMPUS` (campus del rol), `TRES_CAMPUS` (auditor), `GLOBAL_CONFIG` (admin) |
| Recurso | Entidad/acción del catálogo (carta, documento, horas, supervisión, evaluación, práctica, reconocimiento, auditoría, catálogos, parámetros) |
| Condición | Estado del recurso, periodo, vigencia de asignación, completitud de perfil, etc. |
| Acceso | `LECTURA` o `ESCRITURA` (crear/editar/transicionar) |
| Respuesta cruzada | `403` por defecto; `404` opcional en recursos sensibles para no filtrar existencia |

### 1.1. Reglas de ámbito

- R-A1: `SECRETARY` y `COORDINATOR` operan **exclusivamente sobre su campus y escuela** (RN-10); su asignación de rol declara ambos y cada recurso se contrasta con su `CampusSchool`.
- R-A2: `SUPERVISOR` accede solo a prácticas con `PracticeAssignment` vigente hacia su usuario (HU-21).
- R-A3: `STUDENT` accede solo a entidades donde es propietario (perfil, cartas, prácticas, registros) (HU-03).
- R-A4: `AUDITOR` lee los tres campus y **nunca** escribe; ninguna transición ni comando acepta su rol (HU-43, I-17).
- R-A5: `SYSTEM_ADMIN` administra estructura, accesos, parámetros y seguridad; **no hereda** permisos operativos de coordinador ni secretaría.
- R-A6: El acceso siempre exige cuenta activa, sesión vigente y perfil mínimo para operaciones de negocio.

## 2. Matriz por acción

Leyenda de escritura: `E` (crear/editar/transicionar), `L` (leer), `—` (sin acceso).

### 2.1. Identidad, perfil y plataforma

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Autenticarse (login/logout) | Propio E | Propio E | Propio E | Propio E | Propio E | Propio E |
| Completar/consultar perfil propio | Propio E/L | Propio E/L | Propio E/L | Propio E/L | Propio E/L | Propio E (bloqueado hasta completo para trámites) |
| Gestionar campus/escuelas/catálogos | Global E | — | — | — | — | — |
| Gestionar parámetros (meta 700 h, dominios, límites) | Global E | — | — | — | — | — |
| Gestionar usuarios/roles/accesos | Global E | — | — | — | — | — |
| Gestionar periodos de un campus | Global E | — | Campus E | — | — | — |
| Leer bitácora de auditoría | Global L | Tres campus L | Campus L | — | — | — |

### 2.2. Carta de presentación

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Crear solicitud (borrador) | — | — | — | — | — | Propio E |
| Guardar borrador / enviar solicitud | — | — | — | — | — | Propio E (Borrador→Enviada) |
| Corregir y reenviar solicitud observada | — | — | — | — | — | Propio E (solo Observada) |
| Revisar bandeja de cartas | — | — | Campus L | Campus E (aprobar/observar/anular) | — | — |
| Ver historial/estado de una solicitud | — | Tres campus L | Campus L | Campus L | — | Propio L |
| Generar vista previa (plantilla) | — | — | Campus L | Campus E | — | Propio L |
| Descargar carta aprobada | — | Tres campus L | Campus L | Campus L | — | Propio L (solo propia) |
| Ver plantillas de carta | Global L | — | Campus L | Campus L | — | L (vigente) |

Condiciones: observar/anular exigen comentario; aprobar bloquea datos y genera PDF final; la descarga solo de versión Aprobada y se audita.

### 2.3. Empresa y práctica (expediente)

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Buscar empresa por RUC | — | — | Campus L | — | — | Propio E (búsqueda para su uso) |
| Registrar/actualizar empresa reutilizable | — | — | Campus E | — | — | Propio E (actualización auditada) |
| Registrar representante sin cuenta | — | — | Campus E | — | — | Propio E |
| Crear expediente de práctica | — | — | — | — | — | Propio E (`PREPARATION`) |
| Editar práctica **En preparación** | — | — | — | — | — | Propio E |
| Autorizar práctica | — | — | CampusSchool E (exige checklist inicial) | — | — | — |
| Activar práctica | — | — | CampusSchool E (fecha de inicio o acción justificada) | — | — | — |
| Suspender/cancelar/reactivar práctica | — | — | Campus E (motivo obligatorio) | — | — | — |
| Mover a En cierre | — | — | Campus E | — | — | — |
| Finalizar práctica | — | — | Campus E (checklist de cierre sin bloqueos) | — | — | — |
| Reabrir práctica finalizada | — | — | Campus E (motivo obligatorio) | — | — | — |
| Ver expediente completo | — | Tres campus L | Campus L | — | Asignado L | Propio L |
| Ver checklist (inicio/cierre) | — | Tres campus L | Campus L | — | Asignado L | Propio L |
| Asignar/reasignar supervisor | — | — | Campus E (docentes activos del campus; motivo en reasignación) | — | — | — |
| Importar prácticas activas | — | — | Campus E (plantilla controlada, validación previa) | — | — | — |

Condiciones: la práctica conserva empresa, representante elegido y `representativeSnapshot`; editar esos catálogos nunca la modifica y cambiar de empresa crea un expediente nuevo. Autorizar y activar exigen que todos los snapshots iniciales obligatorios tengan documento `APPROVED` (HU-18, I-09); una práctica no autorizada no admite horas ni evaluaciones.

### 2.4. Documentos del expediente

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Cargar PDF para requisito de su expediente | — | — | — | — | — | Propio E (snapshot `PDF`; crea versión `PENDING`) |
| Crear/reemplazar registro digital | — | — | — | — | — | Propio E (snapshot `DIGITAL_RECORD`; crea versión `PENDING`) |
| Reemplazar evidencia | — | — | — | — | — | Propio E (solo `PENDING`/`OBSERVED`; nueva versión) |
| Enviar versión actual | — | — | — | — | — | Propio E (`PENDING`→`UNDER_REVIEW`, misma versión) |
| Revisión documental (aprobar/observar/anular) | — | — | Campus E (motivo si observar/anular) | Solo carta E | — | — |
| Ver versiones y comentarios | — | Tres campus L | Campus L | Campus L (cartas) | Asignado L (solo lectura) | Propio L |
| Descargar versión PDF por endpoint autorizado | — | Tres campus L | CampusSchool L | CampusSchool L | Asignado L | Propio L |
| Ver documento aprobado | — | Tres campus L | Campus L | Campus L | Asignado L | Propio L |

Condiciones: cada revisión apunta a la versión actual exacta. `OBSERVED` solo se corrige creando otra versión `PENDING` y enviándola; `APPROVED` congela documento y versión. No hay ruta de borrado. Para PDF solo se validan extensión `.pdf`, MIME `application/pdf`, bytes mágicos `%PDF`, contenido no vacío y tamaño máximo configurable; no hay OCR ni validación de firma o semántica. Los bytes no están en la base y toda descarga pasa por el endpoint autorizado y genera auditoría; un registro digital no tiene descarga.

### 2.5. Horas

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Registrar/enviar horas | — | — | — | — | — | Propio E (práctica Activa) |
| Corregir horas observadas | — | — | — | — | — | Propio E (solo Observado) |
| Validar horas | — | — | Campus E | — | — | — |
| Observar horas | — | — | Campus E (comentario obligatorio) | — | — | — |
| Ver horas de una práctica | — | Tres campus L | Campus L | — | Asignado L | Propio L |
| Ver resumen consolidado de horas | — | Tres campus L | Campus L | — | Asignado L (por práctica) | Propio L |

Condiciones: solo Validado suma (RN-06); sin edición directa de horas ajenas; agregados derivados.

### 2.6. Supervisiones

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Programar supervisión | — | — | Campus E | — | — | — |
| Reprogramar (motivo obligatorio) | — | — | Campus E | — | — | — |
| Registrar realización (finalizar) | — | — | — | — | Asignado E | — |
| Reabrir supervisión realizada | — | — | Campus E (motivo) | — | — | — |
| Ver supervisión y resultado | — | Tres campus L | Campus L | — | Asignado L | Propio L |

Condiciones: una activa del mismo tipo por práctica (HU-25); solo el docente asignado completa (HU-26); vencida se deriva por fecha.

### 2.7. Evaluaciones

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Consultar plantillas vigentes | Global L | — | Campus L | — | L | L |
| Completar evaluación docente (borrador/finalizar) | — | — | — | — | Asignado E (fase correspondiente) | — |
| Reabrir evaluación finalizada | — | — | Campus E (motivo) | — | — | — |
| Cargar evaluación empresarial (PDF firmado) | — | — | — | — | — | Propio E |
| Aprobar/observar evaluación empresarial | — | — | Campus E (observar con comentario) | — | — | — |
| Ver matriz de evaluaciones por práctica | — | Tres campus L | Campus L | — | Asignado L | Propio L |

Condiciones: NA excluido del cálculo; sin fórmula combinada de nota final; versión de plantilla congelada al finalizar (HU-31).

### 2.8. Cierre y reconocimiento

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Cargar informe final / constancia | — | — | — | — | — | Propio E (práctica en cierre o activa) |
| Consultar checklist de cierre | — | Tres campus L | Campus L | — | Asignado L | Propio L |
| Finalizar práctica (tras checklist) | — | — | Campus E | — | — | — |
| Registrar documento de reconocimiento | — | — | Campus E (requisito Cumplido) | — | — | — |
| Ver estado del requisito PPP | — | Tres campus L | Campus L | — | — | Propio L |
| Anular reconocimiento | — | — | Campus E (motivo; mantiene historial) | — | — | — |

### 2.9. Monitoreo, reportes y notificaciones

| Acción | SYSTEM_ADMIN | AUDITOR | COORDINATOR | SECRETARY | SUPERVISOR | STUDENT |
|---|---|---|---|---|---|---|
| Dashboard del estudiante | — | — | — | — | — | Propio L |
| Dashboard operativo | — | Tres campus L | Campus L | Cartas campus L | Asignado L | — |
| Dashboard consolidado (3 campus) | — | Tres campus L | — | — | — | — |
| Reportes y exportaciones | Global L (config) | Tres campus L | Campus L | — | Asignado L | Propio L |
| Notificaciones propias | Propio L | Propio L | Propio L | Propio L | Propio L | Propio L |
| Marcar notificación leída | Propio E | Propio E | Propio E | Propio E | Propio E | Propio E |

## 3. Respuestas ante acceso cruzado (estándar)

| Escenario | Respuesta |
|---|---|
| Usuario sin sesión o token vencido | `401` |
| Rol no autorizado para la acción | `403` |
| Recurso de otro campus / no asignado / no propio | `403` (o `404` en identidad sensible: no revelar existencia; ver A-05) |
| Auditor intenta escritura o transición | `403` antes de tocar el servicio |
| SYSTEM_ADMIN intenta acción operativa | `403` (no hereda coordinador) |
| Transición inválida desde el estado actual | `409 Conflict` (con detalle de transiciones permitidas) |
| Violación de regla de negocio (perfil incompleto, meta, horas fuera de rango) | `422` o `409` con motivo accionable |
| Archivo que no supera validación técnica | `413` (tamaño) o `422` (formato/estructura) |

## 4. Implementación prevista (no código)

- Guard global de autenticación; guard por módulo para rol.
- Resolución de ámbito centralizada: `(campusId, schoolId)` del recurso vs `UserRole` del actor, con fallo `DENY`.
- Comprobaciones de propiedad/asignación en el servicio de dominio, no solo en el guard (defensa en profundidad).
- Cada transición expone su propia política (ver 03); el guard valida rol/ámbito y el servicio valida estado + condiciones.
