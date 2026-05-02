# PocketBase Backend

Backend local de Fideo sobre PocketBase.

## Estado actual

- auth real en `fideo_users`
- workspace remoto versionado en `fideo_state_snapshots`
- transporte snapshot-first con snapshot compacto condicional en las rutas pesadas
- materializacion de slices normalizados y de `taskAssignments` / `taskReports`
- `bootstrap`, `persist`, `runtimeOverview`, `presence/ping`, `tasks/report`, `messages/*`, `follow-up`, `reassign` y `resolve`
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

Si actualizaste el repo, reinicia PocketBase para que corran las migraciones nuevas.

## Runtime actual

### Bootstrap y reconstruccion remota

- `POST /api/fideo/bootstrap` crea el workspace si falta, ata el usuario al workspace y crea `fideo_state_snapshots` si aun no existe.
- La respuesta se arma mezclando `seedSnapshot`, el snapshot persistido y los slices materializados (`productGroups`, `warehouses`, `prices`, `inventory`, `customers`, `suppliers`, `purchaseOrders`, `sales`, `payments`, `crateLoans`, `activities`, `activityLog`, `cashDrawers`, `cashDrawerActivities`, `taskAssignments`, `taskReports`).
- Si ya existen tablas materializadas, bootstrap las toma como fuente para reconstruir el snapshot devuelto. Si aun no existen, las materializa desde el snapshot disponible.
- Se hace backfill de `customerId` faltantes en `sales` y `crateLoans` cuando se puede resolver por nombre.
- `runtimeOverview` se calcula solo para perfiles internos o usuarios con `canSwitchRoles`.
- Perfiles `Cliente` y `Proveedor` reciben snapshot scopeado: se les vacian slices internos como `activityLog`, `cashDrawers`, `taskAssignments` y `taskReports`.

### Persist con snapshot compacto

- `POST /api/fideo/state/persist` usa `expectedVersion`. Si el remoto ya avanzo, responde `409` con `snapshotRecordId` y la version actual.
- El handler mergea el `snapshot` entrante sobre el snapshot remoto anterior antes de guardar. Eso permite transporte compacto sin perder datos omitidos.
- En el runtime actual, el frontend omite `productGroups`, `customers` y `suppliers` en varias rutas pesadas solo si esas slices no cambiaron respecto al remoto. PocketBase conserva esos slices porque el merge parte del snapshot remoto ya persistido.
- Despues de guardar `fideo_state_snapshots`, `syncNormalizedFromSnapshot()` solo sincroniza las colecciones cuyas keys vinieron presentes en el patch. Omitir una key la preserva; mandarla como `[]` o `{}` la trata como borrado y limpia la tabla materializada correspondiente.
- Cada persist exitoso escribe `fideo_action_logs` con `action = persist_state` y, si aplica, con el diff de push operativo.

### Follow-up server-side de excepciones

- Rutas activas: `POST /api/fideo/exceptions/follow-up`, `POST /api/fideo/tasks/follow-up`, `POST /api/fideo/reports/follow-up` y `POST /api/fideo/cash/follow-up`.
- El follow-up ya no depende de que el cliente mande el snapshot completo. Resuelve la excepcion origen contra `fideo_state_snapshots` y solo mezcla `body.snapshot` si un caller alterno lo manda.
- El handler acepta referencias como `task_report:*`, `task_blocked:*`, `task_ack_overdue:*`, `cash_negative:*`, `cash_idle:*`, `cash_without_cashier:*` y `cash_close_difference:*`.
- Si encuentra la tarea o reporte origen, actualiza metadata de seguimiento (`followUp`, `followUpCount`, `lastFollowUpAt`, `lastFollowUpTarget`) dentro del payload persistido.
- Si corresponde, marca el reporte como escalado (`escalationStatus = sent`), genera una nota timeline en `taskReports` y agrega una entrada nueva a `activityLog`.
- Al final guarda una nueva version del snapshot y resincroniza `fideo_task_assignments` y `fideo_task_reports` desde el estado resultante.
- Runtime actual a tener en cuenta: esta ruta devuelve `snapshot`, `taskAssignment`, `report`, `noteReport`, `followUpTarget` y `runtimeOverview`; ademas ya escribe `actionLogId` y propaga `pushNotifications` cuando corresponden.

