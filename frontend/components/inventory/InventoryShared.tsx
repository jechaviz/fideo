
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InventoryBatch, CrateType, FruitState, Quality, Warehouse } from '../../types';
import { generateSvgIcon } from '../../services/geminiService';
import { SparklesIcon, WarehouseTransferIcon, ChevronUpIcon, ChevronDownIcon, ChevronRightIcon } from '../icons/Icons';

export type IconEntityType = 'category' | 'productGroup' | 'variety' | 'quality' | 'state' | 'warehouse';
export type ActionType = 'moveState' | 'changeQuality' | 'moveLocation';

export const FRUIT_STATES: FruitState[] = ['Verde', 'Entrado', 'Maduro', 'Suave'];
export const QUALITIES: Quality[] = ['Normal', 'Con Defectos', 'Merma'];

export const IconDisplay: React.FC<{ icon: string; className?: string }> = React.memo(({ icon, className = '' }) => {
    if (icon && icon.trim().startsWith('<svg')) {
        return <div className={`w-6 h-6 inline-block ${className}`} dangerouslySetInnerHTML={{ __html: icon }} />;
    }
    return <span className={`text-lg inline-flex items-center justify-center font-bold ${className}`}>{icon || '📦'}</span>;
});

// Helper to map crate color names to CSS colors for the dot
const getCrateDotColor = (colorName: string = '') => {
    const lower = colorName.toLowerCase();
    if (lower.includes('verde')) return '#16a34a'; // green-600
    if (lower.includes('roja') || lower.includes('rojo')) return '#dc2626'; // red-600
    if (lower.includes('azul')) return '#2563eb'; // blue-600
    if (lower.includes('negra') || lower.includes('negro')) return '#374151'; // gray-700
    if (lower.includes('madera')) return '#b45309'; // amber-700
    return '#9ca3af'; // gray-400
};

