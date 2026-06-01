const priceForBatch = (state, batch) =>
  state.prices.find((price) =>
    price.varietyId === batch.varietyId &&
    price.size === batch.size &&
    price.quality === batch.quality &&
    price.state === batch.state)?.price || 0;

export const findProductInfo = (state, varietyId) =>
  state.productGroups
    .flatMap((group) => group.varieties.map((variety) => ({ group, variety })))
    .find(({ variety }) => variety.id === varietyId);

export const productLabelForBatch = (state, batch) => {
  const info = findProductInfo(state, batch.varietyId);
  if (!info) return batch.product || 'Producto sin catalogo';
  return `${info.group.name} ${info.variety.name}`;
};

export const inventoryRows = (state) =>
  state.inventory
    .map((batch) => ({
      ...batch,
      product: productLabelForBatch(state, batch),
      warehouse: state.warehouses.find((item) => item.id === batch.warehouseId) || null,
      crateType: state.crateTypes.find((item) => item.id === batch.packagingId) || null,
      estimatedValue: priceForBatch(state, batch) * Number(batch.quantity || 0),
      unitPrice: priceForBatch(state, batch),
    }))
    .sort((left, right) =>
      left.product.localeCompare(right.product) ||
      left.state.localeCompare(right.state) ||
      left.quality.localeCompare(right.quality));

export const inventoryTotals = (state) => {
  const rows = inventoryRows(state);
  return rows.reduce((acc, row) => {
    acc.quantity += Number(row.quantity || 0);
    acc.value += Number(row.estimatedValue || 0);
    acc.merma += row.quality === 'Merma' ? Number(row.quantity || 0) : 0;
    acc.defects += row.quality === 'Con Defectos' ? Number(row.quantity || 0) : 0;
    return acc;
  }, { quantity: 0, value: 0, merma: 0, defects: 0 });
};

export const inventoryFilterOptions = (state) => {
  const rows = inventoryRows(state);
  return {
    sizes: Array.from(new Set(rows.map((row) => row.size))).sort(),
    qualities: Array.from(new Set(rows.map((row) => row.quality))).sort(),
    states: Array.from(new Set(rows.map((row) => row.state))).sort(),
    warehouses: state.warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      icon: warehouse.icon,
      count: rows.filter((row) => row.warehouseId === warehouse.id).length,
    })),
    locations: Array.from(new Set(rows.map((row) => row.location))).sort(),
  };
};

export const warehouseInventoryMatrix = (state) =>
  state.warehouses.map((warehouse) => {
    const rows = inventoryRows(state).filter((row) => row.warehouseId === warehouse.id);
    return {
      ...warehouse,
      rows,
      quantity: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      value: rows.reduce((sum, row) => sum + Number(row.estimatedValue || 0), 0),
      cold: rows.filter((row) => row.location === 'Camara Fria' || row.location === 'C\u00e1mara Fr\u00eda')
        .reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      floor: rows.filter((row) => row.location !== 'Camara Fria' && row.location !== 'C\u00e1mara Fr\u00eda')
        .reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    };
  });

export const inventoryTableRows = (state, filters = {}) =>
  inventoryRows(state).filter((row) =>
    (!filters.size || row.size === filters.size) &&
    (!filters.quality || row.quality === filters.quality) &&
    (!filters.state || row.state === filters.state) &&
    (!filters.warehouseId || row.warehouseId === filters.warehouseId) &&
    (!filters.location || row.location === filters.location));
