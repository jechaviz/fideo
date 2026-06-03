<template>
  <section class="space-y-6">
    <article class="glass-panel-dark rounded-[2rem] p-6">Entregas</article>
  </section>
</template>

<script>
import {
  deliveryAttentionItems,
  deliveryColumns,
  deliveryLiveActivity,
  deliveryPresenceRows,
  deliveryReportReceiptRows,
  routeGroups,
} from '/src/domain/delivery/deliverySelectors.js';

const { h } = Vue;

const panelClass = 'glass-panel-dark rounded-[2rem] border border-white/10';
const labelClass = 'm-0 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

const statusLabel = {
  assigned: 'Pendiente',
  acknowledged: 'Acusada',
  in_progress: 'En curso',
  blocked: 'Bloqueada',
  done: 'Hecha',
};

const statusTone = {
  assigned: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  acknowledged: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
  in_progress: 'border-brand-400/20 bg-brand-400/10 text-brand-200',
  blocked: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  done: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
};

const stageIcon = {
  packing: 'fa-box-open',
  assignment: 'fa-user-plus',
  route: 'fa-truck',
  other: 'fa-list-check',
};

const reportTone = {
  critical: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
  warning: 'border-amber-400/20 bg-amber-400/10 text-amber-50',
  info: 'border-white/10 bg-white/[0.03] text-slate-200',
};

