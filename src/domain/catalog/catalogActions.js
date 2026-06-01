import { makeId, pushLog, receipt } from '../core/events.js';

const scalarDetails = (updates) =>
  Object.fromEntries(Object.entries(updates).filter(([, value]) =>
    ['string', 'number', 'boolean'].includes(typeof value)));

const findGroup = (state, productGroupId) =>
  state.productGroups.find((group) => group.id === productGroupId);

const findVariety = (group, varietyId) =>
  group?.varieties.find((variety) => variety.id === varietyId);

export const addProductGroup = (state, productData) => {
  const productGroup = {
    ...productData,
    id: makeId('pg'),
    archived: false,
    varieties: [],
  };
  state.productGroups.push(productGroup);
  pushLog(state, 'PRODUCTO_CRUD', `Grupo de producto creado: ${productGroup.name}`, {
    Categoria: productGroup.category || '',
  });
  return receipt('catalog_group_add', 'ok', `Grupo creado: ${productGroup.name}`, { productGroup });
};

export const updateProductGroup = (state, productGroupId, updates) => {
  const group = findGroup(state, productGroupId);
  if (!group) return receipt('catalog_group_update', 'skipped', 'Grupo no encontrado.');
  const originalName = group.name;
  Object.assign(group, updates);
  pushLog(state, 'PRODUCTO_CRUD', `Grupo actualizado: ${originalName}`, scalarDetails(updates));
  return receipt('catalog_group_update', 'ok', `Grupo actualizado: ${group.name}`, { productGroupId });
};

export const setProductGroupArchived = (state, productGroupId, archived) => {
  const group = findGroup(state, productGroupId);
  if (!group) return receipt('catalog_group_archive', 'skipped', 'Grupo no encontrado.');
  group.archived = Boolean(archived);
  group.varieties.forEach((variety) => {
    variety.archived = Boolean(archived);
  });
  pushLog(state, 'PRODUCTO_CRUD', archived ? 'Grupo archivado' : 'Grupo desarchivado', {
    Producto: group.name,
  });
  return receipt('catalog_group_archive', 'ok', archived ? 'Grupo archivado.' : 'Grupo activo.', {
    productGroupId,
  });
};

export const addVariety = (state, productGroupId, varietyData) => {
  const group = findGroup(state, productGroupId);
  if (!group) return receipt('catalog_variety_add', 'skipped', 'Grupo no encontrado.');
  const variety = { ...varietyData, id: makeId('var'), archived: false };
  group.varieties.push(variety);
  pushLog(state, 'PRODUCTO_CRUD', `Variedad creada: ${variety.name}`, { Grupo: group.name });
  return receipt('catalog_variety_add', 'ok', `Variedad creada: ${variety.name}`, { variety });
};

export const updateVariety = (state, productGroupId, varietyId, updates) => {
  const group = findGroup(state, productGroupId);
  const variety = findVariety(group, varietyId);
  if (!variety) return receipt('catalog_variety_update', 'skipped', 'Variedad no encontrada.');
  const originalName = variety.name;
  Object.assign(variety, updates);
  pushLog(state, 'PRODUCTO_CRUD', `Variedad actualizada: ${originalName}`, scalarDetails(updates));
  return receipt('catalog_variety_update', 'ok', `Variedad actualizada: ${variety.name}`, { varietyId });
};

export const setVarietyArchived = (state, productGroupId, varietyId, archived) => {
  const group = findGroup(state, productGroupId);
  const variety = findVariety(group, varietyId);
  if (!variety) return receipt('catalog_variety_archive', 'skipped', 'Variedad no encontrada.');
  variety.archived = Boolean(archived);
  pushLog(state, 'PRODUCTO_CRUD', archived ? 'Variedad archivada' : 'Variedad desarchivada', {
    Variedad: variety.name,
  });
  return receipt('catalog_variety_archive', 'ok', archived ? 'Variedad archivada.' : 'Variedad activa.', {
    varietyId,
  });
};

