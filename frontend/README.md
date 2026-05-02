# Frontend de Fideo

App React/Vite del producto.

## Estado actual

- usa login real y workspace remoto cuando existe `VITE_POCKETBASE_URL`
- hace `bootstrap` remoto al entrar y `persist` versionado sobre el mismo workspace
- si hay conflicto `409`, recarga la ultima version remota antes de seguir
- abre suscripcion sobre el snapshot activo y manda heartbeat a `presence/ping`
- consume `runtimeOverview` para roster global y cola consolidada de excepciones
- `ActionCenter` ya usa `follow-up`, `reassign` y `resolve` server-side
- si PocketBase no esta disponible, mantiene fallback local donde aplica

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

Bootstrap de un usuario local:

```bash
bun run pb:bootstrap -- -SuperuserEmail dev@fideo.local -SuperuserPassword "ChangeMe123!"
```

## .env.local

Minimo para backend real:

```env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

Opcional para IA, web push y SLA vivo:

```env
VITE_GEMINI_API_KEY=tu_api_key_opcional_para_fallback_cliente
GEMINI_API_KEY=tu_api_key_para_backend
FIDEO_GEMINI_MODEL=gemini-2.5-flash
VITE_ONESIGNAL_ENABLED=false
VITE_ONESIGNAL_APP_ID=tu_app_id_web
VITE_ONESIGNAL_WORKER_PATH=onesignal/OneSignalSDKWorker.js
VITE_ONESIGNAL_WORKER_SCOPE=onesignal/
VITE_ONESIGNAL_ALLOW_LOCALHOST=true
ONESIGNAL_ENABLED=1
ONESIGNAL_APP_ID=tu_app_id
ONESIGNAL_REST_API_KEY=tu_rest_api_key
FIDEO_APP_URL=https://tu-host-de-fideo/
FIDEO_TASK_ACK_ESCALATION_MINUTES=20
```

## Contrato PocketBase que consume el frontend

- `POST /api/fideo/bootstrap`
- `POST /api/fideo/state/persist`
- `POST /api/fideo/runtime/overview`
- `POST /api/fideo/presence/ping`
- `POST /api/fideo/exceptions/follow-up`
- `POST /api/fideo/exceptions/reassign`
- `POST /api/fideo/exceptions/resolve`
- `POST /api/fideo/tasks/report`
- `POST /api/fideo/messages/*`

La capa publica hacia React sigue siendo snapshot-first, pero el runtime remoto ya materializa `taskAssignments`, `taskReports` y slices de dominio reales en PocketBase.
