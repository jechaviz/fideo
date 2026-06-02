import { customerPortfolio } from '../customers/customerLedger.js';
import {
  deliveryAttentionItems,
  deliveryColumns,
  deliveryPresenceRows,
  routeGroups,
} from '../delivery/deliverySelectors.js';
import { taskIdForSale } from '../delivery/taskAssignments.js';
import { cashAttention, financeSummary } from '../finance/financeSelectors.js';
import { campaignDeliveryAnalytics, correctionQueue } from '../messages/messageInsights.js';
import { messageStats } from '../messages/messageSelectors.js';
import { purchaseOrderPipeline, purchaseReceiptSummary } from '../suppliers/supplierSelectors.js';

const requiredRoleByTaskKind = {
  PACK_ORDER: 'Empacador',
  DELIVER_ORDER: 'Repartidor',
  ASSIGN_DELIVERY: 'Admin',
};

const saleTaskKindByStatus = {
  'Pendiente de Empaque': 'PACK_ORDER',
  'Listo para Entrega': 'ASSIGN_DELIVERY',
  'En Ruta': 'DELIVER_ORDER',
};

const statusRank = {
  ok: 0,
  info: 1,
  warning: 2,
  critical: 3,
};

const maxStatus = (statuses) =>
  statuses.reduce((current, status) =>
    (statusRank[status] || 0) > (statusRank[current] || 0) ? status : current, 'ok');

const statusFromCounts = ({ critical = 0, warning = 0, info = 0 }) => {
  if (critical > 0) return 'critical';
  if (warning > 0) return 'warning';
  if (info > 0) return 'info';
  return 'ok';
};

