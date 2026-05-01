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
- estado de negocio persistido en localStorage,
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

Backend temporal actual:

- PocketBase para auth,
- snapshot persistido del workspace,
- identidad base por empleado en `fideo_users` con `employeeId` y `pushExternalId`,
- tres slices normalizados en colecciones reales: uno para catalogo/inventario/clientes/proveedores/compras, otro para ventas/pagos/caja/actividad/prestamos y un slice minimo de `taskAssignments` con acuse por `employeeId`,
- scope server-side por perfil para portales Cliente/Proveedor,
- backfill de `customerId` para ventas y prestamos historicos,
- rutas custom para bootstrap, persistencia del estado compartido, interpretacion remota de mensajes y aprobacion server-side de acciones,
- OneSignal server-side para empujar eventos operativos puntuales.

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
| Persistencia real backend | Medio-alto | Ya existe auth real, snapshot remoto, tres slices normalizados y scope server-side para portales |
| Produccion multiusuario | Bajo | Aun no es la historia principal del sistema |

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
```

La configuracion y las migraciones de PocketBase viven en `backend/pocketbase/`.

`bun run pb:start` ya intenta heredar `GEMINI_API_KEY`, `FIDEO_GEMINI_API_KEY`, `VITE_GEMINI_API_KEY`, `GEMINI_MODEL`, `FIDEO_GEMINI_MODEL`, `ONESIGNAL_ENABLED`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` y `FIDEO_APP_URL` desde `frontend/.env.local` para que PocketBase pueda interpretar mensajes y disparar push operativo sin wiring manual extra.

## OneSignal Operativo

Fideo ya trae una primera capa server-side para OneSignal desde PocketBase. Hoy se dispara en estos casos:

- `pedido listo` -> push a `Admin` / despacho
- `asignacion de entrega` -> push al `Repartidor` asignado
- `alerta de caja` -> push a `Admin` cuando hay incidencia segura

La idea no es mandar ruido, sino abrir el carril del siguiente nivel operativo: que la app no solo refleje la operacion, sino que tambien la empuje.

Para ese targeting, el backend ya soporta dos estrategias:

- `include_aliases.external_id` para usuarios identificados
- `filters` por tags de `workspace_slug`, `role` y `employee_id`

El contrato recomendado para el cliente movil que use OneSignal es:

- `external_id = fideo_users.pushExternalId` si existe, o `fideo_users.id` como fallback
- tags: `app=fideo`, `workspace_slug=<slug>`, `role=<rol>`, `employee_id=<employeeId>`

Con esa base, el slice operativo ya en curso es `taskAssignments` sobre el contrato snapshot-first actual. La idea no es reescribir todo el modelo interno de golpe, sino cerrar primero ownership, acuse y avance del trabajo con estados `assigned`, `acknowledged`, `in_progress`, `blocked` y `done`.

El roadmap completo de "control desk" a "jefe en celular" vive en [docs/FIDEO_JEFE_EN_CELULAR_ROADMAP.md](C:/git/customers/fideo/docs/FIDEO_JEFE_EN_CELULAR_ROADMAP.md).

## Limitaciones Reales Hoy

Para no romantizar el estado actual, estas son las brechas mas claras:

1. El backend ya corre con PocketBase y tres slices normalizados reales, pero el loop interno sigue siendo snapshot-first y el slice `taskAssignments` apenas esta tomando forma encima de ese contrato.
2. `employeeId` y `pushExternalId` ya existen, pero aun falta cerrar bien la identidad empleado-dispositivo para que cada push y cada tarea caigan en la persona correcta sin heuristicas.
3. Cliente y Proveedor ya reciben snapshots recortados y en solo lectura, pero los perfiles internos aun pueden endurecerse mas por capacidad, ownership y rutas servidoras.
4. Las vistas de staff todavia leen demasiado contexto general; falta llevarlas a bandejas personales mas reales con acuse, avance, bloqueo y cierre.
5. El loop multiusuario real ya tiene auth y workspace compartido, pero todavia no hay locking fino ni colaboracion en tiempo real.
6. Aun quedan capas de soporte fuera de la normalizacion fuerte: mensajes, gastos, activos, inventario de cajas, templates y algunas configuraciones.
7. Si la key de Gemini del backend no existe o es invalida, la interpretacion remota degrada a `DESCONOCIDO` de forma segura en vez de romper el flujo.

## Siguiente Paso Correcto

Si la pregunta es "que sigue para acercarnos de verdad al goal", el orden correcto parece este:

1. Terminar `taskAssignments` snapshot-first como slice operativo interno, con ownership claro y transiciones `assigned -> acknowledged -> in_progress -> blocked -> done`.
2. Cerrar identidad por empleado de punta a punta: `employeeId`, `pushExternalId`, tags, `external_id` y feed personal consistente.
3. Convertir las vistas de staff en superficies personales reales: lo mio, lo pendiente, lo bloqueado y lo terminado.
4. Llevar reportes, correcciones y bloqueos del staff al mismo loop servidor.
5. Endurecer observabilidad, retries, presencia y escalacion sobre PocketBase + OneSignal.
6. Seguir normalizando las capas de soporte que aun viven solo en snapshot.

### Actualizacion para el siguiente nivel

Con PocketBase + OneSignal ya aterrizados, el frente inmediato cambia de "mandar push" a "confirmar trabajo". Hoy la apuesta concreta es esta:

1. `taskAssignments` ya tiene carril backend minimo snapshot-first; el siguiente paso es endurecerlo sin rehacer aun toda la arquitectura transaccional.
2. Estados minimos y auditables: `assigned`, `acknowledged`, `in_progress`, `blocked`, `done`.
3. Identidad por empleado como llave unica de push, ownership y vista personal.
4. Staff views mas reales para repartidor, empacador, cajero y admin operativo.
5. Luego si: reportes estructurados, SLA, escalacion y automatizacion de seguimiento.

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
