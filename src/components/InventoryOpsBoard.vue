<template>
  <section class="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
    <article class="surface p-4">
      <h2>Tabla inventario</h2>
    </article>
    <article class="surface p-4">
      <h2>Bodegas</h2>
    </article>
  </section>
</template>

<script>
import {
  inventoryFilterOptions,
  inventoryTableRows,
  inventoryTotals,
  warehouseInventoryMatrix,
} from '/src/domain/inventory/selectors.js';

const { h } = Vue;

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export default {
  name: 'InventoryOpsBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: ['move-location', 'transfer-warehouse', 'adjust-batch', 'raise-price'],
  computed: {
    totals() {
      return inventoryTotals(this.state);
    },
    options() {
      return inventoryFilterOptions(this.state);
    },
    warehouses() {
      return warehouseInventoryMatrix(this.state);
    },
    rows() {
      return inventoryTableRows(this.state).slice(0, 8);
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    nextWarehouse(row) {
      return this.state.warehouses.find((warehouse) => warehouse.id !== row.warehouseId) || null;
    },
    nextLocation(row) {
      return row.location === 'Camara Fria' || row.location === 'C\u00e1mara Fr\u00eda'
        ? 'Piso de Venta'
        : 'Camara Fria';
    },
    renderOptions() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Filtros disponibles'),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Tamanos', this.options.sizes.length),
          this.metric('Calidades', this.options.qualities.length),
          this.metric('Estados', this.options.states.length),
          this.metric('Ubicaciones', this.options.locations.length),
        ]),
        h('ul', { class: 'm-0 mt-3 flex list-none flex-wrap gap-2 p-0' }, [
          ...this.options.sizes.map((size) => h('li', { class: 'pill text-xs', key: `size-${size}` }, size)),
          ...this.options.qualities.map((quality) => h('li', { class: 'pill text-xs', key: `quality-${quality}` }, quality)),
        ]),
      ]);
    },
    renderWarehouses() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Bodegas'),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.warehouses.map((warehouse) =>
          h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: warehouse.id }, [
            h('div', { class: 'flex items-start justify-between gap-3' }, [
              h('div', [
                h('strong', { class: 'text-white' }, `${warehouse.icon} ${warehouse.name}`),
                h('span', { class: 'block text-slate-300' }, `${warehouse.quantity} uds - ${money(warehouse.value)}`),
                h('span', { class: 'block text-xs text-slate-500' },
                  `Frio ${warehouse.cold} / Piso ${warehouse.floor}`),
              ]),
              h('span', { class: 'pill text-xs' }, String(warehouse.rows.length)),
            ]),
          ]))),
      ]);
    },
    renderRow(row) {
      const targetWarehouse = this.nextWarehouse(row);
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: row.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', { class: 'min-w-0' }, [
            h('strong', { class: 'text-white' }, row.product),
            h('span', { class: 'block text-slate-300' },
              `${row.quantity} ${row.crateType?.shortCode || ''} - ${row.size} - ${row.state}`),
            h('span', { class: 'block text-xs text-slate-500' },
              `${row.quality} - ${row.location} - ${row.warehouse?.name || 'Bodega'} - ${money(row.estimatedValue)}`),
          ]),
          h('div', { class: 'flex shrink-0 flex-col gap-2' }, [
            h('button', {
              class: 'focus-ring rounded-lg bg-sky-300 px-2 py-1 text-xs font-black text-slate-950',
              onClick: () => this.$emit('move-location', row.id, this.nextLocation(row)),
            }, row.location === 'Camara Fria' ? 'Piso' : 'Frio'),
            targetWarehouse ? h('button', {
              class: 'focus-ring rounded-lg bg-violet-300 px-2 py-1 text-xs font-black text-slate-950',
              onClick: () => this.$emit('transfer-warehouse', row.id, targetWarehouse.id),
            }, targetWarehouse.icon) : null,
            h('button', {
              class: 'focus-ring rounded-lg bg-amber-300 px-2 py-1 text-xs font-black text-slate-950',
              onClick: () => this.$emit('adjust-batch', row),
            }, 'Ajustar'),
            h('button', {
              class: 'focus-ring rounded-lg border border-white/10 px-2 py-1 text-xs font-black text-slate-200',
              onClick: () => this.$emit('raise-price', row),
            }, 'Precio'),
          ]),
        ]),
      ]);
    },
    renderTable() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex flex-col gap-3 md:flex-row md:items-end md:justify-between' }, [
          h('div', [
            h('p', { class: 'm-0 text-xs font-black uppercase text-sky-200' }, 'Tabla inventario'),
            h('h2', { class: 'm-0 mt-1 text-xl font-black text-white' }, 'Lotes operables'),
          ]),
          h('div', { class: 'grid gap-2 sm:grid-cols-3' }, [
            this.metric('Unidades', this.totals.quantity),
            this.metric('Valor', money(this.totals.value)),
            this.metric('Merma', this.totals.merma),
          ]),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.rows.map(this.renderRow)),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]' }, [
      h('div', { class: 'grid gap-4' }, [
        this.renderOptions(),
        this.renderWarehouses(),
      ]),
      this.renderTable(),
    ]);
  },
};
</script>
