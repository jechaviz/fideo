import { pushLog, receipt } from '../core/events.js';

const findCustomer = (state, customerId) =>
  state.customers.find((customer) => customer.id === customerId);

export const updateCustomer = (state, customerId, updates) => {
  const customer = findCustomer(state, customerId);
  if (!customer) return receipt('customer_update', 'skipped', 'Cliente no encontrado.');
  Object.assign(customer, updates);
  pushLog(state, 'CLIENTE_CRUD', `Cliente actualizado: ${customer.name}`, {
    Cliente: customer.name,
  });
  return receipt('customer_update', 'ok', `Cliente actualizado: ${customer.name}`, { customerId });
};

export const addCustomerContact = (state, customerId, name, isPrimary = false) => {
  const customer = findCustomer(state, customerId);
  const cleanName = String(name || '').trim();
  if (!customer || !cleanName) return receipt('customer_contact_add', 'skipped', 'Contacto invalido.');
  customer.contacts ||= [];
  if (isPrimary) customer.contacts.forEach((contact) => { contact.isPrimary = false; });
  customer.contacts.push({ name: cleanName, isPrimary: Boolean(isPrimary) });
  pushLog(state, 'CLIENTE_CRUD', `Contacto agregado: ${cleanName}`, { Cliente: customer.name });
  return receipt('customer_contact_add', 'ok', `Contacto agregado: ${cleanName}`, { customerId });
};

export const removeCustomerContact = (state, customerId, name) => {
  const customer = findCustomer(state, customerId);
  if (!customer) return receipt('customer_contact_remove', 'skipped', 'Cliente no encontrado.');
  const before = customer.contacts?.length || 0;
  customer.contacts = (customer.contacts || []).filter((contact) => contact.name !== name);
  if (customer.contacts.length === before) return receipt('customer_contact_remove', 'skipped', 'Contacto no encontrado.');
  pushLog(state, 'CLIENTE_CRUD', `Contacto removido: ${name}`, { Cliente: customer.name });
  return receipt('customer_contact_remove', 'ok', `Contacto removido: ${name}`, { customerId });
};

export const returnCrateLoan = (state, loanId) => {
  const loan = state.crateLoans.find((item) => item.id === loanId);
  if (!loan || loan.status !== 'Prestado') return receipt('crate_return', 'skipped', 'Prestamo no encontrado.');
  loan.status = 'Devuelto';
  const crateType = state.crateTypes.find((item) => item.id === loan.crateTypeId);
  pushLog(state, 'DEVOLUCION_CAJA_CRUD', `Devolucion de caja registrada de ${loan.customer}`, {
    Cantidad: loan.quantity,
    Descripcion: crateType?.name || 'N/A',
  });
  return receipt('crate_return', 'ok', `Caja devuelta: ${loan.customer}`, { loanId });
};

export const markCrateAsLost = (state, loanId) => {
  const loan = state.crateLoans.find((item) => item.id === loanId);
  if (!loan || loan.status !== 'Prestado') return receipt('crate_lost', 'skipped', 'Prestamo no encontrado.');
  loan.status = 'No Devuelto';
  const crateType = state.crateTypes.find((item) => item.id === loan.crateTypeId);
  const cost = Number(crateType?.cost || 0) * Number(loan.quantity || 0);
  const crateInventory = state.crateInventory.find((item) => item.crateTypeId === loan.crateTypeId);
  if (crateInventory) crateInventory.quantityOwned = Math.max(0, crateInventory.quantityOwned - loan.quantity);
  pushLog(state, 'CAJA_NO_DEVUELTA', `Caja no devuelta por ${loan.customer}`, {
    Cantidad: loan.quantity,
    Descripcion: crateType?.name || 'N/A',
    Costo: cost,
  });
  return receipt('crate_lost', 'ok', `Caja marcada no devuelta: ${loan.customer}`, { loanId, cost });
};
