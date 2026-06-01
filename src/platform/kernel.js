import { createInitialState, deriveMetrics, buildExceptionQueue } from '../domain/fideoState.js';
import { changeQuality, moveInventory } from '../domain/inventory/inventoryActions.js';
import { followUpException, reassignException, resolveException } from '../domain/operations/exceptionLoop.js';
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
