import { debtRows } from '../finance/financeSelectors.js';
import { inventoryRows } from '../inventory/selectors.js';
import { purchaseOrderPipeline } from '../suppliers/supplierSelectors.js';
import { messageStats } from './messageSelectors.js';

export const aiInsightCards = (state) => {
  const stock = inventoryRows(state);
  const mature = stock.filter((row) => row.state === 'Maduro' && row.quality === 'Normal');
  const debt = debtRows(state);
  const pipeline = purchaseOrderPipeline(state);
  const stats = messageStats(state);
  const topMature = mature.toSorted((left, right) => right.quantity - left.quantity)[0];
  const topDebt = debt[0];

  return [
    topMature ? {
      id: 'stock-campaign',
      title: 'Oferta sugerida',
      detail: `${topMature.product} tiene ${topMature.quantity} unidades maduras.`,
      action: 'Crear campana a clientes activos',
      priority: 'high',
    } : null,
    topDebt ? {
      id: 'debt-follow-up',
      title: 'Cobranza prioritaria',
      detail: `${topDebt.customerName} concentra ${topDebt.totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}.`,
      action: 'Enviar recordatorio de pago',
      priority: topDebt.totalBalance > 10000 ? 'high' : 'normal',
    } : null,
    pipeline.openCount ? {
      id: 'supplier-follow-up',
      title: 'Compra en seguimiento',
      detail: `${pipeline.openCount} orden(es) abiertas por ${pipeline.totalOpenCost.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}.`,
      action: 'Confirmar ETA con proveedor',
      priority: 'normal',
    } : null,
    stats.pending ? {
      id: 'message-review',
      title: 'Mensajes por interpretar',
      detail: `${stats.pending} mensaje(s) esperando IA local o correccion manual.`,
      action: 'Interpretar y aprobar',
      priority: 'normal',
    } : null,
  ].filter(Boolean);
};

export const campaignDrafts = (state) => {
  const stock = inventoryRows(state)
    .filter((row) => row.state === 'Maduro' && row.quality === 'Normal')
    .toSorted((left, right) => right.quantity - left.quantity);
  const top = stock[0];
  const targetIds = state.customers.map((customer) => customer.id);
  if (!top || !targetIds.length) return [];
  return [{
    id: 'mature-stock',
    title: `${top.product} listo`,
    message: `${top.product} maduro disponible hoy. Aparta antes del cierre.`,
    targetIds,
    product: top.product,
    quantity: top.quantity,
  }];
};

export const correctionQueue = (state) =>
  state.messages
    .filter((message) => message.status === 'interpreted')
    .filter((message) => !message.interpretation || Number(message.interpretation.certainty || 0) < 0.8 ||
      message.interpretation.type === 'DESCONOCIDO')
    .toSorted((left, right) =>
      Number(left.interpretation?.certainty || 0) - Number(right.interpretation?.certainty || 0));
