# PocketBase Backend

Backend local de Fideo sobre PocketBase.

## Estado actual

- auth real en `fideo_users`
- workspace remoto versionado en `fideo_state_snapshots`
- materializacion de slices normalizados, `taskAssignments` y `taskReports`
- `bootstrap`, `persist`, `runtimeOverview`, `presence/ping`, `messages/*`, `follow-up`, `reassign` y `resolve`
- push operativo y SLA vivo via OneSignal cuando hay credenciales

## Quickstart

Todo corre desde `backend/pocketbase/`.

```powershell
.\install-pocketbase.ps1
.\start-pocketbase.ps1
.\pocketbase.exe superuser upsert dev@fideo.local "ChangeMe123!"
.\bootstrap-pocketbase.ps1 `
  -SuperuserEmail dev@fideo.local `
  -SuperuserPassword "ChangeMe123!" `
  -UserEmail admin@fideo.local `
  -UserPassword "ChangeMe123!"
```

Si actualizaste el repo, reinicia PocketBase para que corran las migraciones nuevas. Las mas recientes suben limites JSON del snapshot y de payloads operativos para que `persist` y runtime no se queden cortos.

## Lo que ya esta sano

- `POST /api/fideo/bootstrap`: deja listo el workspace, respeta ids existentes (`employeeId`, `customerId`, `supplierId`, `pushExternalId`) y devuelve `snapshot` + `runtimeOverview`
- `POST /api/fideo/state/persist`: guarda snapshot versionado, sincroniza slices materializados y responde conflicto cuando el remoto ya avanzo
- `POST /api/fideo/exceptions/follow-up`: deja seguimiento sobre la excepcion origen, actualiza snapshot/runtime y usa la misma base de push/auditoria que `reassign` y `resolve`

## Rutas clave

- `POST /api/fideo/bootstrap`
- `POST /api/fideo/state/persist`
- `POST /api/fideo/runtime/overview`
- `POST /api/fideo/presence/ping`
- `POST /api/fideo/exceptions/follow-up`
- `POST /api/fideo/exceptions/reassign`
- `POST /api/fideo/exceptions/resolve`
- `POST /api/fideo/messages/interpret`
- `POST /api/fideo/messages/approve`
- `POST /api/fideo/messages/correct`
- `POST /api/fideo/messages/revert`

## Variables utiles

Se pueden definir en `frontend/.env.local`, `frontend/.env` o directamente en el proceso que levanta PocketBase:

```env
GEMINI_API_KEY=tu_api_key
FIDEO_GEMINI_MODEL=gemini-2.5-flash
ONESIGNAL_ENABLED=1
ONESIGNAL_APP_ID=tu_app_id
ONESIGNAL_REST_API_KEY=tu_rest_api_key
FIDEO_APP_URL=https://tu-host-de-fideo/
FIDEO_TASK_ACK_ESCALATION_MINUTES=20
```

`start-pocketbase.ps1` intenta heredar esas variables desde el frontend para evitar wiring manual extra.
