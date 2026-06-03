<template>
  <aside class="fideo-sidebar-placeholder">Fideo sidebar</aside>
</template>

<script>
const { h } = Vue;

const adminNavConfig = [
  {
    title: 'Daily',
    items: [
      { id: 'dashboard', label: 'Ops', short: 'OP' },
      { id: 'actions', label: 'Acciones', short: 'AC' },
      { id: 'deliveries', label: 'Ruta', short: 'RT' },
      { id: 'messages', label: 'Mensajes', short: 'MS' },
      { id: 'inventory', label: 'Stock', short: 'ST' },
    ],
  },
  {
    title: 'More',
    items: [
      { id: 'customers', label: 'Clientes', short: 'CL' },
      { id: 'suppliers', label: 'Proveedores', short: 'PR' },
      { id: 'planogram', label: 'Mapa', short: 'MP' },
      { id: 'finances', label: 'Finanzas', short: 'FN' },
      { id: 'salesLog', label: 'Ventas', short: 'VT' },
      { id: 'history', label: 'Historial', short: 'HS' },
      { id: 'ripening', label: 'Maduracion', short: 'MD' },
      { id: 'assets', label: 'Activos', short: 'AT' },
      { id: 'training', label: 'IA', short: 'IA' },
    ],
  },
  {
    title: 'Settings',
    items: [{ id: 'settings', label: 'Ajustes', short: 'AJ' }],
  },
];

const packerNavConfig = [
  { title: 'Empaque', items: [{ id: 'deliveries', label: 'Pedidos', short: 'PD' }] },
];

const delivererNavConfig = [
  { title: 'Ruta', items: [{ id: 'deliveries', label: 'Mis Entregas', short: 'ME' }] },
];