export const setCategoryIcon = (state, categoryName, icon) => {
  const cleanCategory = String(categoryName || '').trim();
  const cleanIcon = String(icon || '').trim();
  if (!cleanCategory || !cleanIcon) return receipt('catalog_category_icon', 'failed', 'Categoria o icono invalido.');
  state.categoryIcons = { ...(state.categoryIcons || {}), [cleanCategory]: cleanIcon };
  pushLog(state, 'PRODUCTO_CRUD', 'Icono de categoria cambiado', { Categoria: cleanCategory, Icono: cleanIcon });
  return receipt('catalog_category_icon', 'ok', `Icono actualizado: ${cleanCategory}`, { categoryName: cleanCategory });
};

export const setStateIcon = (state, stateName, icon) => {
  const cleanState = String(stateName || '').trim();
  const cleanIcon = String(icon || '').trim();
  if (!cleanState || !cleanIcon) return receipt('catalog_state_icon', 'failed', 'Estado o icono invalido.');
  state.stateIcons = { ...(state.stateIcons || {}), [cleanState]: cleanIcon };
  pushLog(state, 'PRODUCTO_CRUD', 'Icono de estado cambiado', { Estado: cleanState, Icono: cleanIcon });
  return receipt('catalog_state_icon', 'ok', `Icono actualizado: ${cleanState}`, { stateName: cleanState });
};

export const addSize = (state, name, icon) => {
  const cleanName = String(name || '').trim();
  const cleanIcon = String(icon || cleanName.slice(0, 2).toUpperCase()).trim();
  if (!cleanName) return receipt('catalog_size_add', 'failed', 'Tamano invalido.');
  if (state.sizes[cleanName]) return receipt('catalog_size_add', 'skipped', 'Tamano existente.');
  state.sizes[cleanName] = { icon: cleanIcon, archived: false };
  pushLog(state, 'PRODUCTO_CRUD', `Nuevo tamano creado: ${cleanName}`, { Icono: cleanIcon });
  return receipt('catalog_size_add', 'ok', `Tamano creado: ${cleanName}`, { name: cleanName });
};

export const updateSize = (state, oldName, updates) => {
  const size = state.sizes[oldName];
  if (!size) return receipt('catalog_size_update', 'skipped', 'Tamano no encontrado.');
  const finalName = updates.name || oldName;
  if (finalName !== oldName && state.sizes[finalName]) {
    return receipt('catalog_size_update', 'failed', 'El tamano destino ya existe.');
  }

  delete state.sizes[oldName];
  state.sizes[finalName] = {
    icon: updates.icon ?? size.icon,
    archived: size.archived || false,
  };

  if (finalName !== oldName) {
    state.productGroups.forEach((group) => {
      group.varieties.forEach((variety) => {
        variety.sizes = variety.sizes.map((item) => (item === oldName ? finalName : item));
      });
    });
    pushLog(state, 'PRODUCTO_CRUD', 'Tamano renombrado', { De: oldName, A: finalName });
  }
  if (updates.icon !== undefined) {
    pushLog(state, 'PRODUCTO_CRUD', `Icono de tamano actualizado: ${finalName}`, { Icono: updates.icon });
  }

  return receipt('catalog_size_update', 'ok', `Tamano actualizado: ${finalName}`, { name: finalName });
};

export const setSizeArchived = (state, name, archived) => {
  const size = state.sizes[name];
  if (!size) return receipt('catalog_size_archive', 'skipped', 'Tamano no encontrado.');
  state.sizes[name] = { ...size, archived: Boolean(archived) };
  pushLog(state, 'PRODUCTO_CRUD', archived ? 'Tamano archivado' : 'Tamano desarchivado', { Tamano: name });
  return receipt('catalog_size_archive', 'ok', archived ? 'Tamano archivado.' : 'Tamano activo.', { name });
};

export const addWarehouse = (state, name, icon) => {
  const cleanName = String(name || '').trim();
  const cleanIcon = String(icon || cleanName.slice(0, 2).toUpperCase()).trim();
  if (!cleanName || !cleanIcon) return receipt('catalog_warehouse_add', 'failed', 'Bodega invalida.');
  const warehouse = { id: makeId('wh'), name: cleanName, icon: cleanIcon, archived: false };
  state.warehouses.push(warehouse);
  pushLog(state, 'BODEGA_CRUD', `Nueva bodega creada: ${cleanName}`, { Icono: cleanIcon });
  return receipt('catalog_warehouse_add', 'ok', `Bodega creada: ${cleanName}`, { warehouse });
};

