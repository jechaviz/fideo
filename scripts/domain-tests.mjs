import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/fideoState.js';
import { setProductGroupArchived, setRipeningRule, updateSize } from '../src/domain/catalog/catalogActions.js';
import { adjustInventory, changeQuality, moveBatchLocation, moveInventory } from '../src/domain/inventory/inventoryActions.js';
import { followUpException, reassignException, resolveException } from '../src/domain/operations/exceptionLoop.js';
import { buildPersistableSnapshot, compactRemoteSnapshot } from '../src/domain/snapshotTransport.js';

const state = createInitialState();
const snapshot = buildPersistableSnapshot(state);
const compact = compactRemoteSnapshot(snapshot, snapshot);

assert.equal(compact.customers, undefined);
assert.equal(compact.suppliers, undefined);
assert.equal(compact.productGroups, undefined);
assert.equal(compact.taskAssignments.length, 2);
assert.equal(snapshot.productGroups.length, 3);

const catalogState = createInitialState();
const archive = setProductGroupArchived(catalogState, 'pg-mango', true);
assert.equal(archive.status, 'ok');
assert.equal(catalogState.productGroups.find((group) => group.id === 'pg-mango').varieties[0].archived, true);

const renameSize = updateSize(catalogState, 'Grande', { name: 'Extra', icon: 'X' });
assert.equal(renameSize.status, 'ok');
assert.equal(catalogState.sizes.Extra.icon, 'X');
assert.equal(catalogState.productGroups.find((group) => group.id === 'pg-papaya').varieties[0].sizes[0], 'Extra');

const rule = setRipeningRule(catalogState, 'var-mango-ataulfo', 'Verde', 'Entrado', 3);
assert.equal(rule.status, 'ok');
assert.equal(catalogState.ripeningRules.find((item) => item.fromState === 'Verde').days, 3);
const removedRule = setRipeningRule(catalogState, 'var-mango-ataulfo', 'Verde', 'Entrado', 0);
assert.equal(removedRule.status, 'ok');
assert.equal(catalogState.ripeningRules.some((item) => item.fromState === 'Verde'), false);

const inventoryState = createInitialState();
const move = moveInventory(inventoryState, {
  varietyId: 'var-platano-chiapas',
  size: 'Mediano',
  quality: 'Normal',
  state: 'Entrado',
  warehouseId: 'wh-main',
  packagingId: 'crate-green',
}, 'Maduro', 10);
assert.equal(move.status, 'ok');
assert.equal(inventoryState.inventory.find((batch) => batch.varietyId === 'var-platano-chiapas' && batch.state === 'Maduro').quantity, 10);

const waste = changeQuality(inventoryState, {
  varietyId: 'var-papaya-maradol',
  size: 'Grande',
  quality: 'Con Defectos',
  state: 'Suave',
  warehouseId: 'wh-floor',
  packagingId: 'crate-wood',
}, 'Merma', 5);
assert.equal(waste.status, 'ok');
assert.equal(inventoryState.expenses[0].amount, 900);

const adjust = adjustInventory(inventoryState, {
  varietyId: 'var-mango-ataulfo',
  size: 'Mediano',
  quality: 'Normal',
  state: 'Maduro',
  warehouseId: 'wh-main',
  packagingId: 'crate-green',
}, 90);
assert.equal(adjust.difference, 8);

const location = moveBatchLocation(inventoryState, 'inv-1', 'Camara Fria', 5);
assert.equal(location.status, 'ok');
assert.equal(inventoryState.inventory.some((batch) => batch.location === 'Camara Fria' && batch.quantity === 5), true);

const exception = {
  id: 'task_report:report-route-sale-2',
  taskId: 'route-sale-2',
  reportId: 'report-route-sale-2',
  severity: 'high',
  title: 'Cambio de horario sin confirmar',
  detail: 'Cliente pidio cambio de horario',
  employeeName: 'Ruta Centro',
};

const beforeReports = state.taskReports.length;
const follow = followUpException(state, exception);
assert.equal(state.taskReports.length, beforeReports + 1);
assert.equal(follow.receipt.kind, 'follow_up');

const reassigned = reassignException(state, exception, 'emp-admin');
assert.equal(reassigned.receipt.status, 'ok');
assert.equal(state.taskAssignments.find((task) => task.taskId === exception.taskId).employeeId, 'emp-admin');

const resolved = resolveException(state, exception);
assert.equal(resolved.receipt.kind, 'resolve');
assert.equal(state.taskReports.find((report) => report.id === exception.reportId).status, 'resolved');

console.log('FideoVue domain tests passed.');
