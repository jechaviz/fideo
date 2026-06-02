import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/fideoState.js';
import { addFixedAsset, logAssetMaintenance, sellCrateAsset } from '../src/domain/assets/assetActions.js';
import { crateAssetSummary, fixedAssetSummary } from '../src/domain/assets/assetSelectors.js';
import { addSize, addWarehouse, setCategoryIcon, setProductGroupArchived, setRipeningRule, setSizeArchived, setStateIcon, setWarehouseArchived, updateProductGroup, updateSize, updateVariety, updateWarehouse } from '../src/domain/catalog/catalogActions.js';
import { catalogSizeRows, catalogSummary, catalogWarehouseRows, ripeningTransitionRows } from '../src/domain/catalog/catalogSelectors.js';
import { markCrateAsLost, returnCrateLoan, updateCustomer } from '../src/domain/customers/customerActions.js';
import { customerPortfolio } from '../src/domain/customers/customerLedger.js';
import { syncOperationalTaskAssignments, updateTaskAssignmentStatus } from '../src/domain/delivery/taskAssignments.js';
import { pingDeliveryPresence, recordDeliveryReportReceipt } from '../src/domain/delivery/presenceActions.js';
import { deliveryAttentionItems, deliveryColumns, deliveryPresenceRows, deliveryReportReceiptRows, delivererPortal, routeGroups } from '../src/domain/delivery/deliverySelectors.js';
import { submitTaskReport } from '../src/domain/delivery/taskReports.js';
import { addExpense, closeCashDrawer, createFinanceExport, openCashDrawer, recordCashMovement, recordCashRemoteReceipt, signedCashMovementAmount } from '../src/domain/finance/financeActions.js';
import { cashActivityRows, cashRemoteReceiptRows, debtRows, financeExportRows, financeSummary } from '../src/domain/finance/financeSelectors.js';
import { adjustInventory, changeQuality, moveBatchLocation, moveInventory, transferBatchWarehouse } from '../src/domain/inventory/inventoryActions.js';
import { inventoryFilterOptions, inventoryTableRows, warehouseInventoryMatrix } from '../src/domain/inventory/selectors.js';
import { addMessage, appendTrainingKnowledge, approveInterpretation, correctInterpretation, interpretMessage, recordCampaignProviderReceipt, revertInterpretation, sendPromotion, updateMessageTemplate } from '../src/domain/messages/messageActions.js';
import { aiInsightCards, campaignDeliveryAnalytics, campaignDrafts, campaignReceiptRows, correctionQueue } from '../src/domain/messages/messageInsights.js';
import { messageStats } from '../src/domain/messages/messageSelectors.js';
import { followUpException, reassignException, resolveException } from '../src/domain/operations/exceptionLoop.js';
import { rolePipelineAudit } from '../src/domain/operations/rolePipelineAudit.js';
import { planogramZones } from '../src/domain/planogram/planogramSelectors.js';
import { customerPortal, packerPortal, supplierPortal } from '../src/domain/portals/portalSelectors.js';
import { planPushBinding } from '../src/domain/push/pushIdentity.js';
import { addPayment, assignDelivery, completeSale, markOrderAsPacked, setPrice, setSpecialPrice } from '../src/domain/sales/salesActions.js';
import { createPurchaseOrder, recordPurchaseProviderReceipt, receivePurchaseOrder, repricePurchaseOrder, setPurchaseOrderStatus, updateSupplier, updateSupplierSupply } from '../src/domain/suppliers/supplierActions.js';
import { purchaseOrderPipeline, purchaseReceiptRows, purchaseReceiptSummary, supplierCostMatrix, supplierStats } from '../src/domain/suppliers/supplierSelectors.js';
import { buildPersistableSnapshot, compactRemoteSnapshot, normalizePersistResult } from '../src/domain/snapshotTransport.js';
import { createPocketBaseGateway } from '../src/infrastructure/pocketbaseGateway.js';
import { mutatingPocketBaseRoutes, pocketBaseRouteManifest, routeById } from '../src/infrastructure/pocketbaseRoutes.js';
import { createAiGateway } from '../src/infrastructure/aiGateway.js';
import { normalizeAiProviderConfig, providerForModel } from '../src/infrastructure/aiProviderCatalog.js';
import { gateSummary, runtimeGateMatrix } from '../src/infrastructure/runtimeGates.js';

