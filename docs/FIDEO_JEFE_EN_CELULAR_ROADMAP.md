# Fideo Jefe En Celular Roadmap

Este documento baja la vision de Fideo como "control desk" a Fideo como "jefe en celular":

- vive en un telefono dedicado
- escucha y recibe reportes
- reparte trabajo
- persigue acuses y cierres
- empuja la operacion, no solo la refleja

## Donde estamos hoy

La base fuerte ya existe:

- backend PocketBase con auth, workspace remoto y snapshot versionado compartido
- rutas server-side para interpretar, corregir, aprobar, revertir y reportar trabajo
- slices normalizados de ventas, inventario, clientes, actividad y caja
- identidad push por empleado en `fideo_users` con `employeeId` y `pushExternalId`
- OneSignal server-side ya conectado para eventos operativos y escalaciones vivas
- `taskAssignments` y `taskReports` ya materializados en PocketBase y reconstruidos al snapshot
- vistas reales para `PackerView`, `DelivererView`, `ActionCenter` y `Deliveries` leyendo la misma cola
- SLA vivo para tareas bloqueadas, reportes abiertos de severidad alta y tareas sin acuse
- loop real de entregas y operacion comercial

La brecha principal ya no es "poner otro dashboard". Es cerrar el runtime operativo personal:

- extender el contrato de identidad por empleado a clientes staff mas cerrados
- expandir subscriptions y presencia mas alla de la sesion actual, solo donde de verdad suban despacho y seguimiento
- bandejas personales mas cerradas para Admin/Cajero y mejor triage de excepciones
- ampliar el SLA mas alla del primer timeout y la severidad alta
- seguimiento mas fino despues del primer ack

## Capa actual del producto

### 1. Identidad push cerrada por empleado

La capa server-side ya esta cerrada alrededor del empleado, no solo del usuario:

- PocketBase puede targetear por `include_aliases.external_id` o por `filters`,
- resuelve audiencia por `employeeId` cuando la tarea o el reporte ya trae owner operativo,
- usa `pushExternalId` como override de `external_id` si existe,
- cae a `fideo_users.id` cuando no existe override,
- conserva tags `app`, `workspace_slug`, `role` y `employee_id` para fallback limpio.

La base web ya esta alineada con ese contrato: prefiere `pushExternalId` y cae a `fideo_users.id`. Lo que sigue es llevar el mismo sujeto tecnico a clientes staff mas cerrados y dedicados.

### 2. PocketBase realtime operativo

PocketBase ya es la capa realtime actual en sentido operativo:

- el workspace remoto vive versionado,
- `bootstrap`, `persist`, `approve` y `/api/fideo/tasks/report` ya hacen roundtrip server-side sobre el mismo runtime,
- `taskAssignments` y `taskReports` se materializan en colecciones reales y se reconstruyen al snapshot,
- el cliente recarga la ultima version cuando aparece un `409`,
- la sesion actual ya se suscribe al snapshot activo y reporta presencia con heartbeat,
- push y escalacion salen de cambios reales del backend.

La nota honesta aqui es igual de importante: esto ya es realtime operativo, pero no multiplayer fino. Hay suscripcion del snapshot activo y presencia de la sesion actual; no hay todavia colaboracion record-by-record ni una vista global de presencia del staff.

### 3. Loop de tarea y SLA vivo

La capa operativa ya no es solo `taskAssignments`. Hoy el loop actual incluye:

- `taskAssignments` con estados `assigned`, `acknowledged`, `in_progress`, `blocked`, `done`,
- ownership por `employeeId` y rol,
- timestamps de acuse, inicio, bloqueo y cierre,
- `taskReports` reales con `kind`, `status`, `severity`, `summary`, `detail`, `evidence` y `escalationStatus`,
- ownership del bloqueo que se queda en el `employeeId` que lo reporto, o en la cola del rol si aun no habia persona,
- escalacion a `Admin` cuando una `taskAssignment` entra a `blocked`,
- escalacion a `Admin` cuando entra un reporte abierto con severidad operativa (`blocker`, `incident`, `high`),
- escalacion a `Admin` cuando una tarea sigue en `assigned` sin `acknowledgedAt` pasado el umbral,
- trazabilidad del intento de envio en logs server-side.

El umbral de falta de acuse cae hoy en `20` minutos por default y se gobierna con `FIDEO_TASK_ACK_ESCALATION_MINUTES`.

