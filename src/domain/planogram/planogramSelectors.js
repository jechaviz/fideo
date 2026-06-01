const coldLocations = new Set(['Camara Fria', 'C\u00e1mara Fr\u00eda']);

const productName = (state, batch) => {
  const group = state.productGroups.find((item) => item.varieties.some((variety) => variety.id === batch.varietyId));
  const variety = group?.varieties.find((item) => item.id === batch.varietyId);
  return group && variety ? `${group.name} ${variety.name}` : batch.product || 'Producto';
};

const stackKey = (batch) => `${batch.varietyId}:${batch.packagingId || 'bulk'}:${batch.location}`;

export const planogramStacks = (state) => {
  const stacks = new Map();
  state.inventory.filter((batch) => Number(batch.quantity || 0) > 0).forEach((batch) => {
    const crateType = state.crateTypes.find((item) => item.id === batch.packagingId);
    const dimensions = crateType?.dimensions || { width: 40, depth: 30, height: 20 };
    const key = stackKey(batch);
    if (!stacks.has(key)) {
      stacks.set(key, {
        id: key,
        name: productName(state, batch),
        location: batch.location,
        crateType,
        batches: [],
        quantity: 0,
        baseArea: dimensions.width * dimensions.depth,
        totalHeight: 0,
      });
    }
    const stack = stacks.get(key);
    stack.batches.push(batch);
    stack.quantity += Number(batch.quantity || 0);
    stack.totalHeight += Number(batch.quantity || 0) * dimensions.height;
  });
  return Array.from(stacks.values()).sort((left, right) => right.quantity - left.quantity);
};

export const planogramZones = (state) => {
  const stacks = planogramStacks(state);
  return {
    cold: stacks.filter((stack) => coldLocations.has(stack.location)),
    floor: stacks.filter((stack) => !coldLocations.has(stack.location)),
    totalQuantity: stacks.reduce((sum, stack) => sum + stack.quantity, 0),
  };
};