const state = createInitialState();
const snapshot = buildPersistableSnapshot(state);
const compact = compactRemoteSnapshot(snapshot, snapshot);

assert.equal(compact.customers, undefined);
assert.equal(compact.suppliers, undefined);
assert.equal(compact.productGroups, undefined);
assert.equal(compact.taskAssignments.length, 2);
assert.equal(snapshot.productGroups.length, 3);
assert.equal(snapshot.stateIcons.Verde, 'VE');

const initialAudit = rolePipelineAudit(createInitialState());
assert.equal(initialAudit.summary.adminKnowsEverything, true);
assert.equal(initialAudit.summary.objectivesAchieved, false);
assert.equal(initialAudit.objectives.find((item) => item.id === 'orders').status, 'critical');
assert.equal(initialAudit.roleCards.some((card) => card.role === 'Admin'), true);
assert.equal(initialAudit.risks.some((risk) => risk.owner === 'Ruta Centro'), true);

const catalogState = createInitialState();
const archive = setProductGroupArchived(catalogState, 'pg-mango', true);
assert.equal(archive.status, 'ok');
assert.equal(catalogState.productGroups.find((group) => group.id === 'pg-mango').varieties[0].archived, true);
const unarchive = setProductGroupArchived(catalogState, 'pg-mango', false);
assert.equal(unarchive.status, 'ok');
assert.equal(catalogState.productGroups.find((group) => group.id === 'pg-mango').varieties[0].archived, false);
const groupIcon = updateProductGroup(catalogState, 'pg-mango', { icon: 'MX' });
assert.equal(groupIcon.status, 'ok');
const varietyIcon = updateVariety(catalogState, 'pg-mango', 'var-mango-ataulfo', { icon: 'AT' });
assert.equal(varietyIcon.status, 'ok');
assert.equal(catalogState.productGroups.find((group) => group.id === 'pg-mango').varieties[0].icon, 'AT');

const categoryIcon = setCategoryIcon(catalogState, 'Tropical', 'TP');
assert.equal(categoryIcon.status, 'ok');
const stateIcon = setStateIcon(catalogState, 'Verde', 'VD');
assert.equal(stateIcon.status, 'ok');
assert.equal(catalogState.stateIcons.Verde, 'VD');

const addedSize = addSize(catalogState, 'Extra', 'EX');
assert.equal(addedSize.status, 'ok');
assert.equal(catalogSizeRows(catalogState).some((row) => row.name === 'Extra'), true);
const archivedSize = setSizeArchived(catalogState, 'Extra', true);
assert.equal(archivedSize.status, 'ok');
assert.equal(catalogSummary(catalogState).activeSizes, 2);

const renameSize = updateSize(catalogState, 'Grande', { name: 'Extra', icon: 'X' });
assert.equal(renameSize.status, 'failed');
const renameGrande = updateSize(catalogState, 'Grande', { name: 'Jumbo', icon: 'J' });
assert.equal(renameGrande.status, 'ok');
assert.equal(catalogState.sizes.Jumbo.icon, 'J');
assert.equal(catalogState.productGroups.find((group) => group.id === 'pg-papaya').varieties[0].sizes[0], 'Jumbo');

const addedWarehouse = addWarehouse(catalogState, 'Bodega Norte', 'BN');
assert.equal(addedWarehouse.status, 'ok');
assert.equal(catalogWarehouseRows(catalogState).some((row) => row.name === 'Bodega Norte'), true);
const warehouseUpdate = updateWarehouse(catalogState, addedWarehouse.warehouse.id, { icon: 'B2' });
assert.equal(warehouseUpdate.status, 'ok');
const warehouseArchive = setWarehouseArchived(catalogState, addedWarehouse.warehouse.id, true);
assert.equal(warehouseArchive.status, 'ok');

