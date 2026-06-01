<template>
  <main class="app-shell px-4 py-4 md:px-6 lg:px-8">
    <ShellHeader
      :workspace="state.workspace"
      :open-exceptions="metrics.openExceptions"
      @inspect="actions.inspectIntegrations"
    />

    <MetricStrip :metrics="metrics" />

    <section class="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
      <ActionCenterPanel
        :exceptions="exceptions"
        :employees="state.employees"
        @follow-up="actions.followUp"
        @resolve="actions.resolve"
        @reassign="actions.reassign"
      />
      <IntegrationHealth :integrations="state.integrations" :receipts="receipts" />
    </section>

    <DomainBoard
      class="mt-4"
      :state="state"
      @advance-batch="actions.advanceBatch"
      @mark-waste="actions.markWaste"
      @pack-sale="actions.packSale"
      @route-sale="actions.routeSale"
      @complete-sale="actions.completeSale"
    />

    <DeliveryOpsBoard
      :state="state"
      @pack-sale="actions.packSale"
      @route-sale="actions.routeSale"
      @complete-sale="actions.completeSale"
      @ack-task="actions.ackTask"
      @start-task="actions.startTask"
      @block-task="actions.blockTask"
      @complete-task="actions.completeTask"
      @note-task="actions.noteTask"
      @incident-task="actions.incidentTask"
    />

    <InventoryOpsBoard
      :state="state"
      @move-location="actions.moveBatchLocation"
      @transfer-warehouse="actions.transferWarehouse"
      @adjust-batch="actions.adjustBatch"
      @raise-price="actions.raiseBatchPrice"
    />

    <CatalogAdminBoard
      :state="state"
      @add-warehouse="actions.addCatalogWarehouse"
      @rename-warehouse="actions.renameCatalogWarehouse"
      @cycle-warehouse-icon="actions.cycleCatalogWarehouseIcon"
      @toggle-warehouse="actions.toggleCatalogWarehouse"
      @add-size="actions.addCatalogSize"
      @rename-size="actions.renameCatalogSize"
      @cycle-size-icon="actions.cycleCatalogSizeIcon"
      @toggle-size="actions.toggleCatalogSize"
      @cycle-group-icon="actions.cycleCatalogGroupIcon"
      @toggle-group="actions.toggleCatalogGroup"
      @cycle-variety-icon="actions.cycleCatalogVarietyIcon"
      @increase-ripening="actions.increaseRipeningRule"
      @reset-ripening="actions.resetRipeningRule"
    />

    <CommerceBoard
      :state="state"
      @return-crate="actions.returnCrate"
      @mark-crate-lost="actions.markCrateLost"
      @receive-order="actions.receiveOrder"
      @create-demo-order="actions.createDemoOrder"
      @toggle-drawer="actions.toggleDrawer"
      @add-expense="actions.addExpense"
    />

    <FinanceOpsBoard
      :state="state"
      @toggle-drawer="actions.toggleDrawer"
      @cash-deposit="actions.cashDeposit"
      @cash-withdraw="actions.cashWithdraw"
      @sell-crate-asset="actions.sellCrateAsset"
      @add-expense="actions.addExpense"
    />

    <SupplierOpsBoard
      :state="state"
      @create-demo-order="actions.createDemoOrder"
      @order-purchase-order="actions.orderPurchaseOrder"
      @receive-order="actions.receiveOrder"
      @reprice-order="actions.repricePurchaseOrder"
      @raise-supplier-cost="actions.raiseSupplierCost"
    />

    <MessageBoard
      :state="state"
      @add-message="actions.addDemoMessage"
      @interpret-message="actions.interpretMessage"
      @approve-message="actions.approveMessage"
      @revert-message="actions.revertMessage"
      @send-promotion="actions.sendPromotion"
      @bind-push="actions.bindPush"
    />

    <MessageAiOpsBoard
      :state="state"
      @correct-message="actions.correctMessage"
      @train-ai="actions.trainAi"
      @send-campaign="actions.sendCampaignDraft"
      @update-template="actions.updateTemplate"
    />

    <PortalAssetBoard
      :state="state"
      :pocketbase-routes="pocketbaseRoutes"
      @add-asset="actions.addDemoAsset"
      @maintain-asset="actions.maintainAsset"
      @ack-task="actions.ackTask"
      @start-task="actions.startTask"
      @block-task="actions.blockTask"
      @complete-task="actions.completeTask"
    />

    <RuntimeGateBoard
      :gates="runtimeGates"
      :pocketbase-routes="pocketbaseRoutes"
      @bootstrap-pocketbase="actions.bootstrapPocketBase"
      @persist-snapshot="actions.persistSnapshot"
      @presence-ping="actions.presencePing"
      @plan-realtime="actions.planRealtime"
      @plan-ai="actions.planAi"
    />
  </main>