### Sincronizacion de taskAssignments y taskReports

- `1730700001_fideo_task_assignments.js` crea `fideo_task_assignments` con llave unica `(workspace, externalId)` e indices por `(workspace, employeeId, status)` y `(workspace, taskId)`.
- `1730700002_fideo_task_reports.js` crea `fideo_task_reports` con llave unica `(workspace, externalId)` e indices por `(workspace, taskId, createdAt)` y `(workspace, status, escalationStatus)`.
- La materializacion es replace-by-workspace: se hace upsert por `externalId` y se borran registros ya no presentes en el slice nuevo.
- Si un `taskAssignment` no trae `id`, el backend usa `taskId::employeeId` como fallback estable.
- Si un `taskReport` no trae `id`, el backend usa `taskId::createdAt::kind::employeeId` como fallback estable.
- `persist` solo toca estos slices si el patch trae las keys. `tasks/report` y `follow-up` los reescriben siempre despues de mutar el snapshot; `reassign` y `resolve` los resincronizan cuando esos slices fueron tocados.

## Migraciones relevantes de JSON

- `1730700000_fideo_increase_json_limit.js`: sube `fideo_state_snapshots.snapshot` y `fideo_action_logs.payload` de `1MB` a `10MB`.
- `1730700003_fideo_raise_snapshot_limit.js`: vuelve a subir esos dos campos de `10MB` a `50MB`.
- `1730700004_fideo_raise_runtime_json_limits.js`: deja en `50MB` los JSON de runtime con mas presion operativa:
  - `fideo_state_snapshots.snapshot`
  - `fideo_action_logs.payload`
  - `fideo_product_groups.varieties`
  - `fideo_customers.contacts`
  - `fideo_customers.specialPrices`
  - `fideo_customers.schedule`
  - `fideo_suppliers.supplies`
  - `fideo_activity_logs.details`
  - `fideo_task_assignments.payload`
  - `fideo_task_reports.payload`

## Troubleshooting para snapshots grandes

- Primer paso despues de actualizar el repo: reinicia `.\start-pocketbase.ps1`. PocketBase aplica migraciones al arrancar; si no reinicias, puedes seguir con limites viejos.
- Si `persist`, `tasks/report`, `reassign`, `resolve` o un follow-up grande empiezan a fallar por tamano, verifica que el servidor ya arranco con las migraciones `1730700003_*` y `1730700004_*`.
- Si usas un cliente custom, no mandes slices pesados vacios para "ahorrar payload". Omitelos por completo. En este backend, `[]` significa "borra lo remoto", no "dejalo intacto".
- Un `409` con mensaje tipo `El snapshot remoto ya cambio...` no es error de tamano; es drift de version. Rehaz bootstrap o recarga la ultima version remota antes de reintentar.
- Si ves desaparicion o duplicado raro en `taskAssignments` / `taskReports`, revisa que los items conserven `id`. Si no lo traen, el fallback cambia cuando cambian `employeeId`, `createdAt` o `kind`, y eso puede abrir un registro nuevo y limpiar el anterior.
- Bootstrap puede reconstruir un snapshot compacto desde las tablas materializadas. Si las tablas materializadas quedaron vacias o corruptas, vuelve a persistir una version completa y sana del slice afectado para resembrarlas.

## Rutas clave

- `POST /api/fideo/bootstrap`
- `POST /api/fideo/state/persist`
- `POST /api/fideo/runtime/overview`
- `POST /api/fideo/presence/ping`
- `POST /api/fideo/tasks/report`
- `POST /api/fideo/exceptions/follow-up`
- `POST /api/fideo/tasks/follow-up`
- `POST /api/fideo/reports/follow-up`
- `POST /api/fideo/cash/follow-up`
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

## Smoke rapido

Hay un smoke reusable para validar `persist -> follow-up -> bootstrap -> restore`:

```powershell
.\smoke-followup.ps1 `
  -SuperuserEmail dev@fideo.local `
  -SuperuserPassword "ChangeMe123!" `
  -UserEmail admin@fideo.local `
  -UserPassword "ChangeMe123!"
```

Si tu superuser o tu usuario local son otros, pasa sus credenciales. El script autentica, persiste una tarea sintetica con snapshot compacto, ejecuta follow-up, confirma rehidratacion por bootstrap y restaura el snapshot original.
