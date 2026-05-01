import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InventoryBatch, CrateType, FruitState, Quality, Warehouse } from '../../types';
import { SparklesIcon, WarehouseTransferIcon, ChevronUpIcon, ChevronDownIcon, ChevronRightIcon } from '../icons/Icons';

export type IconEntityType = 'category' | 'productGroup' | 'variety' | 'quality' | 'state' | 'warehouse';
export type ActionType = 'moveState' | 'changeQuality' | 'moveLocation';

export const FRUIT_STATES: FruitState[] = ['Verde', 'Entrado', 'Maduro', 'Suave'];
export const QUALITIES: Quality[] = ['Normal', 'Con Defectos', 'Merma'];

const modalPanelClass = 'glass-panel-dark rounded-[2rem] border border-white/10';
const fieldClass = 'w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20';

export const IconDisplay: React.FC<{ icon: string; className?: string }> = React.memo(({ icon, className = '' }) => {
    if (icon && icon.trim().startsWith('<svg')) {
        return <div className={`inline-block h-6 w-6 ${className}`} dangerouslySetInnerHTML={{ __html: icon }} />;
    }
    return <span className={`inline-flex items-center justify-center text-lg font-bold ${className}`}>{icon || '[]'}</span>;
});

const getCrateDotColor = (colorName: string = '') => {
    const lower = colorName.toLowerCase();
    if (lower.includes('verde')) return '#16a34a';
    if (lower.includes('roja') || lower.includes('rojo')) return '#dc2626';
    if (lower.includes('azul')) return '#2563eb';
    if (lower.includes('negra') || lower.includes('negro')) return '#374151';
    if (lower.includes('madera')) return '#b45309';
    return '#94a3b8';
};

export const CrateTooltip: React.FC<{ breakdown: { code: string; count: number; color: string }[] }> = ({ breakdown }) => (
    <div className="absolute bottom-full left-1/2 z-[60] mb-2 flex max-w-[240px] w-max -translate-x-1/2 flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-slate-950/95 p-2 text-xs text-white shadow-2xl backdrop-blur-sm">
        {breakdown.map((item, idx) => (
            <span key={idx} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 shadow-sm">
                <span className="mr-1.5 h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: getCrateDotColor(item.color) }}></span>
                <span className="mr-1 font-bold">{item.count}</span>
                <span className="font-mono text-[10px] text-slate-400">{item.code}</span>
            </span>
        ))}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-950/90"></div>
    </div>
);

export const MaturityBarSegment: React.FC<{
    count: number;
    total: number;
    batches: InventoryBatch[];
    crateTypes: CrateType[];
    colorClass: string;
}> = ({ count, total, batches, crateTypes, colorClass }) => {
    const [hovered, setHovered] = useState(false);
    const widthPct = (count / total) * 100;

    const breakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        batches.forEach((batch) => {
            const pkgId = batch.packagingId || 'unknown';
            counts[pkgId] = (counts[pkgId] || 0) + batch.quantity;
        });
        return Object.entries(counts)
            .map(([pkgId, qty]) => {
                const crate = crateTypes.find((item) => item.id === pkgId);
                return {
                    code: crate?.shortCode || '?',
                    count: qty,
                    color: crate?.color || 'gray',
                };
            })
            .sort((a, b) => b.count - a.count);
    }, [batches, crateTypes]);

    if (count === 0) return null;

    return (
        <div
            className={`relative flex h-full cursor-help items-center justify-center first:rounded-l-xl last:rounded-r-xl transition-all hover:brightness-110 ${colorClass} ${
                hovered ? 'z-50 scale-y-110 shadow-sm' : 'z-10'
            }`}
            style={{ width: `${widthPct}%` }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {widthPct > 10 && <span className="select-none text-[10px] font-bold leading-none text-white drop-shadow-md">{count}</span>}
            {hovered && <CrateTooltip breakdown={breakdown} />}
        </div>
    );
};

