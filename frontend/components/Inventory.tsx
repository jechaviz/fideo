
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { InventoryBatch, ProductGroup, ProductVariety, Warehouse, Quality, StorageLocation, FruitState } from '../types';
import { 
    InventoryIcon, ChevronRightIcon, ChevronDownIcon, EditIcon, PlusIcon, ArchiveBoxXMarkIcon, ArrowUturnLeftIcon, SettingsIcon,
} from './icons/Icons';
import { IconDisplay, IconEntityType, ActionType, InventoryActionModal, TransferModal, IconEditorModal, IntelligentHeader } from './inventory/InventoryShared';
import InventoryTable from './inventory/InventoryTable';

// Re-export SizeSelectorPopover wrapper if needed or direct import
const SizeSelectorPopover: React.FC<{
    assignedSizes: Set<string>;
    allSizes: Record<string, { icon: string; archived: boolean }>;
    onClose: () => void;
    onToggleSize: (sizeName: string) => void;
}> = ({ assignedSizes, allSizes, onClose, onToggleSize }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const activeSizes = (Object.entries(allSizes) as [string, { icon: string; archived: boolean }][]).filter(([, q]) => !q.archived);

    return (
        <div ref={popoverRef} className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-50 w-64 p-3">
             <p className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">Asignar Tamaños</p>
             <div className="space-y-2 max-h-60 overflow-y-auto">
                {activeSizes.map(([name, data]) => (
                    <label key={name} className="flex items-center space-x-3 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer">
                        <input type="checkbox" checked={assignedSizes.has(name)} onChange={() => onToggleSize(name)} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"/>
                        <IconDisplay icon={data.icon} className="w-5 h-5"/>
                        <span className="text-sm text-gray-800 dark:text-gray-300">{name}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

type InventoryTab = 'global' | 'catalogs' | string; // string = warehouseId
type ProductSubTab = 'catalog' | 'sizes';

// --- Management Components (Catalog) ---

const AddProductRow: React.FC<{ onAdd: (data: {name: string, category: string, unit: 'cajas' | 'kilos' | 'unidades', icon: string}) => void }> = ({ onAdd }) => {
    const [data, setData] = useState<{name: string, category: string, unit: 'cajas' | 'kilos' | 'unidades', icon: string}>({name: '', category: '', unit: 'cajas', icon: '📦'});
    const handleAdd = () => { if (data.name && data.category) { onAdd(data); setData({name: '', category: '', unit: 'cajas', icon: '📦'}); } };
    return (
        <tr className="bg-green-50 dark:bg-green-900/20">
            <td className="px-4 py-2"><input value={data.icon} onChange={e => setData({...data, icon: e.target.value})} className="p-1 border rounded w-12 text-center bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></td>
            <td className="px-4 py-2"><input value={data.name} onChange={e => setData({...data, name: e.target.value})} className="p-1 border rounded w-full bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Nombre Grupo"/></td>
            <td className="px-4 py-2"><input value={data.category} onChange={e => setData({...data, category: e.target.value})} className="p-1 border rounded w-full bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Categoría" list="categories" /></td>
            <td className="px-4 py-2"><select value={data.unit} onChange={e => setData({...data, unit: e.target.value})} className="p-1 border rounded w-full bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value="cajas">cajas</option><option value="kilos">kilos</option></select></td>
            <td className="px-4 py-2" colSpan={2}></td>
            <td className="px-4 py-2 text-right"><button onClick={handleAdd} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><PlusIcon/></button></td>
        </tr>
    );
};

const EditableVarietyRow: React.FC<{ variety: ProductVariety, productGroupId: string, allSizes: Record<string, { icon: string; archived: boolean }>, onUpdate: (productGroupId: string, varietyId: string, data: Partial<ProductVariety>) => void, onArchive: (productGroupId: string, varietyId: string, archived: boolean) => void, onEditIcon: (type: IconEntityType, name: string, icon: string, id?: string) => void }> = ({ variety, productGroupId, allSizes, onUpdate, onArchive, onEditIcon }) => {
    const [data, setData] = useState(variety);
    const [showSizePopover, setShowSizePopover] = useState(false);
    useEffect(() => setData(variety), [variety]);
    const handleBlur = (field: keyof ProductVariety) => { if (JSON.stringify(variety[field]) !== JSON.stringify(data[field])) onUpdate(productGroupId, variety.id, { [field]: data[field] }); };
    const handleToggleSize = (sizeName: string) => {
        const newSizes = data.sizes.includes(sizeName) ? data.sizes.filter(q => q !== sizeName) : [...data.sizes, sizeName];
        setData(d => ({...d, sizes: newSizes})); onUpdate(productGroupId, variety.id, { sizes: newSizes });
    };
    return (
        <tr className={variety.archived ? 'bg-gray-100 dark:bg-gray-800/50 opacity-60' : 'bg-white dark:bg-gray-800'}>
            <td className="pl-12 pr-4 py-2"><button onClick={() => onEditIcon('variety', data.name, data.icon)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><IconDisplay icon={data.icon} className="text-2xl" /></button></td>
            <td className="px-4 py-2"><input value={data.name} onChange={e => setData({...data, name: e.target.value})} onBlur={() => handleBlur('name')} className="p-1 w-full bg-transparent border border-transparent hover:border-gray-300 rounded dark:text-white"/></td>
            <td colSpan={2}></td>
            <td className="px-4 py-2"><input value={data.aliases.join(', ')} onChange={e => setData({...data, aliases: e.target.value.split(',').map(s => s.trim())})} onBlur={() => handleBlur('aliases')} className="p-1 w-full bg-transparent border border-transparent hover:border-gray-300 rounded dark:text-white"/></td>
            <td className="px-4 py-2 relative">
                <div className="flex flex-wrap gap-1 items-center">
                    {variety.sizes.map(q => allSizes[q] ? <span key={q} className="flex items-center gap-1 text-xs bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-full"><IconDisplay icon={allSizes[q].icon} className="w-3 h-3 text-sm"/> {q}</span> : null)}
                    <button onClick={() => setShowSizePopover(p => !p)} className="p-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"><EditIcon /></button>
                    {showSizePopover && <SizeSelectorPopover assignedSizes={new Set(data.sizes)} allSizes={allSizes} onToggleSize={handleToggleSize} onClose={() => setShowSizePopover(false)}/>}
                </div>
            </td>
            <td className="px-4 py-2 text-right">
                <button onClick={() => onArchive(productGroupId, variety.id, !variety.archived)} className={`p-2 rounded-full ${variety.archived ? 'text-green-600 hover:bg-green-100' : 'text-red-600 hover:bg-red-100'}`}>
                    {variety.archived ? <ArrowUturnLeftIcon /> : <ArchiveBoxXMarkIcon />}
                </button>
            </td>
        </tr>
    );
};

const ProductsTab: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { productGroups, sizes, updateProductGroup, setProductGroupArchived, addProductGroup, updateVariety, setVarietyArchived, updateSize, updateWarehouse } = data;
    const [editingIconEntity, setEditingIconEntity] = useState<{type: IconEntityType, name: string, currentIcon: string, id?: string} | null>(null);
    const [productSubTab, setProductSubTab] = useState<ProductSubTab>('catalog');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({'Manzanas': true});

    const handleEditIcon = (type: IconEntityType, name: string, icon: string, id?: string) => setEditingIconEntity({ type, name, currentIcon: icon, id });
    const handleSaveIcon = (newIcon: string) => {
        if (!editingIconEntity) return;
        const { type, name, id } = editingIconEntity;
        if (type === 'productGroup') { const pg = productGroups.find(p=>p.name === name); if(pg) updateProductGroup(pg.id, {icon: newIcon}); }
        else if (type === 'variety') { const v = productGroups.flatMap(pg=>pg.varieties).find(v=>v.name === name); if(v) {const pg = productGroups.find(pg => pg.varieties.some(vr=>vr.id === v.id)); if(pg) updateVariety(pg.id, v.id, {icon: newIcon});} }
        else if (type === 'quality') updateSize(name, { icon: newIcon });
        else if (type === 'warehouse' && id) updateWarehouse(id, { icon: newIcon });
        setEditingIconEntity(null);
    };

    const uniqueCategories = useMemo(() => Array.from(new Set(productGroups.map(p => p.category))), [productGroups]);
    const productsByCategory = useMemo(() => {
        const grouped: Record<string, ProductGroup[]> = {};
        productGroups.forEach(pg => { if (!grouped[pg.category]) grouped[pg.category] = []; grouped[pg.category].push(pg); });
        return grouped;
    }, [productGroups]);

    return (
        <div>
            <div className="flex space-x-4 mb-4 border-b dark:border-gray-700 overflow-x-auto">
                <button onClick={() => setProductSubTab('catalog')} className={`py-2 px-4 border-b-2 font-semibold whitespace-nowrap ${productSubTab === 'catalog' ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500'}`}>Productos</button>
                <button onClick={() => setProductSubTab('sizes')} className={`py-2 px-4 border-b-2 font-semibold whitespace-nowrap ${productSubTab === 'sizes' ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500'}`}>Tamaños</button>
            </div>
            
            {productSubTab === 'catalog' ? (
                <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr><th className="w-8"></th><th className="text-left px-4 py-3 text-gray-500 dark:text-gray-300">Nombre</th><th className="text-left px-4 py-3 text-gray-500 dark:text-gray-300">Categoría</th><th className="text-left px-4 py-3 text-gray-500 dark:text-gray-300">Unidad</th><th className="text-left px-4 py-3 text-gray-500 dark:text-gray-300">Alias</th><th className="text-left px-4 py-3 text-gray-500 dark:text-gray-300">Tamaños</th><th className="w-20"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            <AddProductRow onAdd={addProductGroup} />
                            {(Object.entries(productsByCategory) as [string, ProductGroup[]][]).map(([cat, pgs]) => (
                                <React.Fragment key={cat}>
                                    <tr className="bg-slate-100 dark:bg-gray-900"><td colSpan={7}><button onClick={() => setExpandedCategories(p => ({...p, [cat]: !p[cat]}))} className="w-full text-left p-2 font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">{expandedCategories[cat] ? <ChevronDownIcon/> : <ChevronRightIcon/>} {cat}</button></td></tr>
                                    {expandedCategories[cat] && pgs.map(pg => (
                                        <React.Fragment key={pg.id}>
                                            <tr className={pg.archived ? 'bg-gray-200 opacity-60' : 'bg-gray-50 dark:bg-gray-800'}>
                                                <td className="px-4 py-2"><button onClick={() => handleEditIcon('productGroup', pg.name, pg.icon)}><IconDisplay icon={pg.icon} className="text-2xl"/></button></td>
                                                <td className="px-4 py-2"><input defaultValue={pg.name} onBlur={e => updateProductGroup(pg.id, {name: e.target.value})} className="font-bold bg-transparent w-full dark:text-white"/></td>
                                                <td className="px-4 py-2"><input defaultValue={pg.category} onBlur={e => updateProductGroup(pg.id, {category: e.target.value})} list="categories" className="bg-transparent w-full dark:text-white"/></td>
                                                <td className="px-4 py-2"><select defaultValue={pg.unit} onBlur={e => updateProductGroup(pg.id, {unit: e.target.value as 'cajas' | 'kilos' | 'unidades'})} className="bg-transparent w-full dark:text-white"><option value="cajas">cajas</option><option value="kilos">kilos</option></select></td>
                                                <td colSpan={2}></td>
                                                <td className="px-4 py-2 text-right"><button onClick={() => setProductGroupArchived(pg.id, !pg.archived)} className={pg.archived ? 'text-green-600' : 'text-red-600'}>{pg.archived ? <ArrowUturnLeftIcon/> : <ArchiveBoxXMarkIcon/>}</button></td>
                                            </tr>
                                            {pg.varieties.map(v => <EditableVarietyRow key={v.id} variety={v} productGroupId={pg.id} allSizes={sizes} onUpdate={updateVariety} onArchive={setVarietyArchived} onEditIcon={handleEditIcon} /> )}
                                        </React.Fragment>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="font-bold mb-4 dark:text-white">Gestión de Tamaños</h3>
                    <p className="text-gray-500">Utiliza la configuración de tamaños existente.</p>
                </div>
            )}
            {editingIconEntity && <IconEditorModal entity={editingIconEntity} isOpen={!!editingIconEntity} onClose={() => setEditingIconEntity(null)} onSave={handleSaveIcon} />}
            <datalist id="categories">{uniqueCategories.map(c => <option key={c} value={c} />)}</datalist>
        </div>
    );
};

const WarehouseManager: React.FC<{
    warehouses: Warehouse[];
    onAdd: (name: string, icon: string) => void;
    onUpdate: (id: string, updates: { name?: string; icon?: string }) => void;
    onArchive: (id: string, archived: boolean) => void;
    onEditIcon: (entityType: IconEntityType, entityName: string, currentIcon: string, warehouseId: string) => void;
}> = ({ warehouses, onAdd, onUpdate, onArchive, onEditIcon }) => {
    const [newName, setNewName] = useState('');
    const [newIcon, setNewIcon] = useState('B');
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Mis Bodegas</h2>
            <form onSubmit={e => { e.preventDefault(); if (newName) { onAdd(newName, newIcon); setNewName(''); setNewIcon('B'); } }} className="flex items-center gap-2 p-2 border-b mb-4 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-700 rounded-lg">
                <input type="text" value={newIcon} onChange={e => setNewIcon(e.target.value)} className="p-2 border rounded w-24 sm:w-32 text-center bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="Cód. (ej. SP113)"/>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="p-2 border rounded flex-grow bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-white" placeholder="Dirección / Nombre"/>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><PlusIcon/> <span className="hidden sm:inline">Añadir</span></button>
            </form>
            <div className="space-y-2">
                {warehouses.map((w) => (
                    <div key={w.id} className={`flex items-center gap-2 p-2 rounded-lg ${w.archived ? 'opacity-60 bg-gray-100' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <button onClick={() => onEditIcon('warehouse', w.name, w.icon, w.id)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"><IconDisplay icon={w.icon} className="w-6 h-6 text-xl"/></button>
                        <input type="text" defaultValue={w.name} onBlur={e => onUpdate(w.id, {name: e.target.value})} className="flex-grow bg-transparent border-transparent hover:border-gray-300 rounded p-1 dark:text-white"/>
                        <button onClick={() => onArchive(w.id, !w.archived)} className={`p-1 ${w.archived ? 'text-green-600' : 'text-red-600'}`}>{w.archived ? <ArrowUturnLeftIcon/> : <ArchiveBoxXMarkIcon/>}</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main Component Logic ---

const Inventory: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { 
        productGroups, inventory, prices, warehouses, moveInventory, changeQuality,
        adjustInventory, setPrice, sizes, qualities, stateIcons, 
        addWarehouse, updateWarehouse, setWarehouseArchived, moveBatchLocation, crateTypes
    } = data;

    const [activeTab, setActiveTab] = useState<InventoryTab>('global');
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({}); // Product Groups
    const [expandedVarieties, setExpandedVarieties] = useState<Record<string, boolean>>({}); // Varieties
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [saveStatus, setSaveStatus] = useState<{key: string; message: string; success: boolean} | null>(null);
    const [editingIconEntity, setEditingIconEntity] = useState<{type: IconEntityType, name: string, currentIcon: string, id?: string} | null>(null);

    // Action Modal State
    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [currentActionBatch, setCurrentActionBatch] = useState<InventoryBatch | null>(null);
    const [currentActionType, setCurrentActionType] = useState<ActionType | null>(null);
    const [currentActionTarget, setCurrentActionTarget] = useState<string>('');

    // Transfer Modal State
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [currentTransferBatch, setCurrentTransferBatch] = useState<InventoryBatch | null>(null);

    const activeWarehouses = useMemo(() => warehouses.filter(w => !w.archived), [warehouses]);
    
    // Filter inventory based on active tab
    const filteredInventory = useMemo(() => {
        if (activeTab === 'catalogs') return [];
        if (activeTab === 'global') return inventory.filter(b => b.quantity > 0);
        return inventory.filter(b => b.warehouseId === activeTab && b.quantity > 0);
    }, [inventory, activeTab]);

    // Group Data: ProductGroup -> Variety -> Batches
    const groupedInventory = useMemo(() => {
        const groups = new Map<string, { group: ProductGroup, varieties: Map<string, { variety: ProductVariety, batches: (InventoryBatch & { price?: number })[] }> }>();
        for (const batch of filteredInventory) {
            let group = productGroups.find(pg => pg.id === productGroups.find(g => g.varieties.some(v => v.id === batch.varietyId))?.id);
            if (!group) continue;
            let variety = group.varieties.find(v => v.id === batch.varietyId);
            if (!variety) continue;
            if (!groups.has(group.id)) {
                groups.set(group.id, { group, varieties: new Map() });
            }
            const groupEntry = groups.get(group.id);
            if (!groupEntry.varieties.has(variety.id)) {
                groupEntry.varieties.set(variety.id, { variety, batches: [] });
            }
            const varietyEntry = groupEntry.varieties.get(variety.id);
            const price = prices.find(p => p.varietyId === variety?.id && p.size === batch.size && p.quality === batch.quality && p.state === batch.state)?.price;
            varietyEntry.batches.push({ ...batch, price });
        }
        return Array.from(groups.values()).map(g => {
            const varietiesArray = Array.from(g.varieties.values()).sort((a, b) => a.variety.name.localeCompare(b.variety.name));
            const isSingleVariety = varietiesArray.length === 1;
            return { ...g, varieties: varietiesArray, isSingleVariety };
        }).sort((a,b) => a.group.name.localeCompare(b.group.name));
    }, [filteredInventory, productGroups, prices]);

    const toggleNode = (id: string) => setExpandedNodes(p => ({ ...p, [id]: !p[id] }));
    const toggleVariety = (id: string) => setExpandedVarieties(p => ({ ...p, [id]: !p[id] }));

    const handleStartEdit = (key: string, val: string | number) => { setEditingKey(key); setEditingValue(String(val || '')); setSaveStatus(null); };
    const handleSaveEdit = async (key: string) => {
        const val = parseFloat(editingValue);
        if (isNaN(val)) { setEditingKey(null); return; }
        const parts = key.split('-');
        let res;
        if (parts[0] === 'qty') res = await adjustInventory(parts[1], parts[5], parts[2], parts[3] as Quality, parts[4] as FruitState, parts[6], val);
        else res = await setPrice(parts[1], parts[2], parts[3] as Quality, parts[4] as FruitState, val);
        setSaveStatus({ key, message: res.message, success: res.success });
        setEditingKey(null);
        setTimeout(() => setSaveStatus(null), 2000);
    };

    const handleEditIcon = (type: IconEntityType, name: string, icon: string, id?: string) => setEditingIconEntity({ type, name, currentIcon: icon, id });
    const handleSaveIcon = (newIcon: string) => {
        if (editingIconEntity?.type === 'warehouse' && editingIconEntity.id) updateWarehouse(editingIconEntity.id, { icon: newIcon });
        setEditingIconEntity(null);
    };

    const handleInitiateAction = (batch: InventoryBatch, actionType: ActionType, targetValue: string) => {
        setCurrentActionBatch(batch);
        setCurrentActionType(actionType);
        setCurrentActionTarget(targetValue);
        setActionModalOpen(true);
    };

    const handleConfirmAction = async (quantity: number) => {
        if (!currentActionBatch) return;
        if (currentActionType === 'moveState') {
            await moveInventory(currentActionBatch, currentActionTarget as FruitState, quantity);
        } else if (currentActionType === 'changeQuality') {
            await changeQuality(currentActionBatch, currentActionTarget as Quality, quantity);
        } else if (currentActionType === 'moveLocation') {
            await moveBatchLocation(currentActionBatch.id, currentActionTarget as StorageLocation, quantity);
        }
        setActionModalOpen(false);
        setCurrentActionBatch(null);
    };

    const handleInitiateTransfer = (batch: InventoryBatch) => {
        setCurrentTransferBatch(batch);
        setTransferModalOpen(true);
    };

    const handleConfirmTransfer = async (_targetWarehouseId: string, _quantity: number) => {
        if (!currentTransferBatch) return;
        alert("Transferencia simulada. (Función completa pendiente de conexión al backend)");
        setTransferModalOpen(false);
        setCurrentTransferBatch(null);
    };

    const getProductName = (batch: InventoryBatch | null) => {
        if (!batch) return '';
        const group = productGroups.find(g => g.varieties.some(v => v.id === batch.varietyId));
        const variety = group?.varieties.find(v => v.id === batch.varietyId);
        return `${group?.name} ${variety?.name} (${batch.size})`;
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Inventario</h1>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-t-lg shadow-sm border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-4 px-4 overflow-x-auto" aria-label="Tabs">
                    <button onClick={() => setActiveTab('global')} className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'global' ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                        <InventoryIcon />
                        <span>Global</span>
                    </button>
                    {activeWarehouses.map(w => (
                        <button key={w.id} onClick={() => setActiveTab(w.id)} title={w.name} className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === w.id ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            <IconDisplay icon={w.icon} className="text-lg"/>
                        </button>
                    ))}
                    <button onClick={() => setActiveTab('catalogs')} className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ml-auto ${activeTab === 'catalogs' ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                        <SettingsIcon />
                        <span>Catálogos</span>
                    </button>
                </nav>
            </div>
            <div className="flex-grow bg-gray-50 dark:bg-gray-900 pt-4">
                {activeTab === 'catalogs' ? (
                    <div className="space-y-8">
                        <ProductsTab data={data} />
                        <WarehouseManager warehouses={warehouses} onAdd={addWarehouse} onUpdate={updateWarehouse} onArchive={setWarehouseArchived} onEditIcon={handleEditIcon} />
                        {editingIconEntity && <IconEditorModal entity={editingIconEntity} isOpen={!!editingIconEntity} onClose={() => setEditingIconEntity(null)} onSave={handleSaveIcon} />}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedInventory.map(({ group, varieties, isSingleVariety }) => {
                             const groupBatches = varieties.flatMap((v: { variety: ProductVariety, batches: (InventoryBatch & { price?: number })[] }) => v.batches);
                             const mainVariety = varieties[0]?.variety;
                             const title = isSingleVariety ? `${group.name} ${mainVariety?.name}` : group.name;
                             const icon = group.icon;
                             return (
                            <div key={group.id} className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                                <IntelligentHeader icon={icon} title={title} batches={groupBatches} crateTypes={crateTypes} allSizes={sizes} expanded={expandedNodes[group.id]} onToggle={() => toggleNode(group.id)} level="group" varietiesList={varieties} isSingleVariety={isSingleVariety}/>
                                {expandedNodes[group.id] && (
                                    <div className="border-t border-gray-200 dark:border-gray-700">
                                        {isSingleVariety ? (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                <InventoryTable batches={groupBatches} showWarehouseCol={activeTab === 'global'} stateIcons={stateIcons} qualityIcons={qualities} warehouses={warehouses} allSizes={sizes} crateTypes={crateTypes} onEdit={handleStartEdit} editingKey={editingKey} editingValue={editingValue} setEditingValue={setEditingValue} onSaveEdit={handleSaveEdit} saveStatus={saveStatus} onInitiateAction={handleInitiateAction} onInitiateTransfer={handleInitiateTransfer}/>
                                            </div>
                                        ) : (
                                            varieties.map(({ variety, batches }: { variety: ProductVariety, batches: (InventoryBatch & { price?: number })[] }) => (
                                                <div key={variety.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                    <IntelligentHeader icon={variety.icon} title={variety.name} batches={batches} crateTypes={crateTypes} allSizes={sizes} expanded={expandedVarieties[variety.id]} onToggle={() => toggleVariety(variety.id)} level="variety"/>
                                                    {expandedVarieties[variety.id] && (
                                                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                            <InventoryTable batches={batches} showWarehouseCol={activeTab === 'global'} stateIcons={stateIcons} qualityIcons={qualities} warehouses={warehouses} allSizes={sizes} crateTypes={crateTypes} onEdit={handleStartEdit} editingKey={editingKey} editingValue={editingValue} setEditingValue={setEditingValue} onSaveEdit={handleSaveEdit} saveStatus={saveStatus} onInitiateAction={handleInitiateAction} onInitiateTransfer={handleInitiateTransfer}/>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )})}
                        {groupedInventory.length === 0 && <div className="text-center py-12 text-gray-500 dark:text-gray-400">No hay inventario en esta vista.</div>}
                    </div>
                )}
            </div>
            <InventoryActionModal isOpen={actionModalOpen} onClose={() => setActionModalOpen(false)} onConfirm={handleConfirmAction} actionType={currentActionType} batch={currentActionBatch} targetValue={currentActionTarget} productName={getProductName(currentActionBatch)}/>
            <TransferModal isOpen={transferModalOpen} onClose={() => setTransferModalOpen(false)} onConfirm={handleConfirmTransfer} batch={currentTransferBatch} warehouses={activeWarehouses} productName={getProductName(currentTransferBatch)}/>
        </div>
    );
};

export default Inventory;
