
import React, { useState, useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { InventoryBatch, ProductGroup, CrateType } from '../types';
import { XMarkIcon } from './icons/Icons';

const IconDisplay: React.FC<{ icon: string; className?: string }> = React.memo(({ icon, className = '' }) => {
    if (icon && icon.trim().startsWith('<svg')) {
        return <div className={`w-full h-full ${className}`} dangerouslySetInnerHTML={{ __html: icon }} />;
    }
    return <span className={`flex items-center justify-center font-bold ${className}`}>{icon || '📦'}</span>;
});

const StackDetailsModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    batches: InventoryBatch[]; 
    productGroups: ProductGroup[];
    locationName: string;
}> = ({ isOpen, onClose, batches, productGroups, locationName }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{locationName}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Contenido de la estiba</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><XMarkIcon /></button>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {batches.map(batch => {
                        const group = productGroups.find(g => g.varieties.some(v => v.id === batch.varietyId));
                        const variety = group?.varieties.find(v => v.id === batch.varietyId);
                        return (
                            <div key={batch.id} className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-600 flex items-center justify-center text-2xl shadow-sm mr-3">
                                    <IconDisplay icon={group?.icon || ''} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-gray-100">{group?.name} {variety?.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{batch.size} • {batch.state}</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <span className="block text-lg font-bold text-green-600 dark:text-green-400">{batch.quantity}</span>
                                    <span className="text-[10px] uppercase text-gray-400">Cajas</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Type for a visual "Stack" (Estiba)
interface Stack {
    id: string;
    batches: InventoryBatch[];
    crateType?: CrateType;
    totalHeight: number; // cm
    totalQuantity: number;
    baseArea: { width: number; depth: number };
}

const Planogram: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { inventory, productGroups, crateTypes } = data;
    const [viewMode, setViewMode] = useState<'isometric' | 'top'>('isometric');
    const [selectedStack, setSelectedStack] = useState<{ batches: InventoryBatch[], name: string } | null>(null);

    // Group inventory into physical stacks (Same Product Group + Same Variety + Same Packaging = One Stack Column usually)
    // For simplifiction in this view, we group by Packaging ID + Variety ID.
    const generateStacks = (locationFilter: string): Stack[] => {
        const relevantBatches = inventory.filter(b => b.location === locationFilter && b.quantity > 0);
        const stackMap = new Map<string, Stack>();

        relevantBatches.forEach(batch => {
            // Key: varietyId + packagingId (Assuming same product/size/packaging form a stack)
            // We could also just group by packagingId for mixed stacks, but usually single product per stack.
            const key = `${batch.varietyId}-${batch.packagingId}`;
            
            if (!stackMap.has(key)) {
                const crate = crateTypes.find(c => c.id === batch.packagingId);
                // Default dimensions if missing (fallback)
                const dims = crate?.dimensions || { width: 40, depth: 30, height: 20 };
                
                stackMap.set(key, {
                    id: key,
                    batches: [],
                    crateType: crate,
                    totalHeight: 0,
                    totalQuantity: 0,
                    baseArea: { width: dims.width, depth: dims.depth }
                });
            }

            const stack = stackMap.get(key)!;
            stack.batches.push(batch);
            stack.totalQuantity += batch.quantity;
            // Calculate height: qty * crate height. Note: real world stacks might be side-by-side on a pallet.
            // For this viz, we assume a single column or normalized height. 
            // Let's assume 1 pallet = 1 column visual for simplicity, or scale height down if it's a full pallet (many columns).
            // Let's stick to strict single column height for visual accuracy of "quantity vertically".
            const crateHeight = stack.crateType?.dimensions?.height || 20;
            stack.totalHeight += (batch.quantity * crateHeight); 
        });

        return Array.from(stackMap.values());
    };

    const cameraStacks = useMemo(() => generateStacks('Cámara Fría'), [inventory, crateTypes]);
    const floorStacks = useMemo(() => generateStacks('Piso de Venta'), [inventory, crateTypes]);

    // Helper to get visual style based on crate color name
    const getCrateStyle = (colorName: string = '') => {
        const lowerColor = colorName.toLowerCase();
        if (lowerColor.includes('verde')) return 'from-green-700 to-green-500 border-green-400/30';
        if (lowerColor.includes('roja') || lowerColor.includes('rojo')) return 'from-red-700 to-red-500 border-red-400/30';
        if (lowerColor.includes('azul')) return 'from-blue-700 to-blue-500 border-blue-400/30';
        if (lowerColor.includes('negra') || lowerColor.includes('negro')) return 'from-gray-800 to-gray-600 border-gray-500/30';
        if (lowerColor.includes('madera')) return 'from-amber-800 to-amber-600 border-amber-400/30';
        if (lowerColor.includes('variado')) return 'from-purple-700 to-purple-500 border-purple-400/30';
        return 'from-slate-600 to-slate-400 border-slate-300/30'; 
    };

    const getCrateBg = (colorName: string = '') => {
        const lowerColor = colorName.toLowerCase();
        if (lowerColor.includes('verde')) return 'bg-green-200 dark:bg-green-800/50 border-green-600';
        if (lowerColor.includes('roja') || lowerColor.includes('rojo')) return 'bg-red-200 dark:bg-red-800/50 border-red-600';
        if (lowerColor.includes('azul')) return 'bg-blue-200 dark:bg-blue-800/50 border-blue-600';
        if (lowerColor.includes('negra') || lowerColor.includes('negro')) return 'bg-gray-300 dark:bg-gray-700 border-gray-600';
        if (lowerColor.includes('madera')) return 'bg-amber-200 dark:bg-amber-800/50 border-amber-600';
        return 'bg-slate-200 dark:bg-slate-700 border-slate-500';
    };

    const renderStackVisual = (stack: Stack, zone: string) => {
        // Scaling factors: 1cm = 1.5px for width/depth. Height needs to be compressed for 3D effect.
        // Warehouse height limit = 5m (500cm).
        const MAX_HEIGHT_CM = 500; 
        const effectiveHeightCm = Math.min(stack.totalHeight, MAX_HEIGHT_CM);
        
        // Dimensions for CSS
        const widthPx = stack.baseArea.width * 1.5;
        const depthPx = stack.baseArea.depth * 1.5;
        const heightPx = (effectiveHeightCm / MAX_HEIGHT_CM) * 150; // Max visual height 150px

        const mainBatch = stack.batches[0];
        const group = productGroups.find(g => g.varieties.some(v => v.id === mainBatch.varietyId));
        const gradientClass = getCrateStyle(stack.crateType?.color);
        const bgClass = getCrateBg(stack.crateType?.color);

        return (
            <div 
                key={stack.id}
                onClick={() => setSelectedStack({ batches: stack.batches, name: `${zone} - ${stack.crateType?.name || 'Estiba'}` })}
                className="relative cursor-pointer group transition-transform duration-300 hover:scale-105 inline-block m-4"
                style={{
                    width: `${widthPx}px`,
                    height: `${depthPx}px`, // In top-down, depth is height on screen
                    transformStyle: 'preserve-3d',
                    transform: viewMode === 'isometric' ? `translateZ(${heightPx/2}px)` : 'none'
                }}
            >
                 {/* 3D Body */}
                 <div 
                    className={`absolute bottom-0 left-0 w-full shadow-xl rounded-sm flex items-center justify-center text-white font-bold text-xs flex-col transition-all duration-500 ${viewMode === 'top' ? bgClass : ''}`}
                    style={{ 
                        height: viewMode === 'isometric' ? `${heightPx}px` : '100%',
                        transform: viewMode === 'isometric' ? 'rotateX(-90deg) translateY(50%) translateZ(15px)' : 'none',
                        opacity: 0.9
                    }}
                >
                    {viewMode === 'top' ? (
                        <div className={`w-full h-full border-2 rounded flex items-center justify-center flex-col ${bgClass} p-1`}>
                             <div className="text-lg"><IconDisplay icon={group?.icon || ''} /></div>
                             <span className="text-gray-800 dark:text-white text-xs font-bold">{stack.totalQuantity}</span>
                             <span className="text-[8px] text-gray-600 dark:text-gray-300 mt-1 truncate w-full text-center leading-tight">{stack.crateType?.name.split(' ')[0]}</span>
                        </div>
                    ) : (
                        <div 
                            className={`w-full bg-gradient-to-t shadow-md border relative group-hover:brightness-110 ${gradientClass}`}
                            style={{ height: `${heightPx}px` }}
                        >
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-full text-center z-20">
                                <div className="w-8 h-8 mx-auto drop-shadow-lg bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-lg border border-white/30"><IconDisplay icon={group?.icon || ''} /></div>
                            </div>
                            {/* Sides simulation (simple CSS borders/gradients) */}
                            <div className="absolute bottom-2 w-full text-center text-[10px] text-white/90 font-mono drop-shadow-md leading-none">
                                {stack.totalQuantity} <br/> <span className="text-[8px] opacity-75">cajas</span>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Floor Shadow/Placeholder for Isometric */}
                {viewMode === 'isometric' && (
                    <div className="absolute inset-0 bg-black/20 blur-sm transform translate-z-[-1px] rounded-sm"></div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Planograma 3D</h1>
                <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                    <button 
                        onClick={() => setViewMode('isometric')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'isometric' ? 'bg-white dark:bg-gray-600 shadow text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        3D / Isométrico
                    </button>
                    <button 
                        onClick={() => setViewMode('top')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'top' ? 'bg-white dark:bg-gray-600 shadow text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Planta (2D)
                    </button>
                </div>
            </div>

            {/* Warehouse Container with Scroll */}
            <div className="flex-grow bg-gray-100 dark:bg-gray-900 rounded-xl shadow-inner p-4 overflow-auto">
                {/* Inner content larger than viewport to force scroll */}
                <div className="min-w-[1000px] min-h-[800px] flex items-center justify-center perspective-container py-20">
                    <div 
                        className={`warehouse-floor w-full max-w-5xl mx-auto transition-all duration-700 ease-in-out ${viewMode === 'isometric' ? 'rotate-x-60 rotate-z-minus-15 scale-90' : 'scale-100'}`}
                        style={{ 
                            transformStyle: 'preserve-3d',
                            transform: viewMode === 'isometric' ? 'perspective(2000px) rotateX(55deg) rotateZ(-15deg) scale(0.9)' : 'none'
                        }}
                    >
                        {/* Mezzanine (Tapanco) - Floating above Camera */}
                        <div className="absolute top-0 left-0 w-full h-[55%] border-4 border-dashed border-gray-400/30 rounded-lg z-0 pointer-events-none" style={{ transform: 'translateZ(200px)' }}>
                            <div className="absolute top-4 right-4 bg-gray-800/80 text-white text-sm px-3 py-1 rounded backdrop-blur-sm border border-white/10">
                                Tapanco (Cajas Vacías)
                            </div>
                        </div>

                        {/* Cold Storage Zone */}
                        <div className="relative bg-blue-50 dark:bg-blue-900/20 border-4 border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8 shadow-lg" style={{ minHeight: '400px' }}>
                            <div className="absolute -top-4 left-6 bg-blue-600 text-white text-sm font-bold px-4 py-1.5 rounded shadow-sm z-10">
                                Cámara Fría (6m Profundidad)
                            </div>
                            <div className="flex flex-wrap gap-2 content-start h-full pl-2 pt-2">
                                {cameraStacks.length > 0 ? cameraStacks.map((stack) => renderStackVisual(stack, 'Cámara')) : (
                                    <div className="w-full h-full flex items-center justify-center text-blue-300/50 font-bold text-2xl uppercase tracking-widest">Vacío</div>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-b from-blue-200/5 to-blue-500/10 pointer-events-none"></div>
                        </div>

                        {/* Sales Floor Zone */}
                        <div className="relative bg-orange-50 dark:bg-orange-900/20 border-4 border-orange-200 dark:border-orange-800 rounded-xl p-6 shadow-lg" style={{ minHeight: '350px' }}>
                            <div className="absolute -top-4 left-6 bg-orange-600 text-white text-sm font-bold px-4 py-1.5 rounded shadow-sm z-10">
                                Piso de Venta (4m Profundidad)
                            </div>
                            <div className="flex flex-wrap gap-2 content-start h-full pl-2 pt-2">
                                {floorStacks.length > 0 ? floorStacks.map((stack) => renderStackVisual(stack, 'Piso')) : (
                                    <div className="w-full h-full flex items-center justify-center text-orange-300/50 font-bold text-2xl uppercase tracking-widest">Vacío</div>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-b from-orange-200/5 to-orange-500/10 pointer-events-none"></div>
                        </div>
                    </div>
                </div>
            </div>

            <StackDetailsModal 
                isOpen={!!selectedStack} 
                onClose={() => setSelectedStack(null)} 
                batches={selectedStack?.batches || []} 
                productGroups={productGroups}
                locationName={selectedStack?.name || ''}
            />
        </div>
    );
};

export default Planogram;
