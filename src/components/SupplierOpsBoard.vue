<template>
  <section class="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
    <article class="surface p-4">
      <h2>Abasto coordinado</h2>
    </article>
    <article class="surface p-4">
      <h2>Pipeline compras</h2>
    </article>
  </section>
</template>

<script>
import {
  purchaseOrderPipeline,
  purchaseReceiptRows,
  purchaseReceiptSummary,
  supplierCostMatrix,
  supplierRows,
  supplierStats,
} from '/src/domain/suppliers/supplierSelectors.js';

const { h } = Vue;

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export default {
  name: 'SupplierOpsBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: [
    'create-demo-order',
    'order-purchase-order',
    'receive-order',
    'reprice-order',
    'raise-supplier-cost',
    'rename-supplier',
    'refresh-supplier-contact',
    'record-purchase-receipt',
  ],
  computed: {
    stats() {
      return supplierStats(this.state);
    },
    suppliers() {
      return supplierRows(this.state);
    },
    costs() {
      return supplierCostMatrix(this.state).slice(0, 6);
    },
    pipeline() {
      return purchaseOrderPipeline(this.state);
    },
    receiptSummary() {
      return purchaseReceiptSummary(this.state);
    },
    receipts() {
      return purchaseReceiptRows(this.state).slice(0, 5);
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    renderNetwork() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('p', { class: 'm-0 text-xs font-black uppercase text-sky-200' }, 'Abasto coordinado'),
            h('h2', { class: 'm-0 mt-1 text-xl font-black text-white' }, 'Red de proveedores'),
          ]),
          h('button', {
            class: 'focus-ring rounded-lg bg-sky-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('create-demo-order'),
          }, 'Orden'),
        ]),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-3' }, [
          this.metric('Red', this.stats.supplierCount),
          this.metric('Variedades', this.stats.suppliedVarieties),
          this.metric('Flete prom.', money(this.stats.avgFreight)),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.suppliers.map((supplier) =>
          h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: supplier.id }, [
            h('div', { class: 'flex items-start justify-between gap-3' }, [
              h('div', [
                h('strong', { class: 'text-white' }, supplier.name),
                h('span', { class: 'block text-slate-300' },
                  `${supplier.supplyCount} SKU(s) - ${money(supplier.avgLandedCost)}`),
                h('span', { class: 'block text-xs text-slate-500' }, supplier.contact || 'Sin contacto'),
              ]),
              h('div', { class: 'flex shrink-0 flex-wrap justify-end gap-2' }, [
                h('button', {
                  class: 'focus-ring rounded-lg bg-amber-300 px-2 py-1 text-xs font-black text-slate-950',
                  onClick: () => this.$emit('rename-supplier', supplier),
                }, 'Editar'),
                h('button', {
                  class: 'focus-ring rounded-lg border border-white/10 px-2 py-1 text-xs font-black text-slate-200',
                  onClick: () => this.$emit('refresh-supplier-contact', supplier),
                }, 'Contacto'),
              ]),
            ]),
          ]))),
      ]);
    },
    renderCostMatrix() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Costo aterrizado'),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.costs.map((row) =>
          h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: `${row.supplierId}-${row.varietyId}` }, [
            h('div', { class: 'flex items-start justify-between gap-3' }, [
              h('div', [
                h('strong', { class: 'text-white' }, row.productName),
                h('span', { class: 'block text-slate-300' }, row.supplierName),
                h('span', { class: 'block text-xs text-slate-500' },
                  `Base ${money(row.baseCost)} + flete ${money(row.freightCost)}`),
              ]),
              h('button', {
                class: 'focus-ring rounded-lg bg-amber-300 px-2 py-1 text-xs font-black text-slate-950',
                onClick: () => this.$emit('raise-supplier-cost', row),
              }, money(row.landedCost)),
            ]),
          ]))),
      ]);
    },
    renderOrder(order) {
      const canOrder = order.status === 'Pendiente';
      const canReceive = order.status !== 'Recibido';
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: order.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', { class: 'min-w-0' }, [
            h('strong', { class: 'text-white' }, order.supplier?.name || 'Proveedor'),
            h('span', { class: 'block text-slate-300' },
              `${order.product?.group.name || 'Producto'} ${order.product?.variety.name || ''}`.trim()),
            h('span', { class: 'block text-xs text-slate-500' },
              `${order.quantity} ${order.packaging} - ${money(order.totalCost)}`),
          ]),
          h('div', { class: 'flex flex-col gap-2' }, [
            canOrder ? h('button', {
              class: 'focus-ring rounded-lg bg-sky-300 px-2 py-1 text-xs font-black text-slate-950',
              onClick: () => this.$emit('order-purchase-order', order.id),
            }, 'Ordenar') : null,
            canReceive ? h('button', {
              class: 'focus-ring rounded-lg bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950',
              onClick: () => this.$emit('receive-order', order.id),
            }, 'Recibir') : null,
            h('button', {
              class: 'focus-ring rounded-lg border border-white/10 px-2 py-1 text-xs font-black text-slate-200',
              onClick: () => this.$emit('reprice-order', order.id),
            }, 'Recalcular'),
          ]),
        ]),
      ]);
    },
    renderPipelineColumn(title, rows) {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-center justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, title),
          h('span', { class: 'pill text-xs' }, String(rows.length)),
        ]),
        rows.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, rows.map(this.renderOrder))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin ordenes.'),
      ]);
    },
    renderReceiptPanel() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Recibos compra'),
            h('span', { class: 'text-sm text-slate-400' }, `${this.receiptSummary.remoteReceipts} remotos`),
          ]),
          h('button', {
            class: 'focus-ring rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('record-purchase-receipt'),
          }, 'Acuse'),
        ]),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-3' }, [
          this.metric('Recibos', this.receiptSummary.receipts),
          this.metric('Remotos', this.receiptSummary.remoteReceipts),
          this.metric('Monto', money(this.receiptSummary.receivedAmount)),
        ]),
        this.receipts.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.receipts.map((row) =>
            h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: row.id }, [
              h('div', { class: 'flex items-start justify-between gap-3' }, [
                h('div', [
                  h('strong', { class: 'text-white' }, row.supplier?.name || 'Proveedor'),
                  h('span', { class: 'block text-slate-300' }, `${row.provider} - ${row.status}`),
                  h('span', { class: 'block text-xs text-slate-500' },
                    `${row.quantity} uds - ${money(row.amount)}`),
                ]),
                h('span', { class: 'pill text-xs' }, row.purchaseOrderId.slice(0, 12)),
              ]),
            ])))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin recibos registrados.'),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]' }, [
      h('div', { class: 'grid gap-4' }, [
        this.renderNetwork(),
        this.renderCostMatrix(),
      ]),
      h('div', { class: 'grid gap-4' }, [
        h('article', { class: 'surface p-4' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Pipeline compras'),
          h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-3' }, [
            this.metric('Abiertas', this.pipeline.openCount),
            this.metric('Comprometido', money(this.pipeline.totalOpenCost)),
            this.metric('Recibido', money(this.pipeline.receivedCost)),
          ]),
        ]),
        this.renderReceiptPanel(),
        h('div', { class: 'grid gap-4 lg:grid-cols-3' }, [
          this.renderPipelineColumn('Pendiente', this.pipeline.Pendiente),
          this.renderPipelineColumn('Ordenado', this.pipeline.Ordenado),
          this.renderPipelineColumn('Recibido', this.pipeline.Recibido.slice(0, 4)),
        ]),
      ]),
    ]);
  },
};
</script>
