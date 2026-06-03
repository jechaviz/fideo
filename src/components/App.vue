<template>
  <main class="fideo-app-placeholder">Fideo</main>
</template>

<script>
const { h, inject, resolveComponent } = Vue;

const internalRoles = ['Admin', 'Cajero', 'Empacador', 'Repartidor'];
const roleLabels = {
  Admin: 'Admin',
  Cajero: 'Caja',
  Empacador: 'Empaque',
  Repartidor: 'Ruta',
  Cliente: 'Cliente',
  Proveedor: 'Proveedor',
};
const viewTitles = {
  dashboard: 'Centro Comercial',
  actions: 'Acciones',
  inventory: 'Inventario',
  customers: 'Clientes',
  deliveries: 'Entregas',
  finances: 'Finanzas',
  messages: 'Mensajes',
  suppliers: 'Proveedores',
  planogram: 'Planograma',
  ripening: 'Maduracion',
  history: 'Historial',
  assets: 'Activos',
  training: 'IA',
  salesLog: 'Ventas',
  settings: 'Ajustes',
};
const defaultViewByRole = {
  Admin: 'dashboard',
  Cajero: 'dashboard',
  Empacador: 'deliveries',
  Repartidor: 'deliveries',
  Cliente: 'portal',
  Proveedor: 'portal',
};

