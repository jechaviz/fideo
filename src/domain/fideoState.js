const nowIso = () => new Date().toISOString();

export const createInitialState = () => ({
  workspace: {
    id: 'fideo-demo',
    slug: 'fideo-operacion',
    version: 1,
    mode: 'vue3-static-sfc',
  },
  employees: [
    { id: 'emp-admin', name: 'Admin Fideo', role: 'Admin', status: 'active' },
    { id: 'emp-pack', name: 'Empaque Norte', role: 'Empacador', status: 'active' },
    { id: 'emp-route', name: 'Ruta Centro', role: 'Repartidor', status: 'idle' },
  ],
  customers: [
    { id: 'cus-lupita', name: 'Fruteria Lupita', creditStatus: 'Confiable' },
    { id: 'cus-mercado', name: 'Mercado Central', creditStatus: 'Vigilar' },
  ],
  suppliers: [
    { id: 'sup-huerta', name: 'Huerta del Sur', contact: 'WhatsApp proveedor' },
  ],
  inventory: [
    { id: 'inv-1', product: 'Mango Ataulfo', quality: 'Normal', state: 'Maduro', quantity: 82 },
    { id: 'inv-2', product: 'Platano Chiapas', quality: 'Normal', state: 'Entrado', quantity: 44 },
    { id: 'inv-3', product: 'Papaya Maradol', quality: 'Con Defectos', state: 'Suave', quantity: 18 },
  ],
  sales: [
    {
      id: 'sale-1',
      customerId: 'cus-lupita',
      customer: 'Fruteria Lupita',
      product: 'Mango Ataulfo',
      quantity: 24,
      total: 11280,
      status: 'Pendiente de Empaque',
      paymentStatus: 'Pendiente',
      assignedEmployeeId: 'emp-pack',
    },
    {
      id: 'sale-2',
      customerId: 'cus-mercado',
      customer: 'Mercado Central',
      product: 'Platano Chiapas',
      quantity: 30,
      total: 9300,
      status: 'En Ruta',
      paymentStatus: 'Parcial',
      assignedEmployeeId: 'emp-route',
    },
  ],
  taskAssignments: [
    {
      id: 'task-pack-sale-1',
      taskId: 'pack-sale-1',
      saleId: 'sale-1',
      title: 'Empacar venta Fruteria Lupita',
      role: 'Empacador',
      employeeId: 'emp-pack',
      employeeName: 'Empaque Norte',
      status: 'assigned',
      createdAt: nowIso(),
    },
    {
      id: 'task-route-sale-2',
      taskId: 'route-sale-2',
      saleId: 'sale-2',
      title: 'Confirmar entrega Mercado Central',
      role: 'Repartidor',
      employeeId: 'emp-route',
      employeeName: 'Ruta Centro',
      status: 'blocked',
      blockedReason: 'Cliente pidio cambio de horario',
      createdAt: nowIso(),
    },
  ],
  taskReports: [
    {
      id: 'report-route-sale-2',
      taskId: 'route-sale-2',
      kind: 'blocker',
      status: 'open',
      severity: 'high',
      summary: 'Cambio de horario sin confirmar',
      createdAt: nowIso(),
      employeeId: 'emp-route',
      employeeName: 'Ruta Centro',
    },
  ],
  activityLog: [],
  integrations: {
    pocketbase: { status: 'pending', label: 'PocketBase snapshot runtime' },
    veeper: { status: 'pending', label: 'Veeper WhatsApp handoff' },
    ai: { status: 'dry-run', label: 'codex-goal AI engines' },
  },
});

export const deriveMetrics = (state) => {
  const openReports = state.taskReports.filter((report) => report.status !== 'resolved');
  const totalSales = state.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const inventoryUnits = state.inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return {
    openExceptions: openReports.length,
    totalSales,
    inventoryUnits,
    activeStaff: state.employees.filter((employee) => employee.status === 'active').length,
  };
};

export const buildExceptionQueue = (state) =>
  state.taskReports
    .filter((report) => report.status !== 'resolved')
    .map((report) => {
      const task = state.taskAssignments.find((item) => item.taskId === report.taskId);
      return {
        id: `task_report:${report.id}`,
        kind: 'task_blocked',
        severity: report.severity || 'normal',
        title: report.summary || task?.title || 'Excepcion operativa',
        detail: task?.blockedReason || report.detail || 'Requiere seguimiento.',
        taskId: report.taskId,
        reportId: report.id,
        employeeId: report.employeeId || task?.employeeId || null,
        employeeName: report.employeeName || task?.employeeName || null,
        createdAt: report.createdAt,
      };
    });

