export const fruitStates = ['Verde', 'Entrado', 'Maduro', 'Suave'];

export const catalogSummary = (state) => ({
  groups: state.productGroups.length,
  activeGroups: state.productGroups.filter((group) => !group.archived).length,
  varieties: state.productGroups.reduce((sum, group) => sum + group.varieties.length, 0),
  activeVarieties: state.productGroups.reduce((sum, group) =>
    sum + group.varieties.filter((variety) => !variety.archived).length, 0),
  activeSizes: Object.values(state.sizes).filter((size) => !size.archived).length,
  activeWarehouses: state.warehouses.filter((warehouse) => !warehouse.archived).length,
  rules: state.ripeningRules.length,
});

export const catalogVarietyRows = (state) =>
  state.productGroups.flatMap((group) =>
    group.varieties.map((variety) => ({
      productGroupId: group.id,
      varietyId: variety.id,
      groupName: group.name,
      category: group.category,
      label: `${group.name} ${variety.name}`,
      icon: variety.icon || group.icon || '--',
      sizes: variety.sizes || [],
      archived: group.archived || variety.archived,
    }))).sort((left, right) => left.label.localeCompare(right.label));

export const catalogSizeRows = (state) =>
  Object.entries(state.sizes).map(([name, size]) => ({
    name,
    icon: size.icon,
    archived: Boolean(size.archived),
    varietyCount: catalogVarietyRows(state).filter((row) => row.sizes.includes(name)).length,
  })).sort((left, right) => left.name.localeCompare(right.name));

export const catalogWarehouseRows = (state) =>
  state.warehouses.map((warehouse) => {
    const batches = state.inventory.filter((batch) => batch.warehouseId === warehouse.id);
    return {
      ...warehouse,
      batchCount: batches.length,
      quantity: batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0),
    };
  });

export const ripeningTransitionRows = (state) =>
  catalogVarietyRows(state)
    .filter((row) => !row.archived)
    .flatMap((variety) => fruitStates.slice(0, -1).map((fromState, index) => {
      const toState = fruitStates[index + 1];
      const rule = state.ripeningRules.find((item) =>
        item.varietyId === variety.varietyId && item.fromState === fromState && item.toState === toState);
      return {
        ...variety,
        fromState,
        toState,
        days: Number(rule?.days || 0),
      };
    }));
