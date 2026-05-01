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
- loop real de entregas y operacion comercial

La brecha principal ya no es de UI. Es de runtime operativo:

- identidad empleado-dispositivo
- push en tiempo real
- ack del personal
- voz de entrada estable
- voz de salida y escalacion

## Slice activo ya implementado

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

## Roadmap por prioridad

### P0 - Backbone movil y despacho push

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

### P1 - Tareas con acuse

Objetivo: pasar de "te avise" a "ya se quien recibio y quien sigue pendiente".

Backend:

- coleccion o slice de `task_assignments`
- estados `assigned -> acknowledged -> in_progress -> blocked -> done`
- timestamp de SLA y reasignacion
- eventos de acuse y cierre

Cliente movil:

- acciones rapidas `Recibido`, `Voy`, `Bloqueado`, `Terminado`
- feed personal por rol
- notificaciones de recordatorio y escalacion

Hecho cuando:

- Fideo sabe si el repartidor vio la orden
- Fideo sabe si el empacador ya tomo el pedido
- el tablero deja de inferir y empieza a confirmar

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

1. cerrar OneSignal y la identidad por empleado
2. montar tareas con acuse
3. agregar reportes estructurados
4. endurecer realtime y presencia
5. meter voz de entrada estable
6. meter voz de salida y escalacion
7. automatizar reglas de seguimiento

## Lo que no conviene hacer aun

- no intentar "microfono siempre abierto" en web movil comun como primer paso
- no meter autonomia total antes de tener acuse y trazabilidad
- no mandar push masivo sin identidad y scoping limpios
- no mezclar notificacion bonita con evento operativo sin prioridad ni ownership

## Definicion de exito

Podremos decir que Fideo ya se volvio "jefe en celular" cuando:

- una orden nace en el backend y llega al bolsillo correcto
- el empleado acusa recibo y reporta avance desde su telefono
- Fideo detecta silencio o atraso y empuja seguimiento
- admin opera por excepcion, no por persecucion manual
