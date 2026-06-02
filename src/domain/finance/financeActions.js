import { makeId, nowIso, pushLog, receipt } from '../core/events.js';
import { cashActivityRows, financeSummary } from './financeSelectors.js';

const findDrawer = (state, drawerId) =>
  state.cashDrawers.find((drawer) => drawer.id === drawerId);

const isFiniteNonNegative = (value) => Number.isFinite(value) && value >= 0;
const isFinitePositive = (value) => Number.isFinite(value) && value > 0;
const cashMovementTypes = new Set(['INGRESO_VENTA', 'EGRESO_COMPRA', 'DEPOSITO_BANCO', 'RETIRO_EFECTIVO']);

export const openCashDrawer = (state, drawerId, initialBalance = 0, notes = '') => {
  const drawer = findDrawer(state, drawerId);
  if (!drawer) return receipt('cash_drawer_open', 'skipped', 'Caja no encontrada.');
  if (drawer.status === 'Abierta') return receipt('cash_drawer_open', 'failed', 'La caja ya esta abierta.');
  const balance = Number(initialBalance);
  if (!isFiniteNonNegative(balance)) return receipt('cash_drawer_open', 'failed', 'Saldo inicial invalido.');

  drawer.status = 'Abierta';
  drawer.balance = balance;
  drawer.lastOpened = nowIso();
  state.cashDrawerActivities.unshift({
    id: makeId('cda'),
    drawerId,
    type: 'SALDO_INICIAL',
    amount: drawer.balance,
    timestamp: nowIso(),
    notes: notes || 'Apertura de caja',
  });
  pushLog(state, 'CAJA_OPERACION', `Apertura de caja: ${drawer.name}`, { SaldoInicial: drawer.balance });
  return receipt('cash_drawer_open', 'ok', 'Caja abierta.', { drawerId });
};

export const closeCashDrawer = (state, drawerId, finalBalance = 0, notes = '') => {
  const drawer = findDrawer(state, drawerId);
  if (!drawer) return receipt('cash_drawer_close', 'skipped', 'Caja no encontrada.');
  if (drawer.status === 'Cerrada') return receipt('cash_drawer_close', 'failed', 'La caja ya esta cerrada.');

  const counted = Number(finalBalance);
  if (!isFiniteNonNegative(counted)) return receipt('cash_drawer_close', 'failed', 'Saldo final invalido.');
  const difference = counted - Number(drawer.balance || 0);
  const timestamp = nowIso();
  if (difference !== 0) {
    state.cashDrawerActivities.unshift({
      id: makeId('cda_diff'),
      drawerId,
      type: 'CORTE_CIERRE',
      amount: Math.abs(difference),
      timestamp,
      notes: `Diferencia al cierre: ${difference}`,
    });
  }
  state.cashDrawerActivities.unshift({
    id: makeId('cda_close'),
    drawerId,
    type: 'CORTE_CIERRE',
    amount: counted,
    timestamp,
    notes: notes || 'Cierre de caja',
  });
  drawer.status = 'Cerrada';
  drawer.balance = 0;
  drawer.lastClosed = timestamp;
  pushLog(state, 'CAJA_OPERACION', `Cierre de caja: ${drawer.name}`, {
    SaldoFinal: counted,
    Diferencia: difference,
  });
  return receipt('cash_drawer_close', 'ok', `Caja cerrada. Diferencia: ${difference}`, { drawerId, difference });
};

export const addExpense = (state, expenseData) => {
  const amount = Number(expenseData.amount);
  if (!isFinitePositive(amount)) return receipt('expense_add', 'failed', 'El gasto debe ser mayor a cero.');
  const expense = {
    id: makeId('expense'),
    description: expenseData.description || 'Gasto',
    amount,
    date: expenseData.date || nowIso(),
    category: expenseData.category || 'Otros',
    relatedAssetId: expenseData.relatedAssetId || null,
  };
  state.expenses.unshift(expense);
  pushLog(state, 'GASTO', `Gasto registrado: ${expense.description}`, {
    Categoria: expense.category,
    Monto: expense.amount,
  });
  return receipt('expense_add', 'ok', `Gasto registrado: ${expense.description}`, { expense });
};

