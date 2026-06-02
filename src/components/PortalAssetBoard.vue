<template>
  <section class="mt-4 grid gap-4 xl:grid-cols-3">
    <article class="surface p-4">
      <h2>Activos</h2>
    </article>
    <article class="surface p-4">
      <h2>Planograma</h2>
    </article>
    <article class="surface p-4">
      <h2>Portales</h2>
    </article>
  </section>
</template>

<script>
import { crateAssetSummary, fixedAssetSummary } from '/src/domain/assets/assetSelectors.js';
import { planogramZones } from '/src/domain/planogram/planogramSelectors.js';
import { customerPortal, delivererPortal, packerPortal, supplierPortal } from '/src/domain/portals/portalSelectors.js';

const { h } = Vue;

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export default {
  name: 'PortalAssetBoard',
  props: {
    state: { type: Object, required: true },
    pocketbaseRoutes: { type: Array, required: true },
  },
  emits: ['add-asset', 'maintain-asset', 'ack-task', 'start-task', 'block-task', 'complete-task'],
  computed: {
    fixedAssets() {
      return fixedAssetSummary(this.state);
    },
    crates() {
      return crateAssetSummary(this.state);
    },
    zones() {
      return planogramZones(this.state);
    },
    customerPortal() {
      return customerPortal(this.state);
    },
    packerPortal() {
      return packerPortal(this.state);
    },
    supplierPortal() {
      return supplierPortal(this.state);
    },
    delivererPortal() {
      return delivererPortal(this.state);
    },
    firstAsset() {
      return this.state.fixedAssets[0] || null;
    },
    firstTask() {
      return this.packerPortal?.tasks[0] || null;
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    taskButtons(task) {
      const buttons = [];
      if (task.status === 'assigned') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-sky-300 px-3 py-2 text-xs font-black text-slate-950',
          onClick: () => this.$emit('ack-task', task.taskId),
        }, 'Enterado'));
      }
      if (task.status === 'acknowledged') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-violet-300 px-3 py-2 text-xs font-black text-slate-950',
          onClick: () => this.$emit('start-task', task.taskId),
        }, 'Iniciar'));
      }
      if (task.status === 'in_progress') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950',
          onClick: () => this.$emit('complete-task', task.taskId),
        }, 'Cerrar'));
      }
      if (task.status !== 'blocked' && task.status !== 'done') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-rose-300 px-3 py-2 text-xs font-black text-slate-950',
          onClick: () => this.$emit('block-task', task.taskId),
        }, 'Bloquear'));
      }
      return buttons;
    },
    renderAssets() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Activos'),
          h('button', {
            class: 'focus-ring rounded-lg bg-sky-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('add-asset'),
          }, 'Activo'),
        ]),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Fijos', this.fixedAssets.total),
          this.metric('Valor', money(this.fixedAssets.totalCost)),
          this.metric('Cajas stock', this.crates.inStock),
          this.metric('Cajas perdidas', this.crates.lost),
        ]),
        this.firstAsset ? h('button', {
          class: 'focus-ring mt-3 rounded-lg bg-amber-300 px-3 py-2 text-xs font-black text-slate-950',
          onClick: () => this.$emit('maintain-asset', this.firstAsset.id),
        }, 'Mantenimiento') : null,
      ]);
    },
    renderPlanogram() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Planograma'),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Total cajas', this.zones.totalQuantity),
          this.metric('Stacks frio', this.zones.cold.length),
          this.metric('Stacks piso', this.zones.floor.length),
          this.metric('Rutas MySQL', this.pocketbaseRoutes.length),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' },
          this.zones.floor.slice(0, 3).map((stack) =>
            h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: stack.id }, [
              h('strong', { class: 'text-white' }, stack.name),
              h('span', { class: 'block text-slate-300' }, `${stack.location} - ${stack.quantity}`),
            ]))),
      ]);
    },
    renderPortals() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Portales'),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Cliente', this.customerPortal?.customer.name || 'N/A'),
          this.metric('Saldo', money(this.customerPortal?.ledger.totalBalance || 0)),
          this.metric('Empaque', this.packerPortal?.tasks.length || 0),
          this.metric('Reparto', this.delivererPortal?.tasks.length || 0),
          this.metric('Proveedor', this.supplierPortal?.latestStatus || 'N/A'),
        ]),
        this.firstTask ? h('div', { class: 'mt-3 flex flex-wrap gap-2' }, this.taskButtons(this.firstTask)) : null,
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 xl:grid-cols-3' }, [
      this.renderAssets(),
      this.renderPlanogram(),
      this.renderPortals(),
    ]);
  },
};
</script>
