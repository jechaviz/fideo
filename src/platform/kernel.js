import { createInitialState, deriveMetrics, buildExceptionQueue } from '../domain/fideoState.js';
import { markCrateAsLost, returnCrateLoan } from '../domain/customers/customerActions.js';
import { addExpense, closeCashDrawer, openCashDrawer } from '../domain/finance/financeActions.js';
import { changeQuality, moveInventory } from '../domain/inventory/inventoryActions.js';
import { addMessage, approveInterpretation, interpretMessage, revertInterpretation, sendPromotion } from '../domain/messages/messageActions.js';
import { followUpException, reassignException, resolveException } from '../domain/operations/exceptionLoop.js';
import { planPushBinding } from '../domain/push/pushIdentity.js';
import { assignDelivery, completeSale, markOrderAsPacked } from '../domain/sales/salesActions.js';
import { createPurchaseOrder, receivePurchaseOrder } from '../domain/suppliers/supplierActions.js';
import { createAiGateway } from '../infrastructure/aiGateway.js';
import { createPocketBaseGateway } from '../infrastructure/pocketbaseGateway.js';
import { createVeeperGateway } from '../infrastructure/veeperGateway.js';

const createReceipts = (vue) => vue.ref([]);

const pushReceipt = (receipts, receipt) => {
  receipts.value = [
    {
      id: `receipt_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      at: new Date().toISOString(),
      ...receipt,
    },
    ...receipts.value,
  ].slice(0, 12);
};

const nextFruitState = {
  Verde: 'Entrado',
  Entrado: 'Maduro',
  Maduro: 'Suave',
  Suave: '',
};

const criteriaFromBatch = (batch) => ({
  varietyId: batch.varietyId,
  size: batch.size,
  quality: batch.quality,
  state: batch.state,
  warehouseId: batch.warehouseId,
  packagingId: batch.packagingId,
});

export const createKernel = ({ vue, config }) => {
  const state = vue.reactive(createInitialState());
  const receipts = createReceipts(vue);

  const veeper = createVeeperGateway({ baseUrl: config.veeperBaseUrl });
  const pocketbase = createPocketBaseGateway();
  const ai = createAiGateway({ codexGoalPath: config.codexGoalPath });

  const metrics = vue.computed(() => deriveMetrics(state));
  const exceptionQueue = vue.computed(() => buildExceptionQueue(state));

  const actions = {
    followUp: async (exception) => {
      const result = followUpException(state, exception);
      pushReceipt(receipts, result.receipt);
      const veeperReceipt = await veeper.planWhatsAppFollowUp(result.followUp);
      pushReceipt(receipts, veeperReceipt);
    },
    reassign: (exception, employeeId) => {
      const result = reassignException(state, exception, employeeId);
      pushReceipt(receipts, result.receipt);
    },
    resolve: (exception) => {
      const result = resolveException(state, exception);
      pushReceipt(receipts, result.receipt);
    },
    advanceBatch: (batchId) => {
      const batch = state.inventory.find((item) => item.id === batchId);
      if (!batch) {
        pushReceipt(receipts, { kind: 'inventory_move', status: 'skipped', message: 'Lote no encontrado.' });
        return;
      }
      const toState = nextFruitState[batch.state];
      if (!toState) {
        pushReceipt(receipts, { kind: 'inventory_move', status: 'skipped', message: 'El lote ya esta en estado final.' });
        return;
      }
      const result = moveInventory(state, criteriaFromBatch(batch), toState, Math.min(12, batch.quantity));
      pushReceipt(receipts, result);
    },
    markWaste: (batchId) => {
      const batch = state.inventory.find((item) => item.id === batchId);
      if (!batch) {
        pushReceipt(receipts, { kind: 'inventory_quality_change', status: 'skipped', message: 'Lote no encontrado.' });
        return;
      }
      const result = changeQuality(state, criteriaFromBatch(batch), 'Merma', Math.min(4, batch.quantity));
      pushReceipt(receipts, result);
    },
    packSale: (saleId) => {
      pushReceipt(receipts, markOrderAsPacked(state, saleId));
    },
    routeSale: (saleId) => {
      const employee = state.employees.find((item) => item.role === 'Repartidor');
      pushReceipt(receipts, assignDelivery(state, saleId, employee?.id || ''));
    },
    completeSale: (saleId) => {
      pushReceipt(receipts, completeSale(state, saleId, 'Pagado', 'Efectivo'));
    },
    returnCrate: (loanId) => {
      pushReceipt(receipts, returnCrateLoan(state, loanId));
    },
    markCrateLost: (loanId) => {
      pushReceipt(receipts, markCrateAsLost(state, loanId));
    },
    receiveOrder: (orderId) => {
      pushReceipt(receipts, receivePurchaseOrder(state, orderId));
    },
    createDemoOrder: () => {
      const supplier = state.suppliers[0];
      const supply = supplier?.supplies[0];
      pushReceipt(receipts, createPurchaseOrder(state, {
        supplierId: supplier?.id,
        varietyId: supply?.varietyId,
        size: supply?.availableSizes[0] || 'Mediano',
        packaging: supply?.packagingOptions[0]?.name || 'Caja',
        quantity: 12,
      }));
    },
    toggleDrawer: (drawerId) => {
      const drawer = state.cashDrawers.find((item) => item.id === drawerId);
      const result = drawer?.status === 'Abierta'
        ? closeCashDrawer(state, drawerId, drawer.balance)
        : openCashDrawer(state, drawerId, 5000);
      pushReceipt(receipts, result);
    },
    addExpense: () => {
      pushReceipt(receipts, addExpense(state, {
        description: 'Gasto operativo',
        amount: 250,
        category: 'Otros',
      }));
    },
    addDemoMessage: () => {
      pushReceipt(receipts, addMessage(state, 'compra proveedor mango mediano 10 cajas', 'Huerta del Sur'));
    },
    interpretMessage: (messageId) => {
      pushReceipt(receipts, interpretMessage(state, messageId));
    },
    approveMessage: (messageId) => {
      pushReceipt(receipts, approveInterpretation(state, messageId));
    },
    revertMessage: (messageId) => {
      pushReceipt(receipts, revertInterpretation(state, messageId));
    },
    sendPromotion: async () => {
      const message = 'Mango maduro premium disponible hoy.';
      const customerIds = state.customers.map((customer) => customer.id);
      const result = sendPromotion(state, message, customerIds);
      pushReceipt(receipts, result);
      if (result.status === 'ok') {
        const veeperReceipt = await veeper.planPromotion({
          campaignId: `promo_${Date.now()}`,
          message,
          targets: result.targets,
        });
        pushReceipt(receipts, veeperReceipt);
      }
    },
    bindPush: () => {
      state.push = planPushBinding({
        id: 'local-admin',
        role: 'Admin',
        employeeId: 'emp-admin',
        channel: 'web',
      }, state.workspace);
      pushReceipt(receipts, {
        kind: 'push_bind',
        status: 'dry-run',
        message: 'Push identity preparada sin cargar SDK externo.',
      });
    },
    inspectIntegrations: async () => {
      const results = await Promise.allSettled([
        pocketbase.inspect(),
        veeper.inspect(),
        ai.inspect(),
      ]);
      results.forEach((result) => {
        pushReceipt(receipts, result.status === 'fulfilled' ? result.value : {
          kind: 'integration_error',
          status: 'failed',
          message: result.reason?.message || 'Integracion no disponible',
        });
      });
    },
  };

  return {
    actions,
    exceptionQueue,
    metrics,
    receipts,
    state,
  };
};
