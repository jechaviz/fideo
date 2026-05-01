# Frontend de Fideo

Este directorio contiene la app React/Vite de Fideo.

Si quieres entender el producto, la vision, el estado actual y como evaluar si el goal se esta alcanzando, lee primero:

- [`../README.md`](../README.md)

## Stack

- React 19
- Vite
- TypeScript
- Bun
- Recharts
- Gemini via backend PocketBase con fallback opcional en cliente
- PocketBase SDK
- OneSignal Web SDK via `react-onesignal`

## Capa actual del frontend

El frontend ya corre sobre PocketBase + OneSignal. La capa actual del producto en esta app es:

- workspace remoto versionado sobre PocketBase como runtime compartido
- suscripcion realtime del snapshot activo + heartbeat de presencia por sesion
- `runtimeOverview` remoto con roster global y bandeja consolidada de excepciones
- `taskAssignments` y `taskReports` como loop operativo actual para staff
- identidad push cerrada por empleado en cliente y servidor
- SLA vivo desde PocketBase para bloqueo, severidad alta y falta de acuse

Leccion honesta: este frontend ya consume realtime del snapshot activo, roster global y cola consolidada. Lo que sigue ahora es mover `reasignar`, `follow-up` y `resolver` de excepciones al backend, sin romper el contrato snapshot-first.

## Siguiente nivel: acciones server-side de excepciones

Este es el frente inmediato del frontend sobre la base ya viva:

- presencia global por `employeeId`, `role`, `sessionId`, `deviceId`, `status` y `lastSeenAt`,
- lectura compacta de estados `online`, `idle`, `stale` y `offline`,
- una sola cola de excepciones para `Admin` y `Cajero`,
- la misma cola mezclando bloqueos, reportes abiertos, alertas de caja, tareas sin acuse y silencios de roles criticos,
- CTAs de `reasignar`, `seguimiento` y `resolver` pegados a rutas server-side, no solo a mutaciones locales.

## Comandos

```bash
bun install
bun run dev
bun run lint
bun run build
bun run pb:install
bun run pb:start
bun run pb:check
```

Para bootstrap de un usuario local sobre PocketBase:

```bash
bun run pb:bootstrap -- -SuperuserEmail dev@fideo.local -SuperuserPassword "ChangeMe123!"
```

Si omites `-PushExternalId`, el helper deriva uno estable.
Si omites `-EmployeeId` en un rol interno, intenta resolverlo desde el snapshot seeded.
Si el usuario ya existia, preserva `employeeId`, `customerId`, `supplierId` y `pushExternalId` salvo que pases un override explicito.

## Variables de entorno

Crear `frontend/.env.local` con:

```env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
VITE_GEMINI_API_KEY=tu_api_key_opcional_para_fallback_cliente
GEMINI_API_KEY=tu_api_key_para_backend_si_levantas_pb_desde_esta_maquina
FIDEO_GEMINI_MODEL=gemini-2.5-flash
VITE_ONESIGNAL_ENABLED=false
VITE_ONESIGNAL_APP_ID=tu_app_id_web_de_onesignal
VITE_ONESIGNAL_WORKER_PATH=onesignal/OneSignalSDKWorker.js
VITE_ONESIGNAL_WORKER_SCOPE=onesignal/
VITE_ONESIGNAL_ALLOW_LOCALHOST=true
ONESIGNAL_ENABLED=1
ONESIGNAL_APP_ID=tu_app_id_de_onesignal
ONESIGNAL_REST_API_KEY=tu_rest_api_key_de_onesignal
FIDEO_APP_URL=https://tu-host-de-fideo/
FIDEO_TASK_ACK_ESCALATION_MINUTES=20
```

## Notas

- `bun` es el package manager principal.
- `lint` corre typecheck y ESLint.
- `build` ya pasa sin el warning anterior del chunk gigante.
- Si `VITE_POCKETBASE_URL` existe, la app arranca con login real y sincroniza el workspace con PocketBase.
- OneSignal solo se enciende cuando `VITE_ONESIGNAL_ENABLED=true` y existe `VITE_ONESIGNAL_APP_ID`.
- Los workers web push viven en `public/onesignal/OneSignalSDKWorker.js` y `public/onesignal/OneSignalSDKUpdaterWorker.js`.
- La identidad push del cliente web ahora prefiere `pushExternalId` y cae a `fideo_users.id`, manteniendo tags de `role`, `workspace_id`, `workspace_slug`, `channel`, `employee_id`, `customer_id` o `supplier_id` cuando aplican.
- Del lado servidor, PocketBase usa el mismo contrato operativo: resuelve audiencia con `employeeId`, usa `pushExternalId` si existe y cae a `fideo_users.id` cuando no hay override.
- `runtimeOverview` ya entra en `bootstrap` y tambien puede refrescarse por ruta dedicada para no inflar el `snapshot`.
- El runtime remoto actual pasa por `bootstrap`, `persist`, `approve` y `/api/fideo/tasks/report`, todos sobre el mismo workspace versionado.
- La sesion ahora abre suscripcion realtime sobre `fideo_state_snapshots/<snapshotRecordId>` y manda heartbeat a `POST /api/fideo/presence/ping`.
- `taskAssignments` ya alimenta `ActionCenter`, `Deliveries`, `PackerView` y `DelivererView`.
- `taskReports` ya existe como slice real y se materializa tambien en PocketBase; el loop sigue siendo snapshot-first hacia el frontend, pero ya no depende solo de badges pegados al task.
- En este frontend, el timeline base de tarea sigue viviendo en `acknowledgedAt`, `startedAt`, `blockedAt` y `completedAt` (`doneAt` al materializar en PocketBase), mientras `taskReports` agrega severidad, detalle, evidencia y `escalationStatus`.
- El bloqueo ya tiene owner practico: queda amarrado al `employeeId` que tomo la tarea o a la cola del rol si aun no habia persona asignada.
- El SLA vivo actual ya existe en PocketBase: escala `taskAssignments` que entran a `blocked`, reportes abiertos con `escalationStatus: pending` y severidad operativa, y tambien tareas en `assigned` sin `acknowledgedAt` despues del umbral configurado.
- Ese umbral cae en `20` minutos por default y se gobierna con `FIDEO_TASK_ACK_ESCALATION_MINUTES`.
- La siguiente capa de producto en este frontend es llevar `reasignar`, `follow-up` y `resolver` de esa bandeja a rutas server-side, sin romper el contrato snapshot-first.
- Si `bun run pb:start` encuentra `GEMINI_API_KEY`, `FIDEO_GEMINI_API_KEY`, `VITE_GEMINI_API_KEY`, `ONESIGNAL_ENABLED`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `FIDEO_APP_URL` o `FIDEO_TASK_ACK_ESCALATION_MINUTES` en `frontend/.env.local`, intenta promoverlas al proceso de PocketBase para habilitar interpretacion server-side, push y SLA vivo.
- La interpretacion de mensajes ya intenta ir primero al backend (`/api/fideo/messages/interpret`) y cae al Gemini del cliente solo si esa ruta no existe o no esta disponible.
- PocketBase ya materializa un primer slice normalizado para `productGroups`, `warehouses`, `prices`, `inventory`, `customers`, `suppliers` y `purchaseOrders`, ademas de `fideo_task_assignments` y `fideo_task_reports`.
- La parte servidor vive en `../backend/pocketbase/`.
- Los helpers `pb:*` delegan a los scripts PowerShell de `../backend/pocketbase/`.
