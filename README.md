# Fideo

Fideo es un centro de control comercial para un mayorista de productos agricolas. Su tesis no es "tener muchos modulos", sino comprimir en una sola interfaz el loop real del negocio:

1. entra una conversacion o una necesidad operativa,
2. Fideo la interpreta,
3. el operador la convierte en accion,
4. el sistema refleja el impacto en inventario, clientes, entregas, cobro y decision siguiente.

Este repositorio hoy contiene la primera gran pieza de ese sistema: una app frontend en `frontend/` con foco en operacion diaria, lectura comercial y asistencia por IA.

## North Star

El objetivo del producto es que una bodega o comercializadora de fruta pueda dirigir el negocio desde una sola mesa de control sin brincar entre WhatsApp, libretas, hojas sueltas y memoria humana.

En una version lograda, Fideo deberia permitir que un responsable del negocio pueda:

- entender el estado del dia en menos de 2 minutos,
- saber que vender, que mover, que cobrar y que entregar sin reconstruir contexto,
- convertir lenguaje natural en operaciones reales,
- leer clientes, inventario y rentabilidad como partes del mismo sistema,
- coordinar roles distintos sin perder continuidad.

## Evaluacion Honesta del Goal

La respuesta corta es: si, la direccion correcta ya esta apareciendo, pero todavia no esta cerrada.

Estado estimado por eje:

| Eje | Lectura actual |
| --- | --- |
| Ajuste a la vision | Alto |
| Profundidad operativa | Media-alta |
| Calidad de interfaz | Media-alta despues del revamp |
| Madurez tecnica | Media |
| Listo para produccion real | Baja-media |

Interpretacion:

- El producto ya se siente como una mesa de operacion y no como una demo suelta.
- La cobertura funcional es amplia: inventario, clientes, promociones, finanzas, entregas, proveedores, activos, historico, entrenamiento de IA.
- El sistema ya expresa una logica de negocio coherente.
- Lo que todavia falta para decir "goal alcanzado" es cerrar persistencia real multiusuario, integraciones operativas verdaderas y unificar la calidad visual de todas las vistas densas con la nueva shell.

## Que Es Fideo Hoy

Fideo hoy es una app React + Vite + TypeScript que combina:

- cockpit administrativo por roles,
- estado de negocio local-first con capa remota actual en PocketBase,
- acciones de dominio sobre inventario, ventas, credito, cajas y promociones,
- interpretacion asistida por Gemini para mensajes y resumentes,
- dashboards de operacion y rentabilidad,
- vistas para Admin, Cajero, Empacador, Repartidor, Cliente y Proveedor.

La app vive en `frontend/` y fue rediseñada recientemente usando conceptos de diseño extraidos de `C:\git\websites\easypoint`.

## Concepto de Producto

Fideo no intenta ser un ERP generico. Su personalidad producto es mas especifica:

- negocio de alta frecuencia,
- decisiones rapidas,
- mezcla de inventario vivo y relacion comercial,
- operacion guiada por conversaciones,
- lectura visual densa pero clara,
- accion antes que burocracia.

Eso cambia la forma de diseñar la UI:

- menos pantallas "corporativas" abstractas,
- mas panel operativo,
- mas contraste,
- mas prioridad para estado, alertas, flujo y proximidad a la accion.

## Direccion de Diseño

Del estudio de Easypoint se extrajeron estas ideas y se aplicaron al revamp actual:

### 1. Shell con identidad fuerte

La app necesitaba dejar de verse como una coleccion de componentes y empezar a sentirse como un sistema. Para eso se movio hacia:

- base oscura `slate`,
- acento `brand` verde-lima,
- fondos con profundidad radial,
- tarjetas con blur y bordes suaves,
- tipografia mas editorial y menos utilitaria por defecto,
- jerarquia fuerte entre shell, paneles y estados activos.

### 2. Contraste de operador

La inspiracion principal no fue "hacerla bonita", sino hacerla leible en operacion:

- encabezados claros,
- KPIs grandes,
- labels pequenas en uppercase,
- acentos puntuales para foco,
- modules que se entienden rapido al escanear.

### 3. Sensacion de panel premium

Se adopto la idea de "cockpit premium" de Easypoint:

- sidebar mas solido,
- header contextual,
- tarjetas con atmosfera,
- dashboards que ya parecen mesa de control y no reporte generico.

