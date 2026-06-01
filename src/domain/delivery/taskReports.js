import { makeId, nowIso, pushLog, receipt } from '../core/events.js';
import { updateTaskAssignmentStatus } from './taskAssignments.js';

const readText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');

const normalizeKind = (value) => {
  const normalized = readText(value).toLowerCase();
  if (['note', 'nota'].includes(normalized)) return 'note';
  if (['incident', 'incidencia'].includes(normalized)) return 'incident';
  if (['blocker', 'blocked', 'bloqueo'].includes(normalized)) return 'blocker';
  if (['completion', 'closure', 'cierre'].includes(normalized)) return 'completion';
  return null;
};

const findTask = (state, taskId) =>
  state.taskAssignments.find((task) => task.taskId === taskId || task.id === taskId) || null;

const normalizeSeverity = (input) =>
  input?.severity === 'high' || input?.kind === 'blocker' || input?.kind === 'incident' ? 'high' : 'normal';

export const normalizeTaskReportInput = (input = {}) => {
  const kind = normalizeKind(input.kind ?? input.type);
  const summary = readText(input.summary) || readText(input.message);
  if (!kind || !summary) return null;
  const nextTaskStatus = ['assigned', 'acknowledged', 'in_progress', 'blocked', 'done'].includes(input.nextTaskStatus)
    ? input.nextTaskStatus
    : kind === 'blocker' || kind === 'incident'
      ? 'blocked'
      : kind === 'completion'
        ? 'done'
        : undefined;
  return {
    kind,
    summary,
    detail: readText(input.detail),
    evidence: readText(input.evidence),
    severity: normalizeSeverity({ ...input, kind }),
    nextTaskStatus,
  };
};

const markBlockedWithoutReport = (state, task, actor, reason) => {
  const now = nowIso();
  task.status = 'blocked';
  task.employeeId = actor.employeeId ?? task.employeeId ?? null;
  task.employeeName = actor.employeeName ?? task.employeeName ?? null;
  task.blockedAt = now;
  task.updatedAt = now;
  task.blockReason = reason || task.blockReason || 'Sin detalle';
};

export const submitTaskReport = (state, taskId, input, actor = {}) => {
  const task = findTask(state, taskId);
  const reportInput = normalizeTaskReportInput(input);
  if (!task || !reportInput) return receipt('task_report', 'skipped', 'Reporte de tarea invalido.');

  if (reportInput.nextTaskStatus === 'blocked') {
    markBlockedWithoutReport(state, task, actor, reportInput.detail || reportInput.summary);
  } else if (reportInput.nextTaskStatus) {
    updateTaskAssignmentStatus(state, task.taskId, reportInput.nextTaskStatus, actor);
  }

  const status = reportInput.kind === 'note' || reportInput.kind === 'completion' ? 'resolved' : 'open';
  const now = nowIso();
  const report = {
    id: makeId('report'),
    taskId: task.taskId,
    saleId: task.saleId || null,
    role: task.role,
    employeeId: actor.employeeId ?? task.employeeId ?? null,
    employeeName: actor.employeeName ?? task.employeeName ?? null,
    customerId: task.customerId || null,
    customerName: task.customerName || null,
    taskTitle: task.title,
    kind: reportInput.kind,
    status,
    severity: reportInput.severity,
    summary: reportInput.summary,
    detail: reportInput.detail || undefined,
    evidence: reportInput.evidence || undefined,
    escalationStatus: reportInput.severity === 'high' ? 'pending' : 'none',
    createdAt: now,
    resolvedAt: status === 'resolved' ? now : undefined,
  };

  state.taskReports.unshift(report);
  pushLog(state, 'REPORTE_TAREA', report.summary, {
    Tarea: task.title,
    Severidad: report.severity,
  });
  return receipt('task_report', 'ok', `Reporte registrado: ${report.summary}`, { report });
};

export const resolveTaskReport = (state, reportId, resolutionNote = '') => {
  const report = state.taskReports.find((item) => item.id === reportId);
  if (!report) return receipt('task_report_resolve', 'skipped', 'Reporte no encontrado.');
  report.status = 'resolved';
  report.resolvedAt = nowIso();
  report.escalationStatus = report.escalationStatus === 'sent' ? 'sent' : 'none';
  if (resolutionNote) report.detail = resolutionNote;
  pushLog(state, 'REPORTE_TAREA', `Reporte resuelto: ${report.summary}`, { Reporte: report.id });
  return receipt('task_report_resolve', 'ok', `Reporte resuelto: ${report.summary}`, { reportId });
};
