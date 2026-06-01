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

    <MessageBoard
      :state="state"
      @add-message="actions.addDemoMessage"
      @interpret-message="actions.interpretMessage"
      @approve-message="actions.approveMessage"
      @revert-message="actions.revertMessage"
      @send-promotion="actions.sendPromotion"
      @bind-push="actions.bindPush"
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
    const CommerceBoard = resolveComponent('CommerceBoard');
    const FinanceOpsBoard = resolveComponent('FinanceOpsBoard');
    const MessageBoard = resolveComponent('MessageBoard');
    const PortalAssetBoard = resolveComponent('PortalAssetBoard');

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
      h(MessageBoard, {
        state: this.state,
        onAddMessage: this.actions.addDemoMessage,
        onInterpretMessage: this.actions.interpretMessage,
        onApproveMessage: this.actions.approveMessage,
        onRevertMessage: this.actions.revertMessage,
        onSendPromotion: this.actions.sendPromotion,
        onBindPush: this.actions.bindPush,
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
    ]);
  },
};
</script>
