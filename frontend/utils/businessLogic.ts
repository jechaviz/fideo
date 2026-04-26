
import { 
    BusinessState, ActionResult, SaleInterpretation, PaymentMethod, ActivityLog, 
    InventoryBatch, Sale, CashDrawerActivity, FixedAssetSaleInterpretation, 
    PurchaseOrderInterpretation, PurchaseOrder, PriceUpdateInterpretation, 
    StateChangeInterpretation, StorageLocation, AssignmentInterpretation, SaleStatus,
    WarehouseTransferInterpretation, CrateLoanInterpretation, CrateLoan, 
    EmployeeCheckInInterpretation, EmployeeActivity, ViewChangeInterpretation, 
    FilterInterpretation, PaymentStatus, OfferInterpretation
} from '../types';

export const createActionResult = (state: BusinessState, notification?: { text: string; isError: boolean }): ActionResult => ({ nextState: state, notification });

export const findVarietyInState = (s: BusinessState, productGroupQuery: string, varietyQuery: string) => {
    const group = s.productGroups.find(pg => !pg.archived && (pg.name.toLowerCase().includes(productGroupQuery.toLowerCase())));
    if (!group) return null;
    const variety = group.varieties.find(v => !v.archived && (v.name.toLowerCase().includes(varietyQuery.toLowerCase()) || v.aliases.some(a => varietyQuery.toLowerCase().includes(a.toLowerCase()))));
    return variety ? { group, variety } : null;
};

export const addPayment = (s: BusinessState, customerId: string, amount: number, saleId?: string): BusinessState => {
    const newPayment = { id: `pay_${Date.now()}`, customerId, amount, date: new Date(), saleId };
    const customer = s.customers.find(c => c.id === customerId);
    const newLog: ActivityLog = { id: `log_pay_${Date.now()}`, type: 'PAYMENT_CRUD', timestamp: new Date(), description: `Abono registrado de ${customer?.name || 'N/A'}`, details: { Monto: amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) } };
    return { ...s, payments: [...s.payments, newPayment], activityLog: [newLog, ...s.activityLog] };
};

