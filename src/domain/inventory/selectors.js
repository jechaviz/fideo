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
      estimatedValue: priceForBatch(state, batch) * Number(batch.quantity || 0),
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
