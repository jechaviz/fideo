<template>
  <aside class="surface p-4">
    <p class="m-0 text-xs font-black uppercase tracking-wide text-amber-300">Integraciones</p>
    <h2 class="m-0 text-xl font-black text-white">Puertos productivos</h2>

    <div class="mt-4 grid gap-3">
      <article v-for="(integration, key) in integrations" :key="key" class="rounded-lg border border-slate-700 bg-slate-950/45 p-3">
        <div class="flex items-center justify-between gap-3">
          <strong class="text-sm text-white">{{ integration.label }}</strong>
          <span class="pill text-xs">{{ integration.status }}</span>
        </div>
      </article>
    </div>

    <div class="mt-4">
      <p class="m-0 text-xs font-black uppercase tracking-wide text-slate-400">Receipts</p>
      <ol class="m-0 mt-2 grid list-none gap-2 p-0">
        <li v-for="receipt in receipts" :key="receipt.id" class="rounded-lg bg-slate-950/55 p-2 text-xs text-slate-300">
          <strong class="text-white">{{ receipt.kind }}</strong> · {{ receipt.message }}
        </li>
      </ol>
    </div>
  </aside>
</template>

<script>
export default {
  name: 'IntegrationHealth',
  props: {
    integrations: { type: Object, required: true },
    receipts: { type: Array, required: true },
  },
};
</script>

