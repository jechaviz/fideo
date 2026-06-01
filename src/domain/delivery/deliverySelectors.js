import { findCustomerForSale, loanBelongsToCustomer } from '../customers/customerLedger.js';

const stageByKind = {
  PACK_ORDER: 'packing',
  ASSIGN_DELIVERY: 'assignment',
  DELIVER_ORDER: 'route',
};

const stageLabel = {
  packing: 'Empaque',
  assignment: 'Asignacion',
  route: 'Ruta',
  other: 'Operacion',
};

const statusRank = {
  blocked: 0,
  assigned: 1,
  acknowledged: 2,
  in_progress: 3,
  done: 4,
};

const toTime = (value) => {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const taskStage = (task) => stageByKind[task.kind] || 'other';

const taskReportsFor = (state, task) =>
  state.taskReports
    .filter((report) => report.taskId === task.taskId || report.taskId === task.id)
    .toSorted((left, right) => toTime(right.createdAt) - toTime(left.createdAt));

const pendingCratesFor = (state, customer) =>
  customer
    ? state.crateLoans.filter((loan) => loanBelongsToCustomer(loan, customer) && loan.status === 'Prestado')
    : [];

export const deliveryTaskRows = (state) =>
  state.taskAssignments
    .filter((task) => task.status !== 'done')
    .map((task) => {
      const sale = state.sales.find((item) => item.id === task.saleId) || null;
      const customer = sale ? findCustomerForSale(state, sale) : null;
      const reports = taskReportsFor(state, task);
      const stage = taskStage(task);
      return {
        ...task,
        stage,
        stageLabel: stageLabel[stage],
        sale,
        customer,
        reports,
        openReports: reports.filter((report) => report.status !== 'resolved'),
        pendingCrates: pendingCratesFor(state, customer),
        destination: sale?.destination || task.description || '',
        total: Number(sale?.total || sale?.price || 0),
      };
    })
    .toSorted((left, right) => {
      const statusDelta = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
      if (statusDelta) return statusDelta;
      const priorityDelta = (right.priority === 'high' ? 1 : 0) - (left.priority === 'high' ? 1 : 0);
      if (priorityDelta) return priorityDelta;
      return toTime(right.updatedAt || right.createdAt) - toTime(left.updatedAt || left.createdAt);
    });

export const deliveryColumns = (state) => {
  const rows = deliveryTaskRows(state);
  return {
    packing: rows.filter((task) => task.stage === 'packing'),
    assignment: rows.filter((task) => task.stage === 'assignment'),
    route: rows.filter((task) => task.stage === 'route'),
  };
};

export const routeGroups = (state) => {
  const groups = new Map();
  deliveryTaskRows(state)
    .filter((task) => task.stage === 'route')
    .forEach((task) => {
      const key = task.employeeId || task.employeeName || 'sin-asignar';
      if (!groups.has(key)) {
        groups.set(key, {
          driverId: task.employeeId || null,
          driverName: task.employeeName || 'Sin asignar',
          tasks: [],
          openReports: 0,
          blocked: 0,
          total: 0,
        });
      }
      const group = groups.get(key);
      group.tasks.push(task);
      group.openReports += task.openReports.length;
      group.blocked += task.status === 'blocked' ? 1 : 0;
      group.total += task.total;
    });
  return Array.from(groups.values()).toSorted((left, right) => right.tasks.length - left.tasks.length);
};

export const deliveryAttentionItems = (state) =>
  deliveryTaskRows(state)
    .flatMap((task) => {
      const items = [];
      if (task.status === 'blocked') {
        items.push({
          id: `blocked:${task.taskId}`,
          tone: 'critical',
          title: task.blockReason || 'Bloqueo activo',
          detail: `${task.stageLabel} - ${task.customerName || task.title}`,
          taskId: task.taskId,
        });
      }
      task.openReports.forEach((report) => {
        items.push({
          id: `report:${report.id}`,
          tone: report.severity === 'high' ? 'critical' : 'warning',
          title: report.summary,
          detail: task.title,
          taskId: task.taskId,
          reportId: report.id,
        });
      });
      if (task.status === 'assigned' && task.priority === 'high') {
        items.push({
          id: `ack:${task.taskId}`,
          tone: 'info',
          title: 'Esperando acuse',
          detail: task.title,
          taskId: task.taskId,
        });
      }
      return items;
    })
    .slice(0, 8);

export const deliveryLiveActivity = (state) => {
  const reportEvents = state.taskReports.map((report) => ({
    id: `report:${report.id}`,
    title: report.summary,
    detail: report.employeeName || report.customerName || report.taskTitle || 'Reporte',
    at: report.createdAt,
    tone: report.severity === 'high' ? 'critical' : 'info',
  }));
  const logEvents = state.activityLog
    .filter((entry) => ['ASIGNACION_ENTREGA', 'PEDIDO_EMPACADO', 'COMPLETA_VENTA', 'REPORTE_TAREA'].includes(entry.type))
    .map((entry) => ({
      id: `log:${entry.id}`,
      title: entry.description,
      detail: entry.type.replace(/_/g, ' '),
      at: entry.timestamp,
      tone: 'info',
    }));
  return [...reportEvents, ...logEvents]
    .toSorted((left, right) => toTime(right.at) - toTime(left.at))
    .slice(0, 8);
};

export const delivererPortal = (state, employeeId = '') => {
  const tasks = deliveryTaskRows(state)
    .filter((task) => task.stage === 'route')
    .filter((task) => !employeeId || !task.employeeId || task.employeeId === employeeId);
  return {
    tasks,
    pending: tasks.filter((task) => task.status === 'assigned' || task.status === 'acknowledged'),
    active: tasks.filter((task) => task.status === 'in_progress'),
    blocked: tasks.filter((task) => task.status === 'blocked'),
  };
};

const mapUrlFor = (destination) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination || 'Central de Abastos')}`;

export const deliveryPresenceRows = (state) =>
  state.employees
    .filter((employee) => employee.role === 'Repartidor')
    .map((employee) => {
      const presence = (state.deliveryPresence || []).find((item) => item.employeeId === employee.id) || {};
      const tasks = deliveryTaskRows(state).filter((task) => task.employeeId === employee.id && task.stage === 'route');
      const nextTask = tasks[0] || null;
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        status: presence.status || 'offline',
        lastSeenAt: presence.lastSeenAt || '',
        lat: presence.lat || null,
        lng: presence.lng || null,
        taskCount: tasks.length,
        nextTask,
        mapUrl: mapUrlFor(nextTask?.destination || nextTask?.customerName || employee.name),
      };
    });

export const deliveryReportReceiptRows = (state) =>
  (state.deliveryReportReceipts || []).map((receipt) => ({
    ...receipt,
    report: state.taskReports.find((report) => report.id === receipt.reportId) || null,
  })).toSorted((left, right) => String(right.at || '').localeCompare(String(left.at || '')));
