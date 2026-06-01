import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/fideoState.js';
import { addFixedAsset, logAssetMaintenance, sellCrateAsset } from '../src/domain/assets/assetActions.js';
import { crateAssetSummary, fixedAssetSummary } from '../src/domain/assets/assetSelectors.js';
import { setProductGroupArchived, setRipeningRule, updateSize } from '../src/domain/catalog/catalogActions.js';
import { markCrateAsLost, returnCrateLoan, updateCustomer } from '../src/domain/customers/customerActions.js';
import { customerPortfolio } from '../src/domain/customers/customerLedger.js';
import { syncOperationalTaskAssignments, updateTaskAssignmentStatus } from '../src/domain/delivery/taskAssignments.js';
import { deliveryAttentionItems, deliveryColumns, delivererPortal, routeGroups } from '../src/domain/delivery/deliverySelectors.js';
import { submitTaskReport } from '../src/domain/delivery/taskReports.js';
import { addExpense, closeCashDrawer, openCashDrawer, recordCashMovement, signedCashMovementAmount } from '../src/domain/finance/financeActions.js';
import { cashActivityRows, debtRows, financeSummary } from '../src/domain/finance/financeSelectors.js';
import { adjustInventory, changeQuality, moveBatchLocation, moveInventory, transferBatchWarehouse } from '../src/domain/inventory/inventoryActions.js';
import { inventoryFilterOptions, inventoryTableRows, warehouseInventoryMatrix } from '../src/domain/inventory/selectors.js';
import { addMessage, approveInterpretation, correctInterpretation, interpretMessage, revertInterpretation, sendPromotion } from '../src/domain/messages/messageActions.js';
import { messageStats } from '../src/domain/messages/messageSelectors.js';
import { followUpException, reassignException, resolveException } from '../src/domain/operations/exceptionLoop.js';
import { planogramZones } from '../src/domain/planogram/planogramSelectors.js';
import { customerPortal, packerPortal, supplierPortal } from '../src/domain/portals/portalSelectors.js';
import { planPushBinding } from '../src/domain/push/pushIdentity.js';
import { assignDelivery, completeSale, markOrderAsPacked, setPrice, setSpecialPrice } from '../src/domain/sales/salesActions.js';
import {
  createPurchaseOrder,
  receivePurchaseOrder,
  repricePurchaseOrder,
  setPurchaseOrderStatus,
  updateSupplierSupply,
} from '../src/domain/suppliers/supplierActions.js';
import { purchaseOrderPipeline, supplierCostMatrix, supplierStats } from '../src/domain/suppliers/supplierSelectors.js';
import { buildPersistableSnapshot, compactRemoteSnapshot } from '../src/domain/snapshotTransport.js';
import { createPocketBaseGateway } from '../src/infrastructure/pocketbaseGateway.js';
import { mutatingPocketBaseRoutes, pocketBaseRouteManifest, routeById } from '../src/infrastructure/pocketbaseRoutes.js';

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
const transferWarehouse = transferBatchWarehouse(inventoryState, 'inv-1', 'wh-floor', 2);
assert.equal(transferWarehouse.status, 'ok');
assert.equal(inventoryState.inventory.some((batch) => batch.warehouseId === 'wh-floor' && batch.quantity === 2), true);
assert.equal(inventoryFilterOptions(inventoryState).states.includes('Maduro'), true);
assert.equal(warehouseInventoryMatrix(inventoryState).some((warehouse) => warehouse.quantity > 0), true);
assert.equal(inventoryTableRows(inventoryState, { warehouseId: 'wh-floor' }).length >= 1, true);

const salesState = createInitialState();
syncOperationalTaskAssignments(salesState);
assert.equal(salesState.taskAssignments.some((task) => task.taskId === 'pack-sale-1'), true);

const packed = markOrderAsPacked(salesState, 'sale-1');
assert.equal(packed.status, 'ok');
assert.equal(salesState.sales.find((sale) => sale.id === 'sale-1').status, 'Listo para Entrega');
assert.equal(salesState.taskAssignments.some((task) => task.taskId === 'assign-sale-1'), true);

const assigned = assignDelivery(salesState, 'sale-1', 'emp-route');
assert.equal(assigned.status, 'ok');
assert.equal(salesState.sales.find((sale) => sale.id === 'sale-1').status, 'En Ruta');
assert.equal(salesState.taskAssignments.some((task) => task.taskId === 'route-sale-1'), true);

const inProgress = updateTaskAssignmentStatus(salesState, 'route-sale-1', 'in_progress', {
  employeeId: 'emp-route',
  employeeName: 'Ruta Centro',
});
assert.equal(inProgress.status, 'ok');

