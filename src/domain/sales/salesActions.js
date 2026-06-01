import { makeId, nowIso, pushLog, receipt } from '../core/events.js';
import { syncOperationalTaskAssignments } from '../delivery/taskAssignments.js';

const saleAmount = (sale) => Number(sale.price ?? sale.total ?? 0);

const findSale = (state, saleId) => state.sales.find((sale) => sale.id === saleId);

const findCustomerForSale = (state, sale) =>
  state.customers.find((customer) => customer.id === sale.customerId || customer.name === sale.customer);

export const addPayment = (state, customerId, amount, saleId = '') => {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return receipt('payment_add', 'skipped', 'Cliente no encontrado.');
  const payment = { id: makeId('pay'), customerId, amount: Number(amount || 0), date: nowIso(), saleId };
  state.payments.unshift(payment);
  pushLog(state, 'PAYMENT_CRUD', `Abono registrado de ${customer.name}`, { Monto: payment.amount });
  return receipt('payment_add', 'ok', `Abono registrado: ${customer.name}`, { payment });
};

export const markOrderAsPacked = (state, saleId) => {
  const sale = findSale(state, saleId);
  if (!sale) return receipt('sale_pack', 'skipped', 'Venta no encontrada.');
  sale.status = 'Listo para Entrega';
  pushLog(state, 'PEDIDO_EMPACADO', `Pedido empacado para ${sale.customer}`, { PedidoID: sale.id });
  syncOperationalTaskAssignments(state);
  return receipt('sale_pack', 'ok', `Pedido listo para entrega: ${sale.customer}`, { saleId });
};

export const assignDelivery = (state, saleId, employeeId) => {
  const sale = findSale(state, saleId);
  const employee = state.employees.find((item) => item.id === employeeId && item.role === 'Repartidor');
  if (!sale) return receipt('delivery_assign', 'skipped', 'Venta no encontrada.');
  if (!employee) return receipt('delivery_assign', 'failed', 'Repartidor no encontrado.');
  if (sale.status !== 'Listo para Entrega') {
    return receipt('delivery_assign', 'failed', 'La venta aun no esta lista para entrega.');
  }

  sale.status = 'En Ruta';
  sale.assignedEmployeeId = employee.id;
  pushLog(state, 'ASIGNACION_ENTREGA', `Pedido asignado a ${employee.name}`, {
    PedidoID: sale.id,
    Cliente: sale.customer,
    Repartidor: employee.name,
  });
  syncOperationalTaskAssignments(state);
  return receipt('delivery_assign', 'ok', `Ruta asignada a ${employee.name}`, { saleId, employeeId });
};

export const completeSale = (state, saleId, paymentStatus = 'Pagado', paymentMethod = 'Efectivo', paymentNotes = '') => {
  const sale = findSale(state, saleId);
  if (!sale) return receipt('sale_complete', 'skipped', 'Venta no encontrada.');
  const customer = findCustomerForSale(state, sale);
  if (!customer) return receipt('sale_complete', 'failed', 'Cliente no encontrado.');

  const amount = saleAmount(sale);
  const finalPaymentStatus = paymentStatus === 'Pagado' ? 'Pagado' : 'En Deuda';

  if (paymentMethod === 'Efectivo' && finalPaymentStatus === 'Pagado') {
    const drawer = state.cashDrawers.find((item) => item.status === 'Abierta');
    if (drawer) {
      drawer.balance += amount;
      state.cashDrawerActivities.unshift({
        id: makeId('cda'),
        drawerId: drawer.id,
        type: 'INGRESO_VENTA',
        amount,
        timestamp: nowIso(),
        relatedId: sale.id,
        notes: `Pago de ${sale.customer}`,
      });
    } else {
      pushLog(state, 'CAJA_OPERACION', 'Pago en efectivo no registrado: caja cerrada', {
        Cliente: sale.customer,
        Monto: amount,
      });
    }
  }

  if (finalPaymentStatus === 'Pagado') {
    addPayment(state, customer.id, amount, saleId);
  }

  sale.status = 'Completado';
  sale.paymentStatus = finalPaymentStatus;
  sale.paymentMethod = paymentMethod;
  sale.paymentNotes = paymentNotes;
  sale.completedAt = nowIso();

  pushLog(state, 'COMPLETA_VENTA', `Entrega completada para ${sale.customer}`, {
    PedidoID: sale.id,
    Estado: finalPaymentStatus,
    Metodo: paymentMethod,
  });
  syncOperationalTaskAssignments(state);
  return receipt('sale_complete', 'ok', `Entrega completada: ${sale.customer}`, { saleId });
};

export const setPrice = (state, varietyId, size, quality, fruitState, price) => {
  const product = state.productGroups
    .flatMap((group) => group.varieties.map((variety) => ({ group, variety })))
    .find(({ variety }) => variety.id === varietyId);
  if (!product) return receipt('price_set', 'skipped', 'Producto no encontrado.');

  const value = Number(price);
  const index = state.prices.findIndex((item) =>
    item.varietyId === varietyId && item.size === size && item.quality === quality && item.state === fruitState);

  if (!Number.isFinite(value) || value <= 0) {
    if (index >= 0) state.prices.splice(index, 1);
  } else if (index >= 0) {
    state.prices[index].price = value;
  } else {
    state.prices.push({ varietyId, size, quality, state: fruitState, price: value });
  }

  pushLog(state, 'ACTUALIZACION_PRECIO', `Precio actualizado para ${product.group.name} ${product.variety.name}`, {
    Tamano: size,
    Calidad: quality,
    Estado: fruitState,
    NuevoPrecio: value > 0 ? value : 'Eliminado',
  });
  return receipt('price_set', 'ok', value > 0 ? 'Precio actualizado.' : 'Precio eliminado.', { varietyId });
};

export const setSpecialPrice = (state, customerId, varietyId, size, quality, fruitState, price) => {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return receipt('special_price_set', 'skipped', 'Cliente no encontrado.');
  customer.specialPrices ||= [];
  const index = customer.specialPrices.findIndex((item) =>
    item.varietyId === varietyId && item.size === size && item.quality === quality && item.state === fruitState);

  if (price > 0 && index >= 0) {
    customer.specialPrices[index] = { varietyId, size, quality, state: fruitState, price };
  } else if (price > 0) {
    customer.specialPrices.push({ varietyId, size, quality, state: fruitState, price });
  } else if (index >= 0) {
    customer.specialPrices.splice(index, 1);
  }
  return receipt('special_price_set', 'ok', 'Precio especial actualizado.', { customerId });
};