export const SizeMaturityBlock: React.FC<{
    sizeName: string;
    sizeIcon: string;
    batches: InventoryBatch[];
    crateTypes: CrateType[];
    showLabel?: boolean;
}> = ({ sizeName, sizeIcon, batches, crateTypes, showLabel = true }) => {
    const total = batches.reduce((acc, batch) => acc + batch.quantity, 0);

    const byState = useMemo(() => {
        const groups: Record<string, InventoryBatch[]> = { Verde: [], Entrado: [], Maduro: [], Suave: [] };
        batches.forEach((batch) => {
            if (groups[batch.state]) groups[batch.state].push(batch);
        });
        return groups;
    }, [batches]);

    const stateColors: Record<string, string> = {
        Verde: 'bg-emerald-500',
        Entrado: 'bg-amber-400',
        Maduro: 'bg-rose-500',
        Suave: 'bg-orange-700',
    };

    if (total === 0) return null;

    return (
        <div className="flex min-w-[96px] max-w-[150px] flex-grow flex-col">
            {showLabel && (
                <div className="mb-1 flex items-center justify-between px-0.5">
                    <span className="flex items-center gap-1 truncate text-[11px] font-bold text-slate-200">
                        <IconDisplay icon={sizeIcon} className="text-xs" /> {sizeName}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-400">{total}</span>
                </div>
            )}
            <div className="flex h-5 w-full overflow-visible rounded-xl border border-white/10 bg-slate-950/80 shadow-inner">
                {FRUIT_STATES.map((state) => (
                    <MaturityBarSegment
                        key={state}
                        count={byState[state].length > 0 ? byState[state].reduce((acc, batch) => acc + batch.quantity, 0) : 0}
                        total={total}
                        batches={byState[state]}
                        crateTypes={crateTypes}
                        colorClass={stateColors[state]}
                    />
                ))}
            </div>
        </div>
    );
};

