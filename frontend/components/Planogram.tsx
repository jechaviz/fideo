import React, { useState, useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { InventoryBatch, ProductGroup, CrateType } from '../types';
import { XMarkIcon } from './icons/Icons';

const IconDisplay: React.FC<{ icon: string; className?: string }> = React.memo(({ icon, className = '' }) => {
    if (icon && icon.trim().startsWith('<svg')) {
        return <div className={`h-full w-full ${className}`} dangerouslySetInnerHTML={{ __html: icon }} />;
    }
    return <span className={`flex items-center justify-center font-bold ${className}`}>{icon || '[]'}</span>;
});

const panelClass = 'glass-panel-dark rounded-[2rem] border border-white/10';

const StackDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    batches: InventoryBatch[];
    productGroups: ProductGroup[];
    locationName: string;
}> = ({ isOpen, onClose, batches, productGroups, locationName }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${panelClass} w-full max-w-md p-6 md:p-7`}>
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Detalle de stack</p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{locationName}</h3>
                        <p className="mt-2 text-sm text-slate-400">Contenido consolidado de la estiba seleccionada.</p>
                    </div>
                    <button onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white">
                        <XMarkIcon />
                    </button>
                </div>

                <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                    {batches.map((batch) => {
                        const group = productGroups.find((item) => item.varieties.some((variety) => variety.id === batch.varietyId));
                        const variety = group?.varieties.find((item) => item.id === batch.varietyId);
                        return (
                            <div key={batch.id} className="flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl text-white">
                                    <IconDisplay icon={group?.icon || ''} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-white">
                                        {group?.name} {variety?.name}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {batch.size} · {batch.state}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-lg font-black text-brand-300">{batch.quantity}</span>
                                    <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">cajas</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

interface Stack {
    id: string;
    batches: InventoryBatch[];
    crateType?: CrateType;
    totalHeight: number;
    totalQuantity: number;
    baseArea: { width: number; depth: number };
}

const Planogram: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { inventory, productGroups, crateTypes } = data;
    const [viewMode, setViewMode] = useState<'isometric' | 'top'>('isometric');
    const [selectedStack, setSelectedStack] = useState<{ batches: InventoryBatch[]; name: string } | null>(null);

    const generateStacks = (locationFilter: string): Stack[] => {
        const relevantBatches = inventory.filter((batch) => batch.location === locationFilter && batch.quantity > 0);
        const stackMap = new Map<string, Stack>();

        relevantBatches.forEach((batch) => {
            const key = `${batch.varietyId}-${batch.packagingId}`;

            if (!stackMap.has(key)) {
                const crate = crateTypes.find((item) => item.id === batch.packagingId);
                const dims = crate?.dimensions || { width: 40, depth: 30, height: 20 };

                stackMap.set(key, {
                    id: key,
                    batches: [],
                    crateType: crate,
                    totalHeight: 0,
                    totalQuantity: 0,
                    baseArea: { width: dims.width, depth: dims.depth },
                });
            }

            const stack = stackMap.get(key)!;
            stack.batches.push(batch);
            stack.totalQuantity += batch.quantity;
            const crateHeight = stack.crateType?.dimensions?.height || 20;
            stack.totalHeight += batch.quantity * crateHeight;
        });

        return Array.from(stackMap.values());
    };

    const cameraStacks = useMemo(() => generateStacks('Cámara Fría'), [inventory, crateTypes]);
    const floorStacks = useMemo(() => generateStacks('Piso de Venta'), [inventory, crateTypes]);

    const cameraQty = useMemo(() => cameraStacks.reduce((sum, stack) => sum + stack.totalQuantity, 0), [cameraStacks]);
    const floorQty = useMemo(() => floorStacks.reduce((sum, stack) => sum + stack.totalQuantity, 0), [floorStacks]);

    const getCrateStyle = (colorName: string = '') => {
        const lowerColor = colorName.toLowerCase();
        if (lowerColor.includes('verde')) return 'from-emerald-600 to-emerald-400 border-emerald-300/30';
        if (lowerColor.includes('roja') || lowerColor.includes('rojo')) return 'from-rose-600 to-rose-400 border-rose-300/30';
        if (lowerColor.includes('azul')) return 'from-sky-600 to-sky-400 border-sky-300/30';
        if (lowerColor.includes('negra') || lowerColor.includes('negro')) return 'from-slate-700 to-slate-500 border-slate-300/30';
        if (lowerColor.includes('madera')) return 'from-amber-700 to-amber-500 border-amber-300/30';
        if (lowerColor.includes('variado')) return 'from-violet-600 to-violet-400 border-violet-300/30';
        return 'from-slate-500 to-slate-300 border-slate-300/30';
    };

    const getCrateBg = (colorName: string = '') => {
        const lowerColor = colorName.toLowerCase();
        if (lowerColor.includes('verde')) return 'bg-emerald-300/30 border-emerald-300';
        if (lowerColor.includes('roja') || lowerColor.includes('rojo')) return 'bg-rose-300/30 border-rose-300';
        if (lowerColor.includes('azul')) return 'bg-sky-300/30 border-sky-300';
        if (lowerColor.includes('negra') || lowerColor.includes('negro')) return 'bg-slate-400/30 border-slate-300';
        if (lowerColor.includes('madera')) return 'bg-amber-300/30 border-amber-300';
        return 'bg-slate-300/30 border-slate-300';
    };

    const renderStackVisual = (stack: Stack, zone: string) => {
        const maxHeightCm = 500;
        const effectiveHeightCm = Math.min(stack.totalHeight, maxHeightCm);
        const widthPx = stack.baseArea.width * 1.5;
        const depthPx = stack.baseArea.depth * 1.5;
        const heightPx = (effectiveHeightCm / maxHeightCm) * 150;

        const mainBatch = stack.batches[0];
        const group = productGroups.find((item) => item.varieties.some((variety) => variety.id === mainBatch.varietyId));
        const gradientClass = getCrateStyle(stack.crateType?.color);
        const bgClass = getCrateBg(stack.crateType?.color);

        return (
            <div
                key={stack.id}
                onClick={() => setSelectedStack({ batches: stack.batches, name: `${zone} - ${stack.crateType?.name || 'Estiba'}` })}
                className="group relative m-4 inline-block cursor-pointer transition-transform duration-300 hover:scale-105"
                style={{
                    width: `${widthPx}px`,
                    height: `${depthPx}px`,
                    transformStyle: 'preserve-3d',
                    transform: viewMode === 'isometric' ? `translateZ(${heightPx / 2}px)` : 'none',
                }}
            >
                <div
                    className={`absolute bottom-0 left-0 flex w-full items-center justify-center rounded-sm text-white shadow-xl transition-all duration-500 ${viewMode === 'top' ? bgClass : ''}`}
                    style={{
                        height: viewMode === 'isometric' ? `${heightPx}px` : '100%',
                        transform: viewMode === 'isometric' ? 'rotateX(-90deg) translateY(50%) translateZ(15px)' : 'none',
                        opacity: 0.94,
                    }}
                >
                    {viewMode === 'top' ? (
                        <div className={`flex h-full w-full flex-col items-center justify-center rounded border-2 p-1 ${bgClass}`}>
                            <div className="text-lg text-white">
                                <IconDisplay icon={group?.icon || ''} />
                            </div>
                            <span className="text-xs font-black text-white">{stack.totalQuantity}</span>
                            <span className="mt-1 w-full truncate text-center text-[8px] font-semibold text-slate-100">
                                {stack.crateType?.name.split(' ')[0]}
                            </span>
                        </div>
                    ) : (
                        <div className={`relative w-full border bg-gradient-to-t shadow-md group-hover:brightness-110 ${gradientClass}`} style={{ height: `${heightPx}px` }}>
                            <div className="absolute -top-6 left-1/2 z-20 w-full -translate-x-1/2 transform text-center">
                                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-lg text-white shadow-lg backdrop-blur-sm">
                                    <IconDisplay icon={group?.icon || ''} />
                                </div>
                            </div>
                            <div className="absolute bottom-2 w-full text-center font-mono text-[10px] leading-none text-white/90 drop-shadow-md">
                                {stack.totalQuantity}
                                <br />
                                <span className="text-[8px] opacity-75">cajas</span>
                            </div>
                        </div>
                    )}
                </div>

                {viewMode === 'isometric' && <div className="absolute inset-0 rounded-sm bg-black/25 blur-sm"></div>}
            </div>
        );
    };

    return (
        <div className="flex h-full flex-col gap-6 overflow-hidden">
            <section className="rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.12),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Layout de almacen</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">Planograma vivo para camara y piso de venta.</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Misma visual premium, ahora aplicada al mapa fisico: control espacial, lectura rapida y acceso directo al detalle de cada stack.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 lg:min-w-[420px]">
                        <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
                            <button
                                onClick={() => setViewMode('isometric')}
                                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition ${
                                    viewMode === 'isometric' ? 'bg-brand-400 text-slate-950 shadow-glow' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                3D / Isometrico
                            </button>
                            <button
                                onClick={() => setViewMode('top')}
                                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition ${
                                    viewMode === 'top' ? 'bg-brand-400 text-slate-950 shadow-glow' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Planta 2D
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Stacks camara</p>
                                <p className="mt-2 text-2xl font-black text-white">{cameraStacks.length}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Stacks piso</p>
                                <p className="mt-2 text-2xl font-black text-white">{floorStacks.length}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Cajas visibles</p>
                                <p className="mt-2 text-2xl font-black text-white">{cameraQty + floorQty}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className={`${panelClass} flex-grow overflow-auto p-4 md:p-5`}>
                <div className="min-h-[800px] min-w-[1000px] py-10">
                    <div
                        className={`mx-auto w-full max-w-6xl transition-all duration-700 ease-in-out ${viewMode === 'isometric' ? 'scale-90' : 'scale-100'}`}
                        style={{
                            transformStyle: 'preserve-3d',
                            transform: viewMode === 'isometric' ? 'perspective(2000px) rotateX(55deg) rotateZ(-15deg) scale(0.9)' : 'none',
                        }}
                    >
                        <div className="pointer-events-none absolute left-0 top-0 z-0 h-[55%] w-full rounded-[2rem] border-2 border-dashed border-white/10" style={{ transform: 'translateZ(200px)' }}>
                            <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-slate-300 backdrop-blur-sm">
                                Tapanco
                            </div>
                        </div>

                        <div className="relative mb-8 rounded-[2rem] border border-sky-300/20 bg-sky-400/[0.08] p-6 shadow-lg" style={{ minHeight: '400px' }}>
                            <div className="absolute -top-4 left-6 rounded-full border border-sky-300/20 bg-sky-400/90 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-slate-950 shadow-sm">
                                Camara fria
                            </div>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-white">Zona de resguardo en frio</p>
                                    <p className="mt-1 text-xs text-slate-400">6 m de profundidad operativa</p>
                                </div>
                                <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-black text-sky-100">{cameraQty} cajas</span>
                            </div>
                            <div className="flex h-full flex-wrap content-start gap-2 pl-2 pt-2">
                                {cameraStacks.length > 0 ? (
                                    cameraStacks.map((stack) => renderStackVisual(stack, 'Camara'))
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl font-black uppercase tracking-[0.34em] text-sky-200/30">Vacio</div>
                                )}
                            </div>
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-300/5 to-sky-500/10"></div>
                        </div>

                        <div className="relative rounded-[2rem] border border-amber-300/20 bg-amber-400/[0.08] p-6 shadow-lg" style={{ minHeight: '350px' }}>
                            <div className="absolute -top-4 left-6 rounded-full border border-amber-300/20 bg-amber-400/90 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-slate-950 shadow-sm">
                                Piso de venta
                            </div>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-white">Zona comercial y surtido frontal</p>
                                    <p className="mt-1 text-xs text-slate-400">4 m de profundidad operativa</p>
                                </div>
                                <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-black text-amber-100">{floorQty} cajas</span>
                            </div>
                            <div className="flex h-full flex-wrap content-start gap-2 pl-2 pt-2">
                                {floorStacks.length > 0 ? (
                                    floorStacks.map((stack) => renderStackVisual(stack, 'Piso'))
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl font-black uppercase tracking-[0.34em] text-amber-200/30">Vacio</div>
                                )}
                            </div>
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-300/5 to-amber-500/10"></div>
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