### 4. No clonar, sino traducir

La referencia de Easypoint no se copio literal. Se tradujo al dominio de Fideo:

- Easypoint habla de envios y puntos,
- Fideo habla de fruta, maduracion, clientes, deuda, cajas y ventas,
- por eso la visualidad se adapto a ritmo comercial y control de piso.

## Mapa Funcional Actual

La shell administrativa hoy expone estas superficies:

### Operaciones

- Dashboard
- Centro de acciones
- Mensajes
- Entregas

### Catalogos y operacion comercial

- Inventario
- Planograma
- Clientes
- Proveedores

### Analisis

- Finanzas
- Ventas
- Historial

### Sistema

- Maduracion
- Activos
- Entrenamiento de IA
- Ajustes

### Portales

- Vista cliente
- Vista proveedor

### Roles internos

- Admin
- Cajero
- Empacador
- Repartidor

## Flujos Clave

### 1. Mensaje a operacion

El flujo mas importante del producto es:

1. entra un mensaje,
2. `interpretMessage()` lo clasifica,
3. el usuario lo aprueba,
4. se ejecuta una accion de negocio,
5. el estado cambia,
6. queda huella en `activityLog`.

Ese flujo es el nucleo del producto, porque conecta lenguaje natural con consecuencias operativas.

### 2. Lectura de clientes

Fideo ya puede cruzar:

- ventas,
- deuda,
- pagos,
- cajas prestadas,
- precios especiales,
- resumen por IA.

La idea correcta aqui no es "tener ficha de cliente", sino que cada cliente se lea como una unidad comercial viva.

### 3. Inventario con semantica real

El inventario no es solo cantidad. El modelo ya considera:

- variedad,
- tamaño,
- calidad,
- estado de maduracion,
- ubicacion,
- bodega,
- cajas,
- reglas de maduracion.

Eso es importante porque el valor comercial del stock depende de su estado, no solo de su conteo.

### 4. Siguiente mejor accion

El `ActionCenter` y las recomendaciones proactivas empujan la app hacia una forma mas inteligente de operar:

- no esperar a que el operador recuerde todo,
- sino mostrar que pedidos empacar,
- que entregas asignar,
- que cajas seguir,
- que compras confirmar,
- que inventario mover.

## Arquitectura Actual

## Stack

- React 19
- Vite
- TypeScript
- Tailwind via CDN config in `index.html`
- Recharts
- Gemini via `@google/genai`
- Bun como package manager principal

## Estado y dominio

La mayor parte del estado vive en `useBusinessData()`:

- carga seed data desde `data/initialData.ts`,
- persiste localmente y puede sincronizarse con PocketBase,
- compone hooks de dominio,
- expone acciones y estado a toda la app.

Backend operativo actual:

- PocketBase como auth, workspace remoto y runtime compartido del producto,
- snapshot versionado del workspace como contrato publico actual,
- identidad push cerrada del lado servidor por empleado en `fideo_users` usando `employeeId` para resolver audiencia y `pushExternalId` como override de `external_id`, con fallback a `fideo_users.id`,
- dos capas operativas reales materializadas en PocketBase: `taskAssignments` y `taskReports`, ademas de los slices normalizados de catalogo, inventario, clientes, proveedores, compras, ventas, pagos, caja, actividad y prestamos,
- scope server-side por perfil para portales Cliente/Proveedor,
- backfill de `customerId` para ventas y prestamos historicos,
- rutas custom para bootstrap, persistencia versionada del estado compartido, interpretacion remota de mensajes, aprobacion server-side de acciones y reportes de tarea,
- OneSignal server-side para empujar eventos operativos y escalaciones vivas,
- SLA vivo sobre tareas con reglas actuales de bloqueo, severidad y falta de acuse.

Hooks de dominio:

- `useInventoryActions`
- `useSalesActions`
- `useCatalogActions`
- `useSystemActions`

Servicios IA:

- `interpretMessage`
- `generateOfferMessage`
- `generateSvgIcon`
- `generateCustomerInsights`
- `generateBusinessInsights`

Layouts:

- `AdminLayout`
- `PortalLayout`

## Estructura del Repositorio

```text
fideo/
  frontend/
    components/
    data/
    hooks/
    layouts/
    services/
    utils/
    views/
    App.tsx
    index.tsx
    index.html
    package.json
```

