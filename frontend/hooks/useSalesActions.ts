import React, { useCallback } from 'react';
import { BusinessState, PaymentStatus, PaymentMethod, ActivityLog, CashDrawerActivity, CrateLoanStatus, Quality, FruitState, Customer } from '../types';
import { findCustomerForSale } from '../utils/customerIdentity';
import * as Logic from '../utils/businessLogic';

export const useSalesActions = (setState: React.Dispatch<React.SetStateAction<BusinessState>>) => {
  const markOrderAsPacked = useCallback((saleId: string) => {
    setState(s => {
        const sale = s.sales.find(sl => sl.id === saleId);
        if (!sale) return s;
        const newLog: ActivityLog = { id: `log_pack_${Date.now()}`, type: 'PEDIDO_EMPACADO', timestamp: new Date(), description: `Pedido empacado para ${sale.customer}`, details: { PedidoID: sale.id.substring(2, 8) } };
        return { ...s, sales: s.sales.map(sl => sl.id === saleId ? { ...sl, status: 'Listo para Entrega' } : sl), activityLog: [newLog, ...s.activityLog] };
    });
  }, [setState]);

  const completeSale = useCallback((saleId: string, paymentStatus: PaymentStatus, paymentMethod: PaymentMethod, paymentNotes?: string) => {
    setState(s => {
        let nextState = {...s};
        const sale = nextState.sales.find(sl => sl.id === saleId);
        const customer = sale ? findCustomerForSale(nextState.customers, sale) : undefined;
        if (sale && customer) {
            const newPaymentStatus = paymentStatus === 'Pagado' ? 'Pagado' : 'En Deuda';
            if (paymentMethod === 'Efectivo') {
                const openDrawer = nextState.cashDrawers.find(d => d.status === 'Abierta');
                if (openDrawer) {
                    const newActivity: CashDrawerActivity = { id: `cda_pay_${Date.now()}`, drawerId: openDrawer.id, type: 'INGRESO_VENTA', amount: sale.price, timestamp: new Date(), relatedId: sale.id, notes: `Pago de ${sale.customer}` };
                    const updatedDrawers = nextState.cashDrawers.map(d => d.id === openDrawer.id ? { ...d, balance: d.balance + sale.price } : d);
                    nextState.cashDrawerActivities = [newActivity, ...nextState.cashDrawerActivities];
                    nextState.cashDrawers = updatedDrawers;
                } else {
                    const warningLog: ActivityLog = { id: `log_caja_warn_${Date.now()}`, type: 'CAJA_OPERACION', timestamp: new Date(), description: `Pago en efectivo no registrado: la caja está cerrada`, details: { Cliente: sale.customer, Monto: sale.price } };
                    nextState.activityLog = [warningLog, ...nextState.activityLog];
                }
            }
            if (paymentStatus === 'Pagado') nextState = Logic.addPayment(nextState, customer.id, sale.price, saleId);
            const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'COMPLETA_VENTA', timestamp: new Date(), description: `Entrega completada para ${sale.customer}`, details: { PedidoID: sale.id.substring(2, 8), Estado: newPaymentStatus, Metodo: paymentMethod } };
            nextState.sales = nextState.sales.map(sl => sl.id === saleId ? { ...sl, status: 'Completado', paymentStatus: newPaymentStatus, paymentMethod, paymentNotes } : sl);
            nextState.activityLog = [newLog, ...nextState.activityLog];
        }
        return nextState;
    });
  }, [setState]);
  
  const returnCrateLoan = useCallback((loanId: string) => {
    setState(s => {
        const loan = s.crateLoans.find(l => l.id === loanId);
        if (!loan || loan.status !== 'Prestado') return s;
        const crateType = s.crateTypes.find(ct => ct.id === loan.crateTypeId);
        const newLog: ActivityLog = { id: `log_return_crate_${Date.now()}`, type: 'DEVOLUCION_CAJA_CRUD', timestamp: new Date(), description: `Devolución de caja registrada de ${loan.customer}`, details: { Cantidad: loan.quantity, Descripción: crateType?.name || 'N/A' } };
        const updatedLoans = s.crateLoans.map(l => l.id === loanId ? { ...l, status: 'Devuelto' as CrateLoanStatus } : l);
        return { ...s, crateLoans: updatedLoans, activityLog: [newLog, ...s.activityLog] };
    });
  }, [setState]);

  const markCrateAsLost = useCallback((loanId: string) => {
    setState(s => {
        const loan = s.crateLoans.find(l => l.id === loanId);
        if (!loan || loan.status !== 'Prestado') return s;
        const crateType = s.crateTypes.find(ct => ct.id === loan.crateTypeId);
        const newLog: ActivityLog = { id: `log_lost_crate_${Date.now()}`, type: 'CAJA_NO_DEVUELTA', timestamp: new Date(), description: `Caja no devuelta por ${loan.customer}`, details: { Cantidad: loan.quantity, Descripción: crateType?.name || 'N/A', Costo: (crateType?.cost || 0) * loan.quantity } };
        const updatedLoans = s.crateLoans.map(l => l.id === loanId ? { ...l, status: 'No Devuelto' as CrateLoanStatus } : l);
        const updatedCrateInventory = s.crateInventory.map(inv => { if (inv.crateTypeId === loan.crateTypeId) { return { ...inv, quantityOwned: Math.max(0, inv.quantityOwned - loan.quantity) }; } return inv; });
        return { ...s, crateLoans: updatedLoans, crateInventory: updatedCrateInventory, activityLog: [newLog, ...s.activityLog] };
    });
  }, [setState]);

  const setPrice = useCallback((varietyId: string, size: string, quality: Quality, state: FruitState, price: number): Promise<{ success: boolean, message: string }> => {
    return new Promise((resolve) => {
        setState(s => {
            const productInfo = s.productGroups.flatMap(pg => pg.varieties.map(v => ({...v, groupName: pg.name}))).find(v => v.id === varietyId);
            if (!productInfo) { resolve({ success: false, message: 'Producto no encontrado.' }); return s; }
            const newPrices = [...s.prices];
            const existingPriceIndex = newPrices.findIndex(p => p.varietyId === varietyId && p.size === size && p.quality === quality && p.state === state);
            const newPriceValue = Number(price);
            if (existingPriceIndex > -1) { if (isNaN(newPriceValue) || newPriceValue <= 0) newPrices.splice(existingPriceIndex, 1); else newPrices[existingPriceIndex] = { ...newPrices[existingPriceIndex], price: newPriceValue }; } else if (!isNaN(newPriceValue) && newPriceValue > 0) newPrices.push({ varietyId, size, quality, state, price: newPriceValue });
            const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'ACTUALIZACION_PRECIO', timestamp: new Date(), description: `Precio actualizado para ${productInfo.groupName} ${productInfo.name}`, details: { Tamaño: size, Calidad: quality, Estado: state, NuevoPrecio: price > 0 ? price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : 'Eliminado' } };
            resolve({ success: true, message: price > 0 ? 'Precio actualizado.' : 'Precio eliminado.' });
            return {...s, prices: newPrices, activityLog: [newLog, ...s.activityLog]};
        });
    });
  }, [setState]);

  const setSpecialPrice = useCallback((customerId: string, varietyId: string, size: string, quality: Quality, state: FruitState, price: number) => {
    setState(s => ({...s, customers: s.customers.map(customer => {
        if (customer.id !== customerId) return customer;
        const updatedCustomer = { ...customer, specialPrices: [...customer.specialPrices] };
        const existingPriceIndex = updatedCustomer.specialPrices.findIndex(p => p.varietyId === varietyId && p.size === size && p.quality === quality && p.state === state);
        if (price > 0) { 
            if (existingPriceIndex > -1) updatedCustomer.specialPrices[existingPriceIndex] = { varietyId, size, quality, state, price };
            else updatedCustomer.specialPrices.push({ varietyId, size, quality, state, price });
        } else if (existingPriceIndex > -1) {
            updatedCustomer.specialPrices.splice(existingPriceIndex, 1);
        }
        return updatedCustomer;
    })}));
  }, [setState]);

  const updateCustomer = useCallback((customerId: string, updates: Partial<Customer>) => {
    setState(s => ({
        ...s,
        customers: s.customers.map(c => c.id === customerId ? { ...c, ...updates } : c)
    }));
  }, [setState]);

  return { markOrderAsPacked, completeSale, returnCrateLoan, markCrateAsLost, setPrice, setSpecialPrice, updateCustomer };
};
