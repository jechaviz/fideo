# Fideo

Fideo es una mesa de control comercial para operacion diaria. La app vive en `frontend/` y el backend operativo actual vive en `backend/pocketbase/`.

## Estado actual

- login real con PocketBase cuando existe `VITE_POCKETBASE_URL`
- workspace remoto versionado con contrato snapshot-first hacia el frontend
- `bootstrap`, `persist`, `runtimeOverview` y `presence/ping` ya activos
- `taskAssignments` y `taskReports` ya sobreviven roundtrip real por PocketBase
- `follow-up`, `reassign` y `resolve` ya son acciones server-side desde la misma cola operativa
- OneSignal queda listo para push operativo y SLA vivo cuando hay credenciales

## Lo importante hoy

- `bootstrap`: crea o reutiliza workspace/usuario, preserva `employeeId`, `customerId`, `supplierId` y `pushExternalId`, y devuelve `snapshot` + `runtimeOverview`
- `persist`: guarda el snapshot con version lock; si aparece `409`, el cliente recarga la version remota antes de seguir
- `follow-up`: deja seguimiento sobre la misma excepcion, actualiza snapshot/runtime y reutiliza la misma audiencia push que `reassign` y `resolve`

## Correr local

```bash
cd frontend
bun install
bun run pb:install
bun run pb:start
bun run pb:bootstrap -- -SuperuserEmail dev@fideo.local -SuperuserPassword "ChangeMe123!"
bun run dev
```

`frontend/.env.local` minimo:

```env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

Si tambien quieres IA server-side, push y SLA vivo:

```env
GEMINI_API_KEY=tu_api_key
FIDEO_GEMINI_MODEL=gemini-2.5-flash
ONESIGNAL_ENABLED=1
ONESIGNAL_APP_ID=tu_app_id
ONESIGNAL_REST_API_KEY=tu_rest_api_key
FIDEO_APP_URL=https://tu-host-de-fideo/
FIDEO_TASK_ACK_ESCALATION_MINUTES=20
```

## Donde mirar

- frontend: [`frontend/README.md`](frontend/README.md)
- backend PocketBase: [`backend/pocketbase/README.md`](backend/pocketbase/README.md)
- roadmap corto: [`docs/FIDEO_JEFE_EN_CELULAR_ROADMAP.md`](docs/FIDEO_JEFE_EN_CELULAR_ROADMAP.md)
