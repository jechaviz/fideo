# PocketBase Backend

Este directorio contiene el backend local de Fideo sobre PocketBase:

- auth con la coleccion `fideo_users`
- workspace compartido
- snapshot persistido del estado de negocio
- rutas custom para bootstrap, guardado, interpretacion remota y aprobacion server-side

## Estructura

```text
backend/pocketbase/
  .gitignore
  bootstrap-pocketbase.ps1
  install-pocketbase.ps1
  pb_hooks/
  pb_migrations/
  start-pocketbase.ps1
```

## Quickstart local

Todo esto se corre desde `backend/pocketbase/`.

1. Instala PocketBase localmente sin meter el binario al repo:

```powershell
.\install-pocketbase.ps1
```

Por defecto el helper fija PocketBase en la version `0.37.3`.
Si necesitas otra version:

```powershell
.\install-pocketbase.ps1 -Version 0.37.3 -Force
```

2. Levanta el servidor:

```powershell
.\start-pocketbase.ps1
```

O en una sola pasada si todavia no existe el binario:

```powershell
.\start-pocketbase.ps1 -InstallIfMissing
```

Cuando levantas PocketBase con este helper, el script tambien intenta leer `frontend/.env.local` y `frontend/.env` para heredar estas variables al proceso del backend si todavia no existen en el entorno actual:

- `GEMINI_API_KEY`
- `FIDEO_GEMINI_API_KEY`
- `VITE_GEMINI_API_KEY`
- `GEMINI_MODEL`
- `FIDEO_GEMINI_MODEL`
- `ONESIGNAL_ENABLED`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `FIDEO_APP_URL`

Eso deja lista la interpretacion server-side sin tener que exportar todo a mano en otra consola.
Y ahora tambien deja listo el carril de push operativo via OneSignal.

3. Crea el primer superuser.

Opcion dashboard:

- abre `http://127.0.0.1:8090/_/`
- sigue el instalador inicial

Opcion CLI:

```powershell
.\pocketbase.exe superuser upsert dev@fideo.local "ChangeMe123!"
```

4. Bootstrap de un usuario local de Fideo y del workspace `main`:

```powershell
.\bootstrap-pocketbase.ps1 `
  -SuperuserEmail dev@fideo.local `
  -SuperuserPassword "ChangeMe123!" `
  -UserEmail admin@fideo.local `
  -UserPassword "ChangeMe123!"
```

Ese helper:

- espera a que PocketBase responda
- autentica como `_superusers`
- crea o reutiliza el workspace `main`
- crea o actualiza un usuario en `fideo_users`
- ejecuta `/api/fideo/bootstrap` para dejar listo el snapshot inicial

Si el usuario ya existia con otra password:

```powershell
.\bootstrap-pocketbase.ps1 `
  -SuperuserEmail dev@fideo.local `
  -SuperuserPassword "ChangeMe123!" `
  -UserEmail admin@fideo.local `
  -UserPassword "ChangeMe123!" `
  -ResetUserPassword
