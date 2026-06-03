<template>
  <section class="fideo-role-switcher-placeholder">Roles Fideo</section>
</template>

<script>
const { h } = Vue;

const roleItems = [
  { id: 'Admin', label: 'Admin', detail: 'Control total' },
  { id: 'Cajero', label: 'Caja', detail: 'Cobro y corte' },
  { id: 'Empacador', label: 'Empaque', detail: 'Pedidos listos' },
  { id: 'Repartidor', label: 'Ruta', detail: 'Entregas vivas' },
  { id: 'Cliente', label: 'Cliente', detail: 'Portal compras' },
  { id: 'Proveedor', label: 'Proveedor', detail: 'Abasto' },
];

const toneClass = {
  live: 'border-emerald-400/30 bg-emerald-300/10 text-emerald-100',
  warning: 'border-amber-400/30 bg-amber-300/10 text-amber-100',
  offline: 'border-rose-400/30 bg-rose-300/10 text-rose-100',
  idle: 'border-slate-400/30 bg-slate-300/10 text-slate-100',
};

export default {
  name: 'FideoRoleSwitcher',
  props: {
    currentRole: { type: String, required: true },
    identity: { type: Object, default: null },
    metrics: { type: Object, default: null },
    receipts: { type: Array, default: () => [] },
    runtimeGates: { type: Array, default: () => [] },
    signals: { type: Array, default: () => [] },
    theme: { type: String, default: 'dark' },
  },
  emits: ['select-role', 'inspect', 'toggle-theme'],
  computed: {
    statusSignals() {
      if (this.signals.length) return this.signals;
      return [
        {
          id: 'exceptions',
          label: `${this.metrics?.openExceptions || 0} exc`,
          tone: this.metrics?.openExceptions ? 'warning' : 'live',
        },
        {
          id: 'receipts',
          label: `${this.receipts.length} acuses`,
          tone: this.receipts.length ? 'live' : 'idle',
        },
      ];
    },
  },
  methods: {
    renderSignal(signal) {
      return h('span', {
        class: `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-black ${
          toneClass[signal.tone] || toneClass.idle
        }`,
        key: signal.id,
      }, [
        h('span', { class: 'h-1.5 w-1.5 rounded-full bg-current opacity-80' }),
        h('span', signal.label),
      ]);
    },
    renderRoleButton(role) {
      const active = role.id === this.currentRole;
      return h('button', {
        class: `focus-ring rounded-md border px-3 py-2 text-left transition ${
          active
            ? 'border-lime-300/50 bg-lime-300 text-slate-950'
            : 'border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/10 hover:text-white'
        }`,
        type: 'button',
        'aria-label': `Cambiar a ${role.id}`,
        onClick: () => this.$emit('select-role', role.id),
        key: role.id,
      }, [
        h('span', { class: 'block text-sm font-black' }, role.label),
        h('span', { class: `block text-[11px] font-semibold ${active ? 'text-slate-700' : 'text-slate-500'}` }, role.detail),
      ]);
    },
  },
  render() {
    return h('section', { class: 'grid gap-3' }, [
      h('div', { class: 'flex flex-wrap items-center justify-between gap-2' }, [
        h('div', { class: 'min-w-0' }, [
          h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.24em] text-lime-200' }, 'Sesion'),
          h('strong', { class: 'block truncate text-sm text-white' },
            this.identity?.primaryLabel || `Fideo ${this.currentRole}`),
          this.identity?.secondaryLabel
            ? h('span', { class: 'block truncate text-xs text-slate-500' }, this.identity.secondaryLabel)
            : null,
        ]),
        h('div', { class: 'flex flex-wrap justify-end gap-1.5' },
          this.statusSignals.slice(0, 4).map((signal) => this.renderSignal(signal))),
      ]),
      h('div', { class: 'grid gap-2 sm:grid-cols-3' }, roleItems.map((role) => this.renderRoleButton(role))),
      h('div', { class: 'flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2' }, [
        h('button', {
          class: 'focus-ring rounded-md border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black text-slate-300 hover:bg-white/10 hover:text-white',
          type: 'button',
          onClick: () => this.$emit('toggle-theme'),
        }, this.theme === 'light' ? 'Oscuro' : 'Claro'),
        h('button', {
          class: 'focus-ring rounded-md bg-sky-300 px-3 py-2 text-xs font-black text-slate-950',
          type: 'button',
          onClick: () => this.$emit('inspect'),
        }, 'Inspeccionar integraciones'),
      ]),
    ]);
  },
};
</script>
