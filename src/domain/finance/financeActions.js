import { makeId, nowIso, pushLog, receipt } from '../core/events.js';

const findDrawer = (state, drawerId) =>
  state.cashDrawers.find((drawer) => drawer.id === drawerId);

export const openCashDrawer = (state, drawerId, initialBalance = 0, notes = '') => {
  const drawer = findDrawer(state, drawerId);
  if (!drawer) return receipt('cash_drawer_open', 'skipped', 'Caja no encontrada.');
  if (drawer.status === 'Abierta') return receipt('cash_drawer_open', 'failed', 'La caja ya esta abierta.');

  drawer.status = 'Abierta';
  drawer.balance = Number(initialBalance || 0);
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

  const counted = Number(finalBalance || 0);
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
  const expense = {
    id: makeId('expense'),
    description: expenseData.description || 'Gasto',
    amount: Number(expenseData.amount || 0),
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
