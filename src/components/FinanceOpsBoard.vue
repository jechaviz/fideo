<template>
  <section class="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
    <article class="surface p-4">
      <h2>Caja operativa</h2>
    </article>
    <article class="surface p-4">
      <h2>Timeline caja</h2>
    </article>
  </section>
</template>

<script>
import {
  cashActivityRows,
  cashAttention,
  debtRows,
  financeSummary,
} from '/src/domain/finance/financeSelectors.js';

const { h } = Vue;

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

const toneClass = {
  critical: 'border-rose-400/25 bg-rose-300/10 text-rose-100',
  warning: 'border-amber-400/25 bg-amber-300/10 text-amber-100',
  info: 'border-sky-400/25 bg-sky-300/10 text-sky-100',
};

export default {
  name: 'FinanceOpsBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: ['toggle-drawer', 'cash-deposit', 'cash-withdraw', 'sell-crate-asset', 'add-expense'],
  computed: {
    drawer() {
      return this.state.cashDrawers[0] || null;
    },
    finance() {
      return financeSummary(this.state);
    },
    attention() {
      return cashAttention(this.state);
    },
    activities() {
      return cashActivityRows(this.state, this.drawer?.id).slice(0, 8);
    },
    debtors() {
      return debtRows(this.state).slice(0, 5);
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    renderDrawerPanel() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('p', { class: 'm-0 text-xs font-black uppercase text-sky-200' }, 'Caja operativa'),
            h('h2', { class: 'm-0 mt-1 text-xl font-black text-white' }, this.drawer?.name || 'Sin caja'),
          ]),
          this.drawer ? h('button', {
            class: 'focus-ring rounded-lg bg-amber-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('toggle-drawer', this.drawer.id),
          }, this.drawer.status === 'Abierta' ? 'Cerrar' : 'Abrir') : null,
        ]),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Estado', this.drawer?.status || 'N/A'),
          this.metric('Saldo', money(this.drawer?.balance || 0)),
          this.metric('Diferencia', money(this.finance.drawerDifferences)),
          this.metric('Neto op.', money(this.finance.netOperating)),
        ]),
        this.drawer ? h('div', { class: 'mt-3 flex flex-wrap gap-2' }, [
          h('button', {
            class: 'focus-ring rounded-lg bg-sky-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('cash-deposit', this.drawer.id),
          }, 'Deposito'),
          h('button', {
            class: 'focus-ring rounded-lg bg-rose-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('cash-withdraw', this.drawer.id),
          }, 'Retiro'),
          h('button', {
            class: 'focus-ring rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('sell-crate-asset'),
          }, 'Vender activo'),
          h('button', {
            class: 'focus-ring rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-200',
            onClick: () => this.$emit('add-expense'),
          }, 'Gasto'),
        ]) : null,
      ]);
    },
    renderAttentionPanel() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Atencion inmediata'),
        this.attention.items.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.attention.items.map((item) =>
            h('li', {
              class: `rounded-lg border p-3 text-sm ${toneClass[item.tone] || toneClass.info}`,
              key: item.id,
            }, [
              h('strong', { class: 'text-white' }, item.title),
              h('span', { class: 'block text-slate-200' }, item.meta),
              h('span', { class: 'block text-xs font-black' }, money(item.amount)),
            ])))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin alertas de caja.'),
      ]);
    },
    renderTimeline() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Timeline caja'),
        this.activities.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.activities.map((activity) =>
            h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: activity.id }, [
              h('div', { class: 'flex items-start justify-between gap-3' }, [
                h('div', [
                  h('strong', { class: 'text-white' }, activity.label),
                  h('span', { class: 'block text-slate-300' }, activity.notes || 'Movimiento de caja'),
                  activity.isDifference
                    ? h('span', { class: 'block text-xs text-rose-200' }, `Diferencia ${money(activity.difference)}`)
                    : null,
                ]),
                h('span', {
                  class: activity.signedAmount < 0 ? 'font-black text-rose-200' : 'font-black text-emerald-200',
                }, money(activity.signedAmount)),
              ]),
            ])))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin movimientos registrados.'),
      ]);
    },
    renderDebtPanel() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Cobranza viva'),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Deuda', money(this.finance.portfolio.monetaryDebt)),
          this.metric('Cajas fuera', money(this.finance.portfolio.lentCratesValue)),
        ]),
        this.debtors.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.debtors.map((row) =>
            h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: row.customerId }, [
              h('strong', { class: 'text-white' }, row.customerName),
              h('span', { class: 'block text-slate-300' },
                `${money(row.totalBalance)} - ${row.totalOrders} pedido(s)`),
              h('span', { class: 'block text-xs text-slate-500' },
                `Uso credito ${Math.round(row.creditUsagePct)}%`),
            ])))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Cartera sin saldos abiertos.'),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]' }, [
      h('div', { class: 'grid gap-4' }, [
        this.renderDrawerPanel(),
        this.renderAttentionPanel(),
      ]),
      h('div', { class: 'grid gap-4' }, [
        this.renderTimeline(),
        this.renderDebtPanel(),
      ]),
    ]);
  },
};
</script>