## Como Saber si el Goal se Esta Alcanzando

Esta es la seccion mas importante de este README.

No basta con que la app "tenga muchas pantallas". El goal se esta alcanzando si, al usarla, ocurre esto:

### Test operativo de 10 minutos

Una persona que conoce el negocio deberia poder:

- abrir la app y entender el estado del dia sin explicacion externa,
- detectar pendientes de entrega y tareas urgentes,
- leer clientes y deuda sin buscar en varias vistas,
- entender el inventario con semantica comercial, no solo numerica,
- generar una oferta o recomendacion util con apoyo de IA,
- cambiar de rol y verificar continuidad operativa.

Si eso no pasa, el goal aun no esta cerrado.

### Test de coherencia del sistema

Preguntas que el producto debe responder bien:

- Si entra un pedido por mensaje, queda claro que hacer con el?
- Si un cliente debe dinero, eso aparece en un lugar estrategico o solo en una vista escondida?
- Si el inventario madura, el sistema ayuda a actuar o solo registra?
- Si hay una tarea urgente, se ve como prioridad real?
- Si cambia el rol, la interfaz conserva contexto y utilidad?

### Test visual

La UI va en la direccion correcta si se siente:

- densa pero ordenada,
- premium pero operativa,
- enfocada en control y lectura,
- mas cercana a una mesa de mando que a una landing o panel generico.

## Estado Actual por Area

| Area | Estado actual | Lectura |
| --- | --- | --- |
| Shell visual | Fuerte | El revamp ya genero identidad de sistema |
| Dashboard | Fuerte | Ya se siente panel de operacion |
| Centro de acciones | Fuerte | Buen puente entre estado y accion |
| Mensajeria e IA | Bueno-alto | Ya existe interpretacion y aprobacion server-side; queda endurecer correccion manual, retries y observabilidad |
| Clientes | Bueno | Hay profundidad funcional, falta seguir elevando el polish visual |
| Inventario | Bueno | Modelo fuerte, UI todavia puede escalar al nuevo lenguaje |
| Finanzas | Medio | Util, pero todavia puede ganar claridad ejecutiva |
| Portales externos | Medio | Ya comparten shell, pero aun no son una experiencia totalmente cerrada |
| Persistencia real backend | Alto | Ya existe auth real, snapshot remoto versionado, slices materializados, push operativo y SLA vivo |
| Produccion multiusuario | Medio-bajo | Ya hay runtime remoto y escalacion real; faltan subscriptions cliente, locking fino y presencia |

## Validacion Tecnica Actual

Checks que actualmente pasan:

```bash
cd frontend
bun run lint
bun run build
```

La app se puede correr localmente con:

```bash
cd frontend
bun install
bun run dev
```

Si quieres levantar PocketBase desde el mismo flujo con Bun:

```bash
cd frontend
bun run pb:install
bun run pb:start
bun run pb:check
```

Y para bootstrap de un usuario local de Fideo:

```bash
cd frontend
bun run pb:bootstrap -- -SuperuserEmail dev@fideo.local -SuperuserPassword "ChangeMe123!"
```

Variables recomendadas en `frontend/.env.local`:

```env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
VITE_GEMINI_API_KEY=tu_api_key_opcional_para_fallback_cliente
GEMINI_API_KEY=tu_api_key_para_interpretacion_server_side
FIDEO_GEMINI_MODEL=gemini-2.5-flash
ONESIGNAL_ENABLED=1
ONESIGNAL_APP_ID=tu_app_id_de_onesignal
ONESIGNAL_REST_API_KEY=tu_rest_api_key_de_onesignal
FIDEO_APP_URL=https://tu-host-de-fideo/
FIDEO_TASK_ACK_ESCALATION_MINUTES=20
```

La configuracion y las migraciones de PocketBase viven en `backend/pocketbase/`.

`bun run pb:start` ya intenta heredar `GEMINI_API_KEY`, `FIDEO_GEMINI_API_KEY`, `VITE_GEMINI_API_KEY`, `GEMINI_MODEL`, `FIDEO_GEMINI_MODEL`, `ONESIGNAL_ENABLED`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `FIDEO_APP_URL` y `FIDEO_TASK_ACK_ESCALATION_MINUTES` desde `frontend/.env.local` para que PocketBase pueda interpretar mensajes, disparar push operativo y evaluar el SLA vivo sin wiring manual extra.

