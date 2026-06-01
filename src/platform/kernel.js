import { createInitialState, deriveMetrics, buildExceptionQueue } from '../domain/fideoState.js';
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

