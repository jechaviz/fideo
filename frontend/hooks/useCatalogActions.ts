import React, { useCallback } from 'react';
import { BusinessState, ActivityLog, ProductGroup, ProductVariety, FixedAsset, AssetStatus, Expense, Warehouse, RipeningRule, Supplier, CrateType, FruitState } from '../types';

export const useCatalogActions = (setState: React.Dispatch<React.SetStateAction<BusinessState>>) => {
  const addProductGroup = useCallback((productData: Omit<ProductGroup, 'id' | 'archived' | 'varieties'>) => {
    setState(s => {
      const newProductGroup: ProductGroup = { ...productData, id: `pg_${Date.now()}`, archived: false, varieties: [] };
      const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Grupo de producto creado: ${newProductGroup.name}`, details: { Categoria: newProductGroup.category } };
      return {...s, productGroups: [...s.productGroups, newProductGroup], activityLog: [newLog, ...s.activityLog]};
    });
  }, [setState]);

  const updateProductGroup = useCallback((productGroupId: string, updates: Partial<Omit<ProductGroup, 'id' | 'archived' | 'varieties'>>) => {
      setState(s => {
          let originalName = '';
          const newProductGroups = s.productGroups.map(pg => { if (pg.id === productGroupId) { originalName = pg.name; return { ...pg, ...updates }; } return pg; });
          if (!originalName) return s;
          const logDetails: Record<string, string | number> = {};
          Object.entries(updates).forEach(([key, value]) => { if (typeof value === 'string' || typeof value === 'number') logDetails[key] = value; });
          const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Grupo actualizado: ${originalName}`, details: logDetails};
          return {...s, productGroups: newProductGroups, activityLog: [newLog, ...s.activityLog]};
      });
  }, [setState]);

  const setProductGroupArchived = useCallback((productGroupId: string, archived: boolean) => {
      setState(s => {
          let productName = '';
          const newProductGroups = s.productGroups.map(pg => { if (pg.id === productGroupId) { productName = pg.name; return { ...pg, archived, varieties: pg.varieties.map(v => ({...v, archived})) }; } return pg; });
          if (!productName) return s;
          const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: archived ? `Grupo archivado` : 'Grupo desarchivado', details: { Producto: productName } };
          return {...s, productGroups: newProductGroups, activityLog: [newLog, ...s.activityLog]};
      });
  }, [setState]);

  const addVariety = useCallback((productGroupId: string, varietyData: Omit<ProductVariety, 'id' | 'archived'>) => {
      setState(s => {
          let groupName = '';
          const newProductGroups = s.productGroups.map(pg => { if (pg.id === productGroupId) { groupName = pg.name; const newVariety: ProductVariety = { ...varietyData, id: `v_${Date.now()}`, archived: false, }; return { ...pg, varieties: [...pg.varieties, newVariety] }; } return pg; });
          if (!groupName) return s;
          const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Variedad creada: ${varietyData.name}`, details: { Grupo: groupName } };
          return {...s, productGroups: newProductGroups, activityLog: [newLog, ...s.activityLog]};
      });
  }, [setState]);

  const updateVariety = useCallback((productGroupId: string, varietyId: string, updates: Partial<Omit<ProductVariety, 'id' | 'archived'>>) => {
      setState(s => {
          let varietyName = '';
          const newProductGroups = s.productGroups.map(pg => { if (pg.id === productGroupId) { return { ...pg, varieties: pg.varieties.map(v => { if (v.id === varietyId) { varietyName = v.name; return { ...v, ...updates }; } return v; }) }; } return pg; });
          if (!varietyName) return s;
          const logDetails: Record<string, string | number> = {};
          Object.entries(updates).forEach(([key, value]) => { logDetails[key] = Array.isArray(value) ? value.join(', ') : String(value); });
          const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Variedad actualizada: ${varietyName}`, details: logDetails };
          return {...s, productGroups: newProductGroups, activityLog: [newLog, ...s.activityLog]};
      });
  }, [setState]);

  const setVarietyArchived = useCallback((productGroupId: string, varietyId: string, archived: boolean) => {
       setState(s => {
            let varietyName = '';
            const newProductGroups = s.productGroups.map(pg => { if (pg.id === productGroupId) { return { ...pg, varieties: pg.varieties.map(v => { if (v.id === varietyId) { varietyName = v.name; return { ...v, archived }; } return v; }) }; } return pg; });
            if(!varietyName) return s;
            const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: archived ? `Variedad archivada` : 'Variedad desarchivada', details: { Variedad: varietyName } };
            return {...s, productGroups: newProductGroups, activityLog: [newLog, ...s.activityLog]};
      });
  }, [setState]);

  const setCategoryIcon = useCallback((categoryName: string, icon: string) => { setState(s => { const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Icono de categoría cambiado`, details: { Categoria: categoryName, Icono: icon } }; return {...s, categoryIcons: { ...s.categoryIcons, [categoryName]: icon }, activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const setStateIcon = useCallback((stateName: string, icon: string) => { setState(s => { const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Icono de estado cambiado`, details: { Estado: stateName, Icono: icon } }; return {...s, stateIcons: { ...s.stateIcons, [stateName]: icon }, activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const addSize = useCallback((name: string, icon: string) => { setState(s => { if(s.sizes[name]) return s; const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Nuevo tamaño creado: ${name}`, details: { Icono: icon } }; return {...s, sizes: {...s.sizes, [name]: {icon, archived: false}}, activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const updateSize = useCallback((oldName: string, updates: { name?: string; icon?: string }) => {
    const { name: newName, icon } = updates;
    setState(s => {
        const newSizes = { ...s.sizes };
        const sizeData = newSizes[oldName];
        if (!sizeData) return s;
        const finalName = newName || oldName;
        const dataToUpdate = { icon: icon !== undefined ? icon : sizeData.icon, archived: sizeData.archived };
        if (newName && newName !== oldName) { delete newSizes[oldName]; }
        newSizes[finalName] = dataToUpdate;
        let newProductGroups = s.productGroups;
        const newLogs: ActivityLog[] = [];
        if (newName && newName !== oldName) { newProductGroups = newProductGroups.map(pg => ({ ...pg, varieties: pg.varieties.map(v => ({...v, sizes: v.sizes.map(q => (q === oldName ? newName : q))})) })); newLogs.push({ id: `log_${Date.now()}_size_rename`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: 'Tamaño renombrado', details: { De: oldName, A: newName }}); }
        if (icon !== undefined) { newLogs.push({ id: `log_${Date.now()}_size_icon`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Icono de tamaño actualizado: ${finalName}`, details: { Icono: icon }}); }
        return { ...s, sizes: newSizes, productGroups: newProductGroups, activityLog: [...newLogs, ...s.activityLog] };
    });
  }, [setState]);
  const setSizeArchived = useCallback((name: string, archived: boolean) => { setState(s => { if(!s.sizes[name]) return s; const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Tamaño ${archived ? 'archivado' : 'desarchivado'}: ${name}`, details: {} }; return {...s, sizes: {...s.sizes, [name]: { ...s.sizes[name], archived }}, activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  
  const addExpense = useCallback((expenseData: Omit<Expense, 'id'>) => { setState(s => { const newExpense: Expense = { ...expenseData, id: `ex_${Date.now()}` }; const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'GASTO', timestamp: new Date(), description: `Gasto registrado: ${newExpense.description}`, details: { Categoria: newExpense.category, Monto: newExpense.amount } }; return {...s, expenses: [newExpense, ...s.expenses], activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const logAssetMaintenance = useCallback((assetId: string, cost: number, description: string) => { setState(s => { const asset = s.fixedAssets.find(a => a.id === assetId); if (!asset) return s; const newExpense: Expense = { id: `ex_${Date.now()}`, description: `Reparación: ${description}`, amount: cost, date: new Date(), category: 'Reparación', relatedAssetId: assetId }; const newLog: ActivityLog = { id: `log_${Date.now()}_expense`, type: 'GASTO', timestamp: new Date(), description: `Gasto registrado: ${newExpense.description}`, details: { Categoria: newExpense.category, Monto: newExpense.amount } }; return { ...s, fixedAssets: s.fixedAssets.map(a => a.id === assetId ? { ...a, status: 'En Reparación' as AssetStatus } : a), expenses: [newExpense, ...s.expenses], activityLog: [newLog, ...s.activityLog] }; }); }, [setState]);
  const addFixedAsset = useCallback((assetData: Omit<FixedAsset, 'id'>) => { setState(s => { const newAsset: FixedAsset = { ...assetData, id: `fa_${Date.now()}`}; const newExpense: Expense = { id: `ex_${Date.now()}`, description: `Compra de activo: ${newAsset.name}`, amount: newAsset.cost, date: newAsset.purchaseDate, category: 'Compra Activo', relatedAssetId: newAsset.id }; const newLog: ActivityLog = { id: `log_${Date.now()}_expense_asset`, type: 'GASTO', timestamp: new Date(), description: `Gasto registrado: ${newExpense.description}`, details: { Categoria: newExpense.category, Monto: newExpense.amount } }; return { ...s, fixedAssets: [newAsset, ...s.fixedAssets], expenses: [newExpense, ...s.expenses], activityLog: [newLog, ...s.activityLog] }; }); }, [setState]);
  const updateFixedAsset = useCallback((assetId: string, updates: Partial<Omit<FixedAsset, 'id'>>) => { setState(s => { const asset = s.fixedAssets.find(a => a.id === assetId); if(!asset) return s; const logDetails: Record<string, string | number> = {}; for (const key in updates) { const value = updates[key as keyof typeof updates]; if (key === 'purchaseDate' && value instanceof Date) { logDetails[key] = value.toLocaleDateString('es-MX'); } else if (key === 'metadata' && typeof value === 'object' && value !== null) { const metaString = Object.entries(value).map(([k,v]) => `${k}: ${v}`).join(', '); if (metaString) logDetails[key] = metaString; } else if (typeof value === 'string' || typeof value === 'number') { logDetails[key] = value; } } const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Activo actualizado: ${asset.name}`, details: logDetails }; return { ...s, fixedAssets: s.fixedAssets.map(asset => asset.id === assetId ? {...asset, ...updates} : asset), activityLog: [newLog, ...s.activityLog] }; }); }, [setState]);
  
  const addWarehouse = useCallback((name: string, icon: string) => { setState(s => { if (!name || !icon) return s; const newWarehouse: Warehouse = { id: `w_${Date.now()}`, name, icon, archived: false }; const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'BODEGA_CRUD', timestamp: new Date(), description: `Nueva bodega creada: ${name}`, details: { Icono: icon } }; return { ...s, warehouses: [...s.warehouses, newWarehouse], activityLog: [newLog, ...s.activityLog] }; }); }, [setState]);
  const updateWarehouse = useCallback((warehouseId: string, updates: Partial<Omit<Warehouse, 'id' | 'archived'>>) => { setState(s => { let originalName = ''; const newWarehouses = s.warehouses.map(w => { if (w.id === warehouseId) { originalName = w.name; return { ...w, ...updates }; } return w; }); if (!originalName) return s; const logDetails: Record<string, string | number> = {}; Object.entries(updates).forEach(([key, value]) => { if (typeof value === 'string' || typeof value === 'number') logDetails[key] = value; }); const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'BODEGA_CRUD', timestamp: new Date(), description: `Bodega actualizada: ${originalName}`, details: logDetails }; return { ...s, warehouses: newWarehouses, activityLog: [newLog, ...s.activityLog] }; }); }, [setState]);
  const setWarehouseArchived = useCallback((warehouseId: string, archived: boolean) => { setState(s => { let warehouseName = ''; const newWarehouses = s.warehouses.map(w => { if (w.id === warehouseId) { warehouseName = w.name; return { ...w, archived }; } return w; }); if (!warehouseName) return s; const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'BODEGA_CRUD', timestamp: new Date(), description: archived ? `Bodega archivada` : 'Bodega desarchivada', details: { Bodega: warehouseName } }; return { ...s, warehouses: newWarehouses, activityLog: [newLog, ...s.activityLog] }; }); }, [setState]);

  const addRipeningRule = useCallback((rule: Omit<RipeningRule, 'id'>) => { setState(s => { const newRule = { ...rule, id: `rr_${Date.now()}`}; const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'REGLA_MADURACION_CRUD', timestamp: new Date(), description: `Regla de maduración creada`, details: {} }; return {...s, ripeningRules: [...s.ripeningRules, newRule], activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const updateRipeningRule = useCallback((ruleId: string, updates: Partial<RipeningRule>) => { setState(s => { const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'REGLA_MADURACION_CRUD', timestamp: new Date(), description: `Regla de maduración actualizada`, details: {} }; return {...s, ripeningRules: s.ripeningRules.map(r => r.id === ruleId ? {...r, ...updates} : r), activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const deleteRipeningRule = useCallback((ruleId: string) => { setState(s => { const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'REGLA_MADURACION_CRUD', timestamp: new Date(), description: `Regla de maduración eliminada`, details: {} }; return {...s, ripeningRules: s.ripeningRules.filter(r => r.id !== ruleId), activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);

  const setRipeningRule = useCallback((varietyId: string, fromState: FruitState, toState: FruitState, days: number) => {
    setState(s => {
        const existingRule = s.ripeningRules.find(r => r.varietyId === varietyId && r.fromState === fromState && r.toState === toState);
        const varietyInfo = s.productGroups.flatMap(pg => pg.varieties.map(v => ({...v, groupName: pg.name}))).find(v => v.id === varietyId);
        let newRules = [...s.ripeningRules];
        let description = '';
        const newDays = Math.max(0, days);
        if (newDays > 0) {
            if (existingRule) {
                newRules = newRules.map(r => r.id === existingRule.id ? { ...r, days: newDays } : r);
                description = `Regla actualizada para ${varietyInfo?.groupName || ''} ${varietyInfo?.name || ''}: ${fromState} → ${toState} en ${newDays} días.`;
            } else {
                const newRule: RipeningRule = { id: `rr_${Date.now()}`, varietyId, fromState, toState, days: newDays };
                newRules.push(newRule);
                description = `Regla creada para ${varietyInfo?.groupName || ''} ${varietyInfo?.name || ''}: ${fromState} → ${toState} en ${newDays} días.`;
            }
        } else {
            if (existingRule) {
                newRules = newRules.filter(r => r.id !== existingRule.id);
                description = `Regla eliminada para ${varietyInfo?.groupName || ''} ${varietyInfo?.name || ''}: ${fromState} → ${toState}.`;
            } else { return s; }
        }
        const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'REGLA_MADURACION_CRUD', timestamp: new Date(), description, details: {} };
        return {...s, ripeningRules: newRules, activityLog: [newLog, ...s.activityLog]};
    });
  }, [setState]);
  
  const addSupplier = useCallback((supplier: Omit<Supplier, 'id'>) => { setState(s => { const newSupplier = { ...supplier, id: `sup_${Date.now()}`}; const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PROVEEDOR_CRUD', timestamp: new Date(), description: `Proveedor añadido: ${supplier.name}`, details: {} }; return { ...s, suppliers: [...s.suppliers, newSupplier], activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const updateSupplier = useCallback((supplierId: string, updates: Partial<Supplier>) => { setState(s => { const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PROVEEDOR_CRUD', timestamp: new Date(), description: `Proveedor actualizado`, details: {} }; return { ...s, suppliers: s.suppliers.map(sup => sup.id === supplierId ? {...sup, ...updates} : sup), activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);

  const addCrateType = useCallback((crateType: Omit<CrateType, 'id'>) => { setState(s => { const newCrateType = { ...crateType, id: `ct_${Date.now()}`}; const newCrateInv = { crateTypeId: newCrateType.id, quantityOwned: 0 }; const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Tipo de caja creado: ${crateType.name}`, details: {} }; return { ...s, crateTypes: [...s.crateTypes, newCrateType], crateInventory: [...s.crateInventory, newCrateInv], activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const updateCrateType = useCallback((crateTypeId: string, updates: Partial<CrateType>) => { setState(s => { const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Tipo de caja actualizado`, details: {} }; return { ...s, crateTypes: s.crateTypes.map(ct => ct.id === crateTypeId ? {...ct, ...updates} : ct), activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);
  const deleteCrateType = useCallback((crateTypeId: string) => { setState(s => { const newLog: ActivityLog = { id: `log_${Date.now()}`, type: 'PRODUCTO_CRUD', timestamp: new Date(), description: `Tipo de caja eliminado`, details: {} }; return { ...s, crateTypes: s.crateTypes.filter(ct => ct.id !== crateTypeId), crateInventory: s.crateInventory.filter(ci => ci.crateTypeId !== crateTypeId), activityLog: [newLog, ...s.activityLog]}; }); }, [setState]);

  return { 
    addProductGroup, updateProductGroup, setProductGroupArchived, addVariety, updateVariety, setVarietyArchived, 
    setCategoryIcon, setStateIcon, addSize, updateSize, setSizeArchived, addFixedAsset, updateFixedAsset, logAssetMaintenance, 
    addExpense, addWarehouse, updateWarehouse, setWarehouseArchived, addRipeningRule, updateRipeningRule, deleteRipeningRule, 
    setRipeningRule, addSupplier, updateSupplier, addCrateType, updateCrateType, deleteCrateType 
  };
};
