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

export const supplierCostMatrix = (state) =>
  supplierRows(state).flatMap((supplier) =>
    supplier.coverage.map((supply) => {
      const packagingAvg = supply.packagingOptions.length
        ? supply.packagingOptions.reduce((sum, option) => sum + Number(option.cost || 0), 0) / supply.packagingOptions.length
        : 0;
      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        varietyId: supply.varietyId,
        productName: supply.product ? `${supply.product.group.name} ${supply.product.variety.name}` : 'Producto',
        baseCost: Number(supply.baseCost || 0),
        freightCost: Number(supply.freightCost || 0),
        packagingAvg,
        landedCost: Number(supply.baseCost || 0) + Number(supply.freightCost || 0) + packagingAvg,
        sizes: supply.availableSizes,
        packagingOptions: supply.packagingOptions,
      };
    }))
    .toSorted((left, right) => left.landedCost - right.landedCost);

export const purchaseOrderPipeline = (state) => {
  const rows = purchaseOrderRows(state);
  const byStatus = {
    Pendiente: rows.filter((order) => order.status === 'Pendiente'),
    Ordenado: rows.filter((order) => order.status === 'Ordenado'),
    Recibido: rows.filter((order) => order.status === 'Recibido'),
  };
  return {
    ...byStatus,
    totalOpenCost: [...byStatus.Pendiente, ...byStatus.Ordenado]
      .reduce((sum, order) => sum + Number(order.totalCost || 0), 0),
    receivedCost: byStatus.Recibido.reduce((sum, order) => sum + Number(order.totalCost || 0), 0),
    openCount: byStatus.Pendiente.length + byStatus.Ordenado.length,
  };
};

export const purchaseReceiptRows = (state) =>
  (state.purchaseReceipts || []).map((receipt) => ({
    ...receipt,
    supplier: state.suppliers.find((supplier) => supplier.id === receipt.supplierId) || null,
    order: state.purchaseOrders.find((order) => order.id === receipt.purchaseOrderId) || null,
  })).toSorted((left, right) => String(right.at || '').localeCompare(String(left.at || '')));

export const purchaseReceiptSummary = (state) => {
  const rows = purchaseReceiptRows(state);
  const remoteRows = rows.filter((row) => row.provider !== 'local');
  return {
    receipts: rows.length,
    remoteReceipts: remoteRows.length,
    receivedAmount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    remoteAmount: remoteRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
  };
};
