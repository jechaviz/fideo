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

const filterSelectClass = 'w-full min-w-[70px] rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20';

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
    batches,
    showWarehouseCol,
    stateIcons,
    qualityIcons,
    warehouses,
    allSizes,
    crateTypes,
    onEdit,
    editingKey,
    editingValue,
    setEditingValue,
    onSaveEdit,
    saveStatus,
    onInitiateAction,
    onInitiateTransfer,
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

    const getUniqueValues = (key: keyof InventoryBatch) => Array.from(new Set(batches.map((batch) => batch[key]))).sort();
    const uniqueSizes = useMemo(() => getUniqueValues('size'), [batches]);
    const uniqueQualities = useMemo(() => getUniqueValues('quality'), [batches]);
    const uniqueStates = useMemo(() => getUniqueValues('state'), [batches]);
    const uniqueWarehouses = useMemo(
        () => (showWarehouseCol ? Array.from(new Set(batches.map((batch) => warehouses.find((warehouse) => warehouse.id === batch.warehouseId)?.icon || 'N/A'))) : []),
        [batches, showWarehouseCol, warehouses],
    );

    const filteredBatches = useMemo(() => {
        return batches.filter((batch) => {
            const whIcon = warehouses.find((warehouse) => warehouse.id === batch.warehouseId)?.icon || 'N/A';
            let locationMatch = true;
            if (filters.location === 'yes') locationMatch = batch.location === 'Cámara Fría';
            else if (filters.location === 'no') locationMatch = batch.location !== 'Cámara Fría';

            return (
                (!filters.size || batch.size === filters.size) &&
                (!filters.quality || batch.quality === filters.quality) &&
                (!filters.state || batch.state === filters.state) &&
                (!filters.warehouse || whIcon === filters.warehouse) &&
                locationMatch
            );
        });
    }, [batches, filters, warehouses]);

    const groupedBatches = useMemo(() => {
        const groups: Record<string, InventoryBatch[]> = {};
        filteredBatches.forEach((batch) => {
            if (!groups[batch.size]) groups[batch.size] = [];
            groups[batch.size].push(batch);
        });
        return groups;
    }, [filteredBatches]);

    const sortedSizes = useMemo(() => Object.keys(groupedBatches).sort(), [groupedBatches]);
    const toggleSizeCollapse = (size: string) => setCollapsedSizes((prev) => ({ ...prev, [size]: !prev[size] }));

    const getCrateColorClass = (colorName: string = '') => {
        const lowerColor = colorName.toLowerCase();
        if (lowerColor.includes('verde')) return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100';
        if (lowerColor.includes('roja') || lowerColor.includes('rojo')) return 'border-rose-300/30 bg-rose-400/15 text-rose-100';
        if (lowerColor.includes('azul')) return 'border-sky-300/30 bg-sky-400/15 text-sky-100';
        if (lowerColor.includes('madera')) return 'border-amber-300/30 bg-amber-400/15 text-amber-100';
        return 'border-white/10 bg-white/5 text-slate-200';
    };

    const FilterHeader = ({
        label,
        value,
        options,
        onChange,
        getLabel,
        icon,
        customOptions,
    }: {
        label: string;
        value: string;
        options: string[];
        onChange: (val: string) => void;
        getLabel?: (val: string) => string;
        icon?: React.ReactNode;
        customOptions?: { value: string; label: string }[];
    }) => (
        <div className="flex min-w-[88px] flex-col gap-2">
            <span className="hidden whitespace-nowrap text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 md:block">{label}</span>
            {icon && <span className="text-lg text-slate-500 md:hidden">{icon}</span>}
            <select value={value} onChange={(event) => onChange(event.target.value)} className={filterSelectClass} aria-label={label}>
                <option value="">Todos</option>
                {customOptions
                    ? customOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                              {option.label}
                          </option>
                      ))
                    : options.map((option) => (
                          <option key={option} value={option}>
                              {getLabel ? getLabel(option) : option}
                          </option>
                      ))}
            </select>
        </div>
    );

    return (
        <div className="relative w-full rounded-[1.8rem] border border-white/10 bg-slate-950/60 p-3">
            <div ref={tableRef} className="w-full overflow-x-auto pb-2">
                <table className="min-w-full table-fixed text-left text-sm text-slate-300 md:table-auto">
                    <thead className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm">
                        <tr>
                            <th colSpan={2} className="px-2 py-3 align-top md:px-4">
                                <FilterHeader
                                    label="Tamaño"
                                    icon={<span title="Tamaño">📏</span>}
                                    value={filters.size}
                                    options={uniqueSizes as string[]}
                                    onChange={(value) => setFilters({ ...filters, size: value })}
                                    getLabel={(value) => `${allSizes[value]?.icon || ''} ${value}`}
                                />
                            </th>
                            <th className="px-2 py-3 align-top md:px-4">
                                <FilterHeader
                                    label="Calidad"
                                    icon={<span title="Calidad">🏷️</span>}
                                    value={filters.quality}
                                    options={uniqueQualities as string[]}
                                    onChange={(value) => setFilters({ ...filters, quality: value })}
                                    getLabel={(value) => `${qualityIcons[value as Quality]?.icon || ''} ${value}`}
                                />
                            </th>
                            <th className="px-2 py-3 align-top md:px-4">
                                <FilterHeader
                                    label="Estado"
                                    icon={<span title="Estado">🚦</span>}
                                    value={filters.state}
                                    options={uniqueStates as string[]}
                                    onChange={(value) => setFilters({ ...filters, state: value })}
                                    getLabel={(value) => `${stateIcons[value] || ''} ${value}`}
                                />
                            </th>
                            <th className="px-2 py-3 align-top md:px-4">
                                <FilterHeader
                                    label="En cámara"
                                    icon={<span title="En cámara">❄️</span>}
                                    value={filters.location}
                                    options={[]}
                                    customOptions={[
                                        { value: 'yes', label: '❄️ Sí' },
                                        { value: 'no', label: '☀️ No' },
                                    ]}
                                    onChange={(value) => setFilters({ ...filters, location: value })}
                                />
                            </th>
                            {showWarehouseCol && (
                                <th className="px-2 py-3 align-top md:px-4">
                                    <FilterHeader
                                        label="Bodega"
                                        icon={<span title="Bodega">🏭</span>}
                                        value={filters.warehouse}
                                        options={uniqueWarehouses}
                                        onChange={(value) => setFilters({ ...filters, warehouse: value })}
                                    />
                                </th>
                            )}
                            <th className="px-2 py-3 text-center align-top text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 md:px-4 md:pt-8">Cajas</th>
                            <th className="px-2 py-3 text-center align-top text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 md:px-4 md:pt-8">Peso</th>
                            <th className="px-2 py-3 text-right align-top text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 md:px-4 md:pt-8">Precio</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedSizes.map((size) => {
                            const sizeBatches = groupedBatches[size];
                            const totalQty = sizeBatches.reduce((sum, batch) => sum + batch.quantity, 0);
                            const sizeIcon = allSizes[size]?.icon || '📏';
                            const isCollapsed = collapsedSizes[size];

                            return (
                                <React.Fragment key={size}>
                                    <tr
                                        onClick={() => toggleSizeCollapse(size)}
                                        className="sticky top-[77px] z-10 cursor-pointer border-y border-white/10 bg-white/[0.06] shadow-sm transition hover:bg-white/[0.1] md:top-[80px]"
                                    >
                                        <td colSpan={2} className="px-2 py-3 align-middle sm:px-4">
                                            <div className="flex items-center gap-3 text-white">
                                                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-base">
                                                    {sizeIcon}
                                                </span>
                                                <span className="text-sm font-black">{size}</span>
                                                {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                                            </div>
                                        </td>
                                        <td colSpan={showWarehouseCol ? 4 : 3} className="px-2 py-2 align-middle">
                                            {isCollapsed && <StockMatrix batches={sizeBatches} crateTypes={crateTypes} allSizes={allSizes} singleSizeMode={true} />}
                                        </td>
                                        <td className="px-2 py-3 text-center align-middle sm:px-4">
                                            <span className="inline-flex rounded-full border border-brand-400/20 bg-brand-400/12 px-3 py-1 text-xs font-black text-brand-100">{totalQty}</span>
                                        </td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                    {!isCollapsed &&
                                        sizeBatches.map((batch, idx) => {
                                            const warehouse = warehouses.find((item) => item.id === batch.warehouseId);
                                            const qtyKey = `qty-${batch.varietyId}-${batch.size}-${batch.quality}-${batch.state}-${batch.warehouseId}-${batch.packagingId || ''}`;
                                            const priceKey = `price-${batch.varietyId}-${batch.size}-${batch.quality}-${batch.state}`;
                                            const isEditingQty = editingKey === qtyKey;
                                            const isEditingPrice = editingKey === priceKey;
                                            const qtyStatus = saveStatus?.key === qtyKey ? saveStatus : null;
                                            const priceStatus = saveStatus?.key === priceKey ? saveStatus : null;
                                            const warehouseIcon = warehouse?.icon || 'N/A';
                                            const isTextIcon = warehouseIcon.length > 1 && !warehouseIcon.includes('<svg');
                                            const crate = crateTypes.find((item) => item.id === batch.packagingId);
                                            const totalWeight = (crate?.capacity || 0) * batch.quantity;

                                            return (
                                                <tr key={`${size}-${idx}`} className="border-b border-white/8 bg-transparent transition hover:bg-white/[0.03]">
                                                    <td className="px-2 py-3 md:px-4">
                                                        <span className="ml-4 select-none text-lg text-slate-600">↳</span>
                                                    </td>
                                                    <td className="px-2 py-3 md:px-4">
                                                        <div
                                                            className={`inline-block whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black cursor-help ${getCrateColorClass(crate?.color)}`}
                                                            title={`${crate ? crate.name : 'Desconocido'} (Cap: ${crate?.capacity || '?'}kg)`}
                                                        >
                                                            {crate?.shortCode || '?'}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-3 sm:px-4">
                                                        <IconSelect
                                                            value={batch.quality}
                                                            options={QUALITIES.map((quality) => ({ value: quality, label: quality, icon: qualityIcons[quality]?.icon }))}
                                                            onChange={(value) => onInitiateAction(batch, 'changeQuality', value)}
                                                            title={`Calidad actual: ${batch.quality}`}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-3 sm:px-4">
                                                        <IconSelect
                                                            value={batch.state}
                                                            options={FRUIT_STATES.map((state) => ({ value: state, label: state, icon: stateIcons[state] }))}
                                                            onChange={(value) => onInitiateAction(batch, 'moveState', value)}
                                                            title={`Estado actual: ${batch.state}`}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-3 text-center sm:px-4">
                                                        <button
                                                            onClick={() => onInitiateAction(batch, 'moveLocation', batch.location === 'Cámara Fría' ? 'Piso de Venta' : 'Cámara Fría')}
                                                            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                                                                batch.location === 'Cámara Fría'
                                                                    ? 'border-sky-300/20 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20'
                                                                    : 'border-amber-300/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
                                                            }`}
                                                            title={batch.location === 'Cámara Fría' ? 'En cámara (mover a piso)' : 'En piso (mover a cámara)'}
                                                        >
                                                            {batch.location === 'Cámara Fría' ? <i className="fa-regular fa-snowflake text-xl"></i> : <i className="fa-regular fa-sun text-xl"></i>}
                                                        </button>
                                                    </td>
                                                    {showWarehouseCol && (
                                                        <td className="px-2 py-3 text-xs sm:px-4">
                                                            <button
                                                                onClick={() => onInitiateTransfer(batch)}
                                                                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-slate-200 transition hover:bg-white/[0.07] md:justify-start"
                                                                title={warehouse?.name}
                                                            >
                                                                <IconDisplay icon={warehouseIcon} className="text-base" />
                                                                {!isTextIcon && <span className="hidden max-w-[90px] truncate sm:inline">{warehouse?.name || 'N/A'}</span>}
                                                            </button>
                                                        </td>
                                                    )}
                                                    <td className="relative px-2 py-3 text-center sm:px-4">
                                                        {isEditingQty ? (
                                                            <input
                                                                autoFocus
                                                                type="number"
                                                                className="w-16 rounded-2xl border border-brand-400/40 bg-slate-950 px-2 py-2 text-center text-base font-bold text-white outline-none focus:ring-2 focus:ring-brand-400/20 md:w-20"
                                                                value={editingValue}
                                                                onChange={(event) => setEditingValue(event.target.value)}
                                                                onBlur={() => onSaveEdit(qtyKey)}
                                                                onKeyDown={(event) => event.key === 'Enter' && onSaveEdit(qtyKey)}
                                                            />
                                                        ) : (
                                                            <span
                                                                onClick={() => onEdit(qtyKey, batch.quantity)}
                                                                className="cursor-pointer border-b border-dashed border-slate-600 text-base font-black text-white transition hover:border-brand-400 hover:text-brand-200 md:text-lg"
                                                            >
                                                                {batch.quantity}
                                                            </span>
                                                        )}
                                                        {qtyStatus && (
                                                            <span
                                                                className={`absolute -top-1 right-0 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                                                                    qtyStatus.success ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'
                                                                }`}
                                                            >
                                                                {qtyStatus.success ? '✓' : '✕'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-3 text-center sm:px-4">
                                                        <span className="text-xs font-mono text-slate-400">{totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)} t` : `${totalWeight} kg`}</span>
                                                    </td>
                                                    <td className="relative px-2 py-3 text-right sm:px-4">
                                                        {isEditingPrice ? (
                                                            <input
                                                                autoFocus
                                                                type="number"
                                                                className="w-20 rounded-2xl border border-emerald-400/40 bg-slate-950 px-2 py-2 text-right text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/20 md:w-24"
                                                                value={editingValue}
                                                                onChange={(event) => setEditingValue(event.target.value)}
                                                                onBlur={() => onSaveEdit(priceKey)}
                                                                onKeyDown={(event) => event.key === 'Enter' && onSaveEdit(priceKey)}
                                                            />
                                                        ) : (
                                                            <span
                                                                onClick={() => onEdit(priceKey, batch.price)}
                                                                className="block cursor-pointer text-sm font-semibold text-emerald-300 transition hover:text-emerald-200 hover:underline"
                                                            >
                                                                {batch.price ? batch.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '--'}
                                                            </span>
                                                        )}
                                                        {priceStatus && (
                                                            <span
                                                                className={`absolute -top-1 right-0 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                                                                    priceStatus.success ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'
                                                                }`}
                                                            >
                                                                {priceStatus.success ? '✓' : '✕'}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </React.Fragment>
                            );
                        })}
                        {filteredBatches.length === 0 && (
                            <tr>
                                <td colSpan={showWarehouseCol ? 9 : 8} className="py-10 text-center text-sm text-slate-500">
                                    No hay coincidencias con los filtros.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {showScrollIndicator && (
                <button
                    onClick={scrollRight}
                    className="absolute right-3 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 transform items-center justify-center rounded-full bg-brand-400 text-slate-950 shadow-glow md:hidden"
                    aria-label="Scroll right"
                >
                    <ChevronRightIcon />
                </button>
            )}
        </div>
    );
};

export default InventoryTable;
