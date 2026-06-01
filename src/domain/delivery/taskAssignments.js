const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.round(Math.random() * 10000)}`;

export const taskIdForSale = (kind, saleId) => {
  if (kind === 'PACK_ORDER') return `pack-${saleId}`;
  if (kind === 'ASSIGN_DELIVERY') return `assign-${saleId}`;
  return `route-${saleId}`;
};

const resolveEmployee = (employees, employeeId, fallbackRole) => {
  if (employeeId) {
    const byId = employees.find((employee) => employee.id === employeeId);
    if (byId) return byId;
  }
  return fallbackRole ? employees.find((employee) => employee.role === fallbackRole) : null;
};

const buildPackingTask = (sale, employee) => ({
  id: `task-${taskIdForSale('PACK_ORDER', sale.id)}`,
  taskId: taskIdForSale('PACK_ORDER', sale.id),
  kind: 'PACK_ORDER',
  role: 'Empacador',
  status: 'assigned',
  title: `Empacar ${sale.customer}`,
  description: `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} ${sale.size}`,
  saleId: sale.id,
  employeeId: employee?.id || null,
  employeeName: employee?.name || null,
  customerId: sale.customerId || null,
  customerName: sale.customer,
  priority: 'high',
});

const buildDispatchTask = (sale) => ({
  id: `task-${taskIdForSale('ASSIGN_DELIVERY', sale.id)}`,
  taskId: taskIdForSale('ASSIGN_DELIVERY', sale.id),
  kind: 'ASSIGN_DELIVERY',
  role: 'Admin',
  status: 'assigned',
  title: `Asignar ruta ${sale.customer}`,
  description: `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} ${sale.size}`,
  saleId: sale.id,
  employeeId: null,
  employeeName: null,
  customerId: sale.customerId || null,
  customerName: sale.customer,
  priority: 'high',
});

const buildDeliveryTask = (sale, employee) => ({
  id: `task-${taskIdForSale('DELIVER_ORDER', sale.id)}`,
  taskId: taskIdForSale('DELIVER_ORDER', sale.id),
  kind: 'DELIVER_ORDER',
  role: 'Repartidor',
  status: 'assigned',
  title: `Entregar ${sale.customer}`,
  description: sale.destination || `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName}`,
  saleId: sale.id,
  employeeId: employee?.id || sale.assignedEmployeeId || null,
  employeeName: employee?.name || null,
  customerId: sale.customerId || null,
  customerName: sale.customer,
  priority: 'high',
});

const hydrateTask = (existing, desired, now) => {
  if (!existing) return { ...desired, createdAt: now, updatedAt: now };
  const assigneeChanged = desired.employeeId && existing.employeeId !== desired.employeeId;
  return {
    ...existing,
    ...desired,
    status: assigneeChanged || existing.status === 'done' ? 'assigned' : existing.status,
    acknowledgedAt: assigneeChanged ? undefined : existing.acknowledgedAt,
    startedAt: assigneeChanged ? undefined : existing.startedAt,
    blockedAt: assigneeChanged ? undefined : existing.blockedAt,
    completedAt: assigneeChanged ? undefined : existing.completedAt,
    blockReason: assigneeChanged ? undefined : existing.blockReason,
    updatedAt: now,
  };
};

const closeTask = (existing, now) => {
  if (!existing) return null;
  if (existing.status === 'done') return existing;
  return {
    ...existing,
    status: 'done',
    blockReason: undefined,
    blockedAt: undefined,
    completedAt: existing.completedAt || now,
    updatedAt: now,
  };
};

export const syncOperationalTaskAssignments = (state) => {
  const now = nowIso();
  const taskByTaskId = new Map(state.taskAssignments.map((task) => [task.taskId, task]));
  const nextTasks = [];
  const touched = new Set();
  const push = (task) => {
    if (!task) return;
    touched.add(task.taskId);
    nextTasks.push(task);
  };

  state.sales.forEach((sale) => {
    const packingTaskId = taskIdForSale('PACK_ORDER', sale.id);
    const dispatchTaskId = taskIdForSale('ASSIGN_DELIVERY', sale.id);
    const deliveryTaskId = taskIdForSale('DELIVER_ORDER', sale.id);

    if (sale.status === 'Pendiente de Empaque') {
      push(hydrateTask(taskByTaskId.get(packingTaskId),
        buildPackingTask(sale, resolveEmployee(state.employees, null, 'Empacador')), now));
    } else {
      push(closeTask(taskByTaskId.get(packingTaskId), now));
    }

    if (sale.status === 'Listo para Entrega' && !sale.assignedEmployeeId) {
      push(hydrateTask(taskByTaskId.get(dispatchTaskId), buildDispatchTask(sale), now));
    } else {
      push(closeTask(taskByTaskId.get(dispatchTaskId), now));
    }

    if (sale.status === 'En Ruta' && sale.assignedEmployeeId) {
      push(hydrateTask(taskByTaskId.get(deliveryTaskId),
        buildDeliveryTask(sale, resolveEmployee(state.employees, sale.assignedEmployeeId, 'Repartidor')), now));
    } else {
      push(closeTask(taskByTaskId.get(deliveryTaskId), now));
    }
  });

  state.taskAssignments.forEach((task) => {
    if (!touched.has(task.taskId)) nextTasks.push(task);
  });

  nextTasks.sort((left, right) => {
    if (left.status === 'done' && right.status !== 'done') return 1;
    if (left.status !== 'done' && right.status === 'done') return -1;
    const priorityDelta = (right.priority === 'high' ? 1 : 0) - (left.priority === 'high' ? 1 : 0);
    if (priorityDelta) return priorityDelta;
    return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
  });

  state.taskAssignments = nextTasks;
  return nextTasks;
};

export const updateTaskAssignmentStatus = (state, taskId, nextStatus, actor = {}, blockReason = '') => {
  const now = nowIso();
  const task = state.taskAssignments.find((item) => item.taskId === taskId);
  if (!task) return { kind: 'task_status', status: 'skipped', message: 'Tarea no encontrada.' };

  task.status = nextStatus;
  task.employeeId = actor.employeeId ?? task.employeeId ?? null;
  task.employeeName = actor.employeeName ?? task.employeeName ?? null;
  task.updatedAt = now;
  if (nextStatus === 'acknowledged') task.acknowledgedAt ||= now;
  if (nextStatus === 'in_progress') task.startedAt ||= now;
  if (nextStatus === 'blocked') {
    task.blockedAt = now;
    task.blockReason = blockReason || task.blockReason || 'Sin detalle';
    state.taskReports.unshift({
      id: makeId('report'),
      taskId,
      kind: 'blocker',
      status: 'open',
      severity: 'high',
      summary: task.blockReason,
      createdAt: now,
      employeeId: task.employeeId,
      employeeName: task.employeeName,
    });
  }
  if (nextStatus === 'done') {
    task.completedAt ||= now;
    state.taskReports.forEach((report) => {
      if (report.taskId === taskId && report.status !== 'resolved') {
        report.status = 'resolved';
        report.resolvedAt = now;
      }
    });
  }
  return { kind: 'task_status', status: 'ok', message: `Tarea actualizada: ${nextStatus}`, taskId };
};
