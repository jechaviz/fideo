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
- codex-goal AI engine contract plus Kilo/StepFun provider normalization ->
  `src/infrastructure/aiGateway.js` and `src/infrastructure/aiProviderCatalog.js`
- reusable V contracts -> `C:\git\v_projects\lib\fideo_core`
- `frontend/hooks/useCatalogActions.ts` core catalog behavior ->
  `src/domain/catalog/catalogActions.js`
- `frontend/hooks/useInventoryActions.ts` FIFO inventory behavior ->
  `src/domain/inventory/inventoryActions.js`
- `frontend/hooks/useSalesActions.ts` and delivery task sync ->
  `src/domain/sales/salesActions.js` plus `src/domain/delivery/taskAssignments.js`
- `frontend/components/Customers.tsx` ledger/debt/crate subset ->
  `src/domain/customers/*` plus `src/components/CommerceBoard.vue`
- `frontend/components/Suppliers.tsx` purchase-order/cost subset ->
  `src/domain/suppliers/*` plus `src/components/CommerceBoard.vue`
- `frontend/components/Finances.tsx` cash/debt subset ->
  `src/domain/finance/*` plus `src/components/CommerceBoard.vue`
- `frontend/components/MessageFeed.tsx`, `MessageConfig.tsx`, `Promotions.tsx`
  and `useOneSignalPush.ts` safe local subset ->
  `src/domain/messages/*`, `src/domain/push/*` plus `src/components/MessageBoard.vue`
- `frontend/hooks/usePocketBaseSession.ts` route parity manifest ->
  `src/infrastructure/pocketbaseRoutes.js` plus `src/infrastructure/pocketbaseGateway.js`
- `frontend/components/Assets.tsx` fixed-asset and crate-asset subset ->
  `src/domain/assets/*` plus `src/components/PortalAssetBoard.vue`
- `frontend/components/Planogram.tsx` warehouse stack subset ->
  `src/domain/planogram/planogramSelectors.js` plus `src/components/PortalAssetBoard.vue`
- `frontend/views/CustomerView.tsx`, `PackerView.tsx`, `SupplierView.tsx` portal subset ->
  `src/domain/portals/portalSelectors.js` plus `src/components/PortalAssetBoard.vue`
- `frontend/components/Deliveries.tsx` and `views/DelivererView.tsx` task/report subset ->
  `src/domain/delivery/*` plus `src/components/DeliveryOpsBoard.vue`
- `frontend/components/Finances.tsx` cash attention, drawer timeline and asset-sale subset ->
  `src/domain/finance/*`, `src/domain/assets/assetActions.js` plus `src/components/FinanceOpsBoard.vue`
- `frontend/components/Suppliers.tsx` and `views/SupplierView.tsx` supplier coverage/order pipeline subset ->
  `src/domain/suppliers/*` plus `src/components/SupplierOpsBoard.vue`
- `frontend/components/Inventory.tsx` and `components/inventory/InventoryTable.tsx` table/warehouse subset ->
  `src/domain/inventory/*` plus `src/components/InventoryOpsBoard.vue`
- `frontend/components/MessageFeed.tsx`, `Promotions.tsx`, `MessageConfig.tsx`, `AITraining.tsx`
  insight/correction/campaign subset ->
  `src/domain/messages/*` plus `src/components/MessageAiOpsBoard.vue`
- `frontend/hooks/usePocketBaseSession.ts`, `useOneSignalPush.ts` runtime gate subset ->
  `src/infrastructure/runtimeGates.js` plus `src/components/RuntimeGateBoard.vue`
- `frontend/hooks/useCatalogActions.ts`, `components/RipeningRules.tsx`, `Settings.tsx`
  warehouse/size/icon/ripening admin subset ->
  `src/domain/catalog/*` plus `src/components/CatalogAdminBoard.vue`
- `frontend/components/Promotions.tsx`, `services/onesignal/client.ts` provider receipt subset ->
  `src/domain/messages/*`, `src/infrastructure/veeperGateway.js` plus `MessageAiOpsBoard.vue`
- `frontend/components/Suppliers.tsx`, `views/SupplierView.tsx` editing/remote receipt subset ->
  `src/domain/suppliers/*` plus `src/components/SupplierOpsBoard.vue`
- `frontend/views/DelivererView.tsx`, `components/RoleSwitcher.tsx` presence/map/report receipt subset ->
  `src/domain/delivery/*` plus `src/components/DeliveryOpsBoard.vue`
- `frontend/components/Finances.tsx` export/cash remote receipt subset ->
  `src/domain/finance/*` plus `src/components/FinanceOpsBoard.vue`

## Deployment Gates

- Full Kilo StepFun, Gemini or gateway-backed correction receipts require the selected
  provider executable/endpoint and credentials when applicable.
- OneSignal live SDK execution requires deployment app id plus explicit live flag.
- MySQL-backed snapshot restore requires production database credentials and
  host-side schema readiness; PocketBase remains only as route-compatibility
  vocabulary in this static port.
- Veeper live receipt loop requires a running provider service and credentials.
- codex-goal live engine execution requires `C:\git\codex\codex-goal` on the operator machine.

## Completion Rule

A Fideo source file is complete only when:

- its behavior has an explicit FideoVue module or documented deletion reason
- a domain or browser smoke covers the critical behavior
- line guard remains under 600 lines
- no direct secret, unsafe eval or raw HTML insertion is introduced
- the slice is committed
