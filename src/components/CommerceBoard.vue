<template>
  <section class="mt-4 grid gap-4 xl:grid-cols-3">
    <article class="surface p-4">
      <h2>Clientes</h2>
    </article>
    <article class="surface p-4">
      <h2>Proveedores</h2>
    </article>
    <article class="surface p-4">
      <h2>Finanzas</h2>
    </article>
  </section>
</template>

<script>
import { customerPortfolio } from '/src/domain/customers/customerLedger.js';
import { cashAttention, financeSummary } from '/src/domain/finance/financeSelectors.js';
import { purchaseOrderRows, supplierStats } from '/src/domain/suppliers/supplierSelectors.js';

const { h } = Vue;

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export default {
  name: 'CommerceBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: ['return-crate', 'mark-crate-lost', 'receive-order', 'create-demo-order', 'toggle-drawer', 'add-expense'],
  computed: {
    portfolio() {
      return customerPortfolio(this.state);
    },
    supplierStats() {
      return supplierStats(this.state);
    },
    orders() {
      return purchaseOrderRows(this.state).slice(0, 4);
    },
    finance() {
      return financeSummary(this.state);
    },
    cashAttention() {
      return cashAttention(this.state);
    },
    activeLoans() {
      return this.state.crateLoans.filter((loan) => loan.status === 'Prestado' || loan.status === 'No Devuelto');
    },
    drawer() {
      return this.state.cashDrawers[0] || null;
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, value),
      ]);
    },
    renderCustomerPanel() {
      const loan = this.activeLoans[0];
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Clientes'),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Cartera', money(this.portfolio.totalBalance)),
          this.metric('Activos 30d', String(this.portfolio.activeCustomers)),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.portfolio.ledgers.slice(0, 3).map((ledger) =>
          h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: ledger.customer.id }, [
            h('strong', { class: 'text-white' }, ledger.customer.name),
            h('span', { class: 'block text-slate-300' }, `${ledger.customer.creditStatus} - ${money(ledger.totalBalance)}`),
          ]))),
        loan ? h('div', { class: 'mt-3 flex flex-wrap gap-2' }, [
          h('button', {
            class: 'focus-ring rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('return-crate', loan.id),
          }, 'Devolver caja'),
          h('button', {
            class: 'focus-ring rounded-lg bg-rose-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('mark-crate-lost', loan.id),
          }, 'Caja perdida'),
        ]) : null,
      ]);
    },
    renderSupplierPanel() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Proveedores'),
          h('button', {
            class: 'focus-ring rounded-lg bg-sky-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('create-demo-order'),
          }, 'Orden'),
        ]),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('SKUs', String(this.supplierStats.suppliedVarieties)),
          this.metric('Flete prom.', money(this.supplierStats.avgFreight)),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.orders.map((order) =>
          h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: order.id }, [
            h('div', { class: 'flex items-start justify-between gap-2' }, [
              h('div', [
                h('strong', { class: 'text-white' }, order.supplier?.name || 'Proveedor'),
                h('span', { class: 'block text-slate-300' }, `${order.status} - ${money(order.totalCost)}`),
              ]),
              order.status === 'Ordenado' ? h('button', {
                class: 'focus-ring rounded-lg bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950',
                onClick: () => this.$emit('receive-order', order.id),
              }, 'Recibir') : null,
            ]),
          ]))),
      ]);
    },
    renderFinancePanel() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Finanzas'),
          this.drawer ? h('button', {
            class: 'focus-ring rounded-lg bg-amber-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('toggle-drawer', this.drawer.id),
          }, this.drawer.status === 'Abierta' ? 'Cerrar caja' : 'Abrir caja') : null,
        ]),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Utilidad bruta', money(this.finance.grossProfit)),
          this.metric('Caja abierta', money(this.finance.openCash)),
          this.metric('Deuda', money(this.finance.portfolio.monetaryDebt)),
          this.metric('Alertas caja', String(this.cashAttention.critical + this.cashAttention.warning)),
        ]),
        h('button', {
          class: 'focus-ring mt-3 rounded-lg bg-slate-200 px-3 py-2 text-xs font-black text-slate-950',
          onClick: () => this.$emit('add-expense'),
        }, 'Gasto'),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 xl:grid-cols-3' }, [
      this.renderCustomerPanel(),
      this.renderSupplierPanel(),
      this.renderFinancePanel(),
    ]);
  },
};
</script>
