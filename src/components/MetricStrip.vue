<template>
  <section class="mt-4 grid gap-3 md:grid-cols-4">
    <article v-for="tile in tiles" :key="tile.label" class="surface p-4">
      <p class="m-0 text-xs font-black uppercase tracking-wide text-slate-400">{{ tile.label }}</p>
      <strong class="mt-2 block text-2xl text-white">{{ tile.value }}</strong>
      <span class="text-sm text-slate-300">{{ tile.hint }}</span>
    </article>
  </section>
</template>

<script>
const { h } = Vue;

export default {
  name: 'MetricStrip',
  props: {
    metrics: { type: Object, required: true },
  },
  render() {
    const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
    const tiles = [
      { label: 'Excepciones', value: this.metrics.openExceptions, hint: 'cola viva' },
      { label: 'Ventas', value: money.format(this.metrics.totalSales), hint: 'snapshot actual' },
      { label: 'Inventario', value: this.metrics.inventoryUnits, hint: 'unidades/cajas' },
      { label: 'Staff', value: this.metrics.activeStaff, hint: 'activos' },
    ];
    return h('section', { class: 'mt-4 grid gap-3 md:grid-cols-4' }, tiles.map((tile) =>
      h('article', { class: 'surface p-4', key: tile.label }, [
        h('p', { class: 'm-0 text-xs font-black uppercase tracking-wide text-slate-400' }, tile.label),
        h('strong', { class: 'mt-2 block text-2xl text-white' }, String(tile.value)),
        h('span', { class: 'text-sm text-slate-300' }, tile.hint),
      ])));
  },
};
</script>