## Lo siguiente sobre esta capa

- alinear el cliente staff al mismo contrato `employeeId` + `pushExternalId` o `fideo_users.id`
- usar subscriptions de PocketBase solo en bandejas donde eliminen friccion real
- enriquecer formularios de reporte, evidencia y cierre sin duplicar el loop
- ampliar el SLA por prioridad, horario, ventana y politica por rol
- volver mas personales las vistas de excepcion para Admin/Cajero

## Roadmap por prioridad

### P0 - Identidad push por empleado de punta a punta

Estado: base web cerrada; falta llevar el contrato a clientes staff mas dedicados.

Objetivo: que push, ownership, feed personal y auditoria apunten al mismo sujeto tecnico.

Backend:

- OneSignal server-side en PocketBase
- `employeeId` y `pushExternalId` en `fideo_users`
- resolucion de audiencia por `employeeId`
- fallback a `fideo_users.id` cuando no hay override
- logs de push en respuestas server-side y `fideo_action_logs`

Cliente staff:

- login OneSignal con `external_id = pushExternalId` si existe, o `fideo_users.id`
- set de tags por workspace, rol y `employee_id`
- opt-in de permisos y prueba de recepcion

Hecho cuando:

- una entrega asignada llega al celular correcto
- un pedido listo despierta a despacho
- una alerta de caja no se pierde dentro del tablero
- el mismo empleado recibe el mismo targeting desde cualquier cliente staff cerrado

### P0 - PocketBase realtime operativo

Estado: capa actual activa; falta expandir subscriptions selectivas y presencia mas alla de la sesion actual.

Objetivo: usar PocketBase como runtime compartido real sin venderlo como multiplayer fino antes de tiempo.

Backend:

- workspace remoto versionado como fuente actual de verdad
- materializacion de `taskAssignments` y `taskReports`
- hooks de push y escalacion sobre cambios reales
- recarga de ultima version remota en conflictos `409`

Cliente:

- bootstrap y roundtrip server-side sobre el mismo workspace
- subscriptions solo en bandejas criticas cuando quiten friccion de verdad
- presencia y estados online como capa posterior

Hecho cuando:

- despacho y seguimiento ya no dependen de refrescar toda la app para ver movimiento importante
- los conflictos dejan de sentirse como sobrescritura silenciosa
- la colaboracion mejora sin romper el contrato snapshot-first actual

### P1 - `taskAssignments` snapshot-first con acuse

Estado: capa actual activa; toca endurecer ownership y observabilidad.

Objetivo: pasar de "te avise" a "ya se quien recibio y quien sigue pendiente".

Backend:

- slice o coleccion `taskAssignments` conectado al snapshot compartido
- estados `assigned -> acknowledged -> in_progress -> blocked -> done`
- ownership por empleado, rol, origen y contexto operativo
- timestamps de asignacion, acuse, inicio, bloqueo y cierre
- eventos de acuse y cierre listos para auditoria y SLA despues
- `blockedReason` persistido y visible como parte del contrato actual

Cliente staff:

- acciones rapidas `Recibido`, `Voy`, `Bloqueado`, `Terminado`
- feed personal por empleado y rol
- lectura corta del contexto de la tarea
- notificaciones de recordatorio y escalacion como siguiente capa

Hecho cuando:

- Fideo sabe si el repartidor vio la orden
- Fideo sabe si el empacador ya tomo el pedido
- el tablero deja de inferir y empieza a confirmar
- el staff deja de navegar todo el workspace para encontrar lo suyo

### P1 - Task reports estructurados y ownership de bloqueos

Estado: capa actual activa; toca volverla mas rica y menos ambigua.

Objetivo: que el personal reporte trabajo y excepciones sobre el mismo loop operativo ya vivo.

Backend:

- `taskReports` ya materializado y reconstruido al snapshot
- `acknowledgedAt`, `startedAt`, `blockedAt`, `doneAt` como timeline minima auditable en backend (`completedAt` en frontend)
- `kind`, `status`, `severity`, `summary`, `detail`, `evidence` y `escalationStatus` como capa actual de reporte
- `blockedReason` como motivo obligatorio para el primer reporte de excepcion
- notas de resultado ligadas a la orden o tarea cuando apliquen
- ownership del bloqueo amarrado al `employeeId` que reporto, o a la cola del rol si aun no habia asignado

Cliente movil:

- formularios minimos por rol sobre la misma tarea
- reporte rapido de bloqueo o cierre sin brincar a otro modulo
- despues, si hace falta, voz, foto o firma como segunda capa

Sube de nivel cuando:

- cada tarea bloqueada tiene owner y motivo visibles
- cada cierre importante deja resultado corto y auditable
- el staff ya no reporta solo "por fuera"

### P1 - Primera escalacion sobre PocketBase + OneSignal

Estado: capa actual activa; toca ampliar la matriz de SLA.

Objetivo: que Fideo deje de enterarse tarde cuando algo se atora o nadie acusa, y despues aprenda a perseguir mejor cada excepcion.

Backend:

- hook sobre transiciones de `taskAssignments` a `blocked`
- escalacion cuando entra un `taskReport` abierto con `escalationStatus: pending` y severidad operativa
- primera ventana de seguimiento para `assigned` sin `acknowledgedAt`
- `FIDEO_TASK_ACK_ESCALATION_MINUTES` como umbral actual
- reuse del helper OneSignal ya existente; nada de abrir otro carril
- logs de escalacion con audience, `external_id` o tags usados, y resultado de envio

Cliente movil:

- mismo `external_id` y tags del contrato cerrado por empleado
- confirmacion visible de suscripcion y estado de push
- lectura clara de por que llego la escalacion

Sube de nivel cuando:

- un bloqueo relevante le pega a Admin/dispatch con contexto suficiente
- una tarea sin acuse ya no se pierde en silencio
- la escalacion usa el stack actual de PocketBase + OneSignal y deja trazabilidad
- el SLA deja de vivir solo en un timeout unico y pasa a ventanas mas utiles por rol y prioridad

### P1 - Voz util de entrada

Objetivo: dejar de usar la voz solo como texto bonito y convertirla en canal operativo.

Backend:

- ingreso de transcripciones como eventos operativos
- identidad del hablante o dispositivo
- ruteo a tarea, mensaje o incidente

Cliente movil:

- push-to-talk robusto en celular
- cola offline corta
- reintento y confirmacion visual simple

Hecho cuando:

- el personal puede reportar sin escribir
- Fideo puede convertir reportes hablados en estado operable

### P2 - Fideo habla

Objetivo: que Fideo emita ordenes, recordatorios y escalaciones.

Backend:

- plantillas de mensaje por rol y evento
- prioridad, silencio, vencimiento y reintento

Cliente movil:

- TTS para ordenes urgentes
- audio corto para seguimiento
- modos de no molestar por rol y horario

Hecho cuando:

- Fideo ya no solo manda push; tambien "llama la atencion"

### P2 - Supervisor autonomo

Objetivo: que Fideo persiga el loop por si mismo.

Backend:

- reglas de SLA
- reasignacion por timeout
- escalacion a admin
- sugerencia de siguiente accion basada en cola real

Hecho cuando:

- una orden sin acuse escala sola
- una ruta atrasada empuja accion sin esperar al operador

## Orden tecnico recomendado

1. alinear todos los clientes staff al contrato cerrado `employeeId` + `pushExternalId` o `fideo_users.id`
2. endurecer `taskAssignments` y `taskReports` como contrato operativo real
3. meter subscriptions de PocketBase solo en bandejas donde sumen de verdad
4. ampliar el SLA vivo sobre PocketBase + OneSignal
5. volver mas personales las vistas de staff restantes
6. meter presencia y estados online cuando ya haya valor operativo claro
7. meter voz de entrada estable
8. meter voz de salida y automatizacion de seguimiento

## Lo que no conviene hacer aun

- no intentar "microfono siempre abierto" en web movil comun como primer paso
- no meter autonomia total antes de tener acuse y trazabilidad
- no mandar push masivo sin identidad y scoping limpios
- no separar `taskReports` en un workflow paralelo que rompa el loop actual con `taskAssignments`
- no normalizar cinco subdominios nuevos antes de probar bien `taskAssignments`
- no mezclar notificacion bonita con evento operativo sin prioridad ni ownership

## Definicion de exito

Podremos decir que Fideo ya se volvio "jefe en celular" cuando:

- una orden nace en el backend y llega al bolsillo correcto
- el empleado acusa recibo y reporta avance desde su telefono
- un bloqueo sube con owner y motivo, no solo como ruido
- Fideo detecta silencio o atraso y empuja seguimiento
- admin opera por excepcion, no por persecucion manual