export default {
  name: 'FideoVueApp',
  setup() {
    const kernel = inject('kernel');
    return {
      actions: kernel.actions,
      exceptions: kernel.exceptionQueue,
      metrics: kernel.metrics,
      pocketbaseRoutes: kernel.pocketbaseRoutes,
      receipts: kernel.receipts,
      runtimeGates: kernel.runtimeGates,
      state: kernel.state,
    };
  },
  data() {
    return {
      currentRole: 'Admin',
      currentView: 'dashboard',
      isMoreOpen: false,
      isSidebarOpen: false,
      isSidebarCollapsed: typeof window === 'undefined' ? true : window.innerWidth >= 768,
      theme: 'dark',
    };
  },
  computed: {
    isInternalRole() {
      return internalRoles.includes(this.currentRole);
    },
    roleLabel() {
      return roleLabels[this.currentRole] || this.currentRole;
    },
    viewTitle() {
      return viewTitles[this.currentView] || 'Fideo';
    },
    identity() {
      if (this.currentRole === 'Cliente') {
        const customer = this.state.customers[0];
        return customer ? {
          primaryLabel: customer.name,
          secondaryLabel: 'Portal cliente',
          customerId: customer.id,
        } : null;
      }
      if (this.currentRole === 'Proveedor') {
        const supplier = this.state.suppliers[0];
        return supplier ? {
          primaryLabel: supplier.name,
          secondaryLabel: supplier.contact,
          supplierId: supplier.id,
        } : null;
      }
      const employee = this.state.employees.find((item) => item.role === this.currentRole)
        || this.state.employees[0];
      return employee ? {
        primaryLabel: employee.name,
        secondaryLabel: `${employee.role} activo`,
        employeeId: employee.id,
      } : null;
    },
    headerSignals() {
      return [
        {
          id: 'runtime',
          label: 'Local',
          tone: 'neutral',
        },
      ];
    },
  },
  methods: {
    setRole(role) {
      this.currentRole = role;
      this.currentView = defaultViewByRole[role] || 'dashboard';
      this.isMoreOpen = false;
      this.isSidebarOpen = false;
    },
    setView(view) {
      this.currentView = view;
      this.isMoreOpen = false;
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('light', this.theme === 'light');
    },
    board(name, props = {}) {
      const Component = resolveComponent(name);
      return h(Component, props);
    },
    deliveryProps() {
      return {
        state: this.state,
        onPackSale: this.actions.packSale,
        onRouteSale: this.actions.routeSale,
        onCompleteSale: this.actions.completeSale,
        onAckTask: this.actions.ackTask,
        onStartTask: this.actions.startTask,
        onBlockTask: this.actions.blockTask,
        onCompleteTask: this.actions.completeTask,
        onNoteTask: this.actions.noteTask,
        onIncidentTask: this.actions.incidentTask,
        onPingPresence: this.actions.pingDeliveryPresence,
        onPausePresence: this.actions.pauseDeliveryPresence,
        onRecordReportReceipt: this.actions.recordDeliveryReportReceipt,
      };
    },
    inventoryProps() {
      return {
        state: this.state,
        onMoveLocation: this.actions.moveBatchLocation,
        onTransferWarehouse: this.actions.transferWarehouse,
        onAdjustBatch: this.actions.adjustBatch,
        onRaisePrice: this.actions.raiseBatchPrice,
      };
    },
    catalogProps() {
      return {
        state: this.state,
        onAddWarehouse: this.actions.addCatalogWarehouse,
        onRenameWarehouse: this.actions.renameCatalogWarehouse,
        onCycleWarehouseIcon: this.actions.cycleCatalogWarehouseIcon,
        onToggleWarehouse: this.actions.toggleCatalogWarehouse,
        onAddSize: this.actions.addCatalogSize,
        onRenameSize: this.actions.renameCatalogSize,
        onCycleSizeIcon: this.actions.cycleCatalogSizeIcon,
        onToggleSize: this.actions.toggleCatalogSize,
        onCycleGroupIcon: this.actions.cycleCatalogGroupIcon,
        onToggleGroup: this.actions.toggleCatalogGroup,
        onCycleVarietyIcon: this.actions.cycleCatalogVarietyIcon,
        onIncreaseRipening: this.actions.increaseRipeningRule,
        onResetRipening: this.actions.resetRipeningRule,
      };
    },
    commerceProps() {
      return {
        state: this.state,
        onReturnCrate: this.actions.returnCrate,
        onMarkCrateLost: this.actions.markCrateLost,
        onReceiveOrder: this.actions.receiveOrder,
        onCreateDemoOrder: this.actions.createDemoOrder,
        onToggleDrawer: this.actions.toggleDrawer,
        onAddExpense: this.actions.addExpense,
      };
    },
    financeProps() {
      return {
        state: this.state,
        onToggleDrawer: this.actions.toggleDrawer,
        onCashDeposit: this.actions.cashDeposit,
        onCashWithdraw: this.actions.cashWithdraw,
        onSellCrateAsset: this.actions.sellCrateAsset,
        onAddExpense: this.actions.addExpense,
        onCreateFinanceExport: this.actions.createFinanceExport,
        onRecordCashReceipt: this.actions.recordCashReceipt,
      };
    },
    supplierProps() {
      return {
        state: this.state,
        onCreateDemoOrder: this.actions.createDemoOrder,
        onOrderPurchaseOrder: this.actions.orderPurchaseOrder,
        onReceiveOrder: this.actions.receiveOrder,
        onRepriceOrder: this.actions.repricePurchaseOrder,
        onRaiseSupplierCost: this.actions.raiseSupplierCost,
        onRenameSupplier: this.actions.renameSupplier,
        onRefreshSupplierContact: this.actions.refreshSupplierContact,
        onRecordPurchaseReceipt: this.actions.recordPurchaseReceipt,
      };
    },
    messageProps() {
      return {
        state: this.state,
        onAddMessage: this.actions.addDemoMessage,
        onInterpretMessage: this.actions.interpretMessage,
        onApproveMessage: this.actions.approveMessage,
        onRevertMessage: this.actions.revertMessage,
        onSendPromotion: this.actions.sendPromotion,
        onBindPush: this.actions.bindPush,
      };
    },
    messageAiProps() {
      return {
        state: this.state,
        onCorrectMessage: this.actions.correctMessage,
        onTrainAi: this.actions.trainAi,
        onSendCampaign: this.actions.sendCampaignDraft,
        onUpdateTemplate: this.actions.updateTemplate,
        onRecordProviderReceipt: this.actions.recordProviderReceipt,
      };
    },
    runtimeProps() {
      return {
        gates: this.runtimeGates,
        pocketbaseRoutes: this.pocketbaseRoutes,
        receipts: this.receipts,
        onBootstrapPocketbase: this.actions.bootstrapPocketBase,
        onPersistSnapshot: this.actions.persistSnapshot,
        onPresencePing: this.actions.presencePing,
        onPlanRealtime: this.actions.planRealtime,
        onPlanAi: this.actions.planAi,
      };
    },
    assetProps() {
      return {
        state: this.state,
        pocketbaseRoutes: this.pocketbaseRoutes,
        onAddAsset: this.actions.addDemoAsset,
        onMaintainAsset: this.actions.maintainAsset,
        onAckTask: this.actions.ackTask,
        onStartTask: this.actions.startTask,
        onBlockTask: this.actions.blockTask,
        onCompleteTask: this.actions.completeTask,
      };
    },
    signalBadge(signal) {
      const tone = {
        live: 'border-emerald-400/30 bg-emerald-300/10 text-emerald-100',
        warning: 'border-amber-400/30 bg-amber-300/10 text-amber-100',
        offline: 'border-rose-400/30 bg-rose-300/10 text-rose-100',
        idle: 'border-slate-400/30 bg-slate-300/10 text-slate-100',
        neutral: 'border-white/10 bg-white/5 text-slate-200',
      }[signal.tone] || 'border-slate-400/30 bg-slate-300/10 text-slate-100';
      return h('span', {
        class: `fideo-signal-badge inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`,
        key: signal.id,
      }, [
        h('span', { class: signal.tone === 'neutral' ? 'h-2 w-2 rounded-full bg-slate-400' : 'h-2 w-2 rounded-full bg-current opacity-80' }),
        h('span', { class: 'truncate' }, signal.label),
      ]);
    },
    renderHeader() {
      const FideoRoleSwitcher = resolveComponent('FideoRoleSwitcher');
      return h('header', {
        class: 'sticky top-0 z-20 border-b border-white/[0.08] bg-[#0d1117]/95 backdrop-blur-xl',
      }, [
        h('div', { class: 'mx-auto flex h-12 max-w-[1500px] items-center gap-2 px-3 md:px-4 lg:px-5' }, [
          h('button', {
            class: 'focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 md:hidden',
            type: 'button',
            'aria-label': 'Abrir menu',
            onClick: () => { this.isSidebarOpen = true; },
          }, [h('i', { class: 'fa-solid fa-bars' })]),
          h('div', { class: 'flex min-w-0 flex-1 items-center gap-2' }, [
            h('span', {
              class: 'fideo-role-badge inline-flex items-center gap-1.5 rounded-md border border-brand-400/20 bg-brand-400/10 px-2 py-1 text-[11px] font-black text-brand-200',
            }, [
              h('span', { class: 'h-1.5 w-1.5 rounded-full bg-brand-400' }),
              this.roleLabel,
            ]),
            h('h1', { class: 'm-0 truncate text-sm font-black text-white md:text-base' }, this.viewTitle),
            h('div', { class: 'hidden min-w-0 items-center gap-1.5 lg:flex' },
              this.headerSignals.map((signal) => this.signalBadge(signal))),
          ]),
          h('button', {
            class: `focus-ring flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition ${
              this.isMoreOpen
                ? 'border-brand-400/35 bg-brand-400/10 text-brand-100'
                : 'border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/10 hover:text-white'
            }`,
            type: 'button',
            'aria-expanded': String(this.isMoreOpen),
            'aria-label': 'Abrir More global',
            onClick: () => { this.isMoreOpen = !this.isMoreOpen; },
          }, [
            h('i', { class: 'fa-solid fa-ellipsis' }),
            h('span', { class: 'hidden sm:inline' }, 'More'),
          ]),
        ]),
        this.isMoreOpen ? h('div', {
          class: 'absolute right-3 top-[calc(100%+8px)] z-30 w-[min(94vw,560px)] rounded-lg border border-white/10 bg-[#161b22] p-3 shadow-2xl',
        }, [
          h(FideoRoleSwitcher, {
            currentRole: this.currentRole,
            identity: this.identity,
            metrics: this.metrics,
            receipts: this.receipts,
            runtimeGates: this.runtimeGates,
            signals: this.headerSignals,
            theme: this.theme,
            onSelectRole: this.setRole,
            onInspect: this.actions.inspectIntegrations,
            onToggleTheme: this.toggleTheme,
          }),
          this.receipts.length ? h('ul', {
            class: 'm-0 mt-3 grid max-h-28 list-none gap-2 overflow-hidden border-t border-white/10 p-0 pt-3',
          }, this.receipts.slice(0, 3).map((receipt) => h('li', {
            class: 'truncate rounded-md bg-slate-950/45 px-3 py-2 text-xs text-slate-300',
            key: receipt.id,
          }, `${receipt.kind || 'receipt'}: ${receipt.status || 'ok'} - ${receipt.message || receipt.kind}`))) : null,
        ]) : null,
      ]);
    },
    renderDashboard() {
      const ActionCenterPanel = resolveComponent('ActionCenterPanel');
      const IntegrationHealth = resolveComponent('IntegrationHealth');
      return [
        this.board('MetricStrip', { metrics: this.metrics }),
        h('section', { class: 'mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]' }, [
          h(ActionCenterPanel, {
            exceptions: this.exceptions,
            employees: this.state.employees,
            onFollowUp: this.actions.followUp,
            onResolve: this.actions.resolve,
            onReassign: this.actions.reassign,
          }),
          h(IntegrationHealth, {
            integrations: this.state.integrations,
            receipts: this.receipts,
          }),
        ]),
        this.board('RolePipelineAuditBoard', { state: this.state }),
        this.board('DomainBoard', {
          state: this.state,
          onAdvanceBatch: this.actions.advanceBatch,
          onMarkWaste: this.actions.markWaste,
          onPackSale: this.actions.packSale,
          onRouteSale: this.actions.routeSale,
          onCompleteSale: this.actions.completeSale,
        }),
      ];
    },
    renderInternalView() {
      if (this.currentRole === 'Empacador' || this.currentRole === 'Repartidor') {
        return [this.renderRoleHero(), this.board('DeliveryOpsBoard', this.deliveryProps())];
      }
      const views = {
        dashboard: () => this.renderDashboard(),
        actions: () => [
          this.board('RolePipelineAuditBoard', { state: this.state }),
          this.board('ActionCenterPanel', {
            exceptions: this.exceptions,
            employees: this.state.employees,
            onFollowUp: this.actions.followUp,
            onResolve: this.actions.resolve,
            onReassign: this.actions.reassign,
          }),
        ],
        deliveries: () => [this.board('DeliveryOpsBoard', this.deliveryProps())],
        messages: () => [this.board('MessageBoard', this.messageProps()), this.board('MessageAiOpsBoard', this.messageAiProps())],
        inventory: () => [this.board('InventoryOpsBoard', this.inventoryProps()), this.board('DomainBoard', {
          state: this.state,
          onAdvanceBatch: this.actions.advanceBatch,
          onMarkWaste: this.actions.markWaste,
          onPackSale: this.actions.packSale,
          onRouteSale: this.actions.routeSale,
          onCompleteSale: this.actions.completeSale,
        })],
        customers: () => [this.board('CommerceBoard', this.commerceProps())],
        suppliers: () => [this.board('SupplierOpsBoard', this.supplierProps())],
        planogram: () => [this.board('PortalAssetBoard', this.assetProps())],
        finances: () => [this.board('FinanceOpsBoard', this.financeProps())],
        salesLog: () => [this.board('CommerceBoard', this.commerceProps()), this.board('FinanceOpsBoard', this.financeProps())],
        history: () => [this.board('IntegrationHealth', { integrations: this.state.integrations, receipts: this.receipts }), this.board('RuntimeGateBoard', this.runtimeProps())],
        ripening: () => [this.board('CatalogAdminBoard', this.catalogProps())],
        assets: () => [this.board('PortalAssetBoard', this.assetProps())],
        training: () => [this.board('MessageAiOpsBoard', this.messageAiProps()), this.board('RuntimeGateBoard', this.runtimeProps())],
        settings: () => [this.board('RuntimeGateBoard', this.runtimeProps()), this.board('IntegrationHealth', { integrations: this.state.integrations, receipts: this.receipts })],
      };
      return (views[this.currentView] || views.dashboard)();
    },
    renderRoleHero() {
      const label = this.currentRole === 'Empacador' ? 'Mesa de empaque' : 'Mesa de ruta';
      const detail = this.currentRole === 'Empacador'
        ? 'Pedidos, incidencias y cierre de empaque.'
        : 'Entregas, presencia y reportes de calle.';
      return h('section', { class: 'surface p-4' }, [
        h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.24em] text-lime-200' }, label),
        h('h2', { class: 'm-0 mt-2 text-2xl font-black text-white' }, this.identity?.primaryLabel || this.currentRole),
        h('p', { class: 'm-0 mt-2 max-w-2xl text-sm text-slate-300' }, detail),
      ]);
    },
    renderInternalShell() {
      const FideoShellSidebar = resolveComponent('FideoShellSidebar');
      const VoiceControl = resolveComponent('VoiceControl');
      return h('div', { class: 'fideo-shell relative flex h-screen overflow-hidden bg-[#030712] text-slate-100' }, [
        h('div', { class: 'fideo-ambient pointer-events-none absolute inset-0' }),
        h('div', { class: 'noise-overlay pointer-events-none absolute inset-0' }),
        h('a', {
          class: 'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-2xl focus:bg-brand-400 focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-slate-950',
          href: '#main-content',
        }, 'Saltar al contenido'),
        h(FideoShellSidebar, {
          currentRole: this.currentRole,
          currentView: this.currentView,
          identity: this.identity,
          isCollapsed: this.isSidebarCollapsed,
          isOpen: this.isSidebarOpen,
          metrics: this.metrics,
          onSelectView: this.setView,
          onClose: () => { this.isSidebarOpen = false; },
          onToggleCollapse: () => { this.isSidebarCollapsed = !this.isSidebarCollapsed; },
        }),
        h('main', { class: 'fideo-main-stage relative flex h-full min-w-0 flex-1 flex-col overflow-hidden' }, [
          this.renderHeader(),
          h('div', { class: 'fideo-main-scroll flex-grow overflow-y-auto scroll-smooth' }, [
            h('div', {
              id: 'main-content',
              class: 'fideo-main-content mx-auto w-full max-w-[1500px] px-3 py-3 md:px-4 lg:px-5',
            }, this.renderInternalView()),
          ]),
        ]),
        h(VoiceControl, {
          onVoiceMessage: this.actions.addVoiceMessage,
        }),
      ]);
    },
    renderPortalShell() {
      const FideoRoleSwitcher = resolveComponent('FideoRoleSwitcher');
      return h('div', { class: 'min-h-screen bg-slate-950 text-slate-100' }, [
        h('div', { class: 'portal-ambient pointer-events-none fixed inset-0' }),
        h('header', { class: 'sticky top-0 z-20 border-b border-white/10 bg-slate-950/72 backdrop-blur-2xl' }, [
          h('div', { class: 'mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8' }, [
            h('div', [
              h('p', { class: 'm-0 text-[10px] font-black uppercase tracking-[0.32em] text-lime-200' }, 'Portal'),
              h('div', { class: 'mt-2 flex flex-wrap items-center gap-3' }, [
                h('h1', { class: 'm-0 text-2xl font-black tracking-tight text-white' }, `Fideo ${this.currentRole}`),
                this.identity ? h('span', {
                  class: 'inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200',
                  title: this.identity.secondaryLabel || this.identity.primaryLabel,
                }, [
                  h('span', { class: 'h-2 w-2 rounded-full bg-sky-300/90' }),
                  h('span', { class: 'max-w-[220px] truncate' }, this.identity.primaryLabel),
                ]) : null,
                ...this.headerSignals.map((signal) => this.signalBadge(signal)),
              ]),
            ]),
            h('div', { class: 'w-full sm:w-auto sm:min-w-[520px]' }, [
              h(FideoRoleSwitcher, {
                currentRole: this.currentRole,
                identity: this.identity,
                metrics: this.metrics,
                receipts: this.receipts,
                signals: this.headerSignals,
                theme: this.theme,
                onSelectRole: this.setRole,
                onInspect: this.actions.inspectIntegrations,
                onToggleTheme: this.toggleTheme,
              }),
            ]),
          ]),
        ]),
        h('main', { class: 'relative' }, [
          h('div', { class: 'mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8' }, [
            h('div', { class: 'glass-panel-dark grid gap-4 rounded-lg p-4 md:p-6' },
              this.currentRole === 'Cliente'
                ? [this.board('FideoCustomerPortal', { state: this.state })]
                : [this.board('FideoSupplierPortal', { state: this.state })]),
          ]),
        ]),
      ]);
    },
  },
  render() {
    return this.isInternalRole ? this.renderInternalShell() : this.renderPortalShell();
  },
};
</script>