## Capa actual: identidad push, realtime y SLA vivo

Este es el slice nuevo que hoy ya funciona como capa actual del producto. No vive en una presentacion aparte; ya esta montado sobre la shell y el backend reales.

### 1. Identidad push cerrada por empleado

Del lado servidor, PocketBase ya resuelve push operativo con sujeto laboral, no solo con usuario generico:

- busca audiencias por `employeeId` cuando la tarea, entrega o reporte ya trae owner operativo,
- usa `pushExternalId` como override de OneSignal cuando existe,
- cae a `fideo_users.id` cuando no existe override,
- conserva fallback por tags (`workspace_slug`, `role`, `employee_id`) cuando no hay alias explicito.

Eso significa que el contrato serio ya existe para un cliente staff cerrado: push, ownership y auditoria pueden apuntar al mismo empleado.

La capa web ya quedo alineada con ese contrato: ahora prefiere `pushExternalId` y cae a `fideo_users.id`, conservando tags utiles por workspace, rol y empleado. Lo que sigue pendiente no es la identidad base, sino llevar este mismo contrato a clientes staff mas cerrados y dedicados.

### 2. PocketBase realtime como runtime operativo

PocketBase ya es la capa realtime actual de Fideo en un sentido operativo concreto:

- el workspace remoto vive versionado y compartido,
- `bootstrap`, `persist`, `approve` y `tasks/report` ya hacen roundtrip server-side sobre el mismo estado,
- `taskAssignments` y `taskReports` se materializan en colecciones reales y se reconstruyen de regreso al snapshot,
- cuando hay conflicto `409`, el cliente recarga la ultima version remota y sigue desde ahi,
- la sesion ya abre suscripcion realtime sobre el snapshot activo y manda heartbeat de presencia por sesion,
- el backend dispara push y escalacion sobre cambios reales del runtime, no sobre mocks locales.

La nota honesta aqui tambien importa: esto ya es realtime operativo, no multiplayer fino. Hay suscripcion del snapshot activo y presencia de la sesion actual, pero todavia no existe colaboracion record-by-record ni locking fino. El slice inmediato sobre esta base es volver esa presencia una lectura global del staff y una cola real de excepciones para Admin/Cajero.

### 3. Runtime de presencia global + bandeja de excepciones

Sobre la capa realtime actual, el siguiente cierre operativo ya esta definido asi:

- presencia consolidada por `employeeId`, `role`, `sessionId`, `deviceId`, `status`, `lastSeenAt`, `platform` y `appVersion`,
- estados practicos para despacho y supervision: `online`, `idle`, `stale` y `offline`,
- una sola bandeja para `Admin` y `Cajero` que lea bloqueos, reportes abiertos, alertas de caja, tareas sin acuse y silencios de roles criticos,
- triage y seguimiento sobre las mismas entidades vivas (`taskAssignments`, `taskReports`, caja y presencia), sin abrir workflows paralelos,
- PocketBase como fuente de verdad del runtime y OneSignal como carril de empuje y escalacion.

La meta de este slice no es adornar el tablero. Es que `Admin` y `Cajero` operen por excepcion visible, con ownership claro, en vez de perseguir manualmente que paso con cada tarea o cada ausencia.

### 4. SLA vivo ya activo

El SLA ya no esta solo en intencion. Ya hay reglas activas en PocketBase:

- `taskReports` reales con `kind`, `status`, `severity`, `summary`, `detail`, `evidence` y `escalationStatus`,
- escalacion a `Admin` cuando una `taskAssignment` entra a `blocked`,
- escalacion a `Admin` cuando entra un reporte abierto con `escalationStatus: pending` y severidad operativa (`blocker`, `incident`, `high`),
- escalacion a `Admin` cuando una tarea sigue en `assigned` sin `acknowledgedAt` pasado el umbral,
- umbral configurable con `FIDEO_TASK_ACK_ESCALATION_MINUTES` y default actual de `20`,
- trazabilidad del intento de envio en `fideo_action_logs`, incluso si OneSignal no encuentra audiencia o no esta configurado.

Este no es un SLA perfecto ni un motor autonomo completo. Es un SLA vivo y util: ya persigue silencio y bloqueo en el loop real.

