<template>
  <section class="mt-4 grid gap-4">
    <article class="surface p-4">
      <h2>Entrega viva</h2>
    </article>
  </section>
</template>

<script>
import {
  deliveryAttentionItems,
  deliveryColumns,
  deliveryLiveActivity,
  routeGroups,
} from '/src/domain/delivery/deliverySelectors.js';

const { h } = Vue;

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

const statusLabel = {
  assigned: 'Pendiente',
  acknowledged: 'Enterado',
  in_progress: 'En ruta',
  blocked: 'Bloqueado',
  done: 'Cerrado',
};

const toneClass = {
  assigned: 'border-amber-400/30 bg-amber-300/10 text-amber-100',
  acknowledged: 'border-sky-400/30 bg-sky-300/10 text-sky-100',
  in_progress: 'border-emerald-400/30 bg-emerald-300/10 text-emerald-100',
  blocked: 'border-rose-400/30 bg-rose-300/10 text-rose-100',
  done: 'border-slate-400/30 bg-slate-300/10 text-slate-100',
};

export default {
  name: 'DeliveryOpsBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: [
    'pack-sale',
    'route-sale',
    'complete-sale',
    'ack-task',
    'start-task',
    'block-task',
    'complete-task',
    'note-task',
    'incident-task',
  ],
  computed: {
    columns() {
      return deliveryColumns(this.state);
    },
    routes() {
      return routeGroups(this.state);
    },
    attention() {
      return deliveryAttentionItems(this.state);
    },
    liveActivity() {
      return deliveryLiveActivity(this.state);
    },
    counts() {
      const all = [...this.columns.packing, ...this.columns.assignment, ...this.columns.route];
      return {
        total: all.length,
        blocked: all.filter((task) => task.status === 'blocked').length,
        reports: all.reduce((sum, task) => sum + task.openReports.length, 0),
        routeValue: this.routes.reduce((sum, route) => sum + route.total, 0),
      };
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    chip(task) {
      return h('span', {
        class: `inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase ${toneClass[task.status]}`,
      }, statusLabel[task.status] || task.status);
    },
    taskButtons(task) {
      const buttons = [];
      if (task.status === 'assigned') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-sky-300 px-2 py-1 text-xs font-black text-slate-950',
          onClick: () => this.$emit('ack-task', task.taskId),
        }, 'Enterado'));
      }
      if (task.status === 'acknowledged') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950',
          onClick: () => this.$emit('start-task', task.taskId),
        }, 'Iniciar'));
      }
      if (task.status !== 'blocked') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-rose-300 px-2 py-1 text-xs font-black text-slate-950',
          onClick: () => this.$emit('incident-task', task.taskId),
        }, 'Incidencia'));
      }
      if (task.status === 'in_progress') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950',
          onClick: () => this.$emit('complete-task', task.taskId),
        }, 'Cerrar'));
      }
      buttons.push(h('button', {
        class: 'focus-ring rounded-lg border border-white/10 px-2 py-1 text-xs font-black text-slate-200',
        onClick: () => this.$emit('note-task', task.taskId),
      }, 'Nota'));
      return buttons;
    },
    saleButtons(task) {
      const buttons = [];
      if (task.sale?.status === 'Pendiente de Empaque') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-sky-300 px-2 py-1 text-xs font-black text-slate-950',
          onClick: () => this.$emit('pack-sale', task.sale.id),
        }, 'Empacar'));
      }
      if (task.sale?.status === 'Listo para Entrega') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-violet-300 px-2 py-1 text-xs font-black text-slate-950',
          onClick: () => this.$emit('route-sale', task.sale.id),
        }, 'Asignar'));
      }
      if (task.sale?.status === 'En Ruta') {
        buttons.push(h('button', {
          class: 'focus-ring rounded-lg bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950',
          onClick: () => this.$emit('complete-sale', task.sale.id),
        }, 'Entregar'));
      }
      return buttons;
    },
    renderTask(task) {
      const openReport = task.openReports[0];
      const buttons = [...this.saleButtons(task), ...this.taskButtons(task)];
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: task.taskId }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', { class: 'min-w-0' }, [
            h('div', { class: 'flex flex-wrap items-center gap-2' }, [
              h('strong', { class: 'text-white' }, task.title),
              this.chip(task),
            ]),
            h('span', { class: 'mt-1 block text-slate-300' }, task.description),
            h('span', { class: 'block text-xs text-slate-500' },
              [task.customerName, task.employeeName, task.destination].filter(Boolean).join(' - ')),
            task.pendingCrates.length
              ? h('span', { class: 'mt-2 block text-xs font-bold text-amber-200' },
                `${task.pendingCrates.length} prestamo(s) de caja pendientes`)
              : null,
            openReport
              ? h('span', { class: 'mt-2 block rounded-lg border border-rose-400/20 bg-rose-300/10 px-2 py-1 text-xs text-rose-100' },
                openReport.summary)
              : null,
          ]),
          h('div', { class: 'flex shrink-0 flex-col gap-2' }, buttons),
        ]),
      ]);
    },
    renderColumn(title, rows) {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-center justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, title),
          h('span', { class: 'pill text-xs' }, String(rows.length)),
        ]),
        rows.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, rows.map(this.renderTask))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin tareas abiertas.'),
      ]);
    },
    renderRouteSummary() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Rutas por repartidor'),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.routes.map((route) =>
          h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: route.driverId || route.driverName }, [
            h('strong', { class: 'text-white' }, route.driverName),
            h('span', { class: 'block text-slate-300' },
              `${route.tasks.length} entrega(s) - ${money(route.total)}`),
            route.blocked || route.openReports
              ? h('span', { class: 'block text-xs text-rose-200' },
                `${route.blocked} bloqueo(s), ${route.openReports} reporte(s)`)
              : null,
          ]))),
      ]);
    },
    renderListPanel(title, rows) {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, title),
        rows.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, rows.map((item) =>
            h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: item.id }, [
              h('strong', { class: item.tone === 'critical' ? 'text-rose-100' : 'text-white' }, item.title),
              h('span', { class: 'block text-slate-300' }, item.detail),
            ])))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin elementos abiertos.'),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4' }, [
      h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex flex-col gap-3 md:flex-row md:items-end md:justify-between' }, [
          h('div', [
            h('p', { class: 'm-0 text-xs font-black uppercase text-sky-200' }, 'Entrega viva'),
            h('h2', { class: 'm-0 mt-1 text-2xl font-black text-white' }, 'Empaque, asignacion y ruta'),
          ]),
          h('div', { class: 'grid gap-2 sm:grid-cols-4' }, [
            this.metric('Tareas', this.counts.total),
            this.metric('Bloqueos', this.counts.blocked),
            this.metric('Reportes', this.counts.reports),
            this.metric('En ruta', money(this.counts.routeValue)),
          ]),
        ]),
      ]),
      h('div', { class: 'grid gap-4 xl:grid-cols-3' }, [
        this.renderColumn('Empaque', this.columns.packing),
        this.renderColumn('Asignacion', this.columns.assignment),
        this.renderColumn('Ruta', this.columns.route),
      ]),
      h('div', { class: 'grid gap-4 lg:grid-cols-3' }, [
        this.renderRouteSummary(),
        this.renderListPanel('Atencion ruta', this.attention),
        this.renderListPanel('Actividad entrega', this.liveActivity),
      ]),
    ]);
  },
};
</script>