```

## Slice normalizado inicial

Ademas del snapshot en `fideo_state_snapshots`, el backend ya trae un primer slice de dominio normalizado:

- `fideo_product_groups`
- `fideo_warehouses`
- `fideo_prices`
- `fideo_inventory_batches`
- `fideo_customers`
- `fideo_suppliers`
- `fideo_purchase_orders`

Todas estas colecciones son `workspace`-scoped y contemplan `externalId` para sync/import donde tiene sentido.
Por ahora el contrato operativo sigue siendo snapshot-first: `fideo_state_snapshots` sigue como compatibilidad hacia el frontend, mientras los hooks materializan y reconstruyen este slice normalizado en bootstrap y persist.

## Segunda ola transaccional

El backend ya materializa tambien una segunda ola de normalizacion transaccional:

- `fideo_sales`
- `fideo_payments`
- `fideo_crate_loans`
- `fideo_employee_activities`
- `fideo_activity_logs`
- `fideo_cash_drawers`
- `fideo_cash_drawer_activities`

Estas colecciones siguen el mismo patron de `workspace` scoping y `externalId` para facilitar sync/import sin romper el contrato actual del snapshot.
Los hooks de `/api/fideo/bootstrap` y `/api/fideo/state/persist` ya materializan y reconstruyen este slice tambien, asi que ventas, pagos, actividad, caja y prestamos ya sobreviven roundtrip real sobre PocketBase aunque el contrato publico del frontend siga siendo snapshot-first.

## Slice operacional: task assignments + task reports

El backend ya puede materializar un slice minimo `fideo_task_assignments` desde `snapshot.taskAssignments`.

- conserva `taskId`, `employeeId`, `role`, `status` y timestamps de acuse/progreso/bloqueo/cierre
- guarda tambien `payload` JSON para reconstruir el item snapshot-first sin inventar rutas nuevas
- `/api/fideo/bootstrap` reconstruye `snapshot.taskAssignments` desde la coleccion si ya existe materializacion previa
- deja una primera carril de escalacion para tareas bloqueadas o sin acuse prolongado

Encima de eso, ahora tambien materializa `fideo_task_reports` desde `snapshot.taskReports`.

- conserva el reporte estructurado por `taskId`: `kind`, `status`, `severity`, `summary`, `detail`, `evidence` y `escalationStatus`
- guarda contexto operativo minimo (`saleId`, `role`, empleado, cliente, `taskTitle`) y `payload` JSON completo para roundtrip snapshot-first
- `/api/fideo/bootstrap` reconstruye `snapshot.taskReports` desde la coleccion si ya existe materializacion previa
- perfiles `Cliente` y `Proveedor` no reciben este slice en su snapshot recortado

Con esto, el frontend puede seguir operando snapshot-first mientras PocketBase ya deja un carril real para asignaciones con acuse por empleado y reportes operativos cortos por tarea.

## Rutas custom actuales

- `POST /api/fideo/bootstrap`
- `POST /api/fideo/presence/ping`
- `POST /api/fideo/state/persist`
- `POST /api/fideo/messages/interpret`
- `POST /api/fideo/messages/approve`
- `POST /api/fideo/messages/correct`
- `POST /api/fideo/messages/revert` (`/api/fideo/messages/undo` queda como alias)

Estas rutas cierran el loop de mensajeria operacional:

- `messages/interpret` toma `workspaceId`, `expectedVersion`, `snapshot`, `messageId` y `message`, interpreta en backend y persiste el mensaje en `snapshot.messages` con `status: interpreted`
- `messages/approve` toma el mismo contexto versionado y aplica la accion aprobada sobre el snapshot remoto
- `messages/correct` corrige manualmente la interpretacion de un mensaje no aprobado y deja log versionado con snapshot antes/despues para undo
- `messages/revert` revierte la ultima correccion o aprobacion relevante de un mensaje cuando el version lock confirma que el workspace no se movio despues de esa accion

Ambas rutas exigen auth real en `fideo_users`, validan ownership del workspace y respetan el lock optimista por version.

Para presencia/identidad de dispositivo ahora hay un carril liviano:

- `bootstrap` expone `profile.pushExternalId` cuando existe y tambien `profile.lastSeenAt` / `profile.presence` con la ultima sesion conocida del usuario
- `POST /api/fideo/presence/ping` acepta payload autenticado tipo `workspaceId`, `sessionId`, `deviceId`, `deviceName`, `installationId`, `platform`, `appVersion`, `status`, `pushExternalId` y `meta`
- si `pushExternalId` llega informado, el hook lo guarda en `fideo_users.pushExternalId`
- la presencia se persiste con upsert pragmatica por sesion en `fideo_action_logs` usando acciones `presence_ping:<sessionKey>`, para no meter ruido en `snapshot.activityLog`

## OneSignal server-side

El backend ya soporta envio REST a OneSignal inspirado en el carril usado por `EasyPoint`, pero adaptado al dominio de Fideo.

### Variables esperadas

Define estas variables en `frontend/.env.local`, `frontend/.env` o en el entorno del proceso que levanta PocketBase:

```env
ONESIGNAL_ENABLED=1
ONESIGNAL_APP_ID=tu_app_id
ONESIGNAL_REST_API_KEY=tu_rest_api_key
FIDEO_APP_URL=https://tu-host-de-fideo/
FIDEO_TASK_ACK_ESCALATION_MINUTES=20
```

### Identity contract recomendado

El backend puede targetear de dos formas:

- `include_aliases.external_id`
- `filters` por tags

Para que eso aterrice bien en el cliente movil, el contrato recomendado es:

- `external_id = fideo_users.pushExternalId` si existe, o `fideo_users.id` como fallback
- tags:
  - `app=fideo`
  - `workspace_slug=<slug>`
  - `role=<rol>`
  - `employee_id=<employeeId>`

### Campos nuevos en `fideo_users`

La migracion agrega estos campos opcionales:

- `employeeId`: amarra al usuario con `snapshot.employees[].id` y ahora tambien viaja en `profile.employeeId` dentro de `/api/fideo/bootstrap`
- `pushExternalId`: override del `external_id` que usara OneSignal, y tambien puede refrescarse desde `POST /api/fideo/presence/ping`

Si no defines `pushExternalId`, el backend usa `fideo_users.id`.
Si no defines `employeeId`, el backend intenta resolver por nombre y luego por rol.

### Eventos que ya disparan push

Hoy el hook detecta cambios utiles en el snapshot y manda pushes para:

- `pedido listo` (`Listo para Entrega`) -> `Admin` / despacho
- `asignacion de entrega` (`assignedEmployeeId` nuevo en `En Ruta`) -> `Repartidor`
- `alerta de caja` -> `Admin`
- `task report` abierto con `escalationStatus: pending` y severidad operativa (`blocker`, `incident` o `high`) -> `Admin`
- `taskAssignment` que entra a `blocked` -> `Admin`
- `taskAssignment` que sigue en `assigned` sin `acknowledgedAt` despues del umbral -> `Admin`

El umbral de falta de acuse se controla con `FIDEO_TASK_ACK_ESCALATION_MINUTES` y por default cae en `20`.

Los disparos viven tanto en:

- `POST /api/fideo/state/persist`
- `POST /api/fideo/messages/approve`

Eso cubre acciones directas de UI y acciones aprobadas desde el loop IA. Si OneSignal no esta configurado o no encuentra audiencia, el intento igual queda trazado en `fideo_action_logs` dentro de `pushNotifications`.

## Scope por perfil

El backend ya endurece tambien el acceso por perfil sobre `/api/fideo/bootstrap`:

- roles internos (`Admin`, `Empacador`, `Repartidor`, `Cajero`) reciben el snapshot completo del workspace
- perfiles `Cliente` reciben solo su cuenta, sus ventas, sus pagos y sus prestamos de cajas
- perfiles `Proveedor` reciben solo su ficha y sus ordenes de compra

Ademas, los perfiles portal (`Cliente` y `Proveedor` sin `canSwitchRoles`) quedan en modo solo lectura:

- `/api/fideo/state/persist` responde `403`
- el snapshot que viaja al frontend ya sale podado de datos internos no usados por el portal
- ventas y prestamos nuevos ya guardan `customerId` para no depender solo del nombre del cliente al recortar datos

Tambien ya existe backfill para historicos:

- `fideo_sales.customerId`
- `fideo_crate_loans.customerId`
- `snapshot.sales[].customerId`
- `snapshot.crateLoans[].customerId`

Si el nombre del cliente es unico dentro del workspace, PocketBase rellena esos ids tanto por migracion como durante `bootstrap` y `persist`, para que los historicos viejos no queden flotando en joins por nombre.

## IA server-side

La interpretacion de mensajes ya puede vivir en PocketBase usando Gemini por REST desde JSVM.

- modelo default: `gemini-2.5-flash`
- override opcional: `FIDEO_GEMINI_MODEL` o `GEMINI_MODEL`
- key aceptada por el hook: `FIDEO_GEMINI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `API_KEY` y como fallback `VITE_GEMINI_API_KEY`

