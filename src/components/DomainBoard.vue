<template>
  <section class="grid gap-4 lg:grid-cols-3">
    <article class="surface p-4">
      <h2 class="m-0 text-lg font-black text-white">Inventario</h2>
    </article>
    <article class="surface p-4">
      <h2 class="m-0 text-lg font-black text-white">Ventas</h2>
    </article>
    <article class="surface p-4">
      <h2 class="m-0 text-lg font-black text-white">Staff</h2>
    </article>
  </section>
</template>

<script>
import { inventoryRows, inventoryTotals } from '/src/domain/inventory/selectors.js';

const { h } = Vue;

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export default {
  name: 'DomainBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: ['advance-batch', 'mark-waste'],
  computed: {
    inventoryRows() {
      return inventoryRows(this.state);
    },
    inventoryTotals() {
      return inventoryTotals(this.state);
    },
  },
  methods: {
    section(title, rows, renderRow, footer = null) {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, title),
          footer,
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, rows.map(renderRow)),
      ]);
    },
    renderInventoryRow(item) {
      const canAdvance = item.state !== 'Suave';
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: item.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: 'text-white' }, item.product),
            h('span', { class: 'block text-slate-300' }, `${item.quantity} - ${item.size} - ${item.state} - ${item.quality}`),
            h('span', { class: 'block text-xs text-slate-500' }, `${item.location} - ${money(item.estimatedValue)}`),
          ]),
          h('div', { class: 'flex flex-col gap-2' }, [
            h('button', {
              class: 'focus-ring rounded-lg bg-amber-300 px-2 py-1 text-xs font-black text-slate-950 disabled:opacity-40',
              disabled: !canAdvance,
              title: 'Avanzar maduracion',
              onClick: () => this.$emit('advance-batch', item.id),
            }, 'Madurar'),
            h('button', {
              class: 'focus-ring rounded-lg bg-rose-300 px-2 py-1 text-xs font-black text-slate-950 disabled:opacity-40',
              disabled: item.quality === 'Merma',
              title: 'Registrar merma',
              onClick: () => this.$emit('mark-waste', item.id),
            }, 'Merma'),
          ]),
        ]),
      ]);
    },
    renderSaleRow(sale) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: sale.id }, [
        h('strong', { class: 'text-white' }, sale.customer),
        h('span', { class: 'block text-slate-300' }, `${sale.product} - ${sale.status}`),
        h('span', { class: 'block text-xs text-slate-500' }, money(sale.total)),
      ]);
    },
    renderEmployeeRow(employee) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: employee.id }, [
        h('strong', { class: 'text-white' }, employee.name),
        h('span', { class: 'block text-slate-300' }, `${employee.role} - ${employee.status}`),
      ]);
    },
  },
  render() {
    const inventoryFooter = h('span', { class: 'pill text-xs' },
      `${this.inventoryTotals.quantity} uds - ${money(this.inventoryTotals.value)}`);

    return h('section', { class: 'grid gap-4 lg:grid-cols-3' }, [
      this.section('Inventario', this.inventoryRows, this.renderInventoryRow, inventoryFooter),
      this.section('Ventas', this.state.sales, this.renderSaleRow),
      this.section('Staff', this.state.employees, this.renderEmployeeRow),
    ]);
  },
};
</script>
