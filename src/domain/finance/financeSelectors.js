import { customerPortfolio } from '../customers/customerLedger.js';

const activityDifference = (activity) => {
  const match = String(activity.notes || '').match(/Diferencia al cierre:\s*([+-]?\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : 0;
};

export const financeSummary = (state) => {
  const portfolio = customerPortfolio(state);
  const salesRevenue = state.sales
    .filter((sale) => sale.status === 'Completado')
    .reduce((sum, sale) => sum + Number(sale.price ?? sale.total ?? 0), 0);
  const cogs = state.sales
    .filter((sale) => sale.status === 'Completado')
    .reduce((sum, sale) => sum + Number(sale.cogs || 0), 0);
  const expenses = state.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const openCash = state.cashDrawers
    .filter((drawer) => drawer.status === 'Abierta')
    .reduce((sum, drawer) => sum + Number(drawer.balance || 0), 0);
  const drawerDifferences = state.cashDrawerActivities.reduce((sum, activity) => sum + activityDifference(activity), 0);

  return {
    portfolio,
    salesRevenue,
    cogs,
    grossProfit: salesRevenue - cogs,
    expenses,
    netOperating: salesRevenue - cogs - expenses,
    openCash,
    drawerDifferences,
  };
};

export const cashAttention = (state) => {
  const now = Date.now();
  const items = [];
  state.cashDrawers.forEach((drawer) => {
    if (drawer.status === 'Abierta' && drawer.lastOpened) {
      const minutes = Math.floor((now - new Date(drawer.lastOpened).getTime()) / 60000);
      items.push({
        id: `drawer-${drawer.id}`,
        tone: minutes >= 720 ? 'critical' : minutes >= 360 ? 'warning' : 'info',
        title: minutes >= 720 ? 'Caja abierta prolongada' : 'Caja abierta',
        amount: drawer.balance,
        meta: `${minutes} min abierta`,
      });
    }
  });

  state.cashDrawerActivities
    .filter((activity) => activityDifference(activity) !== 0)
    .slice(0, 3)
    .forEach((activity) => {
      items.push({
        id: `cash-diff-${activity.id}`,
        tone: Math.abs(activityDifference(activity)) >= 1000 ? 'critical' : 'warning',
        title: 'Diferencia de caja',
        amount: activityDifference(activity),
        meta: activity.notes || '',
      });
    });

  return {
    items,
    critical: items.filter((item) => item.tone === 'critical').length,
    warning: items.filter((item) => item.tone === 'warning').length,
  };
};
