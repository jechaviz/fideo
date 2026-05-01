import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { InventoryBatch, ProductGroup, ProductVariety, Warehouse, Quality, StorageLocation, FruitState } from '../types';
import {
    InventoryIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    EditIcon,
    PlusIcon,
    ArchiveBoxXMarkIcon,
    ArrowUturnLeftIcon,
    SettingsIcon,
} from './icons/Icons';
import { IconDisplay, IconEntityType, ActionType, InventoryActionModal, TransferModal, IconEditorModal, IntelligentHeader } from './inventory/InventoryShared';
import InventoryTable from './inventory/InventoryTable';

const panelClass = 'glass-panel-dark rounded-[2rem] border border-white/10';
const inputClass = 'w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20';
const subtleInputClass = 'w-full rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

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

    const activeSizes = (Object.entries(allSizes) as [string, { icon: string; archived: boolean }][]).filter(([, size]) => !size.archived);

    return (
        <div ref={popoverRef} className="absolute right-0 top-full z-50 mt-3 w-72 rounded-[1.6rem] border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-sm">
            <p className="mb-3 text-sm font-black text-white">Asignar tamaños</p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
                {activeSizes.map(([name, size]) => (
                    <label key={name} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]">
                        <input
                            type="checkbox"
                            checked={assignedSizes.has(name)}
                            onChange={() => onToggleSize(name)}
                            className="h-4 w-4 rounded border-white/20 bg-slate-950 text-brand-400 focus:ring-brand-400"
                        />
                        <IconDisplay icon={size.icon} className="w-5 h-5" />
                        <span className="text-sm text-slate-200">{name}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

type InventoryTab = 'global' | 'catalogs' | string;
type ProductSubTab = 'catalog' | 'sizes';

const AddProductRow: React.FC<{
    onAdd: (data: { name: string; category: string; unit: 'cajas' | 'kilos' | 'unidades'; icon: string }) => void;
}> = ({ onAdd }) => {
    const [data, setData] = useState<{ name: string; category: string; unit: 'cajas' | 'kilos' | 'unidades'; icon: string }>({
        name: '',
        category: '',
        unit: 'cajas',
        icon: '📦',
    });

    const handleAdd = () => {
        if (data.name && data.category) {
            onAdd(data);
            setData({ name: '', category: '', unit: 'cajas', icon: '📦' });
        }
    };

    return (
        <tr className="border-b border-white/10 bg-brand-400/10">
            <td className="px-4 py-3">
                <input value={data.icon} onChange={(event) => setData({ ...data, icon: event.target.value })} className={`${inputClass} w-14 text-center`} />
            </td>
            <td className="px-4 py-3">
                <input value={data.name} onChange={(event) => setData({ ...data, name: event.target.value })} className={inputClass} placeholder="Nombre del grupo" />
            </td>
            <td className="px-4 py-3">
                <input
                    value={data.category}
                    onChange={(event) => setData({ ...data, category: event.target.value })}
                    className={inputClass}
                    placeholder="Categoria"
                    list="categories"
                />
            </td>
            <td className="px-4 py-3">
                <select value={data.unit} onChange={(event) => setData({ ...data, unit: event.target.value as 'cajas' | 'kilos' | 'unidades' })} className={inputClass}>
                    <option value="cajas">cajas</option>
                    <option value="kilos">kilos</option>
                    <option value="unidades">unidades</option>
                </select>
            </td>
            <td className="px-4 py-3" colSpan={2}></td>
            <td className="px-4 py-3 text-right">
                <button onClick={handleAdd} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-400 text-slate-950 transition hover:bg-brand-300">
                    <PlusIcon />
                </button>
            </td>
        </tr>
    );
};

const EditableVarietyRow: React.FC<{
    variety: ProductVariety;
    productGroupId: string;
    allSizes: Record<string, { icon: string; archived: boolean }>;
    onUpdate: (productGroupId: string, varietyId: string, data: Partial<ProductVariety>) => void;
    onArchive: (productGroupId: string, varietyId: string, archived: boolean) => void;
    onEditIcon: (type: IconEntityType, name: string, icon: string, id?: string) => void;
}> = ({ variety, productGroupId, allSizes, onUpdate, onArchive, onEditIcon }) => {
    const [data, setData] = useState(variety);
    const [showSizePopover, setShowSizePopover] = useState(false);

    useEffect(() => setData(variety), [variety]);

    const handleBlur = (field: keyof ProductVariety) => {
        if (JSON.stringify(variety[field]) !== JSON.stringify(data[field])) onUpdate(productGroupId, variety.id, { [field]: data[field] });
    };

    const handleToggleSize = (sizeName: string) => {
        const newSizes = data.sizes.includes(sizeName) ? data.sizes.filter((size) => size !== sizeName) : [...data.sizes, sizeName];
        setData((prev) => ({ ...prev, sizes: newSizes }));
        onUpdate(productGroupId, variety.id, { sizes: newSizes });
    };

    return (
        <tr className={`${variety.archived ? 'opacity-55' : ''} border-b border-white/8 bg-transparent`}>
            <td className="pl-12 pr-4 py-3">
                <button onClick={() => onEditIcon('variety', data.name, data.icon)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08]">
                    <IconDisplay icon={data.icon} className="text-2xl" />
                </button>
            </td>
            <td className="px-4 py-3">
                <input
                    value={data.name}
                    onChange={(event) => setData({ ...data, name: event.target.value })}
                    onBlur={() => handleBlur('name')}
                    className={subtleInputClass}
                />
            </td>
            <td colSpan={2}></td>
            <td className="px-4 py-3">
                <input
                    value={data.aliases.join(', ')}
                    onChange={(event) => setData({ ...data, aliases: event.target.value.split(',').map((alias) => alias.trim()) })}
                    onBlur={() => handleBlur('aliases')}
                    className={subtleInputClass}
                />
            </td>
            <td className="relative px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {variety.sizes.map((size) =>
                        allSizes[size] ? (
                            <span key={size} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
                                <IconDisplay icon={allSizes[size].icon} className="w-3 h-3 text-sm" />
                                {size}
                            </span>
                        ) : null,
                    )}
                    <button
                        onClick={() => setShowSizePopover((value) => !value)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-200 transition hover:bg-sky-400/20"
                    >
                        <EditIcon />
                    </button>
                    {showSizePopover && (
                        <SizeSelectorPopover
                            assignedSizes={new Set(data.sizes)}
                            allSizes={allSizes}
                            onToggleSize={handleToggleSize}
                            onClose={() => setShowSizePopover(false)}
                        />
                    )}
                </div>
            </td>
            <td className="px-4 py-3 text-right">
                <button
                    onClick={() => onArchive(productGroupId, variety.id, !variety.archived)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                        variety.archived
                            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
                            : 'border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
                    }`}
                >
                    {variety.archived ? <ArrowUturnLeftIcon /> : <ArchiveBoxXMarkIcon />}
                </button>
            </td>
        </tr>
    );
};

const ProductsTab: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { productGroups, sizes, updateProductGroup, setProductGroupArchived, addProductGroup, updateVariety, setVarietyArchived, updateSize, updateWarehouse } = data;
    const [editingIconEntity, setEditingIconEntity] = useState<{ type: IconEntityType; name: string; currentIcon: string; id?: string } | null>(null);
    const [productSubTab, setProductSubTab] = useState<ProductSubTab>('catalog');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ Manzanas: true });

    const handleEditIcon = (type: IconEntityType, name: string, icon: string, id?: string) => setEditingIconEntity({ type, name, currentIcon: icon, id });
    const handleSaveIcon = (newIcon: string) => {
        if (!editingIconEntity) return;
        const { type, name, id } = editingIconEntity;
        if (type === 'productGroup') {
            const group = productGroups.find((item) => item.name === name);
            if (group) updateProductGroup(group.id, { icon: newIcon });
        } else if (type === 'variety') {
            const variety = productGroups.flatMap((group) => group.varieties).find((item) => item.name === name);
            if (variety) {
                const group = productGroups.find((item) => item.varieties.some((candidate) => candidate.id === variety.id));
                if (group) updateVariety(group.id, variety.id, { icon: newIcon });
            }
        } else if (type === 'quality') {
            updateSize(name, { icon: newIcon });
        } else if (type === 'warehouse' && id) {
            updateWarehouse(id, { icon: newIcon });
        }
        setEditingIconEntity(null);
    };

    const uniqueCategories = useMemo(() => Array.from(new Set(productGroups.map((group) => group.category))), [productGroups]);
    const productsByCategory = useMemo(() => {
        const grouped: Record<string, ProductGroup[]> = {};
        productGroups.forEach((group) => {
            if (!grouped[group.category]) grouped[group.category] = [];
            grouped[group.category].push(group);
        });
        return grouped;
    }, [productGroups]);

    return (
        <div className={`${panelClass} p-5 md:p-6`}>
            <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className={labelClass}>Catalogos operativos</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Productos y tamaños</h2>
                </div>
                <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
                    <button
                        onClick={() => setProductSubTab('catalog')}
                        className={`rounded-2xl px-4 py-3 text-sm font-black transition ${productSubTab === 'catalog' ? 'bg-brand-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                        Productos
                    </button>
                    <button
                        onClick={() => setProductSubTab('sizes')}
                        className={`rounded-2xl px-4 py-3 text-sm font-black transition ${productSubTab === 'sizes' ? 'bg-brand-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                        Tamaños
                    </button>
                </div>
            </div>

            {productSubTab === 'catalog' ? (
                <div className="overflow-x-auto rounded-[1.8rem] border border-white/10 bg-slate-950/50">
                    <table className="min-w-full divide-y divide-white/10 text-sm text-slate-300">
                        <thead className="bg-white/[0.04]">
                            <tr>
                                <th className="w-8"></th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Nombre</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Categoria</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Unidad</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Alias</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Tamaños</th>
                                <th className="w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/8">
                            <AddProductRow onAdd={addProductGroup} />
                            {(Object.entries(productsByCategory) as [string, ProductGroup[]][]).map(([category, groups]) => (
                                <React.Fragment key={category}>
                                    <tr className="bg-white/[0.06]">
                                        <td colSpan={7}>
                                            <button
                                                onClick={() => setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }))}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-black text-slate-200 transition hover:bg-white/[0.04]"
                                            >
                                                {expandedCategories[category] ? <ChevronDownIcon /> : <ChevronRightIcon />}
                                                {category}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedCategories[category] &&
                                        groups.map((group) => (
                                            <React.Fragment key={group.id}>
                                                <tr className={`${group.archived ? 'opacity-55' : ''} bg-white/[0.02]`}>
                                                    <td className="px-4 py-3">
                                                        <button onClick={() => handleEditIcon('productGroup', group.name, group.icon)} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08]">
                                                            <IconDisplay icon={group.icon} className="text-2xl" />
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input defaultValue={group.name} onBlur={(event) => updateProductGroup(group.id, { name: event.target.value })} className={subtleInputClass} />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            defaultValue={group.category}
                                                            onBlur={(event) => updateProductGroup(group.id, { category: event.target.value })}
                                                            list="categories"
                                                            className={subtleInputClass}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            defaultValue={group.unit}
                                                            onBlur={(event) => updateProductGroup(group.id, { unit: event.target.value as 'cajas' | 'kilos' | 'unidades' })}
                                                            className={subtleInputClass}
                                                        >
                                                            <option value="cajas">cajas</option>
                                                            <option value="kilos">kilos</option>
                                                            <option value="unidades">unidades</option>
                                                        </select>
                                                    </td>
                                                    <td colSpan={2}></td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => setProductGroupArchived(group.id, !group.archived)}
                                                            className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                                                                group.archived
                                                                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
                                                                    : 'border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
                                                            }`}
                                                        >
                                                            {group.archived ? <ArrowUturnLeftIcon /> : <ArchiveBoxXMarkIcon />}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {group.varieties.map((variety) => (
                                                    <EditableVarietyRow
                                                        key={variety.id}
                                                        variety={variety}
                                                        productGroupId={group.id}
                                                        allSizes={sizes}
                                                        onUpdate={updateVariety}
                                                        onArchive={setVarietyArchived}
                                                        onEditIcon={handleEditIcon}
                                                    />
                                                ))}
                                            </React.Fragment>
                                        ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
                    <p className={labelClass}>Catalogo de tamaños</p>
                    <h3 className="mt-2 text-xl font-black tracking-tight text-white">Gestion de tamaños</h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">La configuracion de tamaños sigue usando el catalogo ya existente. Esta vista queda preparada para integrarlo sin romper flujos actuales.</p>
                </div>
            )}
            {editingIconEntity && <IconEditorModal entity={editingIconEntity} isOpen={!!editingIconEntity} onClose={() => setEditingIconEntity(null)} onSave={handleSaveIcon} />}
            <datalist id="categories">{uniqueCategories.map((category) => <option key={category} value={category} />)}</datalist>
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
        <div className={`${panelClass} p-6`}>
            <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className={labelClass}>Topologia fisica</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Mis bodegas</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className={labelClass}>Bodegas registradas</p>
                    <p className="mt-2 text-2xl font-black text-white">{warehouses.length}</p>
                </div>
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (newName) {
                        onAdd(newName, newIcon);
                        setNewName('');
                        setNewIcon('B');
                    }
                }}
                className="mb-5 grid grid-cols-1 gap-3 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[140px_minmax(0,1fr)_auto]"
            >
                <input type="text" value={newIcon} onChange={(event) => setNewIcon(event.target.value)} className={`${inputClass} text-center`} placeholder="Cod." />
                <input type="text" value={newName} onChange={(event) => setNewName(event.target.value)} className={inputClass} placeholder="Direccion / nombre" />
                <button type="submit" className="inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300">
                    <PlusIcon />
                    <span>Añadir</span>
                </button>
            </form>

            <div className="space-y-3">
                {warehouses.map((warehouse) => (
                    <div key={warehouse.id} className={`flex flex-col gap-3 rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center ${warehouse.archived ? 'opacity-60' : ''}`}>
                        <button onClick={() => onEditIcon('warehouse', warehouse.name, warehouse.icon, warehouse.id)} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 transition hover:bg-white/10">
                            <IconDisplay icon={warehouse.icon} className="w-6 h-6 text-xl" />
                        </button>
                        <input type="text" defaultValue={warehouse.name} onBlur={(event) => onUpdate(warehouse.id, { name: event.target.value })} className={`${subtleInputClass} flex-1`} />
                        <button
                            onClick={() => onArchive(warehouse.id, !warehouse.archived)}
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                                warehouse.archived
                                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
                                    : 'border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
                            }`}
                        >
                            {warehouse.archived ? <ArrowUturnLeftIcon /> : <ArchiveBoxXMarkIcon />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Inventory: React.FC<{ data: BusinessData }> = ({ data }) => {
    const {
        productGroups,
        inventory,
        prices,
        warehouses,
        moveInventory,
        changeQuality,
        adjustInventory,
        setPrice,
        sizes,
        qualities,
        stateIcons,
        addWarehouse,
        updateWarehouse,
        setWarehouseArchived,
        moveBatchLocation,
        crateTypes,
    } = data;

    const [activeTab, setActiveTab] = useState<InventoryTab>('global');
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
    const [expandedVarieties, setExpandedVarieties] = useState<Record<string, boolean>>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [saveStatus, setSaveStatus] = useState<{ key: string; message: string; success: boolean } | null>(null);
    const [editingIconEntity, setEditingIconEntity] = useState<{ type: IconEntityType; name: string; currentIcon: string; id?: string } | null>(null);

    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [currentActionBatch, setCurrentActionBatch] = useState<InventoryBatch | null>(null);
    const [currentActionType, setCurrentActionType] = useState<ActionType | null>(null);
    const [currentActionTarget, setCurrentActionTarget] = useState('');

    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [currentTransferBatch, setCurrentTransferBatch] = useState<InventoryBatch | null>(null);

    const activeWarehouses = useMemo(() => warehouses.filter((warehouse) => !warehouse.archived), [warehouses]);

    const filteredInventory = useMemo(() => {
        if (activeTab === 'catalogs') return [];
        if (activeTab === 'global') return inventory.filter((batch) => batch.quantity > 0);
        return inventory.filter((batch) => batch.warehouseId === activeTab && batch.quantity > 0);
    }, [inventory, activeTab]);

    const varietyLookup = useMemo(() => {
        const lookup = new Map<string, { group: ProductGroup; variety: ProductVariety }>();
        productGroups.forEach((group) => {
            group.varieties.forEach((variety) => lookup.set(variety.id, { group, variety }));
        });
        return lookup;
    }, [productGroups]);

    const groupedInventory = useMemo(() => {
        const groups = new Map<
            string,
            { group: ProductGroup; varieties: Map<string, { variety: ProductVariety; batches: (InventoryBatch & { price?: number })[] }> }
        >();

        for (const batch of filteredInventory) {
            const lookup = varietyLookup.get(batch.varietyId);
            if (!lookup) continue;

            const { group, variety } = lookup;
            if (!groups.has(group.id)) groups.set(group.id, { group, varieties: new Map() });
            const groupEntry = groups.get(group.id)!;
            if (!groupEntry.varieties.has(variety.id)) groupEntry.varieties.set(variety.id, { variety, batches: [] });

            const varietyEntry = groupEntry.varieties.get(variety.id)!;
            const price = prices.find(
                (item) => item.varietyId === variety.id && item.size === batch.size && item.quality === batch.quality && item.state === batch.state,
            )?.price;
            varietyEntry.batches.push({ ...batch, price });
        }

        return Array.from(groups.values())
            .map((entry) => {
                const varietiesArray = Array.from(entry.varieties.values()).sort((a, b) => a.variety.name.localeCompare(b.variety.name));
                return { ...entry, varieties: varietiesArray, isSingleVariety: varietiesArray.length === 1 };
            })
            .sort((a, b) => a.group.name.localeCompare(b.group.name));
    }, [filteredInventory, varietyLookup, prices]);

    const totalBoxes = useMemo(() => inventory.reduce((sum, batch) => sum + batch.quantity, 0), [inventory]);
    const liveVarieties = useMemo(() => new Set(inventory.filter((batch) => batch.quantity > 0).map((batch) => batch.varietyId)).size, [inventory]);
    const activeGroupCount = useMemo(() => productGroups.filter((group) => !group.archived).length, [productGroups]);

    const toggleNode = (id: string) => setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
    const toggleVariety = (id: string) => setExpandedVarieties((prev) => ({ ...prev, [id]: !prev[id] }));

    const handleStartEdit = (key: string, value: string | number) => {
        setEditingKey(key);
        setEditingValue(String(value || ''));
        setSaveStatus(null);
    };

    const handleSaveEdit = async (key: string) => {
        const value = parseFloat(editingValue);
        if (isNaN(value)) {
            setEditingKey(null);
            return;
        }

        const parts = key.split('-');
        let result;
        if (parts[0] === 'qty') result = await adjustInventory(parts[1], parts[5], parts[2], parts[3] as Quality, parts[4] as FruitState, parts[6], value);
        else result = await setPrice(parts[1], parts[2], parts[3] as Quality, parts[4] as FruitState, value);

        setSaveStatus({ key, message: result.message, success: result.success });
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
        alert('Transferencia simulada. Funcion completa pendiente de conexion al backend.');
        setTransferModalOpen(false);
        setCurrentTransferBatch(null);
    };

    const getProductName = (batch: InventoryBatch | null) => {
        if (!batch) return '';
        const lookup = varietyLookup.get(batch.varietyId);
        return `${lookup?.group.name || ''} ${lookup?.variety.name || ''} (${batch.size})`;
    };

    return (
        <div className="flex h-full flex-col gap-6">
            <section className="rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.12),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Inventario vivo</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">Stock, catalogos y bodegas dentro del nuevo shell operativo.</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Reorganicé la lectura visual para que la capa operativa se sienta premium: jerarquia clara, paneles de cristal y acciones primarias siempre a mano.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 lg:min-w-[420px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Cajas activas</p>
                            <p className="mt-2 text-2xl font-black text-white">{totalBoxes}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Variedades vivas</p>
                            <p className="mt-2 text-2xl font-black text-white">{liveVarieties}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Bodegas activas</p>
                            <p className="mt-2 text-2xl font-black text-white">{activeWarehouses.length}</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className={`${panelClass} overflow-hidden`}>
                <nav className="flex overflow-x-auto border-b border-white/10 bg-slate-950/70 px-3 py-3" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('global')}
                        className={`inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${activeTab === 'global' ? 'bg-brand-400 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <InventoryIcon />
                        <span>Global</span>
                    </button>
                    {activeWarehouses.map((warehouse) => (
                        <button
                            key={warehouse.id}
                            onClick={() => setActiveTab(warehouse.id)}
                            title={warehouse.name}
                            className={`ml-2 inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${activeTab === warehouse.id ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <IconDisplay icon={warehouse.icon} className="text-lg" />
                            <span className="hidden md:inline">{warehouse.name}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setActiveTab('catalogs')}
                        className={`ml-auto inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${activeTab === 'catalogs' ? 'bg-brand-400 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <SettingsIcon />
                        <span>Catalogos</span>
                    </button>
                </nav>

                <div className="bg-transparent p-4 md:p-5">
                    {activeTab === 'catalogs' ? (
                        <div className="space-y-6">
                            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] px-5 py-4">
                                    <p className={labelClass}>Grupos activos</p>
                                    <p className="mt-2 text-3xl font-black text-white">{activeGroupCount}</p>
                                </div>
                                <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] px-5 py-4">
                                    <p className={labelClass}>Bodegas</p>
                                    <p className="mt-2 text-3xl font-black text-white">{warehouses.length}</p>
                                </div>
                                <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] px-5 py-4">
                                    <p className={labelClass}>Tamaños cargados</p>
                                    <p className="mt-2 text-3xl font-black text-white">{Object.keys(sizes).length}</p>
                                </div>
                            </section>
                            <ProductsTab data={data} />
                            <WarehouseManager warehouses={warehouses} onAdd={addWarehouse} onUpdate={updateWarehouse} onArchive={setWarehouseArchived} onEditIcon={handleEditIcon} />
                            {editingIconEntity && <IconEditorModal entity={editingIconEntity} isOpen={!!editingIconEntity} onClose={() => setEditingIconEntity(null)} onSave={handleSaveIcon} />}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedInventory.map(({ group, varieties, isSingleVariety }) => {
                                const groupBatches = varieties.flatMap((entry) => entry.batches);
                                const mainVariety = varieties[0]?.variety;
                                const title = isSingleVariety ? `${group.name} ${mainVariety?.name || ''}` : group.name;

                                return (
                                    <div key={group.id} className={`${panelClass} overflow-hidden`}>
                                        <IntelligentHeader
                                            icon={group.icon}
                                            title={title}
                                            batches={groupBatches}
                                            crateTypes={crateTypes}
                                            allSizes={sizes}
                                            expanded={expandedNodes[group.id]}
                                            onToggle={() => toggleNode(group.id)}
                                            level="group"
                                            varietiesList={varieties}
                                            isSingleVariety={isSingleVariety}
                                        />
                                        {expandedNodes[group.id] && (
                                            <div className="border-t border-white/10">
                                                {isSingleVariety ? (
                                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-4">
                                                        <InventoryTable
                                                            batches={groupBatches}
                                                            showWarehouseCol={activeTab === 'global'}
                                                            stateIcons={stateIcons}
                                                            qualityIcons={qualities}
                                                            warehouses={warehouses}
                                                            allSizes={sizes}
                                                            crateTypes={crateTypes}
                                                            onEdit={handleStartEdit}
                                                            editingKey={editingKey}
                                                            editingValue={editingValue}
                                                            setEditingValue={setEditingValue}
                                                            onSaveEdit={handleSaveEdit}
                                                            saveStatus={saveStatus}
                                                            onInitiateAction={handleInitiateAction}
                                                            onInitiateTransfer={handleInitiateTransfer}
                                                        />
                                                    </div>
                                                ) : (
                                                    varieties.map(({ variety, batches }) => (
                                                        <div key={variety.id} className="last:border-0 border-b border-white/8">
                                                            <IntelligentHeader
                                                                icon={variety.icon}
                                                                title={variety.name}
                                                                batches={batches}
                                                                crateTypes={crateTypes}
                                                                allSizes={sizes}
                                                                expanded={expandedVarieties[variety.id]}
                                                                onToggle={() => toggleVariety(variety.id)}
                                                                level="variety"
                                                            />
                                                            {expandedVarieties[variety.id] && (
                                                                <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-4">
                                                                    <InventoryTable
                                                                        batches={batches}
                                                                        showWarehouseCol={activeTab === 'global'}
                                                                        stateIcons={stateIcons}
                                                                        qualityIcons={qualities}
                                                                        warehouses={warehouses}
                                                                        allSizes={sizes}
                                                                        crateTypes={crateTypes}
                                                                        onEdit={handleStartEdit}
                                                                        editingKey={editingKey}
                                                                        editingValue={editingValue}
                                                                        setEditingValue={setEditingValue}
                                                                        onSaveEdit={handleSaveEdit}
                                                                        saveStatus={saveStatus}
                                                                        onInitiateAction={handleInitiateAction}
                                                                        onInitiateTransfer={handleInitiateTransfer}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {groupedInventory.length === 0 && (
                                <div className={`${panelClass} px-6 py-16 text-center`}>
                                    <p className="text-xl font-bold text-white">No hay inventario en esta vista.</p>
                                    <p className="mt-2 text-sm text-slate-400">Prueba otra bodega o vuelve a la vista global para revisar el stock consolidado.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <InventoryActionModal
                isOpen={actionModalOpen}
                onClose={() => setActionModalOpen(false)}
                onConfirm={handleConfirmAction}
                actionType={currentActionType}
                batch={currentActionBatch}
                targetValue={currentActionTarget}
                productName={getProductName(currentActionBatch)}
            />
            <TransferModal
                isOpen={transferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                onConfirm={handleConfirmTransfer}
                batch={currentTransferBatch}
                warehouses={activeWarehouses}
                productName={getProductName(currentTransferBatch)}
            />
        </div>
    );
};

export default Inventory;
