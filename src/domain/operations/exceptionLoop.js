const nowIso = () => new Date().toISOString();

const findTask = (state, exception) =>
  state.taskAssignments.find((task) => task.taskId === exception.taskId);

const findReport = (state, exception) =>
  state.taskReports.find((report) => report.id === exception.reportId);

const makeReceipt = (kind, message, extra = {}) => ({
  kind,
  status: 'ok',
  message,
  ...extra,
});

const requiredRoleByTaskKind = {
  PACK_ORDER: 'Empacador',
  DELIVER_ORDER: 'Repartidor',
  ASSIGN_DELIVERY: 'Admin',
};

export const followUpException = (state, exception) => {
  const task = findTask(state, exception);
  const report = findReport(state, exception);
  const targetName = exception.employeeName || task?.employeeName || 'Admin';
  const note = {
    id: `note_${Date.now()}`,
    taskId: exception.taskId,
    kind: 'note',
    status: 'resolved',
    severity: exception.severity === 'high' ? 'high' : 'normal',
    summary: `Seguimiento enviado a ${targetName}`,
    detail: exception.detail || 'Seguimiento operativo desde FideoVue.',
    createdAt: nowIso(),
    employeeId: exception.employeeId || task?.employeeId || null,
    employeeName: targetName,
  };

  state.taskReports.unshift(note);
  if (report) {
    report.escalationStatus = 'sent';
    report.lastFollowUpAt = note.createdAt;
  }

  state.activityLog.unshift({
    id: `log_follow_${Date.now()}`,
    type: 'FOLLOW_UP',
    timestamp: note.createdAt,
    description: note.summary,
  });

  return {
    followUp: {
      channel: 'whatsapp',
      targetName,
      summary: note.summary,
      detail: note.detail,
      taskId: exception.taskId,
    },
    receipt: makeReceipt('follow_up', note.summary, { taskId: exception.taskId }),
  };
};

export const reassignException = (state, exception, employeeId) => {
  const task = findTask(state, exception);
  const assignee = state.employees.find((employee) => employee.id === employeeId);
  if (!task || !assignee) {
    return { receipt: makeReceipt('reassign', 'No se pudo resolver la reasignacion.', { status: 'skipped' }) };
  }
  const requiredRole = requiredRoleByTaskKind[task.kind];
  if (requiredRole && assignee.role !== requiredRole) {
    return {
      receipt: makeReceipt('reassign', `La tarea requiere rol ${requiredRole}.`, {
        status: 'failed',
        taskId: task.taskId,
        employeeId: assignee.id,
      }),
    };
  }

  task.employeeId = assignee.id;
  task.employeeName = assignee.name;
  task.role = assignee.role;
  task.updatedAt = nowIso();

  if (task.kind === 'DELIVER_ORDER' && task.saleId) {
    const sale = state.sales.find((item) => item.id === task.saleId);
    if (sale) sale.assignedEmployeeId = assignee.id;
  }

  return {
    receipt: makeReceipt('reassign', `Tarea reasignada a ${assignee.name}.`, {
      taskId: task.taskId,
      employeeId: assignee.id,
    }),
  };
};

export const resolveException = (state, exception) => {
  const task = findTask(state, exception);
  const report = findReport(state, exception);
  const resolvedAt = nowIso();

  if (report) {
    report.status = 'resolved';
    report.resolvedAt = resolvedAt;
  }

  if (task) {
    if (task.status === 'blocked') task.status = 'acknowledged';
    task.blockReason = undefined;
    task.blockedReason = undefined;
    task.blockedAt = undefined;
    task.updatedAt = resolvedAt;
  }

  state.activityLog.unshift({
    id: `log_resolve_${Date.now()}`,
    type: 'RESOLVE',
    timestamp: resolvedAt,
    description: exception.title,
  });

  return {
    receipt: makeReceipt('resolve', 'Excepcion resuelta en el runtime local.', {
      taskId: exception.taskId,
      reportId: exception.reportId,
    }),
  };
};
