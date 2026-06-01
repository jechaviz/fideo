import { makeId, nowIso, pushLog, receipt } from '../core/events.js';
import { locationForState } from '../inventory/inventoryActions.js';

const findSupplier = (state, supplierId) =>
  state.suppliers.find((supplier) => supplier.id === supplierId);

const productInfoFor = (state, varietyId) =>
  state.productGroups
    .flatMap((group) => group.varieties.map((variety) => ({ group, variety })))
    .find(({ variety }) => variety.id === varietyId);

const packagingCost = (supply, packaging) =>
  supply.packagingOptions.find((option) => option.name === packaging)?.cost ?? 0;

export const updateSupplier = (state, supplierId, updates) => {
  const supplier = findSupplier(state, supplierId);
  if (!supplier) return receipt('supplier_update', 'skipped', 'Proveedor no encontrado.');
  Object.assign(supplier, updates);
  pushLog(state, 'PROVEEDOR_CRUD', `Proveedor actualizado: ${supplier.name}`);
  return receipt('supplier_update', 'ok', `Proveedor actualizado: ${supplier.name}`, { supplierId });
};

export const addSupplierSupply = (state, supplierId, supply) => {
  const supplier = findSupplier(state, supplierId);
  if (!supplier) return receipt('supplier_supply_add', 'skipped', 'Proveedor no encontrado.');
  supplier.supplies ||= [];
  supplier.supplies.push({
    varietyId: supply.varietyId,
    baseCost: Number(supply.baseCost || 0),
    freightCost: Number(supply.freightCost || 0),
    availableSizes: supply.availableSizes || [],
    packagingOptions: supply.packagingOptions?.length ? supply.packagingOptions : [{ name: 'Caja', cost: 0 }],
    notes: supply.notes || '',
  });
  pushLog(state, 'PROVEEDOR_CRUD', `Producto agregado a proveedor: ${supplier.name}`);
  return receipt('supplier_supply_add', 'ok', 'Producto de proveedor agregado.', { supplierId });
};

export const removeSupplierSupply = (state, supplierId, varietyId) => {
  const supplier = findSupplier(state, supplierId);
  if (!supplier) return receipt('supplier_supply_remove', 'skipped', 'Proveedor no encontrado.');
  const before = supplier.supplies.length;
  supplier.supplies = supplier.supplies.filter((supply) => supply.varietyId !== varietyId);
  if (before === supplier.supplies.length) return receipt('supplier_supply_remove', 'skipped', 'Producto no encontrado.');
  pushLog(state, 'PROVEEDOR_CRUD', `Producto removido de proveedor: ${supplier.name}`);
  return receipt('supplier_supply_remove', 'ok', 'Producto removido de proveedor.', { supplierId, varietyId });
};

export const updateSupplierSupply = (state, supplierId, varietyId, updates) => {
  const supplier = findSupplier(state, supplierId);
  const supply = supplier?.supplies.find((item) => item.varietyId === varietyId);
  if (!supplier || !supply) return receipt('supplier_supply_update', 'skipped', 'Producto de proveedor no encontrado.');
  Object.assign(supply, {
    ...updates,
    baseCost: updates.baseCost === undefined ? supply.baseCost : Number(updates.baseCost || 0),
    freightCost: updates.freightCost === undefined ? supply.freightCost : Number(updates.freightCost || 0),
  });
  pushLog(state, 'PROVEEDOR_CRUD', `Costo de proveedor actualizado: ${supplier.name}`);
  return receipt('supplier_supply_update', 'ok', 'Producto de proveedor actualizado.', { supplierId, varietyId });
};

