import { createInitialState, deriveMetrics, buildExceptionQueue } from '../domain/fideoState.js';
import { addFixedAsset, logAssetMaintenance, sellCrateAsset } from '../domain/assets/assetActions.js';
import {
  addSize,
  addWarehouse,
  setProductGroupArchived,
  setRipeningRule,
  setSizeArchived,
  setWarehouseArchived,
  updateProductGroup,
  updateSize,
  updateVariety,
  updateWarehouse,
} from '../domain/catalog/catalogActions.js';
import { markCrateAsLost, returnCrateLoan } from '../domain/customers/customerActions.js';
import { pingDeliveryPresence, recordDeliveryReportReceipt } from '../domain/delivery/presenceActions.js';
import { completeOperationalTask } from '../domain/delivery/taskCompletion.js';
import { updateTaskAssignmentStatus } from '../domain/delivery/taskAssignments.js';
import { submitTaskReport } from '../domain/delivery/taskReports.js';
import {
  addExpense,
  closeCashDrawer,
  createFinanceExport,
  openCashDrawer,
  recordCashMovement,
  recordCashRemoteReceipt,
} from '../domain/finance/financeActions.js';
import {
  adjustInventory,
  changeQuality,
  moveBatchLocation,
  moveInventory,
  transferBatchWarehouse,
} from '../domain/inventory/inventoryActions.js';
import {
  addMessage,
  appendTrainingKnowledge,
  approveInterpretation,
  correctInterpretation,
  interpretMessage,
  recordCampaignProviderReceipt,
  revertInterpretation,
  sendPromotion,
  updateMessageTemplate,
} from '../domain/messages/messageActions.js';
import { campaignDrafts } from '../domain/messages/messageInsights.js';
import { followUpException, reassignException, resolveException } from '../domain/operations/exceptionLoop.js';
import { planPushBinding } from '../domain/push/pushIdentity.js';
import { assignDelivery, completeSale, markOrderAsPacked, setPrice } from '../domain/sales/salesActions.js';
import { buildPersistableSnapshot } from '../domain/snapshotTransport.js';
import {
  createPurchaseOrder,
  recordPurchaseProviderReceipt,
  receivePurchaseOrder,
  repricePurchaseOrder,
  setPurchaseOrderStatus,
  updateSupplier,
  updateSupplierSupply,
} from '../domain/suppliers/supplierActions.js';
import { createAiGateway } from '../infrastructure/aiGateway.js';
import { createPocketBaseGateway } from '../infrastructure/pocketbaseGateway.js';
import { runtimeGateMatrix } from '../infrastructure/runtimeGates.js';
import { createVeeperGateway } from '../infrastructure/veeperGateway.js';
import {
  createReceipts,
  criteriaFromBatch,
  nextAvailableName,
  nextFruitState,
  nextIconCode,
  pushReceipt,
} from './kernelHelpers.js';