const allTasksFromColumns = (columns) => [...columns.packing, ...columns.assignment, ...columns.route];

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
    'ping-presence',
    'pause-presence',
    'record-report-receipt',
  ],
  computed: {
    columns() {
      return deliveryColumns(this.state);
    },
    allTasks() {
      return allTasksFromColumns(this.columns);
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
    presenceRows() {
      return deliveryPresenceRows(this.state);
    },
    reportReceipts() {
      return deliveryReportReceiptRows(this.state).slice(0, 4);
    },
    signalCounts() {
      return this.allTasks.reduce((counts, task) => {
        const key = task.status || 'assigned';
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {
        assigned: 0,
        acknowledged: 0,
        blocked: 0,
        in_progress: 0,
      });
    },
    operationalIndicators() {
      return this.allTasks.reduce((indicators, task) => {
        if (task.priority === 'high' && task.status === 'assigned') indicators.noAck += 1;
        if (task.openReports.some((report) => report.severity === 'high')) indicators.escalated += 1;
        indicators.reported += task.openReports.length;
        if (task.status === 'blocked' && (task.employeeName || task.employeeId)) indicators.blockedOwned += 1;
        return indicators;
      }, {
        noAck: 0,
        escalated: 0,
        reported: 0,
        blockedOwned: 0,
      });
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-2xl border border-white/10 bg-white/5 px-4 py-3' }, [
        h('p', { class: labelClass }, label),
        h('p', { class: 'm-0 mt-2 text-2xl font-black text-white' }, String(value)),
      ]);
    },
    chip(label, value, tone) {
      return h('span', {
        class: `inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${tone}`,
      }, `${label} ${value}`);
    },
    statusChip(task) {
      return h('span', {
        class: `inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone[task.status] || statusTone.assigned}`,
      }, statusLabel[task.status] || task.status);
    },
    actionButton(label, tone, onClick) {
      return h('button', {
        class: `focus-ring rounded-2xl px-3 py-2 text-xs font-black transition ${tone}`,
        type: 'button',
        onClick,
      }, label);
    },
    taskButtons(task) {
      const id = task.taskId || task.id;
      const buttons = [];
      if (task.status === 'assigned') {
        buttons.push(this.actionButton('Enterado', 'bg-sky-300 text-slate-950 hover:bg-sky-200', () => this.$emit('ack-task', id)));
      }
      if (task.status === 'acknowledged') {
        buttons.push(this.actionButton('Iniciar', 'bg-emerald-300 text-slate-950 hover:bg-emerald-200', () => this.$emit('start-task', id)));
      }
      if (task.status !== 'blocked') {
        buttons.push(this.actionButton('Incidencia', 'bg-rose-300 text-slate-950 hover:bg-rose-200', () => this.$emit('incident-task', id)));
      }
      if (task.status === 'in_progress') {
        buttons.push(this.actionButton('Cerrar', 'bg-emerald-300 text-slate-950 hover:bg-emerald-200', () => this.$emit('complete-task', id)));
      }
      buttons.push(this.actionButton('Nota', 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white', () => this.$emit('note-task', id)));
      return buttons;
    },
    saleButtons(task) {
      if (task.status !== 'in_progress') return [];
      if (task.sale?.status === 'Pendiente de Empaque') {
        return [this.actionButton('Empacar', 'bg-sky-300 text-slate-950 hover:bg-sky-200', () => this.$emit('pack-sale', task.sale.id))];
      }
      if (task.sale?.status === 'Listo para Entrega') {
        return [this.actionButton('Asignar', 'bg-violet-300 text-slate-950 hover:bg-violet-200', () => this.$emit('route-sale', task.sale.id))];
      }
      if (task.sale?.status === 'En Ruta') {
        return [this.actionButton('Entregar', 'bg-emerald-300 text-slate-950 hover:bg-emerald-200', () => this.$emit('complete-sale', task.sale.id))];
      }
      return [];
    },
    renderHero() {
      return h('section', {
        class: 'rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8',
      }, [
        h('div', { class: 'flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between' }, [
          h('div', [
            h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.34em] text-brand-300' }, 'Operacion en piso'),
            h('h1', { class: 'm-0 mt-3 text-4xl font-black tracking-tight text-white md:text-5xl' }, 'Entregas'),
          ]),
          h('div', { class: 'grid grid-cols-2 gap-3 lg:min-w-[420px] lg:grid-cols-4' }, [
            this.metric('Pendientes', this.signalCounts.assigned),
            this.metric('Acuses', this.signalCounts.acknowledged),
            this.metric('Bloqueos', this.signalCounts.blocked),
            this.metric('En curso', this.signalCounts.in_progress),
          ]),
        ]),
        h('div', { class: 'mt-5 flex flex-wrap gap-2' }, [
          this.chip('Reportes', this.operationalIndicators.reported, 'border-white/10 bg-white/5 text-slate-300'),
          this.chip('Escaladas', this.operationalIndicators.escalated, 'border-rose-400/20 bg-rose-400/10 text-rose-100'),
          this.chip('Sin acuse', this.operationalIndicators.noAck, 'border-amber-400/20 bg-amber-400/10 text-amber-100'),
          this.chip('Bloqueos c/owner', this.operationalIndicators.blockedOwned, 'border-sky-400/20 bg-sky-400/10 text-sky-100'),
        ]),
      ]);
    },
    renderAttentionPanel() {
      return h('div', { class: `${panelClass} p-5` }, [
        h('div', { class: 'flex items-center justify-between gap-3' }, [
          h('div', [
            h('p', { class: labelClass }, 'SLA inmediato'),
            h('h2', { class: 'm-0 mt-2 text-2xl font-black tracking-tight text-white' }, 'Sin acuse y escalacion'),
          ]),
          h('span', { class: 'rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300' }, `${this.attention.length} foco`),
        ]),
        h('div', { class: 'mt-4 space-y-3' }, this.attention.length
          ? this.attention.map((item) => this.renderSignalItem(item))
          : [this.renderEmpty('Sin riesgos SLA activos.')]),
      ]);
    },
    renderRealtimePanel() {
      return h('div', { class: `${panelClass} p-5` }, [
        h('div', { class: 'flex items-center justify-between gap-3' }, [
          h('div', [
            h('p', { class: labelClass }, 'Realtime'),
            h('h2', { class: 'm-0 mt-2 text-2xl font-black tracking-tight text-white' }, 'Actividad en vivo'),
          ]),
          h('span', { class: 'rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300' }, String(this.liveActivity.length)),
        ]),
        h('div', { class: 'mt-4 space-y-3' }, this.liveActivity.length
          ? this.liveActivity.map((item) => this.renderSignalItem(item))
          : [this.renderEmpty('Sin actividad operativa reciente.')]),
      ]);
    },
    renderSignalItem(item) {
      return h('div', { class: `rounded-2xl border px-4 py-3 ${reportTone[item.tone] || reportTone.info}`, key: item.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', { class: 'min-w-0' }, [
            h('p', { class: 'm-0 text-sm font-black text-current' }, item.title),
            item.detail ? h('p', { class: 'm-0 mt-1 text-sm text-current/90' }, item.detail) : null,
          ]),
          h('span', { class: 'rounded-full border border-current/15 bg-black/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-current' }, item.tone || 'info'),
        ]),
      ]);
    },
    renderEmpty(text) {
      return h('div', { class: 'rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center' }, [
        h('p', { class: 'm-0 text-sm font-semibold text-white' }, text),
      ]);
    },
    renderTask(task) {
      const reports = task.openReports || [];
      const buttons = [...this.saleButtons(task), ...this.taskButtons(task)];
      return h('li', { class: 'rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4 text-sm', key: task.taskId || task.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', { class: 'min-w-0' }, [
            h('div', { class: 'flex flex-wrap items-center gap-2' }, [
              h('span', { class: 'inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 text-xs text-slate-300' }, [
                h('i', { class: `fa-solid ${stageIcon[task.stage] || stageIcon.other}` }),
              ]),
              h('strong', { class: 'text-white' }, task.title),
              this.statusChip(task),
            ]),
            task.description ? h('span', { class: 'mt-2 block text-slate-300' }, task.description) : null,
            h('span', { class: 'block text-xs text-slate-500' },
              [task.customerName, task.employeeName, task.destination].filter(Boolean).join(' / ')),
            task.pendingCrates?.length
              ? h('span', { class: 'mt-3 block rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100' },
                `${task.pendingCrates.length} prestamo(s) de caja pendientes`)
              : null,
            reports.length
              ? h('div', { class: 'mt-3 space-y-2' }, reports.slice(0, 2).map((report) =>
                h('span', { class: 'block rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100', key: report.id },
                  report.summary)))
              : null,
          ]),
          h('div', { class: 'flex shrink-0 flex-col gap-2' }, buttons),
        ]),
      ]);
    },
    renderColumn(title, rows, accent) {
      return h('article', { class: `${panelClass} p-6 md:p-7` }, [
        h('div', { class: 'mb-6 flex items-end justify-between gap-3 border-b border-white/10 pb-5' }, [
          h('div', [
            h('h2', { class: `m-0 text-3xl font-black tracking-tight text-white ${accent}` }, title),
          ]),
          h('span', { class: 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300' }, String(rows.length)),
        ]),
        rows.length
          ? h('ul', { class: 'm-0 grid list-none gap-3 p-0' }, rows.map((task) => this.renderTask(task)))
          : h('div', { class: 'rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center' }, [
            h('p', { class: 'm-0 text-xl font-bold text-white' }, 'No hay tareas en esta etapa.'),
          ]),
      ]);
    },
    renderRouteSection() {
      return h('section', { class: `${panelClass} p-6 md:p-7` }, [
        h('div', { class: 'mb-6 flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between' }, [
          h('div', [
            h('h2', { class: 'm-0 mt-2 text-3xl font-black tracking-tight text-white' }, 'Ruta'),
          ]),
          h('div', { class: 'inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300' }, [
            h('span', { class: 'h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_14px_rgba(163,230,53,0.75)]' }),
            `${this.routes.length} frente(s)`,
          ]),
        ]),
        this.routes.length ? h('div', { class: 'space-y-6' }, this.routes.map((route) => this.renderRouteGroup(route))) : h('div', {
          class: 'rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center',
        }, [
          h('p', { class: 'm-0 text-xl font-bold text-white' }, 'No hay rutas activas.'),
          h('p', { class: 'm-0 mt-2 text-sm text-slate-400' }, 'Las tareas de entrega apareceran aqui en cuanto entren a esta etapa.'),
        ]),
      ]);
    },
    renderRouteGroup(route) {
      const presence = this.presenceRows.find((row) => row.employeeId === route.driverId || row.employeeName === route.driverName);
      return h('div', { class: 'rounded-[1.9rem] border border-white/10 bg-white/[0.03] p-5', key: route.driverId || route.driverName }, [
        h('div', { class: 'mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between' }, [
          h('div', { class: 'flex items-center gap-3' }, [
            h('div', { class: 'flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200' }, [
              h('i', { class: 'fa-solid fa-truck' }),
            ]),
            h('div', [
              h('p', { class: labelClass }, 'Responsable'),
              h('h3', { class: 'm-0 mt-1 text-2xl font-black tracking-tight text-white' }, route.driverName),
            ]),
          ]),
          h('div', { class: 'flex flex-wrap items-center gap-2' }, [
            presence ? h('span', { class: 'rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100' }, presence.lastSeenAt || presence.status) : null,
            h('span', { class: 'rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-100' }, `${route.tasks.length} tareas`),
            route.total ? h('span', { class: 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200' }, money(route.total)) : null,
            route.blocked ? h('span', { class: 'rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-black text-rose-100' }, `${route.blocked} bloqueo(s)`) : null,
            route.openReports ? h('span', { class: 'rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-100' }, `${route.openReports} reporte(s)`) : null,
          ]),
        ]),
        h('div', { class: 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3' }, route.tasks.map((task) => this.renderTask(task))),
      ]);
    },
  },
  render() {
    return h('section', { class: 'space-y-6' }, [
      this.renderHero(),
      h('section', { class: 'grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]' }, [
        this.renderAttentionPanel(),
        this.renderRealtimePanel(),
      ]),
      h('section', { class: 'grid grid-cols-1 gap-6 xl:grid-cols-2' }, [
        this.renderColumn('Empaque', this.columns.packing, 'text-amber-200'),
        this.renderColumn('Asignacion', this.columns.assignment, 'text-brand-200'),
      ]),
      this.renderRouteSection(),
    ]);
  },
};
</script>