export const CrateTooltip: React.FC<{ breakdown: { code: string, count: number, color: string }[] }> = ({ breakdown }) => (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] flex flex-wrap gap-1.5 p-2 bg-gray-900/95 text-white text-xs rounded-lg shadow-xl z-[60] pointer-events-none animate-in fade-in zoom-in duration-200 border border-gray-700 backdrop-blur-sm">
        {breakdown.map((item, idx) => (
            <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-gray-800 border border-gray-600 shadow-sm">
                <span className="w-2 h-2 rounded-full mr-1.5 shadow-sm" style={{ backgroundColor: getCrateDotColor(item.color) }}></span>
                <span className="font-bold mr-1">{item.count}</span> <span className="font-mono text-gray-300 text-[10px]">{item.code}</span>
            </span>
        ))}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/90"></div>
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
        batches.forEach(b => {
            const pkgId = b.packagingId || 'unknown';
            counts[pkgId] = (counts[pkgId] || 0) + b.quantity;
        });
        return Object.entries(counts).map(([pkgId, qty]) => {
            const crate = crateTypes.find(c => c.id === pkgId);
            return {
                code: crate?.shortCode || '?',
                count: qty,
                color: crate?.color || 'gray'
            };
        }).sort((a, b) => b.count - a.count);
    }, [batches, crateTypes]);

    if (count === 0) return null;

    return (
        <div 
            className={`relative h-full flex items-center justify-center first:rounded-l-md last:rounded-r-md transition-all hover:brightness-110 cursor-help ${colorClass} ${hovered ? 'z-50 scale-y-110 shadow-sm' : 'z-10'}`}
            style={{ width: `${widthPct}%` }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {widthPct > 10 && <span className="text-[10px] font-bold text-white drop-shadow-md select-none leading-none">{count}</span>}
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
    const total = batches.reduce((acc, b) => acc + b.quantity, 0);
    
    const byState = useMemo(() => {
        const groups: Record<string, InventoryBatch[]> = { 'Verde': [], 'Entrado': [], 'Maduro': [], 'Suave': [] };
        batches.forEach(b => {
            if (groups[b.state]) groups[b.state].push(b);
        });
        return groups;
    }, [batches]);

    const stateColors: Record<string, string> = {
        'Verde': 'bg-green-500 dark:bg-green-600',
        'Entrado': 'bg-yellow-400 dark:bg-yellow-500',
        'Maduro': 'bg-red-500 dark:bg-red-600',
        'Suave': 'bg-amber-700 dark:bg-amber-800',
    };

    if (total === 0) return null;

    return (
        <div className="flex flex-col min-w-[90px] max-w-[140px] flex-grow">
            {showLabel && (
                <div className="flex items-center justify-between mb-1 px-0.5">
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 truncate">
                        <IconDisplay icon={sizeIcon} className="text-xs"/> {sizeName}
                    </span>
                    <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 rounded-full">{total}</span>
                </div>
            )}
            <div className="h-5 flex rounded-md bg-gray-200 dark:bg-gray-700 w-full overflow-visible shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                {FRUIT_STATES.map(state => (
                    <MaturityBarSegment 
                        key={state}
                        count={byState[state].length > 0 ? byState[state].reduce((a,b) => a + b.quantity, 0) : 0}
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
        if (!groupBySize) return { 'All': batches };
        
        const groups: Record<string, InventoryBatch[]> = {};
        batches.forEach(b => {
            if (!groups[b.size]) groups[b.size] = [];
            groups[b.size].push(b);
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
        <div className="flex items-start gap-3 w-full py-1.5 border-b last:border-0 border-gray-100 dark:border-gray-700/50 border-dashed">
            {/* Alignment fixed: Added margin-top to align with the bar, accounting for the label height */}
            <span className={`flex-shrink-0 w-6 text-center text-xl ${groupBySize ? 'mt-5' : 'mt-0'}`} title={locationIcon === '❄️' ? "Cámara Fría" : "Piso de Venta"}>
                {locationIcon}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-3 flex-grow">
                {sortedSizes.map(size => (
                    <SizeMaturityBlock 
                        key={size}
                        sizeName={size === 'All' ? '' : size}
                        sizeIcon={size === 'All' ? '' : (allSizes[size]?.icon || '')}
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
    const cameraBatches = useMemo(() => batches.filter(b => b.location === 'Cámara Fría'), [batches]);
    const floorBatches = useMemo(() => batches.filter(b => b.location !== 'Cámara Fría'), [batches]);

    if (batches.length === 0) return <span className="text-xs text-gray-400 italic pl-2">Sin inventario</span>;

    return (
        <div className="flex flex-col w-full animate-in fade-in duration-300 overflow-visible">
            <LocationRow 
                locationIcon="❄️" 
                batches={cameraBatches} 
                crateTypes={crateTypes} 
                allSizes={allSizes} 
                groupBySize={!singleSizeMode}
            />
            <LocationRow 
                locationIcon="☀️" 
                batches={floorBatches} 
                crateTypes={crateTypes} 
                allSizes={allSizes}
                groupBySize={!singleSizeMode}
            />
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
    const selectedOption = options.find(o => o.value === value);

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
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none border border-transparent focus:border-gray-300 dark:focus:border-gray-600"
                title={title || selectedOption?.label}
            >
                <span className="text-2xl leading-none flex items-center justify-center">{selectedOption?.icon}</span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 sm:hidden" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-64 p-2 border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                            <div className="text-center p-2 font-bold text-gray-700 dark:text-gray-200 border-b dark:border-gray-700 mb-1">Seleccionar</div>
                            <div className="max-h-80 overflow-y-auto">
                                {options.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={(e) => { e.stopPropagation(); onChange(opt.value); setIsOpen(false); }}
                                        className={`w-full text-left px-4 py-3 text-base flex items-center gap-4 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mb-1 ${opt.value === value ? 'bg-blue-50 dark:bg-blue-900/30 font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}
                                    >
                                        <span className="text-2xl w-8 text-center">{opt.icon}</span><span>{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="hidden sm:block absolute z-50 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none left-1/2 transform -translate-x-1/2 sm:left-0 sm:translate-x-0">
                        <div className="py-1">
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${opt.value === value ? 'bg-gray-50 dark:bg-gray-700/50 font-semibold' : 'text-gray-700 dark:text-gray-200'}`}
                                >
                                    <span className="text-lg w-6 text-center">{opt.icon}</span><span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(quantity);
    };

    const getActionTitle = () => {
        if (actionType === 'moveState') return 'Mover Inventario (Estado)';
        if (actionType === 'moveLocation') return 'Mover de Ubicación';
        return 'Cambiar Calidad';
    };

    const getCurrentValueDisplay = () => {
        if (actionType === 'moveState') return batch.state;
        if (actionType === 'moveLocation') return batch.location === 'Cámara Fría' ? 'Cámara Fría' : 'Piso de Venta';
        return batch.quality;
    };

    const getTargetValueDisplay = () => {
        if (actionType === 'moveLocation') return targetValue === 'Cámara Fría' ? 'Cámara Fría' : 'Piso de Venta';
        return targetValue;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h2 className="text-lg font-bold mb-4 dark:text-gray-100">{getActionTitle()}</h2>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                    <p className="font-semibold mb-2">{productName}</p>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 font-medium flex items-center gap-1">
                            {actionType === 'moveLocation' && (batch.location === 'Cámara Fría' ? '❄️' : '☀️')}
                            {getCurrentValueDisplay()}
                        </span>
                        <i className="fa-solid fa-arrow-right text-gray-400"></i>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold flex items-center gap-1">
                            {actionType === 'moveLocation' && (targetValue === 'Cámara Fría' ? '❄️' : '☀️')}
                            {getTargetValueDisplay()}
                        </span>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad de cajas (Máx: {batch.quantity})</label>
                    <input ref={inputRef} type="number" min="1" max={batch.quantity} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-lg font-semibold text-center" />
                    <div className="mt-6 flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Confirmar</button>
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
            const otherWarehouse = warehouses.find(w => w.id !== batch.warehouseId);
            setTargetWarehouseId(otherWarehouse?.id || '');
            setTimeout(() => inputRef.current?.select(), 100);
        }
    }, [isOpen, batch, warehouses]);

    if (!isOpen || !batch) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(targetWarehouseId && quantity > 0) onConfirm(targetWarehouseId, quantity);
    };

    const currentWarehouse = warehouses.find(w => w.id === batch.warehouseId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h2 className="text-lg font-bold mb-4 dark:text-gray-100 flex items-center gap-2"><WarehouseTransferIcon /> Transferir Bodega</h2>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                    <p className="font-semibold mb-2">{productName}</p>
                    <div className="flex items-center gap-2 justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg mb-4">
                        <div className="flex items-center gap-1">
                            <IconDisplay icon={currentWarehouse?.icon || ''} className="text-sm" />
                            <span className="font-semibold">{currentWarehouse?.name || 'Origen'}</span>
                        </div>
                        <i className="fa-solid fa-arrow-right text-gray-400"></i>
                        <select value={targetWarehouseId} onChange={e => setTargetWarehouseId(e.target.value)} className="p-1 border border-gray-300 rounded text-sm bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-white w-32">
                            {warehouses.filter(w => w.id !== batch.warehouseId).map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                        </select>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad de cajas (Máx: {batch.quantity})</label>
                    <input ref={inputRef} type="number" min="1" max={batch.quantity} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-lg font-semibold text-center" />
                    <div className="mt-6 flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={!targetWarehouseId}>Transferir</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const IconEditorModal: React.FC<{
    entity: { type: IconEntityType; name: string; currentIcon: string; };
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
            const svg = await generateSvgIcon(aiPrompt);
            setIconValue(svg);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error al generar icono.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Editar Icono: {entity.name}</h2>
                <div className="mb-4 p-4 border rounded-lg flex flex-col items-center dark:border-gray-600">
                    <span className="text-sm text-gray-500 dark:text-gray-400 mb-2">Vista Previa</span>
                    <IconDisplay icon={iconValue} className="w-16 h-16 text-6xl" />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emoji o SVG</label>
                    <textarea value={iconValue} onChange={(e) => setIconValue(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" placeholder="ej. 🍓 o <svg>...</svg>" />
                </div>
                <div className="mb-4">
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Generar con IA</label>
                    <div className="flex space-x-2">
                        <input type="text" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe un icono..." className="flex-grow p-2 border border-gray-300 rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                        <button onClick={handleGenerate} disabled={isGenerating} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center w-32">
                            {isGenerating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><SparklesIcon /> <span className="ml-2">Generar</span></>}
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                    <button onClick={() => { onSave(iconValue); onClose(); }} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Guardar</button>
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
    varietiesList?: { variety: { name: string }, batches: InventoryBatch[] }[]; 
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

    const handleWheel = (e: React.WheelEvent) => {
        if (isCarouselActive && isHovered) {
            if (e.deltaY > 0) {
                setCurrentIndex((prev) => (prev + 1) % (varietiesList?.length || 1));
            } else {
                setCurrentIndex((prev) => (prev - 1 + (varietiesList?.length || 1)) % (varietiesList?.length || 1));
            }
        }
    };

    const nextSlide = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % (varietiesList?.length || 1));
    };

    const prevSlide = (e?: React.MouseEvent) => {
        e?.stopPropagation();
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
        
        displayBatches.forEach(b => {
            totalQty += b.quantity;
            totalValue += (b.price || 0) * b.quantity;
            if (b.quality === 'Merma') totalMerma += b.quantity;
            if (b.quality === 'Con Defectos') totalDefects += b.quantity;
        });
        return { totalQty, totalValue, totalMerma, totalDefects };
    }, [displayBatches]);

    const containerClass = level === 'group' 
        ? 'p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700' 
        : 'px-4 py-2 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-700';

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onWheel={handleWheel}
            className={`w-full transition-colors focus:outline-none text-left relative ${containerClass}`}
        >
            <button onClick={onToggle} className="absolute inset-0 w-full h-full cursor-pointer z-0 focus:outline-none"></button>
            <div className="flex flex-col sm:flex-row sm:items-center w-full gap-4 relative z-10 pointer-events-none">
                <div className="flex items-center gap-3 min-w-[180px] relative">
                    {isCarouselActive && (
                        <div className="flex flex-col items-center justify-center mr-1 z-20 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <button onClick={prevSlide} className="text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 p-0.5 transition-colors" title="Anterior"><ChevronUpIcon /></button>
                            <div className="flex flex-col gap-1 my-0.5">
                                {varietiesList!.map((_, idx) => (
                                    <button key={idx} onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }} className={`w-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-green-500 h-3' : 'h-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'}`} title={varietiesList![idx].variety.name}/>
                                ))}
                            </div>
                            <button onClick={nextSlide} className="text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 p-0.5 transition-colors" title="Siguiente"><ChevronDownIcon /></button>
                        </div>
                    )}
                    {level === 'group' && (<div className="flex-shrink-0"><IconDisplay icon={icon} className="text-3xl"/></div>)}
                    <div key={isCarouselActive ? currentIndex : 'static'} className={`flex items-center gap-3 transition-all duration-500 ${isCarouselActive ? 'animate-in slide-in-from-bottom-2 fade-in' : ''}`}>
                        <h2 className={`${level === 'group' ? 'text-lg' : 'text-md'} font-bold text-gray-800 dark:text-gray-100`}>{displayTitle}</h2>
                    </div>
                    <div className="sm:hidden ml-auto pointer-events-auto">
                        <button onClick={onToggle}>{expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}</button>
                    </div>
                </div>
                {!expanded && (
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-grow w-full sm:w-auto border-t sm:border-t-0 border-gray-200 dark:border-gray-600 pt-2 sm:pt-0">
                        <div className={`flex-grow w-full md:w-auto pointer-events-auto transition-opacity duration-300 ${isCarouselActive ? 'animate-in fade-in' : ''}`} key={isCarouselActive ? currentIndex : 'matrix'}>
                            <StockMatrix batches={displayBatches} crateTypes={crateTypes} allSizes={allSizes}/>
                        </div>
                        <div className="flex items-center justify-between w-full md:w-auto gap-6 md:ml-4 border-t md:border-t-0 border-gray-100 dark:border-gray-600 pt-2 md:pt-0 mt-2 md:mt-0 flex-shrink-0 transition-opacity duration-300" key={isCarouselActive ? `stats-${currentIndex}` : 'stats'}>
                            {(stats.totalMerma > 0 || stats.totalDefects > 0) && (
                                <div className="flex gap-1">
                                    {stats.totalDefects > 0 && (<div className="flex flex-col items-center bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 px-2 py-1 rounded border border-orange-200 dark:border-orange-800" title="Con Defectos"><span className="text-[10px] font-bold uppercase">Defectos</span><span className="text-sm font-bold">{stats.totalDefects}</span></div>)}
                                    {stats.totalMerma > 0 && (<div className="flex flex-col items-center bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 px-2 py-1 rounded border border-red-200 dark:border-red-800 animate-pulse" title="Merma"><span className="text-[10px] font-bold uppercase">Merma</span><span className="text-sm font-bold">{stats.totalMerma}</span></div>)}
                                </div>
                            )}
                            {stats.totalValue > 0 && (
                                <div className="text-right hidden sm:block">
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Valor Est.</div>
                                    <div className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">{stats.totalValue.toLocaleString('es-MX', {style: 'currency', currency: 'MXN', maximumFractionDigits: 0})}</div>
                                </div>
                            )}
                            <div className="text-right">
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Total</div>
                                <span className="text-lg font-bold text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-600 px-3 py-0.5 rounded-full border border-gray-200 dark:border-gray-500">{stats.totalQty}</span>
                            </div>
                        </div>
                    </div>
                )}
                <div className="hidden sm:block ml-auto pointer-events-auto"><button onClick={onToggle}>{expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}</button></div>
            </div>
        </div>
    );
};
