# Fideo

Fideo es una mesa de control comercial para operacion diaria. La app vive en `frontend/` y el backend operativo actual vive en `backend/pocketbase/`.

## Estado actual

- login real con PocketBase cuando existe `VITE_POCKETBASE_URL`
- workspace remoto versionado con contrato snapshot-first hacia el frontend
- `bootstrap`, `persist`, `follow-up`, `runtimeOverview` y `presence/ping` ya estan estables sobre PocketBase
- transporte compacto para snapshots pesados: el cliente omite `productGroups`, `customers` y `suppliers` cuando no cambiaron, y PocketBase los conserva/fusiona server-side desde las slices normalizadas
- `taskAssignments` y `taskReports` ya sobreviven roundtrip real por PocketBase y se resincronizan despues de `follow-up`
- `follow-up`, `reassign` y `resolve` ya son acciones server-side desde la misma cola operativa
- migraciones recientes suben los limites JSON del runtime para snapshots y payloads operativos grandes
- OneSignal queda listo para push operativo y SLA vivo cuando hay credenciales

## Lo importante hoy

- `bootstrap`: crea o reutiliza workspace/usuario, preserva `employeeId`, `customerId`, `supplierId` y `pushExternalId`, y devuelve `snapshot` + `runtimeOverview`; el frontend tambien lo usa al restaurar sesion
- `persist`: guarda el snapshot con version lock y transporte compacto condicional; si aparece `409`, el cliente recarga la version remota antes de seguir
- `follow-up`: deja seguimiento sobre la misma excepcion, actualiza snapshot/runtime, resincroniza `taskAssignments` y `taskReports`, y reutiliza la misma audiencia push que `reassign` y `resolve`
- PocketBase debe reiniciarse despues de actualizar el repo para aplicar la migracion `1730700004_fideo_raise_runtime_json_limits.js`, que lleva a `50MB` el snapshot y payloads JSON grandes del runtime

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

## Smoke rapido

Smoke e2e sano del runtime remoto: `persist -> follow-up -> bootstrap -> restore`.

1. levanta PocketBase y el frontend con los comandos de arriba
2. opcion rapida: corre `backend/pocketbase/smoke-followup.ps1` con un usuario real para validar el loop completo en una sola pasada
3. entra con un usuario real y provoca un cambio que dispare `persist`
4. genera un `follow-up` desde la cola operativa y confirma que vuelve `snapshot` actualizado con `taskAssignments` y `taskReports` sincronizados
5. recarga la app o vuelve a abrir la sesion: el flujo de `restore` vuelve a llamar `bootstrap` y debe rehidratar el workspace completo, incluyendo las slices pesadas que ya no viajan en el transporte compacto
6. valida que `productGroups`, `customers` y `suppliers` reaparezcan completos despues del bootstrap/restore y que la excepcion seguida conserve su estado

## Donde mirar

- frontend: [`frontend/README.md`](frontend/README.md)
- backend PocketBase: [`backend/pocketbase/README.md`](backend/pocketbase/README.md)
- roadmap corto: [`docs/FIDEO_JEFE_EN_CELULAR_ROADMAP.md`](docs/FIDEO_JEFE_EN_CELULAR_ROADMAP.md)