const rule = setRipeningRule(catalogState, 'var-mango-ataulfo', 'Verde', 'Entrado', 3);
assert.equal(rule.status, 'ok');
assert.equal(catalogState.ripeningRules.find((item) => item.fromState === 'Verde').days, 3);
assert.equal(ripeningTransitionRows(catalogState).some((row) => row.fromState === 'Verde' && row.days === 3), true);
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

const invalidPack = markOrderAsPacked(salesState, 'sale-2');
assert.equal(invalidPack.status, 'failed');
assert.equal(salesState.sales.find((sale) => sale.id === 'sale-2').status, 'En Ruta');
const prematureComplete = completeSale(salesState, 'sale-1', 'Pagado', 'Efectivo');
assert.equal(prematureComplete.status, 'failed');
assert.equal(salesState.sales.find((sale) => sale.id === 'sale-1').status, 'Pendiente de Empaque');

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
const invalidPayment = addPayment(salesState, 'cus-lupita', 0);
assert.equal(invalidPayment.status, 'failed');
assert.equal(salesState.payments.length, 1);

const blockedTask = updateTaskAssignmentStatus(salesState, 'route-sale-2', 'blocked', {
  employeeId: 'emp-route',
  employeeName: 'Ruta Centro',
}, 'Cliente no disponible');
assert.equal(blockedTask.status, 'ok');
assert.equal(salesState.taskReports[0].summary, 'Cliente no disponible');