export const addSaleAction = (s: BusinessState, interpretation: SaleInterpretation): ActionResult => {
    const saleData = interpretation.data;
    const productInfo = findVarietyInState(s, saleData.productGroup, saleData.variety);
    const customerInfo = s.customers.find(c => c.name === saleData.customer);

    if (!customerInfo) {
        return createActionResult(s, { text: `Cliente no encontrado: ${saleData.customer}`, isError: true });
    }

    if (customerInfo.creditStatus === 'Contado Solamente' && saleData.suggestedPayment === undefined) {
        const paymentMethod: PaymentMethod = 'Crédito'; 
        if (paymentMethod === 'Crédito') {
            const newLog: ActivityLog = { id: `log_credit_reject_${Date.now()}`, type: 'CREDIT_REJECTED', timestamp: new Date(), description: `Venta a crédito rechazada para ${customerInfo.name}`, details: { Motivo: 'Cliente configurado para solo contado.' } };
            return createActionResult({...s, activityLog: [newLog, ...s.activityLog]}, { text: `Venta a crédito rechazada. ${customerInfo.name} es cliente de solo contado.`, isError: true });
        }
    }
    
    if (!productInfo) {
        return createActionResult(s, { text: `Producto no encontrado: ${saleData.productGroup} ${saleData.variety}`, isError: true });
    }

    const { group, variety } = productInfo;
    const quality = saleData.quality || 'Normal';
    
    const specialPriceInfo = customerInfo.specialPrices.find(sp => sp.varietyId === variety.id && sp.size === saleData.size && sp.quality === quality && sp.state === saleData.state);
    const regularPrice = s.prices.find(p => p.varietyId === variety.id && p.size === saleData.size && p.quality === quality && p.state === saleData.state)?.price;
    const finalPricePerUnit = specialPriceInfo?.price ?? regularPrice;
    
    if (finalPricePerUnit === undefined) {
        return createActionResult(s, { text: `Precio no encontrado para ${group.name} ${variety.name} ${saleData.size} ${quality} ${saleData.state}`, isError: true });
    }
    
    const totalAvailable = s.inventory
        .filter(b => b.varietyId === variety.id && b.size === saleData.size && b.quality === quality && b.state === saleData.state)
        .reduce((sum, b) => sum + b.quantity, 0);

    if (totalAvailable < saleData.quantity) {
        return createActionResult(s, { text: `Stock insuficiente. Requerido: ${saleData.quantity}, Disponible: ${totalAvailable}`, isError: true });
    }
    
    let nextState = s;
    if (saleData.suggestedPayment && saleData.suggestedPayment > 0) {
        nextState = addPayment(s, customerInfo.id, saleData.suggestedPayment);
    }
    
    let cogsPerUnit = 0;
    const supplierInfo = s.suppliers.find(sup => sup.supplies.some(sp => sp.varietyId === variety.id));
    if (supplierInfo) {
        const suppliedProduct = supplierInfo.supplies.find(sp => sp.varietyId === variety.id);
        if (suppliedProduct) {
            const avgPackagingCost = suppliedProduct.packagingOptions.reduce((acc, opt) => acc + opt.cost, 0) / (suppliedProduct.packagingOptions.length || 1);
            cogsPerUnit = suppliedProduct.baseCost + suppliedProduct.freightCost + avgPackagingCost;
        }
    }
    if (cogsPerUnit === 0) {
        cogsPerUnit = finalPricePerUnit * 0.7;
    }
    const totalCogs = cogsPerUnit * saleData.quantity;

    const now = new Date();
    const deliveryDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); 

    const paymentMethod: PaymentMethod = customerInfo.creditStatus === 'Contado Solamente' ? 'Efectivo' : 'Crédito';

    const newSale: Sale = {
        id: `s_${Date.now()}`, productGroupId: group.id, varietyId: variety.id, productGroupName: group.name, varietyName: variety.name,
        size: saleData.size, quality: quality, state: saleData.state, quantity: saleData.quantity, price: finalPricePerUnit * saleData.quantity,
        cogs: totalCogs, unit: saleData.unit, customer: saleData.customer, destination: saleData.destination || 'Sin destino',
        locationQuery: saleData.locationQuery, status: 'Pendiente de Empaque', 
        paymentStatus: paymentMethod === 'Efectivo' ? 'Pagado' : 'Pendiente', 
        paymentMethod: paymentMethod, timestamp: now, deliveryDeadline,
    };

    let quantityToDecrement = saleData.quantity;
    const updatedInventory = JSON.parse(JSON.stringify(nextState.inventory));
    const availableBatches = updatedInventory
        .filter((b: InventoryBatch) => b.varietyId === variety.id && b.size === saleData.size && b.quality === quality && b.state === saleData.state)
        .sort((a: InventoryBatch, b: InventoryBatch) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

    for (const batch of availableBatches) {
        if (quantityToDecrement <= 0) break;
        const decrementAmount = Math.min(quantityToDecrement, batch.quantity);
        batch.quantity -= decrementAmount;
        quantityToDecrement -= decrementAmount;
    }
    
    const saleLog: ActivityLog = {
      id: `log_sale_${Date.now()}`, type: 'VENTA', timestamp: new Date(), description: `Venta a ${newSale.customer}`, 
      details: { Producto: `${newSale.productGroupName} ${newSale.varietyName} ${newSale.size}`, Cantidad: newSale.quantity, Total: newSale.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) }
    };
    const ticketLog: ActivityLog = {
      id: `log_ticket_${Date.now()}`, type: 'TICKET_ENVIADO', timestamp: new Date(), description: `Ticket de venta enviado a ${newSale.customer}`, 
      details: { Cliente: newSale.customer, Monto: newSale.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) }
    };

    let finalState = {...nextState, sales: [newSale, ...nextState.sales], inventory: updatedInventory.filter((b:InventoryBatch) => b.quantity > 0), activityLog: [ticketLog, saleLog, ...nextState.activityLog]};
    let notification;
    
    if (newSale.paymentMethod === 'Efectivo') {
        const openDrawer = finalState.cashDrawers.find(d => d.status === 'Abierta');
        if (openDrawer) {
            const newActivity: CashDrawerActivity = {
                id: `cda_${Date.now()}`, drawerId: openDrawer.id, type: 'INGRESO_VENTA',
                amount: newSale.price, timestamp: new Date(), relatedId: newSale.id,
                notes: `Venta a ${newSale.customer}`
            };
            const updatedDrawers = finalState.cashDrawers.map(d => 
                d.id === openDrawer.id ? { ...d, balance: d.balance + newSale.price } : d
            );
            finalState.cashDrawerActivities = [newActivity, ...finalState.cashDrawerActivities];
            finalState.cashDrawers = updatedDrawers;
        } else {
             notification = { text: `Venta en efectivo a ${newSale.customer} no se pudo registrar en caja porque está cerrada.`, isError: true };
        }
    }

    return createActionResult(finalState, notification);
};

