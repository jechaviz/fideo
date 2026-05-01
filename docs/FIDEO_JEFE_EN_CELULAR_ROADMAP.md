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
- loop real de entregas y operacion comercial

La brecha principal ya no es "poner otro dashboard". Es cerrar el runtime operativo personal:

- asignacion explicita por empleado
- acuse y cambio de estado sobre el trabajo
- bandejas personales de staff
- reportes cortos y bloqueos con ownership
- escalacion y seguimiento despues del primer ack

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

Esto ya abre el canal correcto. Lo que falta no es inventar otro stack, sino montar arriba el loop de tarea confirmada.

## Slice activo en curso

El siguiente slice operativo se mueve sobre el contrato snapshot-first actual:

- `taskAssignments` como capa de trabajo asignado y auditado
- estados base: `assigned`, `acknowledged`, `in_progress`, `blocked`, `done`
- ownership por `employeeId` y rol
- quick actions de staff sobre la misma tarea, no sobre pantallas sueltas
- staff views mas reales: feed personal, pendientes, bloqueos y cierres

Decision de arquitectura:

- primero cerrar este loop sobre snapshot compartido
- despues decidir que partes merecen normalizacion fuerte propia
- no abrir un motor paralelo antes de probar el loop humano real

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

Estado: en curso.

Objetivo: pasar de "te avise" a "ya se quien recibio y quien sigue pendiente".

Backend:

- slice o coleccion `taskAssignments` conectado al snapshot compartido
- estados `assigned -> acknowledged -> in_progress -> blocked -> done`
- ownership por empleado, rol, origen y contexto operativo
- timestamps de asignacion, acuse, inicio, bloqueo y cierre
- eventos de acuse y cierre listos para auditoria y SLA despues

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

### P1 - Staff reporting estructurado

Objetivo: que el personal reporte trabajo y excepciones de forma estructurada.

Backend:

- reportes por tarea
- incidencia, nota, evidencia, motivo de bloqueo
- hilo corto por orden o tarea

Cliente movil:

- formularios minimos por rol
- reporte rapido con voz o texto
- foto/firma cuando aplique

Hecho cuando:

- el staff ya no reporta solo "por fuera"
- cada orden tiene contexto operativo y cierre auditable

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
2. aterrizar `taskAssignments` snapshot-first
3. volver personales las vistas de staff
4. agregar reportes estructurados y bloqueos
5. endurecer realtime y presencia
6. meter voz de entrada estable
7. meter voz de salida y escalacion
8. automatizar reglas de seguimiento

## Lo que no conviene hacer aun

- no intentar "microfono siempre abierto" en web movil comun como primer paso
- no meter autonomia total antes de tener acuse y trazabilidad
- no mandar push masivo sin identidad y scoping limpios
- no normalizar cinco subdominios nuevos antes de probar bien `taskAssignments`
- no mezclar notificacion bonita con evento operativo sin prioridad ni ownership

## Definicion de exito

Podremos decir que Fideo ya se volvio "jefe en celular" cuando:

- una orden nace en el backend y llega al bolsillo correcto
- el empleado acusa recibo y reporta avance desde su telefono
- Fideo detecta silencio o atraso y empuja seguimiento
- admin opera por excepcion, no por persecucion manual