export const updateWarehouse = (state, warehouseId, updates) => {
  const warehouse = state.warehouses.find((item) => item.id === warehouseId);
  if (!warehouse) return receipt('catalog_warehouse_update', 'skipped', 'Bodega no encontrada.');
  const originalName = warehouse.name;
  Object.assign(warehouse, updates);
  pushLog(state, 'BODEGA_CRUD', `Bodega actualizada: ${originalName}`, scalarDetails(updates));
  return receipt('catalog_warehouse_update', 'ok', `Bodega actualizada: ${warehouse.name}`, { warehouseId });
};

export const setWarehouseArchived = (state, warehouseId, archived) => {
  const warehouse = state.warehouses.find((item) => item.id === warehouseId);
  if (!warehouse) return receipt('catalog_warehouse_archive', 'skipped', 'Bodega no encontrada.');
  warehouse.archived = Boolean(archived);
  pushLog(state, 'BODEGA_CRUD', archived ? 'Bodega archivada' : 'Bodega desarchivada', { Bodega: warehouse.name });
  return receipt('catalog_warehouse_archive', 'ok', archived ? 'Bodega archivada.' : 'Bodega activa.', { warehouseId });
};

export const setRipeningRule = (state, varietyId, fromState, toState, days) => {
  const cleanDays = Math.max(0, Number(days) || 0);
  const existing = state.ripeningRules.find((rule) =>
    rule.varietyId === varietyId && rule.fromState === fromState && rule.toState === toState);
  const varietyInfo = state.productGroups
    .flatMap((group) => group.varieties.map((variety) => ({ groupName: group.name, ...variety })))
    .find((variety) => variety.id === varietyId);

  if (cleanDays === 0) {
    if (!existing) return receipt('catalog_ripening_rule', 'skipped', 'Regla no encontrada.');
    state.ripeningRules = state.ripeningRules.filter((rule) => rule.id !== existing.id);
    pushLog(state, 'REGLA_MADURACION_CRUD', 'Regla de maduracion eliminada', {
      Variedad: varietyInfo?.name || varietyId,
    });
    return receipt('catalog_ripening_rule', 'ok', 'Regla eliminada.', { varietyId });
  }

  if (existing) {
    existing.days = cleanDays;
  } else {
    state.ripeningRules.push({ id: makeId('rr'), varietyId, fromState, toState, days: cleanDays });
  }
  pushLog(state, 'REGLA_MADURACION_CRUD', 'Regla de maduracion guardada', {
    Variedad: varietyInfo ? `${varietyInfo.groupName} ${varietyInfo.name}` : varietyId,
    De: fromState,
    A: toState,
    Dias: cleanDays,
  });
  return receipt('catalog_ripening_rule', 'ok', 'Regla guardada.', { varietyId, days: cleanDays });
};

export const addCrateType = (state, crateTypeData) => {
  const crateType = {
    ...crateTypeData,
    dimensions: crateTypeData.dimensions || { width: 40, depth: 30, height: 20 },
    id: makeId('ct'),
  };
  state.crateTypes.push(crateType);
  state.crateInventory.push({ crateTypeId: crateType.id, quantityOwned: 0 });
  pushLog(state, 'PRODUCTO_CRUD', `Tipo de caja creado: ${crateType.name}`);
  return receipt('catalog_crate_add', 'ok', `Tipo de caja creado: ${crateType.name}`, { crateType });
};

export const deleteCrateType = (state, crateTypeId) => {
  const before = state.crateTypes.length;
  state.crateTypes = state.crateTypes.filter((crateType) => crateType.id !== crateTypeId);
  state.crateInventory = state.crateInventory.filter((item) => item.crateTypeId !== crateTypeId);
  if (state.crateTypes.length === before) return receipt('catalog_crate_delete', 'skipped', 'Tipo de caja no encontrado.');
  pushLog(state, 'PRODUCTO_CRUD', 'Tipo de caja eliminado', { crateTypeId });
  return receipt('catalog_crate_delete', 'ok', 'Tipo de caja eliminado.', { crateTypeId });
};