const completed = completeSale(salesState, 'sale-1', 'Pagado', 'Efectivo');
assert.equal(completed.status, 'ok');
assert.equal(salesState.sales.find((sale) => sale.id === 'sale-1').status, 'Completado');
assert.equal(salesState.payments.length, 1);
assert.equal(salesState.cashDrawers[0].balance, 16280);

const blockedTask = updateTaskAssignmentStatus(salesState, 'route-sale-2', 'blocked', {
  employeeId: 'emp-route',
  employeeName: 'Ruta Centro',
}, 'Cliente no disponible');
assert.equal(blockedTask.status, 'ok');
assert.equal(salesState.taskReports[0].summary, 'Cliente no disponible');

const deliveryState = createInitialState();
assert.equal(deliveryColumns(deliveryState).packing.length, 1);
assert.equal(routeGroups(deliveryState).length, 1);
const taskNote = submitTaskReport(deliveryState, 'pack-sale-1', {
  kind: 'note',
  summary: 'Empaque revisado',
}, { employeeId: 'emp-pack', employeeName: 'Empaque Norte' });
assert.equal(taskNote.status, 'ok');
const routeIncident = submitTaskReport(deliveryState, 'route-sale-2', {
  kind: 'incident',
  summary: 'Cliente no contesta',
  severity: 'high',
}, { employeeId: 'emp-route', employeeName: 'Ruta Centro' });
assert.equal(routeIncident.status, 'ok');
assert.equal(deliveryState.taskAssignments.find((task) => task.taskId === 'route-sale-2').status, 'blocked');
assert.equal(deliveryAttentionItems(deliveryState).some((item) => item.tone === 'critical'), true);
assert.equal(delivererPortal(deliveryState, 'emp-route').blocked.length >= 1, true);

const price = setPrice(salesState, 'var-mango-ataulfo', 'Mediano', 'Normal', 'Maduro', 490);
assert.equal(price.status, 'ok');
assert.equal(salesState.prices.find((item) => item.varietyId === 'var-mango-ataulfo').price, 490);

const specialPrice = setSpecialPrice(salesState, 'cus-lupita', 'var-mango-ataulfo', 'Mediano', 'Normal', 'Maduro', 455);
assert.equal(specialPrice.status, 'ok');
assert.equal(salesState.customers.find((item) => item.id === 'cus-lupita').specialPrices[0].price, 455);

const commerceState = createInitialState();
const customerUpdate = updateCustomer(commerceState, 'cus-lupita', { creditLimit: 30000 });
assert.equal(customerUpdate.status, 'ok');
assert.equal(customerPortfolio(commerceState).customers, 2);

const lostCrate = markCrateAsLost(commerceState, 'loan-mercado-green');
assert.equal(lostCrate.status, 'ok');
assert.equal(commerceState.crateInventory.find((item) => item.crateTypeId === 'crate-green').quantityOwned, 108);
const returnLost = returnCrateLoan(commerceState, 'loan-mercado-green');
assert.equal(returnLost.status, 'skipped');

const suppliers = supplierStats(commerceState);
assert.equal(suppliers.supplierCount, 2);
const order = createPurchaseOrder(commerceState, {
  supplierId: 'sup-huerta',
  varietyId: 'var-mango-ataulfo',
  size: 'Mediano',
  packaging: 'Caja',
  quantity: 10,
});
assert.equal(order.status, 'ok');
const received = receivePurchaseOrder(commerceState, order.order.id);
assert.equal(received.status, 'ok');
assert.equal(commerceState.purchaseOrders.find((item) => item.id === order.order.id).status, 'Recibido');
assert.equal(supplierCostMatrix(commerceState).length >= 1, true);
const supplyUpdate = updateSupplierSupply(commerceState, 'sup-huerta', 'var-mango-ataulfo', { baseCost: 270 });
assert.equal(supplyUpdate.status, 'ok');
const pendingOrder = createPurchaseOrder(commerceState, {
  supplierId: 'sup-huerta',
  varietyId: 'var-mango-ataulfo',
  size: 'Mediano',
  packaging: 'Caja',
  quantity: 5,
});
assert.equal(pendingOrder.order.status, 'Pendiente');
const orderedPo = setPurchaseOrderStatus(commerceState, pendingOrder.order.id, 'Ordenado');
assert.equal(orderedPo.status, 'ok');
const repricedPo = repricePurchaseOrder(commerceState, pendingOrder.order.id);
assert.equal(repricedPo.status, 'ok');
assert.equal(purchaseOrderPipeline(commerceState).openCount >= 1, true);

