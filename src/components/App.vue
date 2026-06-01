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
      }),
    ]);
  },
};
</script>