export const LocationRow: React.FC<{
    locationIcon: string;
    batches: InventoryBatch[];
    crateTypes: CrateType[];
    allSizes: Record<string, { icon: string }>;
    groupBySize?: boolean;
}> = ({ locationIcon, batches, crateTypes, allSizes, groupBySize = true }) => {
    const batchesBySize = useMemo(() => {
        if (!groupBySize) return { All: batches };

        const groups: Record<string, InventoryBatch[]> = {};
        batches.forEach((batch) => {
            if (!groups[batch.size]) groups[batch.size] = [];
            groups[batch.size].push(batch);
        });
        return groups;
    }, [batches, groupBySize]);

    const sortedSizes = useMemo(() => {
        const presentSizes = Object.keys(batchesBySize);
        if (!groupBySize) return ['All'];

        const catalogOrder = Object.keys(allSizes);
        return presentSizes.sort((a, b) => {
            const idxA = catalogOrder.indexOf(a);
            const idxB = catalogOrder.indexOf(b);
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
    }, [batchesBySize, allSizes, groupBySize]);

    if (batches.length === 0) return null;

    return (
        <div className="flex w-full items-start gap-3 border-b border-white/10 py-2 last:border-0">
            <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-center text-lg ${
                    groupBySize ? 'mt-4' : 'mt-0'
                }`}
                title={locationIcon === '❄️' ? 'Cámara Fría' : 'Piso de Venta'}
            >
                {locationIcon}
            </span>
            <div className="flex flex-grow flex-wrap gap-x-4 gap-y-3">
                {sortedSizes.map((size) => (
                    <SizeMaturityBlock
                        key={size}
                        sizeName={size === 'All' ? '' : size}
                        sizeIcon={size === 'All' ? '' : allSizes[size]?.icon || ''}
                        batches={batchesBySize[size]}
                        crateTypes={crateTypes}
                        showLabel={groupBySize}
                    />
                ))}
            </div>
        </div>
    );
};

export const StockMatrix: React.FC<{
    batches: InventoryBatch[];
    crateTypes: CrateType[];
    allSizes: Record<string, { icon: string }>;
    singleSizeMode?: boolean;
}> = ({ batches, crateTypes, allSizes, singleSizeMode = false }) => {
    const cameraBatches = useMemo(() => batches.filter((batch) => batch.location === 'Cámara Fría'), [batches]);
    const floorBatches = useMemo(() => batches.filter((batch) => batch.location !== 'Cámara Fría'), [batches]);

    if (batches.length === 0) return <span className="pl-2 text-xs italic text-slate-500">Sin inventario</span>;

    return (
        <div className="flex w-full flex-col overflow-visible">
            <LocationRow locationIcon="❄️" batches={cameraBatches} crateTypes={crateTypes} allSizes={allSizes} groupBySize={!singleSizeMode} />
            <LocationRow locationIcon="☀️" batches={floorBatches} crateTypes={crateTypes} allSizes={allSizes} groupBySize={!singleSizeMode} />
        </div>
    );
};

export const IconSelect: React.FC<{
    value: string;
    options: { value: string; label: string; icon: React.ReactNode }[];
    onChange: (newValue: string) => void;
    title?: string;
}> = ({ value, options, onChange, title }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find((option) => option.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative inline-block" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 transition hover:border-white/20 hover:bg-white/10 focus:outline-none"
                title={title || selectedOption?.label}
            >
                <span className="flex items-center justify-center text-xl leading-none text-slate-100">{selectedOption?.icon}</span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 sm:hidden" onClick={(event) => { event.stopPropagation(); setIsOpen(false); }}>
                        <div className={`${modalPanelClass} w-64 p-2`}>
                            <div className="mb-1 border-b border-white/10 p-2 text-center text-sm font-black text-white">Seleccionar</div>
                            <div className="max-h-80 overflow-y-auto">
                                {options.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`mb-1 flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left text-base transition ${
                                            option.value === value
                                                ? 'bg-brand-400/15 font-semibold text-brand-200'
                                                : 'text-slate-200 hover:bg-white/5'
                                        }`}
                                    >
                                        <span className="w-8 text-center text-2xl">{option.icon}</span>
                                        <span>{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="absolute left-1/2 z-50 mt-2 hidden w-52 -translate-x-1/2 rounded-[1.4rem] border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-sm sm:left-0 sm:block sm:translate-x-0">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                                    option.value === value ? 'bg-white/8 font-semibold text-white' : 'text-slate-200 hover:bg-white/5'
                                }`}
                            >
                                <span className="w-6 text-center text-lg">{option.icon}</span>
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export const InventoryActionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (quantity: number) => void;
    actionType: ActionType | null;
    batch: InventoryBatch | null;
    targetValue: string;
    productName: string;
}> = ({ isOpen, onClose, onConfirm, actionType, batch, targetValue, productName }) => {
    const [quantity, setQuantity] = useState<number>(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && batch) {
            setQuantity(batch.quantity);
            setTimeout(() => inputRef.current?.select(), 100);
        }
    }, [isOpen, batch]);

    if (!isOpen || !batch) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onConfirm(quantity);
    };

    const getActionTitle = () => {
        if (actionType === 'moveState') return 'Mover inventario';
        if (actionType === 'moveLocation') return 'Cambiar ubicación';
        return 'Cambiar calidad';
    };

    const getCurrentValueDisplay = () => {
        if (actionType === 'moveState') return batch.state;
        if (actionType === 'moveLocation') return batch.location === 'Cámara Fría' ? 'Cámara Fría' : 'Piso de Venta';
        return batch.quality;
    };

    const getTargetValueDisplay = () => {
        if (actionType === 'moveLocation') return targetValue === 'Cámara Fría' ? 'Cámara Fría' : 'Piso de Venta';
        return targetValue;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${modalPanelClass} w-full max-w-sm p-6 md:p-7`}>
                <div className="mb-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Accion sobre lote</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{getActionTitle()}</h2>
                </div>
                <div className="mb-4 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                    <p className="mb-3 font-semibold text-white">{productName}</p>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-300">
                            {actionType === 'moveLocation' && (batch.location === 'Cámara Fría' ? '❄️' : '☀️')}
                            {getCurrentValueDisplay()}
                        </span>
                        <i className="fa-solid fa-arrow-right text-slate-500"></i>
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-400/30 bg-brand-400/15 px-3 py-1.5 text-xs font-bold text-brand-100">
                            {actionType === 'moveLocation' && (targetValue === 'Cámara Fría' ? '❄️' : '☀️')}
                            {getTargetValueDisplay()}
                        </span>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Cantidad de cajas (máx. {batch.quantity})</label>
                    <input
                        ref={inputRef}
                        type="number"
                        min="1"
                        max={batch.quantity}
                        value={quantity}
                        onChange={(event) => setQuantity(Number(event.target.value))}
                        className={`${fieldClass} text-center text-lg font-semibold`}
                    />
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white">
                            Cancelar
                        </button>
                        <button type="submit" className="rounded-2xl bg-brand-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300">
                            Confirmar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const TransferModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (targetWarehouseId: string, quantity: number) => void;
    batch: InventoryBatch | null;
    warehouses: Warehouse[];
    productName: string;
}> = ({ isOpen, onClose, onConfirm, batch, warehouses, productName }) => {
    const [quantity, setQuantity] = useState<number>(0);
    const [targetWarehouseId, setTargetWarehouseId] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && batch) {
            setQuantity(batch.quantity);
            const otherWarehouse = warehouses.find((warehouse) => warehouse.id !== batch.warehouseId);
            setTargetWarehouseId(otherWarehouse?.id || '');
            setTimeout(() => inputRef.current?.select(), 100);
        }
    }, [isOpen, batch, warehouses]);

    if (!isOpen || !batch) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (targetWarehouseId && quantity > 0) onConfirm(targetWarehouseId, quantity);
    };

    const currentWarehouse = warehouses.find((warehouse) => warehouse.id === batch.warehouseId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${modalPanelClass} w-full max-w-sm p-6 md:p-7`}>
                <div className="mb-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Transferencia</p>
                    <h2 className="mt-2 flex items-center gap-2 text-2xl font-black tracking-tight text-white">
                        <WarehouseTransferIcon />
                        Transferir bodega
                    </h2>
                </div>
                <div className="mb-4 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                    <p className="mb-3 font-semibold text-white">{productName}</p>
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                        <div className="flex items-center gap-2 text-slate-200">
                            <IconDisplay icon={currentWarehouse?.icon || ''} className="text-sm" />
                            <span className="font-semibold">{currentWarehouse?.name || 'Origen'}</span>
                        </div>
                        <i className="fa-solid fa-arrow-right text-slate-500"></i>
                        <select value={targetWarehouseId} onChange={(event) => setTargetWarehouseId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none">
                            {warehouses.filter((warehouse) => warehouse.id !== batch.warehouseId).map((warehouse) => (
                                <option key={warehouse.id} value={warehouse.id}>
                                    {warehouse.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Cantidad de cajas (máx. {batch.quantity})</label>
                    <input
                        ref={inputRef}
                        type="number"
                        min="1"
                        max={batch.quantity}
                        value={quantity}
                        onChange={(event) => setQuantity(Number(event.target.value))}
                        className={`${fieldClass} text-center text-lg font-semibold`}
                    />
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!targetWarehouseId}
                        >
                            Transferir
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const IconEditorModal: React.FC<{
    entity: { type: IconEntityType; name: string; currentIcon: string };
    isOpen: boolean;
    onClose: () => void;
    onSave: (newIcon: string) => void;
}> = ({ entity, isOpen, onClose, onSave }) => {
    const [iconValue, setIconValue] = useState(entity.currentIcon);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setIconValue(entity.currentIcon);
        setError('');
        setAiPrompt('');
    }, [entity]);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!aiPrompt) return;
        setIsGenerating(true);
        setError('');
        try {
            const { generateSvgIcon } = await import('../../services/geminiService');
            const svg = await generateSvgIcon(aiPrompt);
            setIconValue(svg);
        } catch (errorValue: unknown) {
            setError(errorValue instanceof Error ? errorValue.message : 'Error al generar icono.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${modalPanelClass} w-full max-w-md p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Iconografia</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Editar icono: {entity.name}</h2>
                </div>
                <div className="mb-4 flex flex-col items-center rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
                    <span className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Vista previa</span>
                    <IconDisplay icon={iconValue} className="h-16 w-16 text-6xl" />
                </div>
                <div className="mb-4">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Emoji o SVG</label>
                    <textarea
                        value={iconValue}
                        onChange={(event) => setIconValue(event.target.value)}
                        rows={3}
                        className={`${fieldClass} font-mono text-sm`}
                        placeholder="ej. 🍓 o <svg>...</svg>"
                    />
                </div>
                <div className="mb-4">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Generar con IA</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={aiPrompt}
                            onChange={(event) => setAiPrompt(event.target.value)}
                            placeholder="Describe un icono..."
                            className={`${fieldClass} flex-grow`}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex w-32 items-center justify-center rounded-2xl bg-sky-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isGenerating ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent"></div> : <><SparklesIcon /><span className="ml-2">Generar</span></>}
                        </button>
                    </div>
                    {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white">
                        Cancelar
                    </button>
                    <button onClick={() => { onSave(iconValue); onClose(); }} className="rounded-2xl bg-brand-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300">
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

export const IntelligentHeader: React.FC<{
    icon: string;
    title: string;
    batches: InventoryBatch[];
    crateTypes: CrateType[];
    allSizes: Record<string, { icon: string }>;
    expanded: boolean;
    onToggle: () => void;
    level: 'group' | 'variety';
    varietiesList?: { variety: { name: string }; batches: InventoryBatch[] }[];
    isSingleVariety?: boolean;
}> = ({ icon, title, batches, crateTypes, allSizes, expanded, onToggle, level, varietiesList, isSingleVariety }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const isCarouselActive = level === 'group' && !isSingleVariety && varietiesList && varietiesList.length > 1 && !expanded;

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isCarouselActive && !isHovered) {
            interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % (varietiesList?.length || 1));
            }, 4000);
        }
        return () => clearInterval(interval);
    }, [isCarouselActive, isHovered, varietiesList?.length]);

    const handleWheel = (event: React.WheelEvent) => {
        if (isCarouselActive && isHovered) {
            if (event.deltaY > 0) setCurrentIndex((prev) => (prev + 1) % (varietiesList?.length || 1));
            else setCurrentIndex((prev) => (prev - 1 + (varietiesList?.length || 1)) % (varietiesList?.length || 1));
        }
    };

    const nextSlide = (event?: React.MouseEvent) => {
        event?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % (varietiesList?.length || 1));
    };

    const prevSlide = (event?: React.MouseEvent) => {
        event?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + (varietiesList?.length || 1)) % (varietiesList?.length || 1));
    };

    const currentVarietyData = isCarouselActive ? varietiesList![currentIndex] : null;
    const displayTitle = isCarouselActive ? `${title} ${currentVarietyData.variety.name}` : title;
    const displayBatches = isCarouselActive ? currentVarietyData.batches : batches;

    const stats = useMemo(() => {
        let totalQty = 0;
        let totalValue = 0;
        let totalMerma = 0;
        let totalDefects = 0;

        displayBatches.forEach((batch) => {
            totalQty += batch.quantity;
            totalValue += (batch.price || 0) * batch.quantity;
            if (batch.quality === 'Merma') totalMerma += batch.quantity;
            if (batch.quality === 'Con Defectos') totalDefects += batch.quantity;
        });
        return { totalQty, totalValue, totalMerma, totalDefects };
    }, [displayBatches]);

    const containerClass =
        level === 'group'
            ? 'bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.12),transparent_32%),rgba(15,23,42,0.9)] px-5 py-5'
            : 'border-b border-white/10 bg-white/[0.03] px-5 py-4';

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onWheel={handleWheel}
            className={`relative w-full text-left transition-colors ${containerClass}`}
        >
            <button onClick={onToggle} className="absolute inset-0 z-0 h-full w-full cursor-pointer focus:outline-none"></button>
            <div className="relative z-10 flex w-full flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex min-w-[200px] items-center gap-3">
                    {isCarouselActive && (
                        <div className="z-20 mr-1 flex flex-col items-center justify-center pointer-events-auto" onClick={(event) => event.stopPropagation()}>
                            <button onClick={prevSlide} className="p-0.5 text-slate-500 transition hover:text-brand-300" title="Anterior"><ChevronUpIcon /></button>
                            <div className="my-1 flex flex-col gap-1">
                                {varietiesList!.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setCurrentIndex(idx);
                                        }}
                                        className={`w-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'h-3 bg-brand-400' : 'h-1.5 bg-slate-600 hover:bg-slate-400'}`}
                                        title={varietiesList![idx].variety.name}
                                    />
                                ))}
                            </div>
                            <button onClick={nextSlide} className="p-0.5 text-slate-500 transition hover:text-brand-300" title="Siguiente"><ChevronDownIcon /></button>
                        </div>
                    )}
                    {level === 'group' && (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-brand-400/15 text-2xl text-brand-100">
                            <IconDisplay icon={icon} className="text-3xl" />
                        </div>
                    )}
                    <div key={isCarouselActive ? currentIndex : 'static'} className={`transition-all duration-500 ${isCarouselActive ? 'animate-in slide-in-from-bottom-2 fade-in' : ''}`}>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{level === 'group' ? 'Grupo operativo' : 'Variedad'}</p>
                        <h2 className={`${level === 'group' ? 'text-xl' : 'text-lg'} mt-1 font-black tracking-tight text-white`}>{displayTitle}</h2>
                    </div>
                    <div className="ml-auto pointer-events-auto sm:hidden">
                        <button onClick={onToggle} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
                            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        </button>
                    </div>
                </div>

                {!expanded && (
                    <div className="flex w-full flex-col gap-4 border-t border-white/10 pt-4 sm:border-t-0 sm:pt-0 md:flex-row md:items-center">
                        <div className={`w-full flex-grow pointer-events-auto ${isCarouselActive ? 'animate-in fade-in' : ''}`} key={isCarouselActive ? currentIndex : 'matrix'}>
                            <StockMatrix batches={displayBatches} crateTypes={crateTypes} allSizes={allSizes} />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 md:ml-4 md:justify-end">
                            {(stats.totalMerma > 0 || stats.totalDefects > 0) && (
                                <div className="flex gap-2">
                                    {stats.totalDefects > 0 && (
                                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-center text-amber-100">
                                            <span className="block text-[10px] font-black uppercase tracking-[0.24em]">Defectos</span>
                                            <span className="text-sm font-black">{stats.totalDefects}</span>
                                        </div>
                                    )}
                                    {stats.totalMerma > 0 && (
                                        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-center text-rose-100">
                                            <span className="block text-[10px] font-black uppercase tracking-[0.24em]">Merma</span>
                                            <span className="text-sm font-black">{stats.totalMerma}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {stats.totalValue > 0 && (
                                <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right sm:block">
                                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Valor estimado</div>
                                    <div className="text-sm font-mono font-semibold text-slate-200">
                                        {stats.totalValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            )}
                            <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-right">
                                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Total</div>
                                <span className="text-lg font-black text-white">{stats.totalQty}</span>
                            </div>
                        </div>
                    </div>
                )}
                <div className="ml-auto hidden pointer-events-auto sm:block">
                    <button onClick={onToggle} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
                        {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    </button>
                </div>
            </div>
        </div>
    );
};