Si la key falta o es invalida, el endpoint no rompe el flujo: devuelve una interpretacion `DESCONOCIDO`, persiste el mensaje ya interpretado y deja trazado el error en `fideo_action_logs`.

## Parametros utiles

Cambiar puerto o bind:

```powershell
.\start-pocketbase.ps1 -Http 127.0.0.1:8091
```

Pasar flags extra a `serve`:

```powershell
.\start-pocketbase.ps1 -PocketBaseArgs @("--dir", "pb_data")
```

Cambiar version descargada:

```powershell
.\install-pocketbase.ps1 -Version 0.37.3 -Force
```

## Que queda fuera del repo

El `.gitignore` local de este directorio evita subir artefactos operativos:

- `pocketbase.exe` o `pocketbase`
- `pocketbase_*.zip`
- `pocketbase.stdout.log` y `pocketbase.stderr.log`
- `CHANGELOG.md` y `LICENSE.md` del bundle descargado
- `pb_data/`
- `pb_public/`
- `.tmp/`

Con eso puedes instalar, correr y resetear el backend local sin ensuciar el repo con binarios o datos locales.

## Frontend

Configura el frontend con:

```env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

Con eso, Fideo usa:

- auth real con login
- bootstrap remoto del workspace
- ping remoto de presencia/identidad de dispositivo
- persistencia remota del snapshot de negocio
- interpretacion remota de mensajes con fallback local si la ruta aun no existe o no esta disponible
- aprobacion server-side de acciones sobre el workspace compartido

Para probar el carril OneSignal de punta a punta necesitas, ademas:

1. levantar PocketBase con las variables OneSignal activas
2. tener usuarios `fideo_users` con `role`, y de preferencia `employeeId` / `pushExternalId`
3. tener el cliente movil registrando el mismo `external_id` y tags en OneSignal
4. provocar uno de estos cambios:
   - mover una venta a `Listo para Entrega`
   - asignar un repartidor
   - generar una incidencia de caja

Tambien puedes crear usuarios mas precisos con el bootstrap helper:

```powershell
.\bootstrap-pocketbase.ps1 `
  -SuperuserEmail dev@fideo.local `
  -SuperuserPassword "ChangeMe123!" `
  -UserEmail driver@fideo.local `
  -UserPassword "ChangeMe123!" `
  -UserName "Empleado Luis" `
  -UserRole Repartidor `
  -CanSwitchRoles $false `
  -EmployeeId e2 `
  -PushExternalId driver-luis
```
