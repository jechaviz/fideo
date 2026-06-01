<template>
  <section class="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
    <article class="surface p-4">
      <h2>Catalogo operativo</h2>
    </article>
    <article class="surface p-4">
      <h2>Reglas maduracion</h2>
    </article>
  </section>
</template>

<script>
import {
  catalogSizeRows,
  catalogSummary,
  catalogVarietyRows,
  catalogWarehouseRows,
  ripeningTransitionRows,
} from '/src/domain/catalog/catalogSelectors.js';

const { h } = Vue;

export default {
  name: 'CatalogAdminBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: [
    'add-warehouse',
    'rename-warehouse',
    'cycle-warehouse-icon',
    'toggle-warehouse',
    'add-size',
    'rename-size',
    'cycle-size-icon',
    'toggle-size',
    'cycle-group-icon',
    'toggle-group',
    'cycle-variety-icon',
    'increase-ripening',
    'reset-ripening',
  ],
  computed: {
    summary() {
      return catalogSummary(this.state);
    },
    groups() {
      return this.state.productGroups.slice(0, 4);
    },
    varieties() {
      return catalogVarietyRows(this.state).slice(0, 5);
    },
    sizes() {
      return catalogSizeRows(this.state);
    },
    warehouses() {
      return catalogWarehouseRows(this.state);
    },
    ripeningRows() {
      return ripeningTransitionRows(this.state).slice(0, 9);
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    action(label, event, payload, tone = 'border') {
      const toneClass = {
        blue: 'bg-sky-300 text-slate-950',
        amber: 'bg-amber-300 text-slate-950',
        green: 'bg-emerald-300 text-slate-950',
        border: 'border border-white/10 text-slate-200',
      }[tone];
      return h('button', {
        class: `focus-ring rounded-lg px-2 py-1 text-xs font-black ${toneClass}`,
        onClick: () => this.$emit(event, payload),
      }, label);
    },
    renderGroup(group) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: group.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', { class: 'min-w-0' }, [
            h('strong', { class: 'text-white' }, `${group.icon || '--'} ${group.name}`),
            h('span', { class: 'block text-slate-300' }, `${group.category} - ${group.varieties.length} variedades`),
          ]),
          h('div', { class: 'flex shrink-0 flex-wrap justify-end gap-2' }, [
            this.action('Icono', 'cycle-group-icon', group, 'blue'),
            this.action(group.archived ? 'Activar' : 'Archivar', 'toggle-group', group),
          ]),
        ]),
      ]);
    },
    renderVariety(row) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: row.varietyId }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: 'text-white' }, `${row.icon} ${row.label}`),
            h('span', { class: 'block text-slate-300' }, row.sizes.join(' / ')),
          ]),
          this.action('Icono', 'cycle-variety-icon', row, 'blue'),
        ]),
      ]);
    },
    renderSize(row) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: row.name }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: 'text-white' }, `${row.icon} ${row.name}`),
            h('span', { class: 'block text-slate-300' }, `${row.varietyCount} variedades`),
          ]),
          h('div', { class: 'flex shrink-0 flex-wrap justify-end gap-2' }, [
            this.action('Icono', 'cycle-size-icon', row, 'blue'),
            this.action('Renombrar', 'rename-size', row, 'amber'),
            this.action(row.archived ? 'Activar' : 'Archivar', 'toggle-size', row),
          ]),
        ]),
      ]);
    },
    renderWarehouse(row) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: row.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', { class: 'min-w-0' }, [
            h('strong', { class: 'text-white' }, `${row.icon} ${row.name}`),
            h('span', { class: 'block text-slate-300' }, `${row.quantity} uds - ${row.batchCount} lotes`),
          ]),
          h('div', { class: 'flex shrink-0 flex-wrap justify-end gap-2' }, [
            this.action('Codigo', 'cycle-warehouse-icon', row, 'blue'),
            this.action('Renombrar', 'rename-warehouse', row, 'amber'),
            this.action(row.archived ? 'Activar' : 'Archivar', 'toggle-warehouse', row),
          ]),
        ]),
      ]);
    },
    renderRipening(row) {
      const stateIcons = this.state.stateIcons || {};
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: `${row.varietyId}-${row.fromState}` }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: 'text-white' }, row.label),
            h('span', { class: 'block text-slate-300' },
              `${stateIcons[row.fromState] || row.fromState} ${row.fromState} -> ${stateIcons[row.toState] || row.toState} ${row.toState}`),
            h('span', { class: 'block text-xs text-slate-500' }, `${row.days} dias`),
          ]),
          h('div', { class: 'flex shrink-0 flex-wrap justify-end gap-2' }, [
            this.action('+1 dia', 'increase-ripening', row, 'green'),
            this.action('Reset', 'reset-ripening', row),
          ]),
        ]),
      ]);
    },
    renderCatalog() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex flex-col gap-3 md:flex-row md:items-end md:justify-between' }, [
          h('div', [
            h('p', { class: 'm-0 text-xs font-black uppercase text-sky-200' }, 'Catalogo operativo'),
            h('h2', { class: 'm-0 mt-1 text-xl font-black text-white' }, 'Productos e iconos'),
          ]),
          h('div', { class: 'grid gap-2 sm:grid-cols-3' }, [
            this.metric('Grupos', this.summary.activeGroups),
            this.metric('Variedades', this.summary.activeVarieties),
            this.metric('Reglas', this.summary.rules),
          ]),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.groups.map((group) => this.renderGroup(group))),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-2' },
          this.varieties.map((row) => this.renderVariety(row))),
      ]);
    },
    renderSizes() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Tamanos'),
            h('span', { class: 'text-sm text-slate-400' }, `${this.summary.activeSizes} activos`),
          ]),
          this.action('Nuevo tamano', 'add-size', null, 'green'),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.sizes.map((row) => this.renderSize(row))),
      ]);
    },
    renderWarehouses() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Bodegas editables'),
            h('span', { class: 'text-sm text-slate-400' }, `${this.summary.activeWarehouses} activas`),
          ]),
          this.action('Nueva bodega', 'add-warehouse', null, 'green'),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' },
          this.warehouses.map((row) => this.renderWarehouse(row))),
      ]);
    },
    renderRipeningRules() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Reglas maduracion'),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' },
          this.ripeningRows.map((row) => this.renderRipening(row))),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]' }, [
      h('div', { class: 'grid gap-4' }, [
        this.renderCatalog(),
        this.renderSizes(),
      ]),
      h('div', { class: 'grid gap-4' }, [
        this.renderWarehouses(),
        this.renderRipeningRules(),
      ]),
    ]);
  },
};
</script>