export default {
  name: 'FideoShellSidebar',
  props: {
    currentRole: { type: String, required: true },
    currentView: { type: String, required: true },
    identity: { type: Object, default: null },
    isCollapsed: { type: Boolean, default: true },
    isOpen: { type: Boolean, default: false },
    metrics: { type: Object, default: null },
  },
  emits: ['select-view', 'close', 'toggle-collapse'],
  data() {
    return {
      openSections: {
        Daily: true,
        More: false,
        Settings: true,
        Empaque: true,
        Ruta: true,
      },
    };
  },
  computed: {
    navConfig() {
      if (this.currentRole === 'Empacador') return packerNavConfig;
      if (this.currentRole === 'Repartidor') return delivererNavConfig;
      return adminNavConfig;
    },
  },
  methods: {
    selectView(view) {
      this.$emit('select-view', view);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        this.$emit('close');
      }
    },
    toggleSection(title, collapsed) {
      if (collapsed && title !== 'More') return;
      this.openSections = { ...this.openSections, [title]: !this.openSections[title] };
    },
    sectionIsOpen(section, collapsed) {
      return Boolean(this.openSections[section.title] || (collapsed && section.title !== 'More'));
    },
    renderBrand(collapsed) {
      return h('div', {
        class: `relative flex min-h-[58px] items-center border-b border-white/[0.08] ${
          collapsed ? 'justify-center px-3 py-3' : 'justify-between px-3.5 py-3'
        }`,
      }, [
        h('div', { class: `flex min-w-0 ${collapsed ? 'flex-col items-center gap-2' : 'items-center gap-3'}` }, [
          h('div', {
            class: 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-300 text-base font-black text-slate-950',
            title: 'Fideo',
          }, 'F'),
          collapsed ? null : h('div', { class: 'min-w-0' }, [
            h('p', { class: 'm-0 truncate text-sm font-black tracking-tight text-white' }, 'Fideo'),
            h('span', { class: 'block truncate text-[11px] font-semibold text-slate-500' },
              this.identity?.primaryLabel || 'Operacion'),
          ]),
        ]),
        collapsed ? null : h('button', {
          class: 'focus-ring flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-400 md:hidden',
          type: 'button',
          'aria-label': 'Cerrar menu',
          onClick: () => this.$emit('close'),
        }, 'x'),
      ]);
    },
    renderSection(section, collapsed) {
      const isOpen = this.sectionIsOpen(section, collapsed);
      const header = collapsed
        ? this.renderCollapsedSectionHeader(section)
        : h('button', {
          class: 'mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[10px] font-black uppercase text-slate-500 hover:bg-white/5 hover:text-slate-300',
          type: 'button',
          'aria-label': section.title === 'More' ? 'Abrir More' : `Seccion ${section.title}`,
          onClick: () => this.toggleSection(section.title, collapsed),
        }, [
          h('span', section.title),
          h('span', { class: 'text-xs' }, this.openSections[section.title] ? 'v' : '>'),
        ]);

      return h('div', { class: 'mb-2.5', key: section.title }, [
        header,
        isOpen ? h('ul', {
          class: `m-0 list-none p-0 ${collapsed ? 'flex flex-col items-center gap-1' : 'mt-1 space-y-1'}`,
        }, section.items.map((item) => this.renderNavItem(item, collapsed))) : null,
      ]);
    },
    renderCollapsedSectionHeader(section) {
      if (section.title === 'More') {
        return h('button', {
          class: `mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-md text-sm font-black ${
            this.openSections.More ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
          }`,
          type: 'button',
          title: 'More',
          'aria-label': 'Abrir More',
          onClick: () => this.toggleSection(section.title, true),
        }, '...');
      }
      return h('div', { class: 'mx-auto my-2 h-px w-8 bg-white/10', title: section.title });
    },
    renderNavItem(item, collapsed) {
      const active = this.currentView === item.id;
      return h('li', { class: 'w-full', key: item.id }, [
        h('button', {
          class: `group relative flex w-full items-center rounded-md px-3 py-2 transition-all duration-200 ${
            active ? 'bg-lime-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
          } ${collapsed ? 'justify-center' : 'text-left'}`,
          type: 'button',
          title: collapsed ? item.label : '',
          'aria-label': item.label,
          onClick: () => this.selectView(item.id),
        }, [
          h('span', {
            class: `nav-icon-box ${collapsed ? '' : 'mr-3'} ${active ? 'bg-slate-950/10' : 'bg-white/5'}`,
          }, item.short),
          collapsed ? this.renderTooltip(item.label) : h('span', {
            class: 'block min-w-0 flex-1 truncate text-sm font-bold',
          }, item.label),
        ]),
      ]);
    },
    renderTooltip(label) {
      return h('span', {
        class: 'sidebar-tooltip pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100',
      }, label);
    },
    renderFooter(collapsed) {
      return h('div', { class: 'relative mt-auto border-t border-white/[0.08] p-2.5' }, [
        h('div', {
          class: `rounded-md border border-white/[0.08] bg-slate-900/70 p-2 ${collapsed ? 'grid gap-2' : 'space-y-2'}`,
        }, [
          collapsed ? null : h('div', { class: 'text-[11px] text-slate-400' }, [
            h('strong', { class: 'block text-slate-200' }, this.identity?.primaryLabel || this.currentRole),
            h('span', this.identity?.secondaryLabel || `${this.metrics?.openExceptions || 0} excepciones abiertas`),
          ]),
          h('button', {
            class: 'focus-ring hidden h-10 items-center justify-center rounded-md bg-white/5 px-3 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white md:flex',
            type: 'button',
            title: collapsed ? 'Expandir menu' : 'Colapsar menu',
            onClick: () => this.$emit('toggle-collapse'),
          }, [
            h('span', collapsed ? '>' : '<'),
            collapsed ? null : h('span', { class: 'ml-2' }, 'Colapsar'),
          ]),
        ]),
      ]);
    },
    renderContent(collapsed) {
      return h('aside', {
        class: `${collapsed ? 'w-[5.25rem]' : 'w-[17.5rem]'} relative flex h-full flex-col overflow-hidden border-r border-white/[0.08] bg-[#040916]/92 text-slate-200 shadow-panel backdrop-blur-2xl transition-all duration-300 ease-in-out`,
      }, [
        this.renderBrand(collapsed),
        h('nav', { class: 'flex-1 overflow-y-auto overflow-x-hidden px-2 py-3' },
          this.navConfig.map((section) => this.renderSection(section, collapsed))),
        this.renderFooter(collapsed),
      ]);
    },
  },
  render() {
    return h(Vue.Fragment, [
      h('div', {
        class: `fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity md:hidden ${
          this.isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`,
        onClick: () => this.$emit('close'),
      }),
      h('div', {
        class: `fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out md:hidden ${
          this.isOpen ? 'translate-x-0' : '-translate-x-full'
        }`,
      }, [this.renderContent(false)]),
      h('div', { class: 'hidden h-full shrink-0 md:flex' }, [this.renderContent(this.isCollapsed)]),
    ]);
  },
};
</script>
