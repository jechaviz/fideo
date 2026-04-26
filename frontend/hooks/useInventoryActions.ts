import React, { useCallback } from 'react';
import { BusinessState, FruitState, StorageLocation, Quality, InventoryBatch, ActivityLog, Expense } from '../types';

export const useInventoryActions = (setState: React.Dispatch<React.SetStateAction<BusinessState>>) => {
  const moveInventory = useCallback((from: { varietyId: string; size: string; quality: Quality; state: FruitState; warehouseId: string; packagingId?: string }, toState: FruitState, quantityToMove: number): Promise<{ success: boolean; message: string; }> => {
    return new Promise((resolve) => {
        setState(s => {
            const productInfo = s.productGroups.flatMap(pg => pg.varieties.map(v => ({...v, groupName: pg.name, unit: pg.unit}))).find(v => v.id === from.varietyId);
            if (!productInfo) { resolve({ success: false, message: 'Producto no encontrado.' }); return s; }
            const updatedInventory = JSON.parse(JSON.stringify(s.inventory));
            const sourceBatches = updatedInventory.filter((b: InventoryBatch) => b.varietyId === from.varietyId && b.size === from.size && b.quality === from.quality && b.state === from.state && b.warehouseId === from.warehouseId && b.packagingId === from.packagingId).sort((a: InventoryBatch, b: InventoryBatch) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
            const totalAvailable = sourceBatches.reduce((sum: number, b: InventoryBatch) => sum + b.quantity, 0);
            if (totalAvailable < quantityToMove) { resolve({ success: false, message: `Stock insuficiente. Disponible: ${totalAvailable}` }); return s; }
            let remainingToMove = quantityToMove;
            for (const batch of sourceBatches) { if (remainingToMove <= 0) break; const decrementAmount = Math.min(remainingToMove, batch.quantity); batch.quantity -= decrementAmount; remainingToMove -= decrementAmount; }
            const newLocation: StorageLocation = (toState === 'Verde') ? 'Cámara Fría' : (toState === 'Entrado' ? 'Maduración' : 'Piso de Venta');
            let destBatch = updatedInventory.find((b: InventoryBatch) => b.varietyId === from.varietyId && b.size === from.size && b.quality === from.quality && b.state === toState && b.warehouseId === from.warehouseId && b.location === newLocation && b.packagingId === from.packagingId);
            if (destBatch) destBatch.quantity += quantityToMove; else updatedInventory.push({ id: `b_${Date.now()}_${Math.random()}`, varietyId: from.varietyId, size: from.size, quality: from.quality, quantity: quantityToMove, state: toState, location: newLocation, warehouseId: from.warehouseId, entryDate: new Date(), packagingId: from.packagingId });
            const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'MOVIMIENTO_ESTADO', timestamp: new Date(), description: `Movimiento de ${productInfo.groupName} ${productInfo.name}`, details: { Cantidad: quantityToMove, De: from.state, A: toState, Tamaño: from.size } };
            resolve({ success: true, message: 'Movimiento exitoso.' });
            return {...s, inventory: updatedInventory.filter((b: InventoryBatch) => b.quantity > 0), activityLog: [newLog, ...s.activityLog]};
        });
    });
  }, [setState]);

  const moveBatchLocation = useCallback((batchId: string, newLocation: StorageLocation, quantityToMove: number): Promise<{ success: boolean, message: string }> => {
    return new Promise((resolve) => {
        setState(s => {
            const batchIndex = s.inventory.findIndex(b => b.id === batchId);
            if (batchIndex === -1) { resolve({ success: false, message: 'Lote no encontrado.' }); return s; }
            const batch = s.inventory[batchIndex];
            if (batch.location === newLocation) { resolve({ success: false, message: 'El lote ya está en esa ubicación.' }); return s; }
            if (quantityToMove > batch.quantity) { resolve({ success: false, message: `Cantidad excede stock (${batch.quantity}).` }); return s; }
            let updatedInventory = [...s.inventory];
            let movedBatch: InventoryBatch;
            const existingBatchIndex = s.inventory.findIndex(b => b.id !== batchId && b.varietyId === batch.varietyId && b.size === batch.size && b.quality === batch.quality && b.state === batch.state && b.warehouseId === batch.warehouseId && b.packagingId === batch.packagingId && b.location === newLocation);
            if (quantityToMove < batch.quantity) {
                updatedInventory[batchIndex] = { ...batch, quantity: batch.quantity - quantityToMove };
                if (existingBatchIndex !== -1) { updatedInventory[existingBatchIndex] = { ...updatedInventory[existingBatchIndex], quantity: updatedInventory[existingBatchIndex].quantity + quantityToMove }; } else { movedBatch = { ...batch, id: `b_${Date.now()}_${Math.random()}`, location: newLocation, quantity: quantityToMove, entryDate: new Date() }; updatedInventory.push(movedBatch); }
            } else {
                if (existingBatchIndex !== -1) { updatedInventory[existingBatchIndex] = { ...updatedInventory[existingBatchIndex], quantity: updatedInventory[existingBatchIndex].quantity + batch.quantity }; updatedInventory = updatedInventory.filter(b => b.id !== batchId); } else { updatedInventory[batchIndex] = { ...batch, location: newLocation }; }
            }
            const productInfo = s.productGroups.flatMap(pg => pg.varieties).find(v => v.id === batch.varietyId);
            const newLog: ActivityLog = { id: `log_move_loc_${Date.now()}`, type: 'MOVIMIENTO_ESTADO', timestamp: new Date(), description: `Movimiento de ubicación: ${productInfo?.name || ''}`, details: { De: batch.location, A: newLocation, Cantidad: quantityToMove } };
            resolve({ success: true, message: `Movido a ${newLocation}.` });
            return { ...s, inventory: updatedInventory, activityLog: [newLog, ...s.activityLog] };
        });
    });
  }, [setState]);
  
  const changeQuality = useCallback((from: { varietyId: string; size: string; state: FruitState; quality: Quality; warehouseId: string; packagingId?: string }, toQuality: Quality, quantityToMove: number): Promise<{ success: boolean; message: string; }> => {
    return new Promise((resolve) => {
        setState(s => {
            const productInfo = s.productGroups.flatMap(pg => pg.varieties.map(v => ({...v, groupName: pg.name, unit: pg.unit}))).find(v => v.id === from.varietyId);
            if (!productInfo) { resolve({ success: false, message: 'Producto no encontrado.' }); return s; }
            const updatedInventory = JSON.parse(JSON.stringify(s.inventory));
            const sourceBatches = updatedInventory.filter((b: InventoryBatch) => b.varietyId === from.varietyId && b.size === from.size && b.quality === from.quality && b.state === from.state && b.warehouseId === from.warehouseId && b.packagingId === from.packagingId).sort((a: InventoryBatch, b: InventoryBatch) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
            const totalAvailable = sourceBatches.reduce((sum: number, b: InventoryBatch) => sum + b.quantity, 0);
            if (totalAvailable < quantityToMove) { resolve({ success: false, message: `Stock insuficiente. Disponible: ${totalAvailable}` }); return s; }
            let nextState = {...s};
            let remainingToMove = quantityToMove;
            for (const batch of sourceBatches) { if (remainingToMove <= 0) break; const decrementAmount = Math.min(remainingToMove, batch.quantity); batch.quantity -= decrementAmount; remainingToMove -= decrementAmount; }
            const location = sourceBatches[0]?.location || 'Piso de Venta'; 
            let destBatch = updatedInventory.find((b: InventoryBatch) => b.varietyId === from.varietyId && b.size === from.size && b.quality === toQuality && b.state === from.state && b.warehouseId === from.warehouseId && b.location === location && b.packagingId === from.packagingId);
            if (destBatch) { destBatch.quantity += quantityToMove; } else { updatedInventory.push({ id: `b_q_${Date.now()}_${Math.random()}`, varietyId: from.varietyId, size: from.size, quality: toQuality, quantity: quantityToMove, state: from.state, location: location, warehouseId: from.warehouseId, entryDate: new Date(), packagingId: from.packagingId }); }
            const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'MOVIMIENTO_CALIDAD', timestamp: new Date(), description: `Cambio de calidad para ${productInfo.groupName} ${productInfo.name}`, details: { Cantidad: quantityToMove, De: from.quality, A: toQuality, Tamaño: from.size, Estado: from.state } };
            nextState.activityLog = [newLog, ...s.activityLog];
            if (toQuality === 'Merma') {
                const priceForCost = s.prices.find(p => p.varietyId === from.varietyId && p.size === from.size && p.quality === from.quality && p.state === from.state)?.price || 0;
                const totalCost = priceForCost * quantityToMove;
                if (totalCost > 0) {
                    const newExpense: Expense = { id: `ex_${Date.now()}`, description: `Merma de ${quantityToMove} ${productInfo.unit} de ${productInfo.groupName} ${productInfo.name} (${from.size})`, amount: totalCost, date: new Date(), category: 'Merma', };
                    const mermaLog: ActivityLog = { id: `log_merma_${Date.now()}`, type: 'MERMA_REGISTRO', timestamp: new Date(), description: `Registro de merma para ${productInfo.groupName} ${productInfo.name}`, details: { Cantidad: quantityToMove, Producto: `${from.size} ${from.quality}`, CostoEstimado: totalCost.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) } };
                    nextState.expenses = [newExpense, ...s.expenses];
                    nextState.activityLog = [mermaLog, ...nextState.activityLog];
                }
            }
            resolve({ success: true, message: `${quantityToMove} movido a ${toQuality}.` });
            return { ...nextState, inventory: updatedInventory.filter((b: InventoryBatch) => b.quantity > 0) };
        });
    });
  }, [setState]);

  const adjustInventory = useCallback((varietyId: string, warehouseId: string, size: string, quality: Quality, state: FruitState, packagingId: string, newTotal: number): Promise<{ success: boolean, message: string }> => {
    return new Promise((resolve) => {
        setState(s => {
            const productBatchesInWarehouse = s.inventory.filter(b => b.varietyId === varietyId && b.warehouseId === warehouseId && b.size === size && b.quality === quality && b.state === state && b.packagingId === packagingId);
            const originalTotal = productBatchesInWarehouse.reduce((sum, b) => sum + b.quantity, 0);
            const difference = newTotal - originalTotal;
            if (difference === 0) { resolve({ success: true, message: 'Sin cambios.' }); return s; }
            if (difference < 0 && originalTotal < Math.abs(difference)) { resolve({ success: false, message: `Stock insuficiente (${originalTotal})` }); return s; }
            const updatedInventory = JSON.parse(JSON.stringify(s.inventory));
            if (difference > 0) {
                let targetBatch = updatedInventory.find((b: InventoryBatch) => b.varietyId === varietyId && b.warehouseId === warehouseId && b.size === size && b.quality === quality && b.state === state && b.packagingId === packagingId);
                if (targetBatch) { targetBatch.quantity += difference; } else { const location = (state === 'Maduro' || state === 'Entrado') ? 'Piso de Venta' : 'Cámara Fría'; updatedInventory.push({ id: `b_${Date.now()}`, varietyId, size, quality, quantity: difference, state, location, warehouseId, entryDate: new Date(), packagingId }); }
            } else {
                let quantityToRemove = Math.abs(difference);
                const sourceBatchesInUpdater = updatedInventory.filter((b: InventoryBatch) => b.varietyId === varietyId && b.warehouseId === warehouseId && b.size === size && b.quality === quality && b.state === state && b.packagingId === packagingId).sort((a: InventoryBatch, b: InventoryBatch) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
                for (const batch of sourceBatchesInUpdater) { if (quantityToRemove <= 0) break; const amountToRemove = Math.min(quantityToRemove, batch.quantity); batch.quantity -= amountToRemove; quantityToRemove -= amountToRemove; }
            }
            const productInfo = s.productGroups.flatMap(pg => pg.varieties.map(v => ({...v, groupName: pg.name}))).find(v => v.id === varietyId);
            const warehouse = s.warehouses.find(w => w.id === warehouseId);
            const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'INVENTARIO_AJUSTE', timestamp: new Date(), description: `Ajuste manual de ${productInfo?.groupName || 'producto'}`, details: { Producto: `${productInfo?.name || 'N/A'} ${size} ${quality}`, Bodega: warehouse?.name || 'N/A', Diferencia: difference, NuevoTotal: newTotal } };
            resolve({ success: true, message: `Ajustado: ${difference > 0 ? '+' : ''}${difference}` });
            return {...s, inventory: updatedInventory.filter((b: InventoryBatch) => b.quantity > 0), activityLog: [newLog, ...s.activityLog]};
        });
    });
  }, [setState]);

  return { moveInventory, moveBatchLocation, changeQuality, adjustInventory };
};
