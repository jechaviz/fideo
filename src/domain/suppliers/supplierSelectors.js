const productInfoFor = (state, varietyId) =>
  state.productGroups
    .flatMap((group) => group.varieties.map((variety) => ({ group, variety })))
    .find(({ variety }) => variety.id === varietyId);

export const supplierRows = (state) =>
  state.suppliers.map((supplier) => {
    const landedCosts = supplier.supplies.map((supply) => supply.baseCost + supply.freightCost);
    return {
      ...supplier,
      supplyCount: supplier.supplies.length,
      avgLandedCost: landedCosts.length
        ? landedCosts.reduce((sum, value) => sum + value, 0) / landedCosts.length
        : 0,
      coverage: supplier.supplies.map((supply) => ({
        ...supply,
        product: productInfoFor(state, supply.varietyId),
      })),
    };
  });

export const supplierStats = (state) => {
  const rows = supplierRows(state);
  const freightValues = state.suppliers.flatMap((supplier) => supplier.supplies.map((supply) => supply.freightCost));
  return {
    supplierCount: state.suppliers.length,
    suppliedVarieties: new Set(state.suppliers.flatMap((supplier) =>
      supplier.supplies.map((supply) => supply.varietyId))).size,
    avgFreight: freightValues.length
      ? freightValues.reduce((sum, value) => sum + value, 0) / freightValues.length
      : 0,
    totalCoverage: rows.reduce((sum, row) => sum + row.supplyCount, 0),
  };
};

export const purchaseOrderRows = (state) =>
  state.purchaseOrders.map((order) => ({
    ...order,
    supplier: state.suppliers.find((item) => item.id === order.supplierId),
    product: productInfoFor(state, order.varietyId),
  })).sort((left, right) => new Date(right.orderDate || 0) - new Date(left.orderDate || 0));
