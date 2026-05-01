# Fideo Jefe En Celular Roadmap

Este documento baja la vision de Fideo como "control desk" a Fideo como "jefe en celular":

- vive en un telefono dedicado
- escucha y recibe reportes
- reparte trabajo
- persigue acuses y cierres
- empuja la operacion, no solo la refleja

## Donde estamos hoy

La base fuerte ya existe:

- backend PocketBase con auth, workspace y snapshot compartido
- rutas server-side para interpretar, corregir, aprobar y revertir acciones
- slices normalizados de ventas, inventario, clientes, actividad y caja
- identidad base por empleado en `fideo_users` con `employeeId` y `pushExternalId`
- OneSignal server-side ya conectado para eventos operativos puntuales
- `taskAssignments` ya materializado con `acknowledgedAt`, `startedAt`, `blockedAt`, `doneAt` y `blockedReason`
- vistas reales para `PackerView`, `DelivererView`, `ActionCenter` y `Deliveries` leyendo la misma cola
- loop real de entregas y operacion comercial

La brecha principal ya no es "poner otro dashboard". Es cerrar el runtime operativo personal:

- reportes estructurados sobre la misma tarea
- ownership real cuando algo se bloquea
- escalacion inicial sobre OneSignal/PocketBase
- bandejas personales mas cerradas para Admin/Cajero
- seguimiento despues del primer ack

## Base ya aterrizada

La primera capa backend de OneSignal ya queda contemplada en PocketBase:

- envio REST a `https://api.onesignal.com/notifications`
- targeting por `include_aliases.external_id`
- fallback por `filters` con tags
- disparos operativos minimos:
  - `pedido listo` -> `Admin`
  - `asignacion de entrega` -> `Repartidor`
  - `alerta de caja` -> `Admin`

Contrato recomendado para el cliente movil:

- `external_id = pushExternalId` del usuario si existe; si no, `fideo_users.id`
- tags:
  - `app=fideo`
  - `workspace_slug=<slug>`
  - `role=<rol>`
  - `employee_id=<employeeId>`

Estado real del cliente hoy:

- el backend ya puede targetear `pushExternalId` o caer a `fideo_users.id`
- el cliente web actual sincroniza OneSignal con `external_id = profile.id`
- por eso la primera escalacion debe validar ambos caminos y tomar `fideo_users.id` como baseline confiable mientras se cierra la unificacion completa

Esto ya abre el canal correcto. Lo que falta no es inventar otro stack, sino montar arriba el loop de tarea confirmada.

## Slice operativo ya visible

Sobre el contrato snapshot-first actual ya existe esta capa operativa:

- `taskAssignments` como capa de trabajo asignado y auditado
- estados base: `assigned`, `acknowledged`, `in_progress`, `blocked`, `done`
- ownership por `employeeId` y rol
- timestamps de acuse, inicio, bloqueo y cierre
- `blockedReason` persistido y visible en vistas operativas
- quick actions de staff sobre la misma tarea, no sobre pantallas sueltas
- staff views mas reales: feed personal, pendientes, bloqueos y cierres

Decision de arquitectura:

- primero cerrar este loop sobre snapshot compartido
- despues decidir que partes merecen normalizacion fuerte propia
- no abrir un motor paralelo antes de probar el loop humano real

## Slice siguiente documentado

El siguiente corte no es "crear `taskReports` y ya". Es endurecer el loop actual sin romper lo que ya funciona.

Definicion practica para este slice:

- el task report inicial vive pegado a la tarea, no en un sistema paralelo
- `acknowledgedAt` cuenta como reporte de acuse
- `startedAt` cuenta como reporte de avance
- `blockedAt` + `blockedReason` cuentan como reporte estructurado de bloqueo
- `doneAt` en PocketBase, que hoy equivale al `completedAt` del frontend, y las notas operativas de cierre cuentan como reporte de termino cuando la tarea viene de una orden real
- el `payload` del task materializado en PocketBase queda como puente para crecer luego a evidencia, nota larga o formulario por rol

Ownership de bloqueos:

- si alguien bloquea una tarea, la tarea sigue perteneciendo al `employeeId` que la tenia tomada hasta que Admin/dispatch la resuelva o reasigne
- si la tarea aun no tenia persona, el bloqueo sigue siendo de la cola del rol y debe subir al tablero de despacho
- el objetivo es que nunca quede un bloqueo sin sujeto, sin motivo o sin contexto

Primera escalacion:

- primer disparo nuevo: `task.status -> blocked`
- segundo disparo nuevo: `task.status = assigned` sin `acknowledgedAt` dentro de una ventana corta
- ambos deben vivir en PocketBase y reutilizar el helper server-side de OneSignal
- ambos deben dejar rastro en logs con `taskId`, `employeeId`, `role`, `status`, `blockReason` y modo de entrega

## Roadmap por prioridad

### P0 - Backbone movil y despacho push

Estado: base aterrizada; queda endurecimiento de activacion cliente e identidad.

Objetivo: que Fideo ya pueda empujar trabajo y no depender solo de que alguien abra la app.

Backend:

- OneSignal server-side en PocketBase
- `employeeId` y `pushExternalId` en `fideo_users`
- reglas de notificacion por cambio real de snapshot
- logs de push en respuestas server-side y `fideo_action_logs`

Cliente movil:

- login OneSignal con `external_id`
- set de tags por workspace, rol y empleado
- opt-in de permisos y prueba de recepcion

Hecho cuando:

- una entrega asignada llega al celular correcto
- un pedido listo despierta a despacho
- una alerta de caja no se pierde dentro del tablero

### P1 - `taskAssignments` snapshot-first con acuse

Estado: base ya aterrizada; falta endurecimiento de ownership y observabilidad.

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

Estado: siguiente slice inmediato.

Objetivo: que el personal reporte trabajo y excepciones sin sacar la tarea del contrato snapshot-first actual.

Backend:

- reportes iniciales pegados a `taskAssignments`, no en una coleccion separada
- `acknowledgedAt`, `startedAt`, `blockedAt`, `doneAt` como timeline minima auditable en backend (`completedAt` en frontend)
- `blockedReason` como motivo obligatorio para el primer reporte de excepcion
- notas de resultado ligadas a la orden o tarea cuando apliquen
- ownership del bloqueo amarrado al `employeeId` que reporto, o a la cola del rol si aun no habia asignado

Cliente movil:

- formularios minimos por rol sobre la misma tarea
- reporte rapido de bloqueo o cierre sin brincar a otro modulo
- despues, si hace falta, voz, foto o firma como segunda capa

Hecho cuando:

- cada tarea bloqueada tiene owner y motivo visibles
- cada cierre importante deja resultado corto y auditable
- el staff ya no reporta solo "por fuera"

### P1 - Primera escalacion sobre PocketBase + OneSignal

Estado: siguiente slice inmediato.

Objetivo: que Fideo deje de enterarse tarde cuando algo se atora o nadie acusa.

Backend:

- hook sobre transiciones de `taskAssignments` a `blocked`
- primera ventana de seguimiento para `assigned` sin `acknowledgedAt`
- reuse del helper OneSignal ya existente; nada de abrir otro carril
- logs de escalacion con audience, `external_id` o tags usados, y resultado de envio

Cliente movil:

- mismo `external_id` y tags del carril push actual
- confirmacion visible de suscripcion y estado de push
- lectura clara de por que llego la escalacion

Hecho cuando:

- un bloqueo relevante le pega a Admin/dispatch con contexto suficiente
- una tarea sin acuse ya no se pierde en silencio
- la escalacion usa el stack actual de PocketBase + OneSignal y deja trazabilidad

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

1. cerrar identidad empleado-dispositivo y activacion OneSignal de punta a punta
2. endurecer `taskAssignments` snapshot-first como contrato operativo real
3. cerrar task reports estructurados y ownership de bloqueos
4. montar primera escalacion sobre PocketBase + OneSignal
5. volver mas personales las vistas de staff restantes
6. endurecer realtime y presencia
7. meter voz de entrada estable
8. meter voz de salida y automatizacion de seguimiento

## Lo que no conviene hacer aun

- no intentar "microfono siempre abierto" en web movil comun como primer paso
- no meter autonomia total antes de tener acuse y trazabilidad
- no mandar push masivo sin identidad y scoping limpios
- no abrir una coleccion `taskReports` nueva antes de comprobar que `taskAssignments` + `payload` ya se quedaron cortos
- no normalizar cinco subdominios nuevos antes de probar bien `taskAssignments`
- no mezclar notificacion bonita con evento operativo sin prioridad ni ownership

## Definicion de exito

Podremos decir que Fideo ya se volvio "jefe en celular" cuando:

- una orden nace en el backend y llega al bolsillo correcto
- el empleado acusa recibo y reporta avance desde su telefono
- un bloqueo sube con owner y motivo, no solo como ruido
- Fideo detecta silencio o atraso y empuja seguimiento
- admin opera por excepcion, no por persecucion manual
