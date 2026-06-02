import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInitialState } from '../src/domain/fideoState.js';
import { customerPortfolio } from '../src/domain/customers/customerLedger.js';
import { completeOperationalTask } from '../src/domain/delivery/taskCompletion.js';
import { syncOperationalTaskAssignments, updateTaskAssignmentStatus } from '../src/domain/delivery/taskAssignments.js';
import { addExpense, openCashDrawer, recordCashMovement } from '../src/domain/finance/financeActions.js';
import { addPayment, completeSale } from '../src/domain/sales/salesActions.js';
import {
  addSupplierSupply,
  createPurchaseOrder,
  receivePurchaseOrder,
  setPurchaseOrderStatus,
  updateSupplierSupply,
} from '../src/domain/suppliers/supplierActions.js';

const fideoApiSource = await readFile(new URL('../api/fideo/index.php', import.meta.url), 'utf8');
assert.match(fideoApiSource, /function expected_version\(array \$body\): \?int/);
assert.match(fideoApiSource, /function idempotency_key\(array \$body\): string/);
assert.match(fideoApiSource, /FIDEO_IDEMPOTENCY_COLLECTION = 'fideo_idempotency'/);
assert.match(fideoApiSource, /INSERT IGNORE INTO pbm_records/);
assert.match(fideoApiSource, /SELECT ROW_COUNT\(\)/);
assert.match(fideoApiSource, /respond\(409, \$payload\)/);
assert.match(fideoApiSource, /if \(!defined\('FIDEO_API_NO_RUN'\)\)/);

const taskWorkflowState = createInitialState();
updateTaskAssignmentStatus(taskWorkflowState, 'pack-sale-1', 'in_progress', {
  employeeId: 'emp-pack',
  employeeName: 'Empaque Norte',
});
const taskWorkflowReceipts = completeOperationalTask(taskWorkflowState, 'pack-sale-1', {
  employeeId: 'emp-pack',
  employeeName: 'Empaque Norte',
});
assert.equal(taskWorkflowReceipts[0].status, 'ok');
assert.equal(taskWorkflowState.sales.find((sale) => sale.id === 'sale-1').status, 'Listo para Entrega');
assert.equal(taskWorkflowState.taskAssignments.find((task) => task.taskId === 'pack-sale-1').status, 'done');

const taskFailureState = createInitialState();
updateTaskAssignmentStatus(taskFailureState, 'pack-sale-1', 'in_progress', {
  employeeId: 'emp-pack',
  employeeName: 'Empaque Norte',
});
taskFailureState.sales.find((sale) => sale.id === 'sale-1').status = 'En Ruta';
const taskFailureReceipts = completeOperationalTask(taskFailureState, 'pack-sale-1', {
  employeeId: 'emp-pack',
  employeeName: 'Empaque Norte',
});
assert.equal(taskFailureReceipts[0].status, 'failed');
assert.equal(taskFailureState.taskAssignments.find((task) => task.taskId === 'pack-sale-1').status, 'in_progress');

const closedCashSale = createInitialState();
closedCashSale.cashDrawers[0].status = 'Cerrada';
const closedCashComplete = completeSale(closedCashSale, 'sale-2', 'Pagado', 'Efectivo');
assert.equal(closedCashComplete.status, 'failed');
assert.equal(closedCashSale.sales.find((sale) => sale.id === 'sale-2').status, 'En Ruta');
assert.equal(closedCashSale.payments.length, 0);

const invalidAmountSale = createInitialState();
invalidAmountSale.sales.find((sale) => sale.id === 'sale-2').price = 0;
invalidAmountSale.sales.find((sale) => sale.id === 'sale-2').total = 0;
const invalidAmountComplete = completeSale(invalidAmountSale, 'sale-2', 'Pagado', 'Efectivo');
assert.equal(invalidAmountComplete.status, 'failed');
assert.equal(invalidAmountSale.payments.length, 0);

const ledgerState = createInitialState();
ledgerState.sales.find((sale) => sale.id === 'sale-1').status = 'En Ruta';
ledgerState.sales.find((sale) => sale.id === 'sale-1').assignedEmployeeId = 'emp-route';
const ledgerPaid = completeSale(ledgerState, 'sale-1', 'Pagado', 'Efectivo');
assert.equal(ledgerPaid.status, 'ok');
ledgerState.sales.push({
  ...ledgerState.sales.find((sale) => sale.id === 'sale-1'),
  id: 'sale-lupita-debt',
  status: 'Completado',
  paymentStatus: 'En Deuda',
  price: 1000,
  total: 1000,
});
const lupitaLedger = customerPortfolio(ledgerState).ledgers.find((ledger) => ledger.customer.id === 'cus-lupita');
assert.equal(lupitaLedger.monetaryDebt, 1000);

const purchaseState = createInitialState();
const invalidSupplyCost = addSupplierSupply(purchaseState, 'sup-huerta', {
  varietyId: 'var-papaya-maradol',
  baseCost: -1,
  freightCost: 0,
});
assert.equal(invalidSupplyCost.status, 'failed');
const invalidOrderStatus = createPurchaseOrder(purchaseState, {
  supplierId: 'sup-huerta',
  varietyId: 'var-mango-ataulfo',
  size: 'Mediano',
  packaging: 'Caja',
  quantity: 1,
  status: 'Recibido',
});
assert.equal(invalidOrderStatus.status, 'failed');
const validOrder = createPurchaseOrder(purchaseState, {
  supplierId: 'sup-huerta',
  varietyId: 'var-mango-ataulfo',
  size: 'Mediano',
  packaging: 'Caja',
  quantity: 4,
});
assert.equal(validOrder.status, 'ok');
const received = receivePurchaseOrder(purchaseState, validOrder.order.id);
assert.equal(received.status, 'ok');
const inventoryAfterReceive = purchaseState.inventory.length;
assert.equal(setPurchaseOrderStatus(purchaseState, validOrder.order.id, 'Ordenado').status, 'failed');
assert.equal(receivePurchaseOrder(purchaseState, validOrder.order.id).status, 'skipped');
assert.equal(purchaseState.inventory.length, inventoryAfterReceive);
assert.equal(updateSupplierSupply(purchaseState, 'sup-huerta', 'var-mango-ataulfo', { freightCost: Number.NaN }).status, 'failed');

const financeState = createInitialState();
assert.equal(addExpense(financeState, { description: 'Gasto invalido', amount: -1 }).status, 'failed');
assert.equal(recordCashMovement(financeState, 'drawer-main', 'AJUSTE_LIBRE', 500, 'Movimiento invalido').status, 'failed');
assert.equal(recordCashMovement(financeState, 'drawer-main', 'DEPOSITO_BANCO', Number.NaN, 'Monto invalido').status, 'failed');
financeState.cashDrawers[0].status = 'Cerrada';
assert.equal(openCashDrawer(financeState, 'drawer-main', Number.NaN).status, 'failed');

const invalidPaymentState = createInitialState();
assert.equal(addPayment(invalidPaymentState, 'cus-lupita', 0).status, 'failed');
syncOperationalTaskAssignments(invalidPaymentState);
assert.equal(updateTaskAssignmentStatus(invalidPaymentState, 'pack-sale-1', 'done', {
  employeeId: 'emp-pack',
  employeeName: 'Empaque Norte',
}).status, 'failed');

console.log('FideoVue domain regression tests passed.');
