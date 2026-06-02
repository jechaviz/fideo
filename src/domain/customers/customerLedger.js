export const saleBelongsToCustomer = (sale, customer) =>
  (sale.customerId && sale.customerId === customer.id) || (!sale.customerId && sale.customer === customer.name);

export const loanBelongsToCustomer = (loan, customer) =>
  (loan.customerId && loan.customerId === customer.id) || (!loan.customerId && loan.customer === customer.name);

export const findCustomerForSale = (state, sale) => {
  if (!sale) return null;
  if (sale.customerId) {
    return state.customers.find((customer) => customer.id === sale.customerId) ||
      state.customers.find((customer) => customer.name === sale.customer) || null;
  }
  return state.customers.find((customer) => customer.name === sale.customer) || null;
};

const saleAmount = (sale) => Number(sale.price ?? sale.total ?? 0);

const loanValue = (state, loan) => {
  const crateType = state.crateTypes.find((item) => item.id === loan.crateTypeId);
  return Number(loan.quantity || 0) * Number(crateType?.cost || 50);
};

export const customerLedger = (state, customer) => {
  const sales = state.sales.filter((sale) => saleBelongsToCustomer(sale, customer));
  const payments = state.payments.filter((payment) => payment.customerId === customer.id);
  const loans = state.crateLoans.filter((loan) =>
    loanBelongsToCustomer(loan, customer) && ['Prestado', 'No Devuelto'].includes(loan.status));

  const billedDebt = sales
    .filter((sale) => sale.paymentStatus === 'En Deuda' && sale.status === 'Completado')
    .reduce((sum, sale) => sum + saleAmount(sale), 0);
  const debtSaleIds = new Set(sales
    .filter((sale) => sale.paymentStatus === 'En Deuda' && sale.status === 'Completado')
    .map((sale) => sale.id));
  const paid = payments
    .filter((payment) => !payment.saleId || debtSaleIds.has(payment.saleId))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const monetaryDebt = Math.max(0, billedDebt - paid);
  const lentCratesValue = loans.reduce((sum, loan) => sum + loanValue(state, loan), 0);
  const lastSale = sales.toSorted((left, right) =>
    new Date(right.timestamp || 0) - new Date(left.timestamp || 0))[0] || null;

  return {
    customer,
    sales,
    payments,
    loans,
    monetaryDebt,
    lentCratesValue,
    totalBalance: monetaryDebt + lentCratesValue,
    totalOrders: sales.length,
    lastSale,
    creditUsagePct: customer.creditLimit ? Math.min(100, (monetaryDebt / customer.creditLimit) * 100) : 0,
  };
};

export const customerPortfolio = (state) => {
  const ledgers = state.customers.map((customer) => customerLedger(state, customer));
  const activeSince = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const activeCustomerIds = new Set(
    state.sales
      .filter((sale) => new Date(sale.timestamp || 0).getTime() >= activeSince)
      .map((sale) => findCustomerForSale(state, sale)?.id)
      .filter(Boolean));

  return {
    ledgers,
    customers: state.customers.length,
    activeCustomers: activeCustomerIds.size,
    monetaryDebt: ledgers.reduce((sum, ledger) => sum + ledger.monetaryDebt, 0),
    lentCratesValue: ledgers.reduce((sum, ledger) => sum + ledger.lentCratesValue, 0),
    totalBalance: ledgers.reduce((sum, ledger) => sum + ledger.totalBalance, 0),
  };
};
