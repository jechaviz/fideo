<template>
  <section class="fideo-supplier-portal-placeholder">Portal proveedor</section>
</template>

<script>
const { h } = Vue;

const statusClass = {
  Pendiente: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  Ordenado: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
  Recibido: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
};

export default {
  name: 'FideoSupplierPortal',
  props: {
    state: { type: Object, required: true },
  },
  computed: {
    supplier() {
      return this.state.suppliers[0] || null;
    },
    orders() {
      if (!this.supplier) return [];
      return this.state.purchaseOrders
        .filter((order) => order.supplierId === this.supplier.id)
        .slice()
        .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));
    },
    totalOrdered() {
      return this.orders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0);
    },
  },
  methods: {
    money(value) {
      return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    },
    productName(varietyId) {
      for (const group of this.state.productGroups) {
        const variety = group.varieties.find((item) => item.id === varietyId);
        if (variety) return `${group.name} ${variety.name}`;
      }
      return 'Producto desconocido';
    },
    metric(label, value) {
      return h('div', { class: 'rounded-lg border border-white/10 bg-white/5 px-4 py-3' }, [
        h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500' }, label),
        h('p', { class: 'm-0 mt-2 text-3xl font-black text-white' }, String(value)),
      ]);
    },
    headerCell(label) {
      return h('th', {
        class: 'px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.24em] text-slate-500',
      }, label);
    },
    row(order) {
      return h('tr', { class: 'border-b border-white/5', key: order.id }, [
        h('td', { class: 'px-6 py-5 text-sm text-slate-300' },
          new Date(order.orderDate).toLocaleDateString('es-MX')),
        h('td', { class: 'px-6 py-5 text-sm font-semibold text-white' },
          `${this.productName(order.varietyId)} (${order.size})`),
        h('td', { class: 'px-6 py-5 text-sm text-slate-300' }, `${order.quantity} ${order.packaging}`),
        h('td', { class: 'px-6 py-5 text-sm font-black text-lime-200' }, this.money(order.totalCost)),
        h('td', { class: 'px-6 py-5' }, [
          h('span', {
            class: `rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${
              statusClass[order.status] || 'border-slate-400/20 bg-slate-400/10 text-slate-200'
            }`,
          }, order.status),
        ]),
      ]);
    },
  },
  render() {
    if (!this.supplier) {
      return h('section', { class: 'surface px-6 py-14 text-center' }, [
        h('h2', { class: 'm-0 text-xl font-black text-white' }, 'Proveedor no encontrado'),
        h('p', { class: 'm-0 mt-2 text-sm text-slate-400' }, 'No fue posible cargar la vista del proveedor.'),
      ]);
    }
    return h('div', { class: 'grid gap-6' }, [
      h('section', {
        class: 'rounded-lg border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_32%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8',
      }, [
        h('div', { class: 'flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between' }, [
          h('div', { class: 'max-w-3xl' }, [
            h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.34em] text-sky-200' }, 'Portal proveedor'),
            h('h2', { class: 'm-0 mt-3 text-4xl font-black tracking-tight text-white' }, this.supplier.name),
            h('p', { class: 'm-0 mt-4 max-w-2xl text-sm leading-6 text-slate-300' },
              'Consulta ordenes de compra, montos y estado operativo de cada solicitud desde un portal claro y premium.'),
          ]),
          h('div', { class: 'grid gap-3 sm:grid-cols-3 xl:min-w-[560px]' }, [
            this.metric('Ordenes', this.orders.length),
            this.metric('Monto total', this.money(this.totalOrdered)),
            this.metric('Ultimo estado', this.orders[0]?.status || 'Sin actividad'),
          ]),
        ]),
      ]),
      h('section', { class: 'surface overflow-hidden' }, [
        h('div', { class: 'border-b border-white/10 px-6 py-5' }, [
          h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500' }, 'Ordenes de compra'),
          h('h3', { class: 'm-0 mt-2 text-2xl font-black tracking-tight text-white' }, 'Historial reciente'),
        ]),
        this.orders.length ? h('div', { class: 'overflow-x-auto' }, [
          h('table', { class: 'min-w-full' }, [
            h('thead', { class: 'border-b border-white/10 bg-white/[0.03]' }, [
              h('tr', [
                this.headerCell('Fecha'),
                this.headerCell('Producto'),
                this.headerCell('Cantidad'),
                this.headerCell('Costo'),
                this.headerCell('Estado'),
              ]),
            ]),
            h('tbody', this.orders.map((order) => this.row(order))),
          ]),
        ]) : h('div', { class: 'px-6 py-14 text-center' }, [
          h('p', { class: 'm-0 text-lg font-semibold text-white' }, 'Sin ordenes para mostrar.'),
          h('p', { class: 'm-0 mt-2 text-sm text-slate-400' }, 'Aun no se han registrado compras asociadas a este proveedor.'),
        ]),
      ]),
    ]);
  },
};
</script>
