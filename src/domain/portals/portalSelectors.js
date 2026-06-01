import { customerLedger, loanBelongsToCustomer, saleBelongsToCustomer } from '../customers/customerLedger.js';
import { purchaseOrderRows } from '../suppliers/supplierSelectors.js';

export const customerPortal = (state, customerId = state.customers[0]?.id) => {
  const customer = state.customers.find((item) => item.id === customerId) || null;
  if (!customer) return null;
  const ledger = customerLedger(state, customer);
  const today = new Date().toDateString();
  return {
    customer,
    ledger,
    todaySales: state.sales.filter((sale) =>
      saleBelongsToCustomer(sale, customer) && new Date(sale.timestamp || 0).toDateString() === today),
    historicalSales: state.sales.filter((sale) => saleBelongsToCustomer(sale, customer)),
    crateLoans: state.crateLoans.filter((loan) => loanBelongsToCustomer(loan, customer)),
    specialPrices: customer.specialPrices || [],
  };
};

export const packerPortal = (state, employeeId = '') => {
  const tasks = state.taskAssignments
    .filter((task) => task.role === 'Empacador' && task.status !== 'done')
    .filter((task) => !employeeId || !task.employeeId || task.employeeId === employeeId)
    .map((task) => ({
      ...task,
      sale: state.sales.find((sale) => sale.id === task.saleId) || null,
      reports: state.taskReports.filter((report) => report.taskId === task.taskId && report.status !== 'resolved'),
    }));
  return {
    tasks,
    queued: tasks.filter((task) => task.status === 'assigned' || task.status === 'acknowledged'),
    active: tasks.filter((task) => task.status === 'in_progress'),
    blocked: tasks.filter((task) => task.status === 'blocked'),
  };
};

export const supplierPortal = (state, supplierId = state.suppliers[0]?.id) => {
  const supplier = state.suppliers.find((item) => item.id === supplierId) || null;
  if (!supplier) return null;
  const orders = purchaseOrderRows(state).filter((order) => order.supplierId === supplier.id);
  return {
    supplier,
    orders,
    totalOrdered: orders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0),
    latestStatus: orders[0]?.status || 'Sin actividad',
  };
};
