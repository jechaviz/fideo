export const createReceipts = (vue) => vue.ref([]);

export const pushReceipt = (receipts, receipt) => {
  receipts.value = [
    {
      id: `receipt_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      at: new Date().toISOString(),
      ...receipt,
    },
    ...receipts.value,
  ].slice(0, 12);
};

export const nextFruitState = {
  Verde: 'Entrado',
  Entrado: 'Maduro',
  Maduro: 'Suave',
  Suave: '',
};

export const criteriaFromBatch = (batch) => ({
  varietyId: batch.varietyId,
  size: batch.size,
  quality: batch.quality,
  state: batch.state,
  warehouseId: batch.warehouseId,
  packagingId: batch.packagingId,
});

const iconPalette = ['TR', 'MX', 'PV', 'WH', 'ST', 'AI'];

export const nextIconCode = (current) => {
  const index = iconPalette.indexOf(current);
  return iconPalette[(index + 1) % iconPalette.length] || iconPalette[0];
};

export const nextAvailableName = (usedNames, baseName) => {
  const used = new Set(usedNames);
  let candidate = baseName;
  let count = 2;
  while (used.has(candidate)) {
    candidate = `${baseName} ${count}`;
    count += 1;
  }
  return candidate;
};
