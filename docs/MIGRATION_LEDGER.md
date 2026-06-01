# Migration Ledger

Source of truth for the full Fideo to FideoVue migration.

Run:

```powershell
node scripts/source-inventory.mjs C:\git\customers\fideo\frontend
```

## Current Slice

Ported and verified:

- `frontend/App.tsx` intent -> `src/components/App.vue` plus `src/platform/kernel.js`
- `frontend/components/ActionCenter.tsx` first operational vertical ->
  `src/components/ActionCenterPanel.vue`
- `frontend/hooks/useBusinessData.ts` first pure exception actions ->
  `src/domain/operations/exceptionLoop.js`
- `frontend/services/pocketbase/state.ts` snapshot transport subset ->
  `src/domain/snapshotTransport.js`
- `frontend/hooks/usePocketBaseSession.ts` PocketBase route surface subset ->
  `src/infrastructure/pocketbaseGateway.js`
- Veeper WhatsApp handoff contract -> `src/infrastructure/veeperGateway.js`
- codex-goal AI engine contract -> `src/infrastructure/aiGateway.js`
- reusable V contracts -> `C:\git\v_projects\lib\fideo_core`

## Pending Domains

- Catalog, product groups, varieties, prices and ripening rules.
- Inventory tables, planogram, assets and fixed assets.
- Customers, customer portals, credit, routes and insights.
- Suppliers, purchase orders and supplier portal.
- Deliveries, packer portal and deliverer portal.
- Finance, cash drawers, payments and activity history.
- Message feed, interpretation approval/correction/revert.
- OneSignal push identity and live SLA policy.
- PocketBase bootstrap, realtime restore and full normalized slices.
- Backend route parity for every PocketBase hook route.
- Veeper live receipt loop once provider credentials are present.
- codex-goal live engine execution once local path exists.

## Completion Rule

A Fideo source file is complete only when:

- its behavior has an explicit FideoVue module or documented deletion reason
- a domain or browser smoke covers the critical behavior
- line guard remains under 600 lines
- no direct secret, unsafe eval or raw HTML insertion is introduced
- the slice is committed