const deliveryState = createInitialState();
assert.equal(deliveryColumns(deliveryState).packing.length, 1);
assert.equal(routeGroups(deliveryState).length, 1);
const pingPresence = pingDeliveryPresence(deliveryState, 'emp-route', { status: 'active' });
assert.equal(pingPresence.status, 'ok');
assert.equal(deliveryPresenceRows(deliveryState)[0].status, 'active');
const invalidPresence = pingDeliveryPresence(deliveryState, 'emp-admin', { status: 'active' });
assert.equal(invalidPresence.status, 'skipped');
const taskNote = submitTaskReport(deliveryState, 'pack-sale-1', {
  kind: 'note',
  summary: 'Empaque revisado',
}, { employeeId: 'emp-pack', employeeName: 'Empaque Norte' });
assert.equal(taskNote.status, 'ok');
const reportReceipt = recordDeliveryReportReceipt(deliveryState, {
  reportId: taskNote.report.id,
  provider: 'mysql',
});
assert.equal(reportReceipt.status, 'ok');
assert.equal(deliveryReportReceiptRows(deliveryState)[0].provider, 'mysql');
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
const supplierEdit = updateSupplier(commerceState, 'sup-huerta', { contact: 'WhatsApp compras' });
assert.equal(supplierEdit.status, 'ok');
const invalidOrderQuantity = createPurchaseOrder(commerceState, {
  supplierId: 'sup-huerta',
  varietyId: 'var-mango-ataulfo',
  size: 'Mediano',
  packaging: 'Caja',
  quantity: 0,
});
assert.equal(invalidOrderQuantity.status, 'failed');
const invalidOrderSize = createPurchaseOrder(commerceState, {
  supplierId: 'sup-huerta',
  varietyId: 'var-mango-ataulfo',
  size: 'Chico',
  packaging: 'Caja',
  quantity: 1,
});
assert.equal(invalidOrderSize.status, 'failed');
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
assert.equal(purchaseReceiptRows(commerceState)[0].provider, 'local');
commerceState.purchaseOrders.unshift({
  id: 'po-invalid-quantity',
  supplierId: 'sup-huerta',
  varietyId: 'var-mango-ataulfo',
  size: 'Mediano',
  packaging: 'Caja',
  quantity: 0,
  totalCost: 0,
  status: 'Ordenado',
  orderDate: new Date().toISOString(),
  paymentMethod: 'Credito',
});
const invalidReceive = receivePurchaseOrder(commerceState, 'po-invalid-quantity');
assert.equal(invalidReceive.status, 'failed');
assert.equal(commerceState.purchaseOrders.find((item) => item.id === 'po-invalid-quantity').status, 'Ordenado');
const remotePurchaseReceipt = recordPurchaseProviderReceipt(commerceState, {
  purchaseOrderId: order.order.id,
  provider: 'mysql',
  status: 'acknowledged',
});
assert.equal(remotePurchaseReceipt.status, 'ok');
assert.equal(purchaseReceiptSummary(commerceState).remoteReceipts, 1);
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
const financeExport = createFinanceExport(commerceState, 'json');
assert.equal(financeExport.status, 'ok');
assert.equal(financeExportRows(commerceState)[0].format, 'json');
const cashReceipt = recordCashRemoteReceipt(commerceState, { provider: 'mysql', drawerId: 'drawer-main' });
assert.equal(cashReceipt.status, 'ok');
assert.equal(cashRemoteReceiptRows(commerceState)[0].provider, 'mysql');
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
assert.equal(Boolean(promo.campaignId), true);
assert.equal(messageStats(messageState).approved >= 2, true);
assert.equal(aiInsightCards(messageState).length >= 1, true);
assert.equal(campaignDrafts(messageState)[0].targetIds.length, 2);
assert.equal(campaignReceiptRows(messageState)[0].provider, 'local');
const providerReceipt = recordCampaignProviderReceipt(messageState, {
  campaignId: promo.campaignId,
  provider: 'veeper',
  targetCount: promo.targets.length,
  delivered: 2,
  failed: 0,
});
assert.equal(providerReceipt.status, 'ok');
assert.equal(campaignDeliveryAnalytics(messageState).delivered, 2);
const training = appendTrainingKnowledge(messageState, 'listo significa fruta madura');
assert.equal(training.status, 'ok');
const templateUpdate = updateMessageTemplate(messageState, 'tpl-promo', { content: '{{customer}} promo {{product}}' });
assert.equal(templateUpdate.status, 'ok');
const badPurchaseMessage = addMessage(messageState, 'compra proveedor sin cantidad valida', 'Huerta del Sur');
assert.equal(badPurchaseMessage.status, 'ok');
const badCorrection = correctInterpretation(messageState, badPurchaseMessage.messageId, {
  type: 'ORDEN_COMPRA',
  certainty: 0.95,
  explanation: 'Orden corregida con cantidad invalida',
  data: {
    supplierId: 'sup-huerta',
    varietyId: 'var-mango-ataulfo',
    size: 'Mediano',
    packaging: 'Caja',
    quantity: 0,
  },
});
assert.equal(badCorrection.status, 'ok');
const badApproval = approveInterpretation(messageState, badPurchaseMessage.messageId);
assert.equal(badApproval.status, 'failed');
assert.equal(messageState.messages.find((message) => message.id === badPurchaseMessage.messageId).status, 'interpreted');
const unknownMessage = addMessage(messageState, 'solo saludo sin accion', 'Cliente');
interpretMessage(messageState, unknownMessage.messageId);
assert.equal(correctionQueue(messageState).some((message) => message.id === unknownMessage.messageId), true);
const unknownApproval = approveInterpretation(messageState, unknownMessage.messageId);
assert.equal(unknownApproval.status, 'failed');
const push = planPushBinding({ id: 'u1', role: 'Admin', employeeId: 'emp-admin' }, messageState.workspace);
assert.equal(push.bindingStatus, 'dry-run');
assert.equal(push.tags.employee_id, 'emp-admin');
assert.equal(push.tags.auth_source, 'mysql');