const money = (value) => Number(value || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

const activeTaskRows = (state) =>
  state.taskAssignments.filter((task) => task.status !== 'done');

const hasOpenTask = (state, sale, kind) => {
  const taskId = taskIdForSale(kind, sale.id);
  return state.taskAssignments.some((task) =>
    task.taskId === taskId && task.status !== 'done');
};

const taskSale = (state, task) =>
  task.saleId ? state.sales.find((sale) => sale.id === task.saleId) || null : null;

const buildHiddenRisks = (state) =>
  activeTaskRows(state).flatMap((task) => {
    const risks = [];
    const sale = taskSale(state, task);
    const employee = task.employeeId
      ? state.employees.find((item) => item.id === task.employeeId) || null
      : null;
    const requiredRole = requiredRoleByTaskKind[task.kind];

    if (task.saleId && !sale) {
      risks.push({
        id: `missing-sale:${task.taskId}`,
        tone: 'critical',
        owner: 'Admin',
        hidden: true,
        title: 'Tarea sin venta',
        detail: `${task.title} referencia ${task.saleId}.`,
      });
    }
    if (requiredRole && employee && employee.role !== requiredRole) {
      risks.push({
        id: `wrong-role:${task.taskId}`,
        tone: 'critical',
        owner: 'Admin',
        hidden: true,
        title: 'Rol incongruente',
        detail: `${task.title} requiere ${requiredRole} y esta en ${employee.role}.`,
      });
    }
    if (task.kind === 'DELIVER_ORDER' && sale && sale.assignedEmployeeId !== task.employeeId) {
      risks.push({
        id: `route-sale-mismatch:${task.taskId}`,
        tone: 'critical',
        owner: 'Admin',
        hidden: true,
        title: 'Ruta desincronizada',
        detail: `${sale.customer} apunta a ${sale.assignedEmployeeId || 'sin ruta'} y la tarea a ${task.employeeId || 'sin ruta'}.`,
      });
    }
    return risks;
  });

const buildUntrackedSales = (state) =>
  state.sales
    .filter((sale) => sale.status !== 'Completado')
    .flatMap((sale) => {
      const kind = saleTaskKindByStatus[sale.status];
      if (!kind) return [];
      if (kind === 'DELIVER_ORDER' && !sale.assignedEmployeeId) {
        return [{
          id: `sale-unassigned:${sale.id}`,
          tone: 'critical',
          owner: 'Admin',
          hidden: true,
          title: 'Venta en ruta sin repartidor',
          detail: `${sale.customer} no tiene repartidor asignado.`,
        }];
      }
      if (hasOpenTask(state, sale, kind)) return [];
      return [{
        id: `sale-no-task:${sale.id}`,
        tone: 'critical',
        owner: 'Admin',
        hidden: true,
        title: 'Venta sin tarea operativa',
        detail: `${sale.customer} esta en ${sale.status} sin tarea activa.`,
      }];
    });

const buildVisibleRisks = (state, selectors) => {
  const risks = [];
  const stats = selectors.messages;
  const correctionCount = selectors.corrections.length;
  const openReports = state.taskReports.filter((report) => report.status !== 'resolved');
  const cash = selectors.cash;

  openReports.forEach((report) => {
    risks.push({
      id: `report:${report.id}`,
      tone: report.severity === 'high' ? 'critical' : 'warning',
      owner: report.employeeName || 'Admin',
      hidden: false,
      title: report.summary || 'Reporte abierto',
      detail: report.taskId || 'Sin tarea vinculada',
    });
  });
  if (stats.pending > 0) {
    risks.push({
      id: 'messages-pending',
      tone: 'warning',
      owner: 'Comunicacion',
      hidden: false,
      title: 'Mensajes sin interpretar',
      detail: `${stats.pending} mensaje(s) esperan lectura.`,
    });
  }
  if (correctionCount > 0) {
    risks.push({
      id: 'messages-correction',
      tone: 'warning',
      owner: 'Comunicacion',
      hidden: false,
      title: 'Correcciones pendientes',
      detail: `${correctionCount} interpretacion(es) requieren revision.`,
    });
  }
  if (selectors.purchase.openCount > 0 && selectors.purchaseReceipts.remoteReceipts === 0) {
    risks.push({
      id: 'purchase-no-remote-receipt',
      tone: 'warning',
      owner: 'Proveedores',
      hidden: false,
      title: 'Compras sin acuse remoto',
      detail: `${selectors.purchase.openCount} orden(es) abiertas sin acuse MySQL.`,
    });
  }
  if (cash.critical > 0 || cash.warning > 0) {
    risks.push({
      id: 'cash-attention',
      tone: cash.critical > 0 ? 'critical' : 'warning',
      owner: 'Finanzas',
      hidden: false,
      title: 'Caja requiere atencion',
      detail: `${cash.critical} criticas, ${cash.warning} advertencias.`,
    });
  }

  return risks;
};

const roleCard = (id, role, status, objective, facts, nextAction) => ({
  id,
  role,
  status,
  objective,
  facts,
  nextAction,
});

export const rolePipelineAudit = (state) => {
  const columns = deliveryColumns(state);
  const routes = routeGroups(state);
  const presence = deliveryPresenceRows(state);
  const portfolio = customerPortfolio(state);
  const finance = financeSummary(state);
  const messages = messageStats(state);
  const corrections = correctionQueue(state);
  const purchase = purchaseOrderPipeline(state);
  const purchaseReceipts = purchaseReceiptSummary(state);
  const campaignDelivery = campaignDeliveryAnalytics(state);
  const cash = cashAttention(state);
  const attention = deliveryAttentionItems(state);
  const activeTasks = activeTaskRows(state);
  const blockedTasks = activeTasks.filter((task) => task.status === 'blocked');
  const hiddenRisks = [...buildHiddenRisks(state), ...buildUntrackedSales(state)];
  const selectors = {
    campaignDelivery,
    cash,
    corrections,
    finance,
    messages,
    portfolio,
    purchase,
    purchaseReceipts,
  };
  const visibleRisks = buildVisibleRisks(state, selectors);
  const risks = [...hiddenRisks, ...visibleRisks].toSorted((left, right) =>
    (statusRank[right.tone] || 0) - (statusRank[left.tone] || 0));

  const openSales = state.sales.filter((sale) => sale.status !== 'Completado');
  const activePresence = presence.filter((row) => row.status === 'active');
  const offlineRoutes = presence.filter((row) => row.taskCount > 0 && row.status !== 'active');

  const objectives = [
    {
      id: 'orders',
      label: 'Pedidos',
      status: statusFromCounts({
        critical: blockedTasks.length + hiddenRisks.length,
        warning: Math.max(0, openSales.length - blockedTasks.length),
      }),
      value: `${openSales.length} abiertos`,
      detail: `${columns.packing.length} empaque, ${columns.assignment.length} asignacion, ${columns.route.length} ruta.`,
    },
    {
      id: 'communication',
      label: 'Comunicacion',
      status: statusFromCounts({
        warning: messages.pending + corrections.length,
        info: messages.interpreted,
      }),
      value: `${messages.pending + corrections.length} pendientes`,
      detail: `${messages.approved} aprobados, ${campaignDelivery.providerReceipts} acuses proveedor.`,
    },
    {
      id: 'tracking',
      label: 'Seguimiento',
      status: statusFromCounts({
        critical: attention.filter((item) => item.tone === 'critical').length,
        warning: offlineRoutes.length,
        info: activePresence.length,
      }),
      value: `${routes.length} ruta(s)`,
      detail: `${activePresence.length} presencia activa, ${offlineRoutes.length} sin ping activo.`,
    },
    {
      id: 'supply',
      label: 'Abasto',
      status: statusFromCounts({
        warning: purchase.openCount,
        info: purchaseReceipts.remoteReceipts,
      }),
      value: money(purchase.totalOpenCost),
      detail: `${purchase.openCount} orden(es) abiertas, ${purchaseReceipts.receipts} recibo(s).`,
    },
    {
      id: 'finance',
      label: 'Finanzas',
      status: statusFromCounts({
        critical: cash.critical,
        warning: cash.warning + (portfolio.totalBalance > 0 ? 1 : 0),
        info: finance.openCash > 0 ? 1 : 0,
      }),
      value: money(finance.openCash),
      detail: `${money(portfolio.totalBalance)} cartera y ${money(finance.netOperating)} neto operativo.`,
    },
  ];

  const roleCards = [
    roleCard('admin', 'Admin', maxStatus([...objectives.map((item) => item.status), ...hiddenRisks.map((item) => item.tone)]),
      'Control total del flujo',
      [
        `${risks.length} riesgo(s) activos`,
        `${hiddenRisks.length} riesgo(s) ocultos`,
        `${state.activityLog.length} evento(s) auditados`,
      ],
      hiddenRisks.length ? 'Corregir integridad de tareas y ventas.' : 'Priorizar excepciones visibles.'),
    roleCard('customers', 'Clientes', portfolio.totalBalance > 0 ? 'warning' : 'ok',
      'Pedido, credito y cajas',
      [
        `${portfolio.activeCustomers}/${portfolio.customers} activos 30d`,
        `${money(portfolio.totalBalance)} cartera`,
        `${state.crateLoans.filter((loan) => loan.status !== 'Devuelto').length} prestamo(s) de caja`,
      ],
      portfolio.totalBalance > 0 ? 'Dar seguimiento a cobranza y cajas.' : 'Mantener historial limpio.'),
    roleCard('suppliers', 'Proveedores', purchase.openCount ? 'warning' : 'ok',
      'Abasto confirmado',
      [
        `${purchase.openCount} orden(es) abiertas`,
        money(purchase.totalOpenCost),
        `${purchaseReceipts.remoteReceipts} acuse(s) MySQL`,
      ],
      purchase.openCount ? 'Confirmar ETA y acuse.' : 'Sin compras abiertas.'),
    roleCard('packing', 'Empaque', columns.packing.some((task) => task.status === 'blocked') ? 'critical' : columns.packing.length ? 'warning' : 'ok',
      'Preparar pedidos',
      [
        `${columns.packing.length} tarea(s)`,
        `${columns.packing.filter((task) => task.status === 'blocked').length} bloqueo(s)`,
        `${columns.assignment.length} listo(s) para asignar`,
      ],
      columns.packing.length ? 'Empacar o reportar incidencia.' : 'Sin cola abierta.'),
    roleCard('delivery', 'Reparto', blockedTasks.some((task) => task.kind === 'DELIVER_ORDER') ? 'critical' : columns.route.length ? 'warning' : 'ok',
      'Entregar y reportar',
      [
        `${columns.route.length} entrega(s)`,
        `${routes.reduce((sum, route) => sum + route.openReports, 0)} reporte(s)`,
        `${activePresence.length}/${presence.length} presencia activa`,
      ],
      blockedTasks.some((task) => task.kind === 'DELIVER_ORDER') ? 'Resolver bloqueo de ruta.' : 'Mantener presencia y cierre.'),
    roleCard('communication', 'Comunicacion', messages.pending + corrections.length ? 'warning' : 'ok',
      'Interpretar y confirmar',
      [
        `${messages.pending} pendiente(s)`,
        `${corrections.length} correccion(es)`,
        `${campaignDelivery.delivered} entregados`,
      ],
      messages.pending + corrections.length ? 'Interpretar, corregir y aprobar.' : 'Sin bandeja pendiente.'),
    roleCard('finance', 'Finanzas', objectives.find((item) => item.id === 'finance')?.status || 'ok',
      'Caja, deuda y utilidad',
      [
        `${money(finance.openCash)} caja`,
        `${money(portfolio.monetaryDebt)} deuda`,
        `${money(finance.grossProfit)} utilidad bruta`,
      ],
      cash.critical + cash.warning ? 'Atender caja.' : 'Conciliar recibos y cortes.'),
  ];

  const summaryStatus = maxStatus([...objectives.map((item) => item.status), ...roleCards.map((item) => item.status)]);
  const hiddenRiskCount = hiddenRisks.length;
  const criticalCount = risks.filter((risk) => risk.tone === 'critical').length;
  const warningCount = risks.filter((risk) => risk.tone === 'warning').length;

  return {
    summary: {
      status: summaryStatus,
      critical: criticalCount,
      warning: warningCount,
      hiddenRisks: hiddenRiskCount,
      visibleRisks: risks.length - hiddenRiskCount,
      objectivesAchieved: summaryStatus !== 'critical' && objectives.every((item) => item.status !== 'warning'),
      adminKnowsEverything: hiddenRiskCount === 0,
      headline: hiddenRiskCount === 0
        ? 'Visibilidad operativa completa'
        : 'Hay riesgos fuera del radar operativo',
    },
    objectives,
    roleCards,
    risks,
  };
};