export const addFixedAssetSaleAction = (s: BusinessState, interpretation: FixedAssetSaleInterpretation): ActionResult => {
    const { customer: customerName, assetName, quantity } = interpretation.data;
    const customer = s.customers.find(c => c.name === customerName);
    if (!customer) return createActionResult(s, { text: `Cliente no encontrado: ${customerName}`, isError: true });

    const crateType = s.crateTypes.find(ct => ct.name.toLowerCase() === assetName.toLowerCase());
    if (!crateType) return createActionResult(s, { text: `Tipo de caja no encontrado: ${assetName}`, isError: true });
    
    const crateInventoryItem = s.crateInventory.find(ci => ci.crateTypeId === crateType.id);
    const currentQuantity = crateInventoryItem?.quantityOwned || 0;
    if (currentQuantity < quantity) return createActionResult(s, { text: `Stock de activo insuficiente: ${crateType.name}`, isError: true });

    const totalCost = crateType.cost * quantity;
    
    const now = new Date();
    const newSale: Sale = {
        id: `s_asset_${Date.now()}`,
        productGroupId: 'asset', varietyId: crateType.id, productGroupName: 'Activos', varietyName: crateType.name,
        size: crateType.size, quality: 'Normal', state: 'Verde', 
        quantity, price: totalCost, cogs: 0, unit: 'unidades', customer: customer.name,
        destination: 'Cliente', status: 'Completado', paymentStatus: 'En Deuda',
        paymentMethod: 'Crédito', timestamp: now, deliveryDeadline: now,
    };
    
    const updatedCrateInventory = s.crateInventory.map(ci => {
        if (ci.crateTypeId === crateType.id) {
            return { ...ci, quantityOwned: ci.quantityOwned - quantity };
        }
        return ci;
    });

    const newLog: ActivityLog = {
        id: `log_asset_sale_${Date.now()}`, type: 'VENTA_ACTIVO_CRUD', timestamp: new Date(),
        description: `Venta de activo a ${customer.name}`,
        details: { Activo: crateType.name, Cantidad: quantity, Total: totalCost.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) }
    };
    
    return createActionResult({ ...s, sales: [newSale, ...s.sales], crateInventory: updatedCrateInventory, activityLog: [newLog, ...s.activityLog] });
};

export const addPurchaseOrderAction = (s: BusinessState, interpretation: PurchaseOrderInterpretation): ActionResult => {
    const orderData = interpretation.data;
    const supplier = s.suppliers.find(sup => sup.name === orderData.supplierName);
    const productInfo = findVarietyInState(s, orderData.productGroup, orderData.variety);

    if (!supplier || !productInfo) {
        return createActionResult(s, { text: 'Proveedor o producto no encontrado para la orden de compra', isError: true });
    }

    const suppliedProduct = supplier.supplies.find(sp => sp.varietyId === productInfo.variety.id);
    if (!suppliedProduct) {
        return createActionResult(s, { text: `El proveedor ${supplier.name} no surte ${productInfo.group.name} ${productInfo.variety.name}`, isError: true });
    }

    const packaging = suppliedProduct.packagingOptions.find(po => po.name === orderData.packaging);
    if (!packaging) {
        return createActionResult(s, { text: `Empaque no encontrado: ${orderData.packaging}`, isError: true });
    }

    const totalCost = (suppliedProduct.baseCost + suppliedProduct.freightCost + packaging.cost) * orderData.quantity;

    const newOrder: PurchaseOrder = {
        id: `po_${Date.now()}`,
        supplierId: supplier.id,
        varietyId: productInfo.variety.id,
        size: orderData.size,
        packaging: orderData.packaging,
        quantity: orderData.quantity,
        totalCost: totalCost,
        status: 'Pendiente',
        orderDate: new Date(),
        paymentMethod: 'Crédito',
    };
    
    const newLog: ActivityLog = { 
        id: `log_po_${Date.now()}`, 
        type: 'ORDEN_COMPRA_CRUD', 
        timestamp: new Date(), 
        description: `Orden de compra creada para ${supplier.name}`, 
        details: { 
            Producto: `${productInfo.group.name} ${productInfo.variety.name}`, 
            Cantidad: `${orderData.quantity} ${orderData.packaging}`, 
            Costo: totalCost.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) 
        } 
    };

    return createActionResult({ ...s, purchaseOrders: [newOrder, ...s.purchaseOrders], activityLog: [newLog, ...s.activityLog] });
};

