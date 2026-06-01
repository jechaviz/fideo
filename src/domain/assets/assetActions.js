import { makeId, nowIso, pushLog, receipt } from '../core/events.js';

export const addFixedAsset = (state, assetData) => {
  const asset = {
    id: makeId('fa'),
    name: assetData.name || 'Activo',
    category: assetData.category || 'Equipo',
    status: assetData.status || 'Activo',
    cost: Number(assetData.cost || 0),
    purchaseDate: assetData.purchaseDate || nowIso(),
    photoUrl: assetData.photoUrl || '',
    metadata: assetData.metadata || {},
  };
  state.fixedAssets.unshift(asset);
  state.expenses.unshift({
    id: makeId('expense'),
    description: `Compra de activo: ${asset.name}`,
    amount: asset.cost,
    date: asset.purchaseDate,
    category: 'Compra Activo',
    relatedAssetId: asset.id,
  });
  pushLog(state, 'GASTO', `Compra de activo: ${asset.name}`, { Monto: asset.cost });
  return receipt('fixed_asset_add', 'ok', `Activo agregado: ${asset.name}`, { asset });
};

export const updateFixedAsset = (state, assetId, updates) => {
  const asset = state.fixedAssets.find((item) => item.id === assetId);
  if (!asset) return receipt('fixed_asset_update', 'skipped', 'Activo no encontrado.');
  Object.assign(asset, updates);
  pushLog(state, 'PRODUCTO_CRUD', `Activo actualizado: ${asset.name}`, { Activo: asset.name });
  return receipt('fixed_asset_update', 'ok', `Activo actualizado: ${asset.name}`, { assetId });
};

export const logAssetMaintenance = (state, assetId, cost, description) => {
  const asset = state.fixedAssets.find((item) => item.id === assetId);
  if (!asset) return receipt('asset_maintenance', 'skipped', 'Activo no encontrado.');
  asset.status = 'En Reparacion';
  const expense = {
    id: makeId('expense'),
    description: `Reparacion: ${description || asset.name}`,
    amount: Number(cost || 0),
    date: nowIso(),
    category: 'Reparacion',
    relatedAssetId: assetId,
  };
  state.expenses.unshift(expense);
  pushLog(state, 'GASTO', `Gasto registrado: ${expense.description}`, {
    Categoria: expense.category,
    Monto: expense.amount,
  });
  return receipt('asset_maintenance', 'ok', `Mantenimiento registrado: ${asset.name}`, { assetId, expense });
};
