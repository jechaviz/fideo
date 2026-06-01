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

## Pending Domains

- Inventory table parity, planogram, assets and fixed assets.
- Customer portal, generated AI insights and full message campaigns.
- Supplier portal and full purchase-order lifecycle.
- Delivery board parity, packer portal and deliverer portal.
- Finance activity history, advanced cash attention and fixed-asset sales.
- Full Gemini/codex-goal message interpretation parity and remote correction receipts.
- OneSignal live SDK binding behind explicit deployment gate.
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