export const updatePriceAction = (s: BusinessState, interpretation: PriceUpdateInterpretation): ActionResult => {
    const priceData = interpretation.data;
    const productInfo = findVarietyInState(s, priceData.productGroup, priceData.variety);

    if (!productInfo) {
        return createActionResult(s, { text: `Producto no encontrado para actualizar precio: ${priceData.productGroup} ${priceData.variety}`, isError: true });
    }

    const newPrices = [...s.prices];
    const existingPriceIndex = newPrices.findIndex(p => p.varietyId === productInfo.variety.id && p.size === priceData.size && p.quality === priceData.quality && p.state === priceData.state);
    
    if (existingPriceIndex > -1) {
        newPrices[existingPriceIndex] = { ...newPrices[existingPriceIndex], price: priceData.price };
    } else {
        newPrices.push({ varietyId: productInfo.variety.id, size: priceData.size, quality: priceData.quality, state: priceData.state, price: priceData.price });
    }

    const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'ACTUALIZACION_PRECIO', timestamp: new Date(), description: `Precio actualizado para ${productInfo.group.name} ${productInfo.variety.name}`, details: { Tamaño: priceData.size, Calidad: priceData.quality, Estado: priceData.state, NuevoPrecio: priceData.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) } };
    return createActionResult({...s, prices: newPrices, activityLog: [newLog, ...s.activityLog]});
};

export const changeProductStateAction = (s: BusinessState, interpretation: StateChangeInterpretation): BusinessState => {
    const moveData = interpretation.data;
    const productInfo = findVarietyInState(s, moveData.productGroup, moveData.variety);
    if (!productInfo) return s;

    const fromWarehouse = s.warehouses.find(w => w.name === 'Bodega Principal');
    if (!fromWarehouse) return s;
    
    const from = { varietyId: productInfo.variety.id, size: moveData.size, quality: moveData.quality, state: moveData.fromState, warehouseId: fromWarehouse.id };
    const toState = moveData.toState;
    const quantityToMove = moveData.quantity;

    const updatedInventory = JSON.parse(JSON.stringify(s.inventory));
    const sourceBatches = updatedInventory.filter((b: InventoryBatch) => b.varietyId === from.varietyId && b.size === from.size && b.quality === from.quality && b.state === from.state && b.warehouseId === from.warehouseId).sort((a: InventoryBatch, b: InventoryBatch) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    const totalAvailable = sourceBatches.reduce((sum: number, b: InventoryBatch) => sum + b.quantity, 0);

    if (totalAvailable < quantityToMove) return s;
    
    let remainingToMove = quantityToMove;
    for (const batch of sourceBatches) {
        if (remainingToMove <= 0) break;
        const decrementAmount = Math.min(remainingToMove, batch.quantity);
        batch.quantity -= decrementAmount;
        remainingToMove -= decrementAmount;
        
        const newLocation: StorageLocation = (toState === 'Verde') ? 'Cámara Fría' : (toState === 'Entrado' ? 'Maduración' : 'Piso de Venta');
        let destBatch = updatedInventory.find((b: InventoryBatch) => b.varietyId === from.varietyId && b.size === from.size && b.quality === from.quality && b.state === toState && b.warehouseId === from.warehouseId && b.location === newLocation);
        if (destBatch) destBatch.quantity += decrementAmount;
        else updatedInventory.push({ id: `b_${Date.now()}_${Math.random()}`, varietyId: from.varietyId, size: from.size, quality: from.quality, quantity: decrementAmount, state: toState, location: newLocation, warehouseId: from.warehouseId, entryDate: new Date(), packagingId: batch.packagingId });
    }
    
    const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'MOVIMIENTO_ESTADO', timestamp: new Date(), description: `Movimiento de ${productInfo.group.name} ${productInfo.variety.name}`, details: { Cantidad: quantityToMove, De: from.state, A: toState, Tamaño: from.size } };
    return {...s, inventory: updatedInventory.filter((b: InventoryBatch) => b.quantity > 0), activityLog: [newLog, ...s.activityLog]};
};

