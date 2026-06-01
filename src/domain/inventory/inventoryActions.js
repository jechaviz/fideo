export const FRUIT_STATES = ['Verde', 'Entrado', 'Maduro', 'Suave'];
export const QUALITIES = ['Normal', 'Con Defectos', 'Merma'];

const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.round(Math.random() * 10000)}`;

const receipt = (kind, status, message, extra = {}) => ({
  kind,
  status,
  message,
  ...extra,
});

const pushLog = (state, type, description, details = {}) => {
  state.activityLog.unshift({
    id: makeId('log'),
    type,
    timestamp: nowIso(),
    description,
    details,
  });
};

export const locationForState = (state) => {
  if (state === 'Verde') return 'Camara Fria';
  if (state === 'Entrado') return 'Maduracion';
  return 'Piso de Venta';
};

const normalizeQuantity = (quantity) => {
  const value = Number(quantity);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const samePackage = (left, right) => (left || '') === (right || '');

const batchMatches = (batch, criteria) =>
  batch.varietyId === criteria.varietyId &&
  batch.size === criteria.size &&
  batch.quality === criteria.quality &&
  batch.state === criteria.state &&
  batch.warehouseId === criteria.warehouseId &&
  samePackage(batch.packagingId, criteria.packagingId);

const sortByEntry = (left, right) =>
  new Date(left.entryDate || 0).getTime() - new Date(right.entryDate || 0).getTime();

const cloneInventory = (state) => state.inventory.map((batch) => ({ ...batch }));

const matchingBatches = (inventory, criteria) =>
  inventory.filter((batch) => batchMatches(batch, criteria)).sort(sortByEntry);

const availableQuantity = (batches) =>
  batches.reduce((sum, batch) => sum + normalizeQuantity(batch.quantity), 0);

const productInfoFor = (state, varietyId) =>
  state.productGroups
    .flatMap((group) => group.varieties.map((variety) => ({ group, variety })))
    .find(({ variety }) => variety.id === varietyId);

const productNameFor = (state, varietyId) => {
  const match = productInfoFor(state, varietyId);
  return match ? `${match.group.name} ${match.variety.name}` : 'Producto';
};

const updateInventory = (state, inventory) => {
  state.inventory = inventory.filter((batch) => normalizeQuantity(batch.quantity) > 0);
};

const removeFromSources = (sourceBatches, quantity) => {
  let remaining = quantity;
  sourceBatches.forEach((batch) => {
    if (remaining <= 0) return;
    const decrement = Math.min(remaining, normalizeQuantity(batch.quantity));
    batch.quantity -= decrement;
    remaining -= decrement;
  });
};

const upsertBatch = (inventory, draft, quantity) => {
  const existing = inventory.find((batch) =>
    batch.varietyId === draft.varietyId &&
    batch.size === draft.size &&
    batch.quality === draft.quality &&
    batch.state === draft.state &&
    batch.warehouseId === draft.warehouseId &&
    batch.location === draft.location &&
    samePackage(batch.packagingId, draft.packagingId));

  if (existing) {
    existing.quantity += quantity;
    return existing;
  }

  const created = {
    id: makeId('batch'),
    entryDate: nowIso(),
    ...draft,
    quantity,
  };
  inventory.push(created);
  return created;
};

export const moveInventory = (state, from, toState, quantityToMove) => {
  const quantity = normalizeQuantity(quantityToMove);
  if (quantity <= 0) return receipt('inventory_move', 'failed', 'Cantidad invalida.');
  if (from.state === toState) return receipt('inventory_move', 'skipped', 'El inventario ya esta en ese estado.');

  const productName = productNameFor(state, from.varietyId);
  const inventory = cloneInventory(state);
  const sources = matchingBatches(inventory, from);
  const available = availableQuantity(sources);
  if (available < quantity) {
    return receipt('inventory_move', 'failed', `Stock insuficiente. Disponible: ${available}`);
  }

  removeFromSources(sources, quantity);
  upsertBatch(inventory, {
    ...from,
    product: productName,
    state: toState,
    location: locationForState(toState),
  }, quantity);

  updateInventory(state, inventory);
  pushLog(state, 'MOVIMIENTO_ESTADO', `Movimiento de ${productName}`, {
    Cantidad: quantity,
    De: from.state,
    A: toState,
    Tamano: from.size,
  });
  return receipt('inventory_move', 'ok', 'Movimiento exitoso.', { quantity, toState });
};

export const moveBatchLocation = (state, batchId, newLocation, quantityToMove) => {
  const quantity = normalizeQuantity(quantityToMove);
  const inventory = cloneInventory(state);
  const batch = inventory.find((item) => item.id === batchId);
  if (!batch) return receipt('inventory_location_move', 'skipped', 'Lote no encontrado.');
  if (quantity <= 0) return receipt('inventory_location_move', 'failed', 'Cantidad invalida.');
  if (batch.location === newLocation) {
    return receipt('inventory_location_move', 'skipped', 'El lote ya esta en esa ubicacion.');
  }
  if (quantity > batch.quantity) {
    return receipt('inventory_location_move', 'failed', `Cantidad excede stock (${batch.quantity}).`);
  }

  batch.quantity -= quantity;
  upsertBatch(inventory, { ...batch, location: newLocation }, quantity);
  updateInventory(state, inventory);
  pushLog(state, 'MOVIMIENTO_ESTADO', `Movimiento de ubicacion: ${productNameFor(state, batch.varietyId)}`, {
    De: batch.location,
    A: newLocation,
    Cantidad: quantity,
  });
  return receipt('inventory_location_move', 'ok', `Movido a ${newLocation}.`, { batchId, quantity });
};

export const changeQuality = (state, from, toQuality, quantityToMove) => {
  const quantity = normalizeQuantity(quantityToMove);
  if (quantity <= 0) return receipt('inventory_quality_change', 'failed', 'Cantidad invalida.');
  if (from.quality === toQuality) return receipt('inventory_quality_change', 'skipped', 'La calidad ya coincide.');

  const productName = productNameFor(state, from.varietyId);
  const inventory = cloneInventory(state);
  const sources = matchingBatches(inventory, from);
  const available = availableQuantity(sources);
  if (available < quantity) {
    return receipt('inventory_quality_change', 'failed', `Stock insuficiente. Disponible: ${available}`);
  }

  const location = sources[0]?.location || locationForState(from.state);
  removeFromSources(sources, quantity);
  upsertBatch(inventory, {
    ...from,
    product: productName,
    quality: toQuality,
    location,
  }, quantity);

  updateInventory(state, inventory);
  pushLog(state, 'MOVIMIENTO_CALIDAD', `Cambio de calidad para ${productName}`, {
    Cantidad: quantity,
    De: from.quality,
    A: toQuality,
    Tamano: from.size,
    Estado: from.state,
  });

  if (toQuality === 'Merma') {
    const unitPrice = state.prices.find((price) =>
      price.varietyId === from.varietyId &&
      price.size === from.size &&
      price.quality === from.quality &&
      price.state === from.state)?.price || 0;
    const amount = unitPrice * quantity;
    if (amount > 0) {
      state.expenses.unshift({
        id: makeId('expense'),
        description: `Merma de ${quantity} unidades de ${productName} (${from.size})`,
        amount,
        date: nowIso(),
        category: 'Merma',
      });
      pushLog(state, 'MERMA_REGISTRO', `Registro de merma para ${productName}`, {
        Cantidad: quantity,
        CostoEstimado: amount,
      });
    }
  }

  return receipt('inventory_quality_change', 'ok', `${quantity} movido a ${toQuality}.`, {
    quantity,
    toQuality,
  });
};

export const adjustInventory = (state, criteria, newTotal) => {
  const targetTotal = normalizeQuantity(newTotal);
  const inventory = cloneInventory(state);
  const sources = matchingBatches(inventory, criteria);
  const originalTotal = availableQuantity(sources);
  const difference = targetTotal - originalTotal;

  if (difference === 0) return receipt('inventory_adjust', 'ok', 'Sin cambios.');
  if (difference < 0 && originalTotal < Math.abs(difference)) {
    return receipt('inventory_adjust', 'failed', `Stock insuficiente (${originalTotal}).`);
  }

  if (difference > 0) {
    upsertBatch(inventory, {
      ...criteria,
      product: productNameFor(state, criteria.varietyId),
      location: locationForState(criteria.state),
    }, difference);
  } else {
    removeFromSources(sources, Math.abs(difference));
  }

  updateInventory(state, inventory);
  const warehouse = state.warehouses.find((item) => item.id === criteria.warehouseId);
  pushLog(state, 'INVENTARIO_AJUSTE', `Ajuste manual de ${productNameFor(state, criteria.varietyId)}`, {
    Bodega: warehouse?.name || 'N/A',
    Diferencia: difference,
    NuevoTotal: targetTotal,
  });
  return receipt('inventory_adjust', 'ok', `Ajustado: ${difference > 0 ? '+' : ''}${difference}`, {
    difference,
    newTotal: targetTotal,
  });
};
