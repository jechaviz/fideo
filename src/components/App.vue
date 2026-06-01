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

    <DomainBoard class="mt-4" :state="state" />
  </main>
</template>

<script>
const { inject } = Vue;

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
};
</script>

