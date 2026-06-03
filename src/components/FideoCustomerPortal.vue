<template>
  <section class="fideo-customer-portal-placeholder">Portal cliente</section>
</template>

<script>
const { h } = Vue;

const tabs = [
  { id: 'today_orders', label: 'Pedido de hoy' },
  { id: 'order_history', label: 'Historial' },
  { id: 'crates', label: 'Mis cajas' },
  { id: 'prices', label: 'Mis precios' },
];

export default {
  name: 'FideoCustomerPortal',
  props: {
    state: { type: Object, required: true },
  },
  data() {
    return { activeTab: 'today_orders' };
  },
  computed: {
    customer() {
      return this.state.customers[0] || null;
    },
    sales() {
      if (!this.customer) return [];
      return this.state.sales
        .filter((sale) => sale.customerId === this.customer.id || sale.customer === this.customer.name)
        .slice()
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    },
    todaySales() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return this.sales.filter((sale) => new Date(sale.timestamp || 0) >= today);
    },
    historicalSales() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return this.sales.filter((sale) => new Date(sale.timestamp || 0) < today);
    },
    customerLoans() {
      if (!this.customer) return [];
      return this.state.crateLoans
        .filter((loan) => loan.customerId === this.customer.id || loan.customer === this.customer.name)
        .slice()
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    },
    totalBalance() {
      const debt = this.sales
        .filter((sale) => sale.paymentStatus === 'En Deuda' && sale.status === 'Completado')
        .reduce((sum, sale) => sum + Number(sale.total || sale.price || 0), 0);
      const paid = this.state.payments
        .filter((payment) => payment.customerId === this.customer?.id)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const crates = this.customerLoans
        .filter((loan) => loan.status === 'Prestado' || loan.status === 'No Devuelto')
        .reduce((sum, loan) => {
          const type = this.state.crateTypes.find((item) => item.id === loan.crateTypeId);
          return sum + Number(loan.quantity || 0) * Number(type?.cost || 50);
        }, 0);
      return Math.max(0, debt - paid) + crates;
    },
    visibleTabs() {
      return tabs.filter((tab) => (tab.id === 'crates' ? this.customerLoans.length : true))
        .filter((tab) => (tab.id === 'prices' ? this.customer?.specialPrices?.length : true));
    },
  },
  methods: {
    money(value) {
      return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    },
    metric(label, value) {
      return h('div', { class: 'rounded-lg border border-white/10 bg-white/5 px-4 py-3' }, [
        h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500' }, label),
        h('p', { class: 'm-0 mt-2 text-3xl font-black text-white' }, String(value)),
      ]);
    },
    tabButton(tab) {
      return h('button', {
        class: `focus-ring rounded-full px-4 py-2 text-sm font-semibold transition ${
          this.activeTab === tab.id ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`,
        type: 'button',
        onClick: () => { this.activeTab = tab.id; },
        key: tab.id,
      }, tab.label);
    },
    orderList(rows, emptyTitle, emptyBody) {
      if (!rows.length) {
        return h('div', { class: 'rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center' }, [
          h('p', { class: 'm-0 text-lg font-semibold text-white' }, emptyTitle),
          h('p', { class: 'm-0 mt-2 text-sm text-slate-400' }, emptyBody),
        ]);
      }
      return h('div', { class: 'grid gap-3' }, rows.map((sale) => h('article', {
        class: 'rounded-lg border border-white/10 bg-white/5 p-4',
        key: sale.id,
      }, [
        h('div', { class: 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between' }, [
          h('div', [
            h('p', { class: 'm-0 font-semibold text-white' }, `${sale.quantity}x ${sale.varietyName} ${sale.size}`),
            h('p', { class: 'm-0 mt-1 text-xs text-slate-400' },
              `${new Date(sale.timestamp).toLocaleString('es-MX')} | ${sale.status} | ${sale.paymentStatus}`),
          ]),
          h('p', { class: 'm-0 text-lg font-black text-lime-200' }, this.money(sale.total || sale.price)),
        ]),
      ])));
    },
    cratesPanel() {
      return this.customerLoans.length ? h('div', { class: 'grid gap-3' }, this.customerLoans.map((loan) => {
        const crate = this.state.crateTypes.find((item) => item.id === loan.crateTypeId);
        const overdue = new Date(loan.dueDate || 0) < new Date() && loan.status === 'Prestado';
        return h('article', {
          class: `rounded-lg border p-4 ${overdue ? 'border-rose-400/20 bg-rose-400/10' : 'border-amber-400/20 bg-amber-400/10'}`,
          key: loan.id,
        }, [
          h('p', { class: 'm-0 font-semibold text-white' }, `${loan.quantity} x ${crate?.name || 'Caja'}`),
          h('p', { class: `m-0 mt-2 text-sm ${overdue ? 'text-rose-200' : 'text-amber-200'}` },
            `${loan.status} | Vence: ${new Date(loan.dueDate).toLocaleDateString('es-MX')}`),
        ]);
      })) : this.orderList([], 'Sin cajas registradas.', 'No tienes prestamos activos en este momento.');
    },
    priceName(price) {
      const group = this.state.productGroups.find((item) =>
        item.varieties.some((variety) => variety.id === price.varietyId));
      const variety = group?.varieties.find((item) => item.id === price.varietyId);
      return `${group?.name || 'Producto'} ${variety?.name || ''} (${price.size})`.trim();
    },
    pricesPanel() {
      const prices = this.customer?.specialPrices || [];
      return prices.length ? h('div', { class: 'grid gap-3' }, prices.map((price) => h('article', {
        class: 'rounded-lg border border-white/10 bg-white/5 p-4',
        key: `${price.varietyId}-${price.size}-${price.state}-${price.quality}`,
      }, [
        h('div', { class: 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between' }, [
          h('div', [
            h('p', { class: 'm-0 font-semibold text-white' }, this.priceName(price)),
            h('p', { class: 'm-0 mt-1 text-xs text-slate-400' }, `${price.quality} | ${price.state}`),
          ]),
          h('p', { class: 'm-0 text-lg font-black text-lime-200' }, this.money(price.price)),
        ]),
      ]))) : this.orderList([], 'Sin precios especiales.', 'Tus condiciones personalizadas apareceran aqui cuando existan.');
    },
    activePanel() {
      if (this.activeTab === 'order_history') {
        return this.orderList(this.historicalSales, 'Sin historial disponible.', 'Aun no encontramos pedidos anteriores para esta cuenta.');
      }
      if (this.activeTab === 'crates') return this.cratesPanel();
      if (this.activeTab === 'prices') return this.pricesPanel();
      return this.orderList(this.todaySales, 'Todavia no hay pedidos para hoy.', 'Cuando se registren tus compras del dia apareceran aqui.');
    },
  },
  render() {
    if (!this.customer) {
      return h('section', { class: 'surface px-6 py-14 text-center' }, [
        h('h2', { class: 'm-0 text-xl font-black text-white' }, 'Cliente no encontrado'),
        h('p', { class: 'm-0 mt-2 text-sm text-slate-400' }, 'No fue posible cargar el portal para esta cuenta.'),
      ]);
    }
    return h('div', { class: 'grid gap-6' }, [
      h('section', {
        class: 'rounded-lg border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_32%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8',
      }, [
        h('div', { class: 'flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between' }, [
          h('div', { class: 'max-w-3xl' }, [
            h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.34em] text-lime-200' }, 'Portal cliente'),
            h('h2', { class: 'm-0 mt-3 text-4xl font-black tracking-tight text-white' }, `Bienvenido, ${this.customer.name}`),
            h('p', { class: 'm-0 mt-4 max-w-2xl text-sm leading-6 text-slate-300' },
              'Consulta pedidos, cajas prestadas y condiciones especiales de compra desde una vista clara y directa.'),
          ]),
          h('div', { class: 'grid gap-3 sm:grid-cols-3 xl:min-w-[540px]' }, [
            this.metric('Balance total', this.money(this.totalBalance)),
            this.metric('Pedidos hoy', this.todaySales.length),
            this.metric('Precios especiales', this.customer.specialPrices.length),
          ]),
        ]),
      ]),
      h('section', { class: 'surface p-3' }, [
        h('div', { class: 'flex flex-wrap gap-2' }, this.visibleTabs.map((tab) => this.tabButton(tab))),
      ]),
      h('section', { class: 'surface p-6' }, [this.activePanel()]),
    ]);
  },
};
</script>