El roadmap completo de "control desk" a "jefe en celular" vive en [docs/FIDEO_JEFE_EN_CELULAR_ROADMAP.md](C:/git/customers/fideo/docs/FIDEO_JEFE_EN_CELULAR_ROADMAP.md).

## Limitaciones Reales Hoy

Para no romantizar el estado actual, estas son las brechas mas claras:

1. El contrato publico del frontend sigue siendo snapshot-first aunque PocketBase ya materializa slices operativos reales; eso simplifica compatibilidad, pero todavia no es un modelo fino record-by-record.
2. La identidad push base ya esta alineada entre cliente y servidor, pero falta llevarla a clientes staff mas cerrados y dedicados fuera del navegador general.
3. El runtime remoto ya tiene suscripcion del snapshot activo y heartbeat de presencia por sesion, pero el roster global de staff y la lectura consolidada de excepciones siguen siendo el siguiente cierre operativo pendiente.
4. Cliente y Proveedor ya reciben snapshots recortados y en solo lectura, pero los perfiles internos aun pueden endurecerse mas por capacidad, ownership y rutas servidoras.
5. Repartidor y Empacador ya tienen bandejas personales usables, pero Admin/Cajero todavia necesitan una cola unificada de excepciones y mejor seguimiento entre bloqueo, caja, SLA y presencia.
6. El SLA vivo actual cubre bloqueo, severidad alta y falta de acuse; todavia no hay matriz mas rica por rol, prioridad, horario o ventana de entrega.
7. Si la key de Gemini del backend no existe o es invalida, la interpretacion remota degrada a `DESCONOCIDO` de forma segura en vez de romper el flujo.

## Siguiente Paso Correcto

Si la pregunta es "que sigue para acercarnos de verdad al goal", el orden correcto parece este:

1. Consolidar presencia global por empleado sobre el heartbeat actual: roster vivo, estado derivado y visibilidad clara por dispositivo y sesion.
2. Volver esa presencia una bandeja de excepciones real para `Admin` y `Cajero`, alimentada por bloqueos, reportes, caja y tareas sin acuse.
3. Alinear el cliente staff que consuma push con el contrato cerrado por empleado: `employeeId` como sujeto operativo y `pushExternalId` o `fideo_users.id` como `external_id`.
4. Endurecer ownership de bloqueos de punta a punta: quien tomo la tarea, quien la bloqueo, quien la resuelve y quien puede reasignarla.
5. Expandir el SLA vivo mas alla del primer timeout de acuse y la severidad alta: prioridad, ventanas, horarios, reintentos y politicas por rol.
6. Seguir normalizando las capas de soporte que aun viven solo en snapshot.

### Actualizacion para el siguiente nivel

Con PocketBase + OneSignal ya aterrizados y con SLA vivo arriba, el frente inmediato cambia de "ya avise" a "ya se quien esta, que se atoró y quien debe resolverlo". Hoy la apuesta concreta es esta:

1. La presencia deja de ser solo `ping` por sesion y pasa a roster global util para operacion.
2. `taskAssignments` y `taskReports` ya viven en backend; ahora alimentan una bandeja de excepciones unica para `Admin` y `Cajero`.
3. `blocked`, `incident`, `high`, silencio sin acuse y alerta de caja dejan de verse por separado y pasan al mismo triage.
4. OneSignal sigue siendo el mismo carril de empuje; no conviene abrir otro stack de notificaciones para esta capa.
5. Despues si: subscriptions mas finas, SLA por ventana y automatizacion mas ambiciosa.

## Definicion Practica de Exito

Podremos decir que Fideo ya esta muy cerca del goal cuando:

- el responsable del negocio prefiera abrir Fideo antes que revisar varios canales separados,
- las decisiones del dia salgan de la app y no de memoria dispersa,
- la UI transmita control, prioridad y claridad sin explicacion,
- la IA no sea un adorno, sino un acelerador real del flujo,
- roles distintos puedan operar sobre el mismo estado sin perder continuidad.

## Resumen Final

Fideo ya no es solo una idea ni una demo visual. Ya es un sistema con forma, criterio y una direccion producto bastante clara.

La vision ya se ve.
La operacion ya se modela.
La interfaz ya empieza a sentirse como producto serio.

Lo que falta no es encontrar el goal. Lo que falta es cerrar la distancia entre prototipo fuerte y herramienta inevitable.