export const assignDeliveryAction = (s: BusinessState, interpretation: AssignmentInterpretation): BusinessState => {
    const { employeeName, customerName } = interpretation.data;
    const employee = s.employees.find(e => e.name === employeeName);
    if (!employee) return s;

    const saleToAssign = s.sales.filter(sale => sale.customer === customerName && sale.status === 'Listo para Entrega').sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    if (!saleToAssign) return s;

    const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'ASIGNACION_ENTREGA', timestamp: new Date(), description: `Pedido asignado a ${employeeName}`, details: { PedidoID: saleToAssign.id.substring(2, 8), Cliente: customerName, Repartidor: employeeName } };
    const newSales = s.sales.map(sale => sale.id === saleToAssign.id ? { ...sale, status: 'En Ruta' as SaleStatus, assignedEmployeeId: employee.id } : sale);
    
    return { ...s, sales: newSales, activityLog: [newLog, ...s.activityLog] };
};

export const transferWarehouseAction = (s: BusinessState, interpretation: WarehouseTransferInterpretation): BusinessState => {
    const transferData = interpretation.data;
    const productInfo = findVarietyInState(s, transferData.productGroup, transferData.variety);
    if (!productInfo) return s;

    const fromWarehouse = s.warehouses.find(w => w.name === transferData.fromWarehouseName);
    const toWarehouse = s.warehouses.find(w => w.name === transferData.toWarehouseName);
    if (!fromWarehouse || !toWarehouse) return s;

    let quantityToTransfer = transferData.quantity;
    const updatedInventory = JSON.parse(JSON.stringify(s.inventory));
    const sourceBatches = updatedInventory.filter((b: InventoryBatch) => b.varietyId === productInfo.variety.id && b.size === transferData.size && b.quality === transferData.quality && b.state === transferData.state && b.warehouseId === fromWarehouse.id).sort((a: InventoryBatch, b: InventoryBatch) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

    const totalAvailable = sourceBatches.reduce((sum: number, b: InventoryBatch) => sum + b.quantity, 0);
    if (totalAvailable < quantityToTransfer) return s;

    for (const batch of sourceBatches) {
        if (quantityToTransfer <= 0) break;
        const amountToTake = Math.min(quantityToTransfer, batch.quantity);
        batch.quantity -= amountToTake;
        quantityToTransfer -= amountToTake;

        let destBatch = updatedInventory.find((b: InventoryBatch) => b.varietyId === productInfo.variety.id && b.size === transferData.size && b.quality === transferData.quality && b.state === transferData.state && b.warehouseId === toWarehouse.id && b.location === batch.location && b.packagingId === batch.packagingId);
        if (destBatch) destBatch.quantity += amountToTake;
        else updatedInventory.push({ id: `b_${Date.now()}_${Math.random()}`, varietyId: productInfo.variety.id, size: transferData.size, quality: transferData.quality, quantity: amountToTake, state: transferData.state, location: batch.location, warehouseId: toWarehouse.id, entryDate: new Date(batch.entryDate), packagingId: batch.packagingId });
    }
    
    const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'TRANSFERENCIA_BODEGA', timestamp: new Date(), description: `Transferencia de ${productInfo.group.name} ${productInfo.variety.name}`, details: { Cantidad: transferData.quantity, De: fromWarehouse.name, A: toWarehouse.name, Producto: `${transferData.size} ${transferData.quality} ${transferData.state}` } };
    return {...s, inventory: updatedInventory.filter((b: InventoryBatch) => b.quantity > 0), activityLog: [newLog, ...s.activityLog]};
};

