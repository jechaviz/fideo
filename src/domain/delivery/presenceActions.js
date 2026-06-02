import { makeId, nowIso, pushLog, receipt } from '../core/events.js';

export const pingDeliveryPresence = (state, employeeId, input = {}) => {
  const employee = state.employees.find((item) => item.id === employeeId && item.role === 'Repartidor');
  if (!employee) return receipt('delivery_presence_ping', 'skipped', 'Repartidor no encontrado.');
  state.deliveryPresence ||= [];
  const existing = state.deliveryPresence.find((item) => item.employeeId === employeeId);
  const payload = {
    employeeId,
    status: input.status || 'active',
    lat: Number(input.lat ?? existing?.lat ?? 20.5888),
    lng: Number(input.lng ?? existing?.lng ?? -100.3899),
    lastSeenAt: nowIso(),
    device: input.device || existing?.device || 'web-static',
  };
  if (existing) Object.assign(existing, payload);
  else state.deliveryPresence.unshift(payload);
  pushLog(state, 'ASIGNACION_ENTREGA', `Presencia actualizada: ${employee.name}`, { Estado: payload.status });
  return receipt('delivery_presence_ping', 'ok', `Presencia ${payload.status}.`, { employeeId });
};

export const recordDeliveryReportReceipt = (state, input = {}) => {
  const report = state.taskReports.find((item) => item.id === input.reportId) || state.taskReports[0];
  const provider = String(input.provider || '').trim();
  if (!report || !provider) return receipt('delivery_report_receipt', 'skipped', 'Reporte o proveedor incompleto.');
  state.deliveryReportReceipts ||= [];
  state.deliveryReportReceipts.unshift({
    id: makeId('delivery_report_receipt'),
    reportId: report.id,
    taskId: report.taskId,
    provider,
    status: input.status || 'acknowledged',
    message: input.message || `${provider} acuse de reporte registrado.`,
    at: nowIso(),
  });
  pushLog(state, 'REPORTE_TAREA', `Acuse remoto ${provider}`, { Reporte: report.id });
  return receipt('delivery_report_receipt', 'ok', `Acuse ${provider} registrado.`, {
    reportId: report.id,
    provider,
  });
};
