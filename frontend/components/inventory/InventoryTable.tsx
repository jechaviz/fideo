
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { InventoryBatch, Warehouse, CrateType, Quality } from '../../types';
import { ChevronRightIcon, ChevronDownIcon } from '../icons/Icons';
import { StockMatrix, IconSelect, IconDisplay, ActionType, QUALITIES, FRUIT_STATES } from './InventoryShared';

interface FilterState {
    size: string;
    quality: string;
    state: string;
    warehouse: string;
    location: string;
}

const InventoryTable: React.FC<{
    batches: InventoryBatch[];
    showWarehouseCol: boolean;
    stateIcons: Record<string, string>;
    qualityIcons: Record<Quality, { icon: string }>;
    warehouses: Warehouse[];
    allSizes: Record<string, { icon: string }>;
    crateTypes: CrateType[];
    onEdit: (key: string, value: string | number) => void;
    editingKey: string | null;
    editingValue: string;
    setEditingValue: (val: string) => void;
    onSaveEdit: (key: string) => void;
    saveStatus: { key: string; message: string; success: boolean } | null;
    onInitiateAction: (batch: InventoryBatch, actionType: ActionType, targetValue: string) => void;
    onInitiateTransfer: (batch: InventoryBatch) => void;
}> = ({ 
    batches, showWarehouseCol, stateIcons, qualityIcons, warehouses, allSizes, crateTypes,
    onEdit, editingKey, editingValue, setEditingValue, onSaveEdit,
    saveStatus, onInitiateAction, onInitiateTransfer
}) => {
    const [filters, setFilters] = useState<FilterState>({ size: '', quality: '', state: '', warehouse: '', location: '' });
    const tableRef = useRef<HTMLDivElement>(null);
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);
    const [collapsedSizes, setCollapsedSizes] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const handleScroll = () => {
            if (tableRef.current) {
                const { scrollLeft, scrollWidth, clientWidth } = tableRef.current;
                setShowScrollIndicator(scrollWidth > clientWidth && scrollLeft + clientWidth < scrollWidth - 10);
            }
        };
        const observer = new ResizeObserver(handleScroll);
        if (tableRef.current) {
            observer.observe(tableRef.current);
            tableRef.current.addEventListener('scroll', handleScroll);
            handleScroll();
        }
        return () => {
            observer.disconnect();
            if (tableRef.current) tableRef.current.removeEventListener('scroll', handleScroll);
        };
    }, [batches]);

    const scrollRight = () => {
        if (tableRef.current) {
            tableRef.current.scrollBy({ left: tableRef.current.clientWidth * 0.8, behavior: 'smooth' });
        }
    };

    const getUniqueValues = (key: keyof InventoryBatch) => Array.from(new Set(batches.map(b => b[key]))).sort();
    const uniqueSizes = useMemo(() => getUniqueValues('size'), [batches]);
    const uniqueQualities = useMemo(() => getUniqueValues('quality'), [batches]);
    const uniqueStates = useMemo(() => getUniqueValues('state'), [batches]);
    const uniqueWarehouses = useMemo(() => showWarehouseCol ? Array.from(new Set(batches.map(b => warehouses.find(w => w.id === b.warehouseId)?.icon || 'N/A'))) : [], [batches, showWarehouseCol, warehouses]);

    const filteredBatches = useMemo(() => {
        return batches.filter(b => {
            const whIcon = warehouses.find(w => w.id === b.warehouseId)?.icon || 'N/A';
            let locationMatch = true;
            if (filters.location === 'yes') locationMatch = b.location === 'Cámara Fría';
            else if (filters.location === 'no') locationMatch = b.location !== 'Cámara Fría';
            return (!filters.size || b.size === filters.size) &&
                (!filters.quality || b.quality === filters.quality) &&
                (!filters.state || b.state === filters.state) &&
                (!filters.warehouse || whIcon === filters.warehouse) &&
                locationMatch;
        });
    }, [batches, filters, warehouses]);

    const groupedBatches = useMemo(() => {
        const groups: Record<string, InventoryBatch[]> = {};
        filteredBatches.forEach(b => {
            if (!groups[b.size]) groups[b.size] = [];
            groups[b.size].push(b);
        });
        return groups;
    }, [filteredBatches]);

    const sortedSizes = useMemo(() => Object.keys(groupedBatches).sort(), [groupedBatches]);
    const toggleSizeCollapse = (size: string) => setCollapsedSizes(prev => ({...prev, [size]: !prev[size]}));

    const getCrateColorClass = (colorName: string = '') => {
        const lowerColor = colorName.toLowerCase();
        if (lowerColor.includes('verde')) return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
        if (lowerColor.includes('roja') || lowerColor.includes('rojo')) return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
        if (lowerColor.includes('azul')) return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
        if (lowerColor.includes('madera')) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700';
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
    };

    const FilterHeader = ({ label, value, options, onChange, getLabel, icon, customOptions }: { label: string, value: string, options: string[], onChange: (val: string) => void, getLabel?: (val: string) => string, icon?: React.ReactNode, customOptions?: {value: string, label: string}[] }) => (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 hidden md:block whitespace-nowrap">{label}</span>
            {icon && <span className="text-lg text-gray-500 dark:text-gray-400 md:hidden">{icon}</span>}
            <select value={value} onChange={e => onChange(e.target.value)} className="text-xs p-1 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-1 focus:ring-green-500 w-full min-w-[60px]" aria-label={label}>
                <option value="">{icon ? 'Todos' : 'Todos'}</option>
                {customOptions 
                    ? customOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                    : options.map(opt => <option key={opt} value={opt}>{getLabel ? getLabel(opt) : opt}</option>)
                }
            </select>
        </div>
    );

    return (
        <div className="relative w-full">
            <div ref={tableRef} className="overflow-x-auto w-full pb-2">
                <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400 table-fixed md:table-auto">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-20">
                        <tr>
                            <th colSpan={2} className="px-2 md:px-4 py-3 align-top min-w-[140px]">
                                <FilterHeader label="Tamaño" icon={<span title="Tamaño">📏</span>} value={filters.size} options={uniqueSizes as string[]} onChange={v => setFilters({...filters, size: v})} getLabel={(val) => `${allSizes[val]?.icon || ''} ${val}`}/>
                            </th>
                            <th className="px-2 md:px-4 py-3 align-top w-24 min-w-[90px]">
                                <FilterHeader label="Calidad" icon={<span title="Calidad">🏷️</span>} value={filters.quality} options={uniqueQualities as string[]} onChange={v => setFilters({...filters, quality: v})} getLabel={(val) => `${qualityIcons[val as Quality]?.icon || ''} ${val}`}/>
                            </th>
                            <th className="px-2 md:px-4 py-3 align-top w-24 min-w-[90px]">
                                <FilterHeader label="Estado" icon={<span title="Estado">🚦</span>} value={filters.state} options={uniqueStates as string[]} onChange={v => setFilters({...filters, state: v})} getLabel={(val) => `${stateIcons[val] || ''} ${val}`}/>
                            </th>
                            <th className="px-2 md:px-4 py-3 align-top w-28 min-w-[110px]">
                                <FilterHeader label="En Cámara" icon={<span title="En Cámara">❄️</span>} value={filters.location} options={[]} customOptions={[{ value: 'yes', label: '❄️ Si' }, { value: 'no', label: '☀️ No' }]} onChange={v => setFilters({...filters, location: v})}/>
                            </th>
                            {showWarehouseCol && (
                                <th className="px-2 md:px-4 py-3 align-top w-24 min-w-[90px]">
                                    <FilterHeader label="Bodega" icon={<span title="Bodega">🏭</span>} value={filters.warehouse} options={uniqueWarehouses} onChange={v => setFilters({...filters, warehouse: v})} />
                                </th>
                            )}
                            <th className="px-2 md:px-4 py-3 align-top text-center font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs pt-7 w-20 min-w-[80px]">Cajas</th>
                            <th className="px-2 md:px-4 py-3 align-top text-center font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs pt-7 w-20 min-w-[80px]">Peso</th>
                            <th className="px-2 md:px-4 py-3 align-top text-right font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs pt-7 w-24 min-w-[90px]">Precio</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedSizes.map(size => {
                            const sizeBatches = groupedBatches[size];
                            const totalQty = sizeBatches.reduce((sum, b) => sum + b.quantity, 0);
                            const sizeIcon = allSizes[size]?.icon || '📏';
                            const isCollapsed = collapsedSizes[size];
                            
                            return (
                                <React.Fragment key={size}>
                                    <tr onClick={() => toggleSizeCollapse(size)} className="bg-gray-100 dark:bg-gray-700 border-y dark:border-gray-600 sticky top-[65px] md:top-[68px] z-10 shadow-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                        <td colSpan={2} className="px-2 sm:px-4 py-2 align-middle">
                                            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
                                                <span className="text-lg bg-white dark:bg-gray-600 rounded-full w-8 h-8 flex items-center justify-center shadow-sm text-base flex-shrink-0">{sizeIcon}</span>
                                                <span className="font-bold text-sm">{size}</span>
                                                {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                                            </div>
                                        </td>
                                        <td colSpan={showWarehouseCol ? 4 : 3} className="px-2 py-1 align-middle">
                                            {isCollapsed && <StockMatrix batches={sizeBatches} crateTypes={crateTypes} allSizes={allSizes} singleSizeMode={true} />}
                                        </td>
                                        <td className="px-2 sm:px-4 py-2 text-center align-middle"><span className="inline-block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs font-bold px-2.5 py-0.5 rounded-full border border-green-200 dark:border-green-700">{totalQty}</span></td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                    {!isCollapsed && sizeBatches.map((batch, idx) => {
                                        const warehouse = warehouses.find(w => w.id === batch.warehouseId);
                                        const qtyKey = `qty-${batch.varietyId}-${batch.size}-${batch.quality}-${batch.state}-${batch.warehouseId}-${batch.packagingId || ''}`;
                                        const priceKey = `price-${batch.varietyId}-${batch.size}-${batch.quality}-${batch.state}`;
                                        const isEditingQty = editingKey === qtyKey;
                                        const isEditingPrice = editingKey === priceKey;
                                        const qtyStatus = saveStatus?.key === qtyKey ? saveStatus : null;
                                        const priceStatus = saveStatus?.key === priceKey ? saveStatus : null;
                                        const warehouseIcon = warehouse?.icon || 'N/A';
                                        const isTextIcon = warehouseIcon.length > 1 && !warehouseIcon.includes('<svg');
                                        const crate = crateTypes.find(c => c.id === batch.packagingId);
                                        const totalWeight = (crate?.capacity || 0) * batch.quantity;

                                        return (
                                            <tr key={`${size}-${idx}`} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                                <td className="px-2 md:px-4 py-2"><span className="text-gray-300 dark:text-gray-600 ml-4 select-none text-lg">↳</span></td>
                                                <td className="px-2 md:px-4 py-2">
                                                    <div className={`inline-block px-2 py-1 text-xs font-bold rounded-md border cursor-help whitespace-nowrap ${getCrateColorClass(crate?.color)}`} title={`${crate ? crate.name : 'Desconocido'} (Cap: ${crate?.capacity || '?'}kg)`}>
                                                        {crate?.shortCode || '?'}
                                                    </div>
                                                </td>
                                                <td className="px-2 sm:px-4 py-2">
                                                    <IconSelect value={batch.quality} options={QUALITIES.map(q => ({ value: q, label: q, icon: qualityIcons[q]?.icon }))} onChange={(val) => onInitiateAction(batch, 'changeQuality', val)} title={`Calidad actual: ${batch.quality}`}/>
                                                </td>
                                                <td className="px-2 sm:px-4 py-2">
                                                    <IconSelect value={batch.state} options={FRUIT_STATES.map(s => ({ value: s, label: s, icon: stateIcons[s] }))} onChange={(val) => onInitiateAction(batch, 'moveState', val)} title={`Estado actual: ${batch.state}`}/>
                                                </td>
                                                <td className="px-2 sm:px-4 py-2 text-center">
                                                    <button onClick={() => onInitiateAction(batch, 'moveLocation', batch.location === 'Cámara Fría' ? 'Piso de Venta' : 'Cámara Fría')} className={`flex items-center justify-center p-2 rounded-md transition-colors w-full h-full max-w-[40px] mx-auto ${batch.location === 'Cámara Fría' ? 'text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30' : 'text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30'}`} title={batch.location === 'Cámara Fría' ? 'En Cámara (Click para mover a Piso)' : 'En Piso (Click para mover a Cámara)'}>
                                                        {batch.location === 'Cámara Fría' ? <i className="fa-regular fa-snowflake text-xl"></i> : <i className="fa-regular fa-sun text-xl"></i>}
                                                    </button>
                                                </td>
                                                {showWarehouseCol && (
                                                    <td className="px-2 sm:px-4 py-2 text-xs">
                                                        <button onClick={() => onInitiateTransfer(batch)} className="flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors text-left w-full justify-center md:justify-start" title={`${warehouse?.name}`}>
                                                            <IconDisplay icon={warehouseIcon} className="text-base"/> 
                                                            {!isTextIcon && <span className="truncate max-w-[80px] hidden sm:inline">{warehouse?.name || 'N/A'}</span>}
                                                        </button>
                                                    </td>
                                                )}
                                                <td className="px-2 sm:px-4 py-2 text-center relative">
                                                    {isEditingQty ? (
                                                        <input autoFocus type="number" className="w-14 md:w-16 p-1 md:p-2 text-center border border-blue-500 rounded text-gray-900 dark:text-white dark:bg-gray-700 text-base md:text-lg" value={editingValue} onChange={e => setEditingValue(e.target.value)} onBlur={() => onSaveEdit(qtyKey)} onKeyDown={e => e.key === 'Enter' && onSaveEdit(qtyKey)}/>
                                                    ) : (
                                                        <span onClick={() => onEdit(qtyKey, batch.quantity)} className="cursor-pointer text-base md:text-lg font-bold hover:text-blue-600 dark:text-white border-b border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-colors">{batch.quantity}</span>
                                                    )}
                                                    {qtyStatus && <span className={`absolute -top-2 right-0 text-[10px] px-1 rounded ${qtyStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{qtyStatus.success ? '✓' : '✗'}</span>}
                                                </td>
                                                <td className="px-2 sm:px-4 py-2 text-center"><span className="text-xs font-mono text-gray-600 dark:text-gray-400">{totalWeight >= 1000 ? `${(totalWeight/1000).toFixed(2)} t` : `${totalWeight} kg`}</span></td>
                                                <td className="px-2 sm:px-4 py-2 text-right relative">
                                                    {isEditingPrice ? (
                                                        <input autoFocus type="number" className="w-16 md:w-20 p-1 md:p-2 text-right border border-green-500 rounded text-gray-900 dark:text-white dark:bg-gray-700 text-xs md:text-sm" value={editingValue} onChange={e => setEditingValue(e.target.value)} onBlur={() => onSaveEdit(priceKey)} onKeyDown={e => e.key === 'Enter' && onSaveEdit(priceKey)}/>
                                                    ) : (
                                                        <span onClick={() => onEdit(priceKey, batch.price)} className="cursor-pointer font-medium text-green-600 dark:text-green-400 hover:underline text-xs md:text-sm block">{batch.price ? batch.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '--'}</span>
                                                    )}
                                                    {priceStatus && <span className={`absolute -top-2 right-0 text-[10px] px-1 rounded ${priceStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{priceStatus.success ? '✓' : '✗'}</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                        {filteredBatches.length === 0 && <tr><td colSpan={showWarehouseCol ? 9 : 8} className="text-center py-6 text-gray-500">No hay coincidencias con los filtros.</td></tr>}
                    </tbody>
                </table>
            </div>
            {showScrollIndicator && <button onClick={scrollRight} className="md:hidden absolute right-2 top-1/2 transform -translate-y-1/2 z-30 bg-green-500/80 text-white p-2 rounded-full shadow-lg animate-pulse focus:outline-none" aria-label="Scroll right"><ChevronRightIcon /></button>}
        </div>
    );
};

export default InventoryTable;