export const signedCashMovementAmount = (type, amount) => {
  const cleanAmount = Math.abs(Number(amount || 0));
  return ['EGRESO_COMPRA', 'DEPOSITO_BANCO', 'RETIRO_EFECTIVO'].includes(type) ? -cleanAmount : cleanAmount;
};

export const recordCashMovement = (state, drawerId, type, amount, notes = '', relatedId = '') => {
  const drawer = findDrawer(state, drawerId);
  if (!drawer) return receipt('cash_movement', 'skipped', 'Caja no encontrada.');
  if (drawer.status !== 'Abierta') return receipt('cash_movement', 'failed', 'La caja esta cerrada.');
  if (!cashMovementTypes.has(type)) return receipt('cash_movement', 'failed', 'Tipo de movimiento invalido.');
  if (!isFinitePositive(Number(amount))) return receipt('cash_movement', 'failed', 'Monto de caja invalido.');

  const signedAmount = signedCashMovementAmount(type, amount);
  if (signedAmount < 0 && Math.abs(signedAmount) > Number(drawer.balance || 0)) {
    return receipt('cash_movement', 'failed', 'Saldo insuficiente en caja.');
  }

  drawer.balance = Number(drawer.balance || 0) + signedAmount;
  const activity = {
    id: makeId('cda'),
    drawerId,
    type,
    amount: signedAmount,
    timestamp: nowIso(),
    notes: notes || type.replace(/_/g, ' ').toLowerCase(),
    relatedId,
  };
  state.cashDrawerActivities.unshift(activity);
  pushLog(state, 'CAJA_OPERACION', `Movimiento de caja: ${activity.notes}`, {
    Tipo: type,
    Monto: signedAmount,
  });
  return receipt('cash_movement', 'ok', `Movimiento registrado: ${activity.notes}`, { activity });
};

export const createFinanceExport = (state, format = 'json') => {
  const summary = financeSummary(state);
  const activities = cashActivityRows(state);
  const exportRecord = {
    id: makeId('finance_export'),
    format,
    createdAt: nowIso(),
    totals: {
      salesRevenue: summary.salesRevenue,
      grossProfit: summary.grossProfit,
      expenses: summary.expenses,
      openCash: summary.openCash,
      monetaryDebt: summary.portfolio.monetaryDebt,
    },
    rows: {
      cashActivities: activities.length,
      expenses: state.expenses.length,
      payments: state.payments.length,
      debtors: summary.portfolio.ledgers.filter((ledger) => ledger.totalBalance > 0).length,
    },
  };
  state.financeExports ||= [];
  state.financeExports.unshift(exportRecord);
  pushLog(state, 'CAJA_OPERACION', 'Export financiero generado', { Formato: format });
  return receipt('finance_export', 'ok', `Export ${format} generado.`, { exportId: exportRecord.id });
};

export const recordCashRemoteReceipt = (state, input = {}) => {
  const provider = String(input.provider || '').trim();
  if (!provider) return receipt('cash_remote_receipt', 'skipped', 'Proveedor incompleto.');
  const drawer = findDrawer(state, input.drawerId) || state.cashDrawers[0];
  state.cashRemoteReceipts ||= [];
  state.cashRemoteReceipts.unshift({
    id: makeId('cash_remote_receipt'),
    drawerId: drawer?.id || '',
    provider,
    status: input.status || 'acknowledged',
    amount: Number(input.amount ?? drawer?.balance ?? 0),
    message: input.message || `${provider} acuse de caja registrado.`,
    at: nowIso(),
  });
  pushLog(state, 'CAJA_OPERACION', `Acuse remoto de caja ${provider}`, { Caja: drawer?.name || '' });
  return receipt('cash_remote_receipt', 'ok', `Acuse ${provider} registrado.`, {
    drawerId: drawer?.id || '',
    provider,
  });
};