const closed = closeCashDrawer(commerceState, 'drawer-main', commerceState.cashDrawers[0].balance + 50, 'conteo');
assert.equal(closed.difference, 50);
const opened = openCashDrawer(commerceState, 'drawer-main', 4000);
assert.equal(opened.status, 'ok');
const expense = addExpense(commerceState, { description: 'Gasolina ruta', amount: 500, category: 'Combustible' });
assert.equal(expense.status, 'ok');
assert.equal(financeSummary(commerceState).expenses >= 500, true);
assert.equal(signedCashMovementAmount('RETIRO_EFECTIVO', 250), -250);
const cashMove = recordCashMovement(commerceState, 'drawer-main', 'DEPOSITO_BANCO', 500, 'Deposito prueba');
assert.equal(cashMove.status, 'ok');
assert.equal(commerceState.cashDrawers[0].balance, 3500);
assert.equal(cashActivityRows(commerceState, 'drawer-main')[0].label, 'Deposito');
const assetSale = sellCrateAsset(commerceState, 'cus-lupita', 'crate-green', 2);
assert.equal(assetSale.status, 'ok');
assert.equal(commerceState.sales[0].productGroupName, 'Activos');
assert.equal(debtRows(commerceState).some((row) => row.customerId === 'cus-lupita'), true);

const messageState = createInitialState();
assert.equal(messageStats(messageState).pending, 1);
const addedMessage = addMessage(messageState, 'compra proveedor mango mediano 10 cajas', 'Huerta del Sur');
assert.equal(addedMessage.status, 'ok');
const interpreted = interpretMessage(messageState, addedMessage.messageId);
assert.equal(interpreted.status, 'ok');
assert.equal(messageState.messages.find((message) => message.id === addedMessage.messageId).status, 'interpreted');

const corrected = correctInterpretation(messageState, addedMessage.messageId, {
  type: 'CREAR_OFERTA',
  certainty: 0.9,
  explanation: 'Campana corregida',
  data: { targetAudience: 'clientes activos', productDescription: 'Mango premium', price: 490 },
});
assert.equal(corrected.status, 'ok');
const approvedMessage = approveInterpretation(messageState, addedMessage.messageId);
assert.equal(approvedMessage.status, 'ok');
assert.equal(messageState.messages.find((message) => message.id === addedMessage.messageId).status, 'approved');
const revertedMessage = revertInterpretation(messageState, addedMessage.messageId);
assert.equal(revertedMessage.status, 'ok');
assert.equal(messageState.messages.find((message) => message.id === addedMessage.messageId).status, 'interpreted');

const promo = sendPromotion(messageState, 'Mango listo hoy', ['cus-lupita', 'cus-mercado']);
assert.equal(promo.status, 'ok');
assert.equal(messageStats(messageState).approved >= 2, true);
const push = planPushBinding({ id: 'u1', role: 'Admin', employeeId: 'emp-admin' }, messageState.workspace);
assert.equal(push.bindingStatus, 'dry-run');
assert.equal(push.tags.employee_id, 'emp-admin');

assert.equal(pocketBaseRouteManifest.length, 19);
assert.equal(routeById('messages_revert').path, '/api/fideo/messages/revert');
assert.equal(mutatingPocketBaseRoutes().length, 18);
const gateway = createPocketBaseGateway();
assert.equal(gateway.routes().length, 19);
const dryInspect = await gateway.inspect();
assert.equal(dryInspect.routes, 19);

const portalState = createInitialState();
assert.equal(fixedAssetSummary(portalState).total, 2);
const addedAsset = addFixedAsset(portalState, {
  name: 'Patin hidraulico',
  category: 'Equipo de Carga',
  cost: 12500,
});
assert.equal(addedAsset.status, 'ok');
const maintainedAsset = logAssetMaintenance(portalState, addedAsset.asset.id, 900, 'Cambio de ruedas');
assert.equal(maintainedAsset.status, 'ok');
assert.equal(portalState.fixedAssets.find((asset) => asset.id === addedAsset.asset.id).status, 'En Reparacion');
const crateAssets = crateAssetSummary(portalState);
assert.equal(crateAssets.owned, 200);
assert.equal(crateAssets.loaned, 12);
const zones = planogramZones(portalState);
assert.equal(zones.totalQuantity, 144);
assert.equal(zones.floor.length >= 1, true);
const customerView = customerPortal(portalState, 'cus-lupita');
assert.equal(customerView.customer.name, 'Fruteria Lupita');
assert.equal(customerView.historicalSales.length, 1);
const packerView = packerPortal(portalState, 'emp-pack');
assert.equal(packerView.tasks.some((task) => task.taskId === 'pack-sale-1'), true);
const supplierView = supplierPortal(portalState, 'sup-huerta');
assert.equal(supplierView.orders.length >= 1, true);

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