export const createKernel = ({ vue, config }) => {
  const state = vue.reactive(createInitialState({ profile: config.stateProfile }));
  const receipts = createReceipts(vue);

  const veeper = createVeeperGateway({ baseUrl: config.veeperBaseUrl });
  const pocketbase = createPocketBaseGateway({
    baseUrl: config.pocketbaseBaseUrl || '',
    backend: config.pocketbaseBackend || 'pocketbase',
    token: config.pocketbaseToken || '',
  });
  const pocketbaseRoutes = pocketbase.routes();
  const ai = createAiGateway({
    codexGoalPath: config.codexGoalPath,
    provider: config.aiProvider,
    model: config.aiModel,
    variant: config.aiVariant,
    bridgeUrl: config.aiBridgeUrl,
  });
  const runtimeGates = runtimeGateMatrix(config);

  const metrics = vue.computed(() => deriveMetrics(state));
  const exceptionQueue = vue.computed(() => buildExceptionQueue(state));

  const actorForTask = (taskId) => {
    const task = state.taskAssignments.find((item) => item.taskId === taskId || item.id === taskId);
    return {
      employeeId: task?.employeeId,
      employeeName: task?.employeeName,
    };
  };

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
    moveBatchLocation: (batchId, location) => {
      const batch = state.inventory.find((item) => item.id === batchId);
      pushReceipt(receipts, moveBatchLocation(state, batchId, location, Math.min(6, Number(batch?.quantity || 0))));
    },
    transferWarehouse: (batchId, targetWarehouseId) => {
      const batch = state.inventory.find((item) => item.id === batchId);
      pushReceipt(receipts, transferBatchWarehouse(state, batchId, targetWarehouseId, Math.min(4, Number(batch?.quantity || 0))));
    },
    adjustBatch: (batch) => {
      pushReceipt(receipts, adjustInventory(state, criteriaFromBatch(batch), Number(batch.quantity || 0) + 3));
    },
    raiseBatchPrice: (batch) => {
      pushReceipt(receipts, setPrice(state, batch.varietyId, batch.size, batch.quality, batch.state,
        Number(batch.unitPrice || 0) + 10));
    },
    addCatalogWarehouse: () => {
      const name = nextAvailableName(state.warehouses.map((warehouse) => warehouse.name), 'Bodega Norte');
      pushReceipt(receipts, addWarehouse(state, name, `W${state.warehouses.length + 1}`));
    },
    renameCatalogWarehouse: (warehouse) => {
      const name = nextAvailableName(state.warehouses.map((item) => item.name), `${warehouse.name} Norte`);
      pushReceipt(receipts, updateWarehouse(state, warehouse.id, { name }));
    },
    cycleCatalogWarehouseIcon: (warehouse) => {
      pushReceipt(receipts, updateWarehouse(state, warehouse.id, { icon: nextIconCode(warehouse.icon) }));
    },
    toggleCatalogWarehouse: (warehouse) => {
      pushReceipt(receipts, setWarehouseArchived(state, warehouse.id, !warehouse.archived));
    },
    addCatalogSize: () => {
      const name = nextAvailableName(Object.keys(state.sizes), 'Extra');
      pushReceipt(receipts, addSize(state, name, name.slice(0, 2).toUpperCase()));
    },
    renameCatalogSize: (size) => {
      const name = nextAvailableName(Object.keys(state.sizes), `${size.name} Plus`);
      pushReceipt(receipts, updateSize(state, size.name, { name }));
    },
    cycleCatalogSizeIcon: (size) => {
      pushReceipt(receipts, updateSize(state, size.name, { icon: nextIconCode(size.icon) }));
    },
    toggleCatalogSize: (size) => {
      pushReceipt(receipts, setSizeArchived(state, size.name, !size.archived));
    },
    cycleCatalogGroupIcon: (group) => {
      pushReceipt(receipts, updateProductGroup(state, group.id, { icon: nextIconCode(group.icon) }));
    },
    toggleCatalogGroup: (group) => {
      pushReceipt(receipts, setProductGroupArchived(state, group.id, !group.archived));
    },
    cycleCatalogVarietyIcon: (row) => {
      pushReceipt(receipts, updateVariety(state, row.productGroupId, row.varietyId, { icon: nextIconCode(row.icon) }));
    },
    increaseRipeningRule: (row) => {
      pushReceipt(receipts, setRipeningRule(state, row.varietyId, row.fromState, row.toState, Number(row.days || 0) + 1));
    },
    resetRipeningRule: (row) => {
      pushReceipt(receipts, setRipeningRule(state, row.varietyId, row.fromState, row.toState, 0));
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
    orderPurchaseOrder: (orderId) => {
      pushReceipt(receipts, setPurchaseOrderStatus(state, orderId, 'Ordenado'));
    },
    repricePurchaseOrder: (orderId) => {
      pushReceipt(receipts, repricePurchaseOrder(state, orderId));
    },
    raiseSupplierCost: (row) => {
      pushReceipt(receipts, updateSupplierSupply(state, row.supplierId, row.varietyId, {
        baseCost: Number(row.baseCost || 0) + 5,
      }));
    },
    renameSupplier: (supplier) => {
      pushReceipt(receipts, updateSupplier(state, supplier.id, {
        name: nextAvailableName(state.suppliers.map((item) => item.name), `${supplier.name} MX`),
      }));
    },
    refreshSupplierContact: (supplier) => {
      pushReceipt(receipts, updateSupplier(state, supplier.id, {
        contact: `WhatsApp ${supplier.name}`,
      }));
    },
    recordPurchaseReceipt: () => {
      const order = state.purchaseOrders.find((item) => item.status !== 'Recibido') || state.purchaseOrders[0];
      const result = recordPurchaseProviderReceipt(state, {
        purchaseOrderId: order?.id,
        provider: 'mysql',
        status: 'acknowledged',
      });
      pushReceipt(receipts, result);
      if (result.status === 'ok') {
        pushReceipt(receipts, {
          kind: 'purchase_remote_receipt',
          status: 'dry-run',
          message: 'Acuse remoto de compra listo para MySQL.',
          orderId: result.orderId,
        });
      }
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
    cashDeposit: (drawerId) => {
      pushReceipt(receipts, recordCashMovement(state, drawerId, 'DEPOSITO_BANCO', 750, 'Deposito a banco'));
    },
    cashWithdraw: (drawerId) => {
      pushReceipt(receipts, recordCashMovement(state, drawerId, 'RETIRO_EFECTIVO', 300, 'Retiro operativo'));
    },
    createFinanceExport: () => {
      pushReceipt(receipts, createFinanceExport(state, 'json'));
    },
    recordCashReceipt: () => {
      const result = recordCashRemoteReceipt(state, {
        drawerId: state.cashDrawers[0]?.id,
        provider: 'mysql',
        status: 'acknowledged',
      });
      pushReceipt(receipts, result);
      if (result.status === 'ok') {
        pushReceipt(receipts, {
          kind: 'cash_receipt_remote_plan',
          status: 'dry-run',
          message: 'Acuse remoto de caja listo para MySQL.',
          drawerId: result.drawerId,
        });
      }
    },
    sellCrateAsset: () => {
      const customer = state.customers[0];
      const crateType = state.crateTypes[0];
      pushReceipt(receipts, sellCrateAsset(state, customer?.id, crateType?.id, 2));
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
    correctMessage: (messageId) => {
      const message = state.messages.find((item) => item.id === messageId);
      pushReceipt(receipts, correctInterpretation(state, messageId, {
        type: 'CREAR_OFERTA',
        certainty: 0.91,
        explanation: 'Correccion local lista para recibo remoto.',
        data: {
          targetAudience: 'clientes activos',
          productDescription: message?.text || 'Producto destacado',
          price: 0,
        },
      }));
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
    sendCampaignDraft: async () => {
      const draft = campaignDrafts(state)[0];
      if (!draft) {
        pushReceipt(receipts, { kind: 'promotion_send', status: 'skipped', message: 'Sin campana sugerida.' });
        return;
      }
      const result = sendPromotion(state, draft.message, draft.targetIds);
      pushReceipt(receipts, result);
      if (result.status === 'ok') {
        pushReceipt(receipts, await veeper.planPromotion({
          campaignId: result.campaignId,
          message: draft.message,
          targets: result.targets,
        }));
      }
    },
    recordProviderReceipt: async (provider) => {
      const seed = state.campaignReceipts.find((item) => item.provider === 'local') || state.campaignReceipts[0];
      const result = recordCampaignProviderReceipt(state, {
        campaignId: seed?.campaignId,
        provider,
        targetCount: seed?.targetCount || state.customers.length,
        delivered: seed?.targetCount || state.customers.length,
        failed: 0,
      });
      pushReceipt(receipts, result);
      if (result.status !== 'ok') return;
      if (provider === 'veeper') {
        pushReceipt(receipts, await veeper.planProviderReceipt({
          campaignId: result.campaignId,
          provider,
          delivered: seed?.targetCount || state.customers.length,
          failed: 0,
        }));
        return;
      }
      pushReceipt(receipts, {
        kind: 'onesignal_provider_receipt',
        status: 'gated',
        message: 'OneSignal receipt gated hasta activar credenciales live.',
        campaignId: result.campaignId,
      });
    },
    trainAi: () => {
      pushReceipt(receipts, appendTrainingKnowledge(state, 'cuando digan listo, priorizar fruta madura para campana'));
    },
    updateTemplate: (templateId) => {
      pushReceipt(receipts, updateMessageTemplate(state, templateId, {
        content: '{{customer}}, tenemos {{product}} listo hoy. Responde para apartar.',
      }));
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
    addDemoAsset: () => {
      pushReceipt(receipts, addFixedAsset(state, {
        name: 'Montacargas compacto',
        category: 'Equipo de Carga',
        status: 'Activo',
        cost: 78000,
        metadata: { area: 'Bodega' },
      }));
    },
    maintainAsset: (assetId) => {
      pushReceipt(receipts, logAssetMaintenance(state, assetId, 1200, 'Servicio preventivo'));
    },
    ackTask: (taskId) => {
      pushReceipt(receipts, updateTaskAssignmentStatus(state, taskId, 'acknowledged', actorForTask(taskId)));
    },
    startTask: (taskId) => {
      pushReceipt(receipts, updateTaskAssignmentStatus(state, taskId, 'in_progress', actorForTask(taskId)));
    },
    blockTask: (taskId) => {
      pushReceipt(receipts, updateTaskAssignmentStatus(state, taskId, 'blocked', actorForTask(taskId),
        'Bloqueo reportado desde portal'));
    },
    completeTask: (taskId) => {
      completeOperationalTask(state, taskId, actorForTask(taskId))
        .forEach((result) => pushReceipt(receipts, result));
    },
    noteTask: (taskId) => {
      pushReceipt(receipts, submitTaskReport(state, taskId, {
        kind: 'note',
        summary: 'Nota operativa desde tablero',
      }, actorForTask(taskId)));
    },
    incidentTask: (taskId) => {
      pushReceipt(receipts, submitTaskReport(state, taskId, {
        kind: 'incident',
        summary: 'Incidencia reportada desde tablero',
        detail: 'Requiere seguimiento operativo.',
        severity: 'high',
        nextTaskStatus: 'blocked',
      }, actorForTask(taskId)));
    },
    pingDeliveryPresence: (employeeId) => {
      pushReceipt(receipts, pingDeliveryPresence(state, employeeId, { status: 'active' }));
    },
    pauseDeliveryPresence: (employeeId) => {
      pushReceipt(receipts, pingDeliveryPresence(state, employeeId, { status: 'background' }));
    },
    recordDeliveryReportReceipt: () => {
      const result = recordDeliveryReportReceipt(state, {
        provider: 'mysql',
        status: 'acknowledged',
      });
      pushReceipt(receipts, result);
      if (result.status === 'ok') {
        pushReceipt(receipts, {
          kind: 'delivery_report_remote_receipt',
          status: 'dry-run',
          message: 'Acuse remoto de reporte listo para MySQL.',
          reportId: result.reportId,
        });
      }
    },
    bootstrapPocketBase: async () => {
      pushReceipt(receipts, await pocketbase.bootstrap(buildPersistableSnapshot(state)));
    },
    persistSnapshot: async () => {
      const result = await pocketbase.persist(
        state.workspace.id,
        buildPersistableSnapshot(state),
        state.workspace.version,
      );
      if (result.version > 0) state.workspace.version = result.version;
      pushReceipt(receipts, result);
    },
    presencePing: async () => {
      pushReceipt(receipts, await pocketbase.presencePing(state.workspace.id, {
        userId: 'local-admin',
        employeeId: 'emp-admin',
        status: 'online',
        at: new Date().toISOString(),
      }));
    },
    planRealtime: async () => {
      pushReceipt(receipts, await pocketbase.realtimePlan(state.workspace.id));
    },
    planAi: async () => {
      pushReceipt(receipts, await ai.planInsightRun(state.workspace.id, 'fideo-insights'));
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
    pocketbaseRoutes,
    receipts,
    runtimeGates,
    state,
  };
};