export const createPurchaseOrder = (state, input) => {
  const supplier = findSupplier(state, input.supplierId);
  const supply = supplier?.supplies.find((item) => item.varietyId === input.varietyId);
  const product = productInfoFor(state, input.varietyId);
  if (!supplier || !supply || !product) {
    return receipt('purchase_order_add', 'failed', 'Proveedor o producto no encontrado.');
  }

  const quantity = Number(input.quantity || 0);
  const totalCost = (supply.baseCost + supply.freightCost + packagingCost(supply, input.packaging)) * quantity;
  const order = {
    id: makeId('po'),
    supplierId: supplier.id,
    varietyId: input.varietyId,
    size: input.size,
    packaging: input.packaging,
    quantity,
    totalCost,
    status: input.status || 'Pendiente',
    orderDate: nowIso(),
    expectedArrivalDate: input.expectedArrivalDate || null,
    paymentMethod: input.paymentMethod || 'Credito',
  };
  state.purchaseOrders.unshift(order);
  pushLog(state, 'ORDEN_COMPRA_CRUD', `Orden de compra creada para ${supplier.name}`, {
    Producto: `${product.group.name} ${product.variety.name}`,
    Cantidad: quantity,
    Costo: totalCost,
  });
  return receipt('purchase_order_add', 'ok', `Orden creada: ${supplier.name}`, { order });
};

export const receivePurchaseOrder = (state, orderId, warehouseId = 'wh-main') => {
  const order = state.purchaseOrders.find((item) => item.id === orderId);
  if (!order) return receipt('purchase_order_receive', 'skipped', 'Orden no encontrada.');
  if (order.status === 'Recibido') return receipt('purchase_order_receive', 'skipped', 'Orden ya recibida.');
  order.status = 'Recibido';

  const product = productInfoFor(state, order.varietyId);
  state.inventory.push({
    id: makeId('batch'),
    varietyId: order.varietyId,
    product: product ? `${product.group.name} ${product.variety.name}` : 'Producto',
    size: order.size,
    quality: 'Normal',
    state: 'Verde',
    quantity: order.quantity,
    warehouseId,
    location: locationForState('Verde'),
    packagingId: state.crateTypes[0]?.id || '',
    entryDate: nowIso(),
  });

  state.expenses.unshift({
    id: makeId('expense'),
    description: `Compra recibida: ${product?.group.name || ''} ${product?.variety.name || ''}`.trim(),
    amount: order.totalCost,
    date: nowIso(),
    category: 'Compra',
    relatedPurchaseOrderId: order.id,
  });
  pushLog(state, 'ORDEN_COMPRA_CRUD', 'Orden recibida en inventario', {
    Orden: order.id,
    Cantidad: order.quantity,
  });
  return receipt('purchase_order_receive', 'ok', 'Orden recibida en inventario.', { orderId });
};

export const setPurchaseOrderStatus = (state, orderId, status) => {
  const order = state.purchaseOrders.find((item) => item.id === orderId);
  if (!order) return receipt('purchase_order_status', 'skipped', 'Orden no encontrada.');
  if (!['Pendiente', 'Ordenado', 'Recibido'].includes(status)) {
    return receipt('purchase_order_status', 'failed', 'Estado de orden invalido.');
  }
  if (status === 'Recibido') return receivePurchaseOrder(state, orderId);
  order.status = status;
  if (status === 'Ordenado' && !order.expectedArrivalDate) {
    const eta = new Date();
    eta.setDate(eta.getDate() + 1);
    order.expectedArrivalDate = eta.toISOString();
  }
  pushLog(state, 'ORDEN_COMPRA_CRUD', `Orden marcada como ${status}`, { Orden: orderId });
  return receipt('purchase_order_status', 'ok', `Orden actualizada: ${status}`, { orderId, orderStatus: status });
};

export const repricePurchaseOrder = (state, orderId) => {
  const order = state.purchaseOrders.find((item) => item.id === orderId);
  const supplier = order ? findSupplier(state, order.supplierId) : null;
  const supply = supplier?.supplies.find((item) => item.varietyId === order.varietyId);
  if (!order || !supplier || !supply) return receipt('purchase_order_reprice', 'skipped', 'Orden no encontrada.');
  order.totalCost = (supply.baseCost + supply.freightCost + packagingCost(supply, order.packaging)) *
    Number(order.quantity || 0);
  pushLog(state, 'ORDEN_COMPRA_CRUD', 'Orden recalculada con costo aterrizado', {
    Orden: order.id,
    Costo: order.totalCost,
  });
  return receipt('purchase_order_reprice', 'ok', 'Orden recalculada.', { orderId, totalCost: order.totalCost });
};
