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

## Foco inmediato

El frontend ya corre sobre PocketBase + OneSignal. El slice activo no es "mas dashboard", sino cerrar trabajo asignado para staff:

- `taskAssignments` snapshot-first sobre el workspace compartido
- estados `assigned`, `acknowledged`, `in_progress`, `blocked`, `done`
- identidad por empleado como llave de feed personal y push
- vistas de staff mas reales para repartidor, empacador, cajero y admin operativo

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
```

## Notas

- `bun` es el package manager principal.
- `lint` corre typecheck y ESLint.
- `build` ya pasa sin el warning anterior del chunk gigante.
- Si `VITE_POCKETBASE_URL` existe, la app arranca con login real y sincroniza el workspace con PocketBase.
- OneSignal solo se enciende cuando `VITE_ONESIGNAL_ENABLED=true` y existe `VITE_ONESIGNAL_APP_ID`.
- Los workers web push viven en `public/onesignal/OneSignalSDKWorker.js` y `public/onesignal/OneSignalSDKUpdaterWorker.js`.
- La identidad push se enlaza con el `external_id` del usuario autenticado de PocketBase y tags de `role`, `workspace_id`, `workspace_slug`, `channel`, `customer_id` o `supplier_id` cuando aplican.
- La siguiente capa de producto en este frontend es llevar esa identidad a bandejas personales y acciones rapidas sobre `taskAssignments`, sin abandonar todavia el contrato snapshot-first.
- Si `bun run pb:start` encuentra `GEMINI_API_KEY`, `FIDEO_GEMINI_API_KEY` o `VITE_GEMINI_API_KEY` en `frontend/.env.local`, intenta promoverlas al proceso de PocketBase para habilitar interpretacion server-side.
- La interpretacion de mensajes ya intenta ir primero al backend (`/api/fideo/messages/interpret`) y cae al Gemini del cliente solo si esa ruta no existe o no esta disponible.
- PocketBase ya materializa un primer slice normalizado para `productGroups`, `warehouses`, `prices`, `inventory`, `customers`, `suppliers` y `purchaseOrders`.
- La parte servidor vive en `../backend/pocketbase/`.
- Los helpers `pb:*` delegan a los scripts PowerShell de `../backend/pocketbase/`.