export const addCrateLoanAction = (s: BusinessState, interpretation: CrateLoanInterpretation): ActionResult => {
    const loanData = interpretation.data;
    const crateType = s.crateTypes.find(ct => ct.name.toLowerCase() === loanData.description.toLowerCase());
    if (!crateType) {
        return createActionResult(s, { text: `Crate type not found: ${loanData.description}`, isError: true });
    }
    
    const now = new Date();
    const dueDate = loanData.dueDate ? new Date(loanData.dueDate) : new Date(now.setDate(now.getDate() + 3));
    
    const newLoan: CrateLoan = { 
        id: `l_${Date.now()}`, 
        customer: loanData.customer, 
        crateTypeId: crateType.id,
        quantity: loanData.quantity, 
        timestamp: new Date(), 
        dueDate: dueDate,
        status: 'Prestado'
    };
    const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRESTAMO_CAJA', timestamp: new Date(), description: `Préstamo de cajas a ${loanData.customer}`, details: { Cantidad: loanData.quantity, Descripción: crateType.name } };
    return createActionResult({...s, crateLoans: [newLoan, ...s.crateLoans], activityLog: [newLog, ...s.activityLog]});
};

export const addActivityAction = (s: BusinessState, interpretation: EmployeeCheckInInterpretation): BusinessState => {
    const activityData = interpretation.data;
    const newActivity: EmployeeActivity = { id: `e_${Date.now()}`, employee: activityData.employee, activity: 'Empleado llegó', timestamp: new Date() };
    const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'LLEGADA_EMPLEADO', timestamp: new Date(), description: `Llegada de ${activityData.employee}`, details: { Empleado: activityData.employee } };
    return {...s, activities: [newActivity, ...s.activities], activityLog: [newLog, ...s.activityLog]};
};

export const changeViewAction = (s: BusinessState, interpretation: ViewChangeInterpretation): BusinessState => {
    const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'NAVEGACION', timestamp: new Date(), description: `Navegando a la vista ${interpretation.data.view}`, details: { Vista: interpretation.data.view } };
    return {...s, currentView: interpretation.data.view, activityLog: [newLog, ...s.activityLog]};
}

export const applyFilterAction = (s: BusinessState, interpretation: FilterInterpretation): BusinessState => {
    const { filterType, filterValue, targetView } = interpretation.data;
    const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'FILTRO', timestamp: new Date(), description: `Filtro aplicado en ${targetView}`, details: { Filtro: filterType, Valor: filterValue } };
    
    let nextState = {...s, activityLog: [newLog, ...s.activityLog]};

    if (targetView === 'inventory') {
        if (filterType === 'product') {
            const pg = s.productGroups.find(p => p.name.toLowerCase() === filterValue.toLowerCase());
            nextState.productFilter = pg ? pg.id : 'all';
        } else if (filterType === 'warehouse') {
            const wh = s.warehouses.find(w => w.name.toLowerCase() === filterValue.toLowerCase());
            nextState.warehouseFilter = wh ? wh.id : 'all';
        }
    } else if (targetView === 'salesLog') {
        if (filterType === 'saleStatus') {
            nextState.saleStatusFilter = filterValue as SaleStatus;
        } else if (filterType === 'paymentStatus') {
            nextState.paymentStatusFilter = filterValue as PaymentStatus;
        }
    }

    return nextState;
}

export const createOfferAction = (s: BusinessState, interpretation: OfferInterpretation): BusinessState => {
    const offerData = interpretation.data;
    const newLog: ActivityLog = { 
        id: `log_offer_${Date.now()}`, 
        type: 'OFERTA_ENVIADA',
        timestamp: new Date(), 
        description: `Oferta creada para ${offerData.targetAudience}`, 
        details: { 
            Producto: offerData.productDescription, 
            Precio: offerData.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
            Audiencia: offerData.targetAudience,
        } 
    };
    return {...s, activityLog: [newLog, ...s.activityLog]};
};