assert.equal(pocketBaseRouteManifest.length, 19);
assert.equal(routeById('messages_revert').path, '/api/fideo/messages/revert');
assert.equal(mutatingPocketBaseRoutes().length, 18);
const gateway = createPocketBaseGateway();
assert.equal(gateway.routes().length, 19);
const dryInspect = await gateway.inspect();
assert.equal(dryInspect.routes, 19);
const dryRealtime = await gateway.realtimePlan('fideo-demo');
assert.equal(dryRealtime.status, 'dry-run');
assert.equal(dryRealtime.realtime, 'disabled');
const persistResult = normalizePersistResult({ version: 7, message: 'ok' });
assert.equal(persistResult.status, 'ok');
assert.equal(persistResult.version, 7);
const gates = runtimeGateMatrix({
  veeperBaseUrl: 'http://127.0.0.1:8097',
  codexGoalPath: 'C:/git/codex/codex-goal',
  aiProvider: 'kilo',
  aiModel: 'stepfun 3.7 free',
});
assert.equal(gates.length, 4);
assert.equal(gateSummary(gates).gated, 1);
assert.equal(gateSummary(gates).configured, 2);
assert.equal(gates.find((gate) => gate.id === 'codex-goal').title, 'Kilo Code AI');
assert.equal(gates.find((gate) => gate.id === 'codex-goal').detail.includes('kilo/stepfun/step-3.7-flash:free'), true);
const kiloConfig = normalizeAiProviderConfig({ provider: 'kilo', model: 'stepfun 3.7 free' });
assert.equal(kiloConfig.provider, 'kilo');
assert.equal(kiloConfig.model, 'kilo/stepfun/step-3.7-flash:free');
assert.equal(providerForModel('stepfun-ai/step-3.7-flash')?.id, 'omniroute');
const geminiConfig = normalizeAiProviderConfig({ provider: 'gemini' });
assert.equal(geminiConfig.model, 'gemini-3-flash-preview');
const aiGateway = createAiGateway({ provider: 'kilo', model: 'stepfun 3.7 free', variant: 'high' });
const aiPlan = await aiGateway.planInsightRun('fideo-demo', 'fideo-insights');
assert.equal(aiPlan.provider, 'kilo');
assert.equal(aiPlan.model, 'kilo/stepfun/step-3.7-flash:free');
const bridgeGate = runtimeGateMatrix({
  aiProvider: 'kilo',
  aiModel: 'stepfun 3.7 free',
  aiBridgeUrl: 'http://127.0.0.1:8765',
});
assert.equal(bridgeGate.find((gate) => gate.id === 'codex-goal').status, 'configured');
const bridgeFetch = async (url) => new Response(JSON.stringify(url.endsWith('/health') ? {
  kind: 'fideo_kilo_bridge',
  status: 'ok',
  model: 'kilo/stepfun/step-3.7-flash:free',
} : {
  kind: 'ai_engine_plan',
  status: 'ok',
  message: 'Kilo mock genero plan Fideo.',
  result: { summary: 'ok' },
}), { status: 200 });
const liveAiGateway = createAiGateway({
  provider: 'kilo',
  model: 'stepfun 3.7 free',
  variant: 'high',
  bridgeUrl: 'http://127.0.0.1:8765',
  fetchImpl: bridgeFetch,
});
assert.equal((await liveAiGateway.inspect()).status, 'local-ready');
assert.equal((await liveAiGateway.planInsightRun('fideo-demo', 'fideo-insights')).status, 'ok');

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

const wrongReassign = reassignException(state, exception, 'emp-admin');
assert.equal(wrongReassign.receipt.status, 'failed');
assert.equal(state.taskAssignments.find((task) => task.taskId === exception.taskId).employeeId, 'emp-route');
state.employees.push({ id: 'emp-route-2', name: 'Ruta Sur', role: 'Repartidor', status: 'active' });
const reassigned = reassignException(state, exception, 'emp-route-2');
assert.equal(reassigned.receipt.status, 'ok');
assert.equal(state.taskAssignments.find((task) => task.taskId === exception.taskId).employeeId, 'emp-route-2');
assert.equal(state.sales.find((sale) => sale.id === 'sale-2').assignedEmployeeId, 'emp-route-2');

const resolved = resolveException(state, exception);
assert.equal(resolved.receipt.kind, 'resolve');
assert.equal(state.taskReports.find((report) => report.id === exception.reportId).status, 'resolved');
assert.equal(state.taskAssignments.find((task) => task.taskId === exception.taskId).status, 'acknowledged');
assert.equal(state.taskAssignments.find((task) => task.taskId === exception.taskId).blockReason, undefined);

console.log('FideoVue domain tests passed.');