</template>

<script>
const { h, inject, resolveComponent } = Vue;

export default {
  name: 'FideoVueApp',
  setup() {
    const kernel = inject('kernel');
    return {
      actions: kernel.actions,
      exceptions: kernel.exceptionQueue,
      metrics: kernel.metrics,
      pocketbaseRoutes: kernel.pocketbaseRoutes,
      receipts: kernel.receipts,
      runtimeGates: kernel.runtimeGates,
      state: kernel.state,
    };
  },
  render() {
    const ShellHeader = resolveComponent('ShellHeader');
    const MetricStrip = resolveComponent('MetricStrip');
    const ActionCenterPanel = resolveComponent('ActionCenterPanel');
    const IntegrationHealth = resolveComponent('IntegrationHealth');
    const DomainBoard = resolveComponent('DomainBoard');
    const DeliveryOpsBoard = resolveComponent('DeliveryOpsBoard');
    const InventoryOpsBoard = resolveComponent('InventoryOpsBoard');
    const CatalogAdminBoard = resolveComponent('CatalogAdminBoard');
    const CommerceBoard = resolveComponent('CommerceBoard');
    const FinanceOpsBoard = resolveComponent('FinanceOpsBoard');
    const SupplierOpsBoard = resolveComponent('SupplierOpsBoard');
    const MessageBoard = resolveComponent('MessageBoard');
    const MessageAiOpsBoard = resolveComponent('MessageAiOpsBoard');
    const PortalAssetBoard = resolveComponent('PortalAssetBoard');
    const RuntimeGateBoard = resolveComponent('RuntimeGateBoard');

    return h('main', { class: 'app-shell px-4 py-4 md:px-6 lg:px-8' }, [
      h(ShellHeader, {
        workspace: this.state.workspace,
        openExceptions: this.metrics.openExceptions,
        onInspect: this.actions.inspectIntegrations,
      }),
      h(MetricStrip, { metrics: this.metrics }),
      h('section', { class: 'mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]' }, [
        h(ActionCenterPanel, {
          exceptions: this.exceptions,
          employees: this.state.employees,
          onFollowUp: this.actions.followUp,
          onResolve: this.actions.resolve,
          onReassign: this.actions.reassign,
        }),
        h(IntegrationHealth, {
          integrations: this.state.integrations,
          receipts: this.receipts,
        }),
      ]),
      h(DomainBoard, {
        class: 'mt-4',
        state: this.state,
        onAdvanceBatch: this.actions.advanceBatch,
        onMarkWaste: this.actions.markWaste,
        onPackSale: this.actions.packSale,
        onRouteSale: this.actions.routeSale,
        onCompleteSale: this.actions.completeSale,
      }),
      h(DeliveryOpsBoard, {
        state: this.state,
        onPackSale: this.actions.packSale,
        onRouteSale: this.actions.routeSale,
        onCompleteSale: this.actions.completeSale,
        onAckTask: this.actions.ackTask,
        onStartTask: this.actions.startTask,
        onBlockTask: this.actions.blockTask,
        onCompleteTask: this.actions.completeTask,
        onNoteTask: this.actions.noteTask,
        onIncidentTask: this.actions.incidentTask,
      }),
      h(InventoryOpsBoard, {
        state: this.state,
        onMoveLocation: this.actions.moveBatchLocation,
        onTransferWarehouse: this.actions.transferWarehouse,
        onAdjustBatch: this.actions.adjustBatch,
        onRaisePrice: this.actions.raiseBatchPrice,
      }),
      h(CatalogAdminBoard, {
        state: this.state,
        onAddWarehouse: this.actions.addCatalogWarehouse,
        onRenameWarehouse: this.actions.renameCatalogWarehouse,
        onCycleWarehouseIcon: this.actions.cycleCatalogWarehouseIcon,
        onToggleWarehouse: this.actions.toggleCatalogWarehouse,
        onAddSize: this.actions.addCatalogSize,
        onRenameSize: this.actions.renameCatalogSize,
        onCycleSizeIcon: this.actions.cycleCatalogSizeIcon,
        onToggleSize: this.actions.toggleCatalogSize,
        onCycleGroupIcon: this.actions.cycleCatalogGroupIcon,
        onToggleGroup: this.actions.toggleCatalogGroup,
        onCycleVarietyIcon: this.actions.cycleCatalogVarietyIcon,
        onIncreaseRipening: this.actions.increaseRipeningRule,
        onResetRipening: this.actions.resetRipeningRule,
      }),
      h(CommerceBoard, {
        state: this.state,
        onReturnCrate: this.actions.returnCrate,
        onMarkCrateLost: this.actions.markCrateLost,
        onReceiveOrder: this.actions.receiveOrder,
        onCreateDemoOrder: this.actions.createDemoOrder,
        onToggleDrawer: this.actions.toggleDrawer,
        onAddExpense: this.actions.addExpense,
      }),
      h(FinanceOpsBoard, {
        state: this.state,
        onToggleDrawer: this.actions.toggleDrawer,
        onCashDeposit: this.actions.cashDeposit,
        onCashWithdraw: this.actions.cashWithdraw,
        onSellCrateAsset: this.actions.sellCrateAsset,
        onAddExpense: this.actions.addExpense,
      }),
      h(SupplierOpsBoard, {
        state: this.state,
        onCreateDemoOrder: this.actions.createDemoOrder,
        onOrderPurchaseOrder: this.actions.orderPurchaseOrder,
        onReceiveOrder: this.actions.receiveOrder,
        onRepriceOrder: this.actions.repricePurchaseOrder,
        onRaiseSupplierCost: this.actions.raiseSupplierCost,
      }),
      h(MessageBoard, {
        state: this.state,
        onAddMessage: this.actions.addDemoMessage,
        onInterpretMessage: this.actions.interpretMessage,
        onApproveMessage: this.actions.approveMessage,
        onRevertMessage: this.actions.revertMessage,
        onSendPromotion: this.actions.sendPromotion,
        onBindPush: this.actions.bindPush,
      }),
      h(MessageAiOpsBoard, {
        state: this.state,
        onCorrectMessage: this.actions.correctMessage,
        onTrainAi: this.actions.trainAi,
        onSendCampaign: this.actions.sendCampaignDraft,
        onUpdateTemplate: this.actions.updateTemplate,
      }),
      h(PortalAssetBoard, {
        state: this.state,
        pocketbaseRoutes: this.pocketbaseRoutes,
        onAddAsset: this.actions.addDemoAsset,
        onMaintainAsset: this.actions.maintainAsset,
        onAckTask: this.actions.ackTask,
        onStartTask: this.actions.startTask,
        onBlockTask: this.actions.blockTask,
        onCompleteTask: this.actions.completeTask,
      }),
      h(RuntimeGateBoard, {
        gates: this.runtimeGates,
        pocketbaseRoutes: this.pocketbaseRoutes,
        onBootstrapPocketbase: this.actions.bootstrapPocketBase,
        onPersistSnapshot: this.actions.persistSnapshot,
        onPresencePing: this.actions.presencePing,
        onPlanRealtime: this.actions.planRealtime,
        onPlanAi: this.actions.planAi,
      }),
    ]);
  },
};
</script>
