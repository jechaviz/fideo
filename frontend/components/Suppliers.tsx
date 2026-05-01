import React, { useEffect, useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Supplier, SuppliedProduct } from '../types';
import { ArrowUturnLeftIcon, PlusIcon, XMarkIcon } from './icons/Icons';

const currency = (value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const Suppliers: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { suppliers, productGroups, updateSupplier } = data;
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(suppliers[0]?.id || null);
    const [showList, setShowList] = useState(false);

    useEffect(() => {
        setShowList(window.innerWidth < 1024 && !selectedSupplierId);
    }, [selectedSupplierId]);

    const flatActiveVarieties = useMemo(
        () =>
            productGroups
                .filter((pg) => !pg.archived)
                .flatMap((pg) =>
                    pg.varieties
                        .filter((v) => !v.archived)
                        .map((v) => ({ ...v, groupName: pg.name, groupIcon: pg.icon })),
                ),
        [productGroups],
    );

    const selectedSupplier = useMemo(
        () => suppliers.find((supplier) => supplier.id === selectedSupplierId),
        [suppliers, selectedSupplierId],
    );

    const supplierStats = useMemo(() => {
        const totalSupplies = suppliers.reduce((sum, supplier) => sum + supplier.supplies.length, 0);
        const avgFreight =
            totalSupplies > 0
                ? suppliers.reduce(
                      (sum, supplier) => sum + supplier.supplies.reduce((inner, supply) => inner + supply.freightCost, 0),
                      0,
                  ) / totalSupplies
                : 0;
        return {
            supplierCount: suppliers.length,
            suppliedVarieties: new Set(suppliers.flatMap((supplier) => supplier.supplies.map((supply) => supply.varietyId).filter(Boolean))).size,
            avgFreight,
        };
    }, [suppliers]);

    const handleUpdate = (updates: Partial<Supplier>) => {
        if (selectedSupplierId) {
            updateSupplier(selectedSupplierId, updates);
        }
    };

    const handleAddProduct = () => {
        if (!selectedSupplier) return;
        const newProduct: SuppliedProduct = {
            varietyId: '',
            baseCost: 0,
            freightCost: 0,
            availableSizes: [],
            packagingOptions: [{ name: 'Caja', cost: 0 }],
            notes: '',
        };
        handleUpdate({ supplies: [...selectedSupplier.supplies, newProduct] });
    };

    const handleUpdateProduct = (index: number, productUpdates: Partial<SuppliedProduct>) => {
        if (!selectedSupplier) return;
        const nextSupplies = [...selectedSupplier.supplies];
        nextSupplies[index] = { ...nextSupplies[index], ...productUpdates };
        handleUpdate({ supplies: nextSupplies });
    };

    const handleRemoveProduct = (index: number) => {
        if (!selectedSupplier) return;
        handleUpdate({ supplies: selectedSupplier.supplies.filter((_, supplyIndex) => supplyIndex !== index) });
    };

    const handleAddPackaging = (index: number) => {
        if (!selectedSupplier) return;
        const nextSupplies = [...selectedSupplier.supplies];
        nextSupplies[index] = {
            ...nextSupplies[index],
            packagingOptions: [...nextSupplies[index].packagingOptions, { name: 'Nueva opcion', cost: 0 }],
        };
        handleUpdate({ supplies: nextSupplies });
    };

    const handleRemovePackaging = (productIndex: number, packagingIndex: number) => {
        if (!selectedSupplier) return;
        const nextSupplies = [...selectedSupplier.supplies];
        nextSupplies[productIndex] = {
            ...nextSupplies[productIndex],
            packagingOptions: nextSupplies[productIndex].packagingOptions.filter((_, index) => index !== packagingIndex),
        };
        handleUpdate({ supplies: nextSupplies });
    };

    const handleSelectSupplier = (id: string) => {
        setSelectedSupplierId(id);
        if (window.innerWidth < 1024) {
            setShowList(false);
        }
    };

    const supplierCoverage = selectedSupplier?.supplies.length ?? 0;
    const supplierAverageLanded =
        selectedSupplier && selectedSupplier.supplies.length > 0
            ? selectedSupplier.supplies.reduce((sum, supply) => sum + supply.baseCost + supply.freightCost, 0) / selectedSupplier.supplies.length
            : 0;

    const SupplierList = () => (
        <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5 shadow-panel">
            <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-500">Red de abasto</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Proveedores activos</h2>
                <p className="mt-2 text-sm text-slate-400">Selecciona un origen para revisar costo, empaque y capacidad de surtido.</p>
            </div>

            <div className="mb-5 grid grid-cols-3 gap-3">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Red</p>
                    <p className="mt-2 text-2xl font-black text-white">{supplierStats.supplierCount}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Variedades</p>
                    <p className="mt-2 text-2xl font-black text-white">{supplierStats.suppliedVarieties}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Flete prom.</p>
                    <p className="mt-2 text-lg font-black text-white">{currency(supplierStats.avgFreight)}</p>
                </div>
            </div>

            <ul className="space-y-2">
                {suppliers.map((supplier) => {
                    const isActive = selectedSupplierId === supplier.id;
                    return (
                        <li key={supplier.id}>
                            <button
                                onClick={() => handleSelectSupplier(supplier.id)}
                                className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                                    isActive
                                        ? 'border-brand-300/40 bg-brand-400/12 text-white shadow-glow'
                                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black">{supplier.name}</p>
                                        <p className="mt-1 text-xs text-slate-400">{supplier.contact || 'Sin contacto definido'}</p>
                                    </div>
                                    <span className="rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">
                                        {supplier.supplies.length} SKUs
                                    </span>
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    return (
        <div className="space-y-6">
            <section className="rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_38%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Abasto coordinado</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">Compra, costo y empaque en una sola lectura.</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Esta vista ya no solo lista proveedores: deja ver cobertura de catalogo, costo aterrizado y configuracion operativa para que comprar sea una decision rapida.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
                        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Proveedores</p>
                            <p className="mt-2 text-3xl font-black text-white">{supplierStats.supplierCount}</p>
                        </div>
                        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Variedades</p>
                            <p className="mt-2 text-3xl font-black text-white">{supplierStats.suppliedVarieties}</p>
                        </div>
                        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Flete prom.</p>
                            <p className="mt-2 text-2xl font-black text-white">{currency(supplierStats.avgFreight)}</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px,minmax(0,1fr)]">
                <div className={`xl:block ${showList ? 'block' : 'hidden'}`}>
                    <div className="sticky top-6">
                        <SupplierList />
                    </div>
                </div>

                <div className={`space-y-6 ${showList ? 'hidden xl:block' : 'block'}`}>
                    {selectedSupplier ? (
                        <>
                            <section className="glass-panel-dark rounded-[2rem] border border-white/10 p-6 shadow-panel">
                                <button
                                    onClick={() => setShowList(true)}
                                    className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-300 transition hover:bg-white/[0.08] lg:hidden"
                                >
                                    <ArrowUturnLeftIcon /> Lista
                                </button>

                                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-500">Ficha del proveedor</p>
                                        <input
                                            type="text"
                                            value={selectedSupplier.name}
                                            onChange={(event) => handleUpdate({ name: event.target.value })}
                                            className="mt-3 w-full border-b border-white/10 bg-transparent pb-3 text-3xl font-black tracking-tight text-white outline-none transition focus:border-brand-300"
                                        />
                                        <input
                                            type="text"
                                            value={selectedSupplier.contact}
                                            onChange={(event) => handleUpdate({ contact: event.target.value })}
                                            className="mt-3 w-full rounded-[1.4rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-brand-300"
                                            placeholder="Contacto principal"
                                        />
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                                        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Cobertura</p>
                                            <p className="mt-2 text-3xl font-black text-white">{supplierCoverage}</p>
                                            <p className="mt-1 text-xs text-slate-400">lineas activas</p>
                                        </div>
                                        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Costo base</p>
                                            <p className="mt-2 text-xl font-black text-white">
                                                {currency(selectedSupplier.supplies.reduce((sum, supply) => sum + supply.baseCost, 0))}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">sumado del catalogo</p>
                                        </div>
                                        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Landed avg</p>
                                            <p className="mt-2 text-xl font-black text-white">{currency(supplierAverageLanded)}</p>
                                            <p className="mt-1 text-xs text-slate-400">base + flete</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="glass-panel-dark rounded-[2rem] border border-white/10 p-6 shadow-panel">
                                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-500">Catalogo de compra</p>
                                        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Productos suministrados</h2>
                                        <p className="mt-2 text-sm text-slate-400">Ajusta costos, tamanos, empaques y notas para que el costo real quede claro antes de comprar.</p>
                                    </div>
                                    <button
                                        onClick={handleAddProduct}
                                        className="inline-flex items-center justify-center gap-2 rounded-[1.4rem] bg-brand-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                                    >
                                        <PlusIcon /> Agregar producto
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {selectedSupplier.supplies.map((product, index) => {
                                        const variety = flatActiveVarieties.find((entry) => entry.id === product.varietyId);
                                        const landedCost = product.baseCost + product.freightCost;
                                        return (
                                            <div key={`${selectedSupplier.id}-${index}`} className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
                                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <select
                                                                value={product.varietyId}
                                                                onChange={(event) => handleUpdateProduct(index, { varietyId: event.target.value })}
                                                                className="min-w-[240px] rounded-[1.1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-brand-300"
                                                            >
                                                                <option value="">Seleccionar producto...</option>
                                                                {flatActiveVarieties.map((entry) => (
                                                                    <option key={entry.id} value={entry.id}>
                                                                        {entry.groupName} {entry.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {variety && (
                                                                <span className="rounded-full border border-brand-400/20 bg-brand-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-brand-200">
                                                                    {variety.groupIcon} {variety.groupName}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                                                            <div className="rounded-[1.2rem] border border-white/10 bg-slate-950/60 p-3">
                                                                <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Costo base</label>
                                                                <input
                                                                    type="number"
                                                                    value={product.baseCost}
                                                                    onChange={(event) => handleUpdateProduct(index, { baseCost: +event.target.value })}
                                                                    className="mt-2 w-full bg-transparent text-xl font-black text-white outline-none"
                                                                />
                                                            </div>
                                                            <div className="rounded-[1.2rem] border border-white/10 bg-slate-950/60 p-3">
                                                                <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Costo flete</label>
                                                                <input
                                                                    type="number"
                                                                    value={product.freightCost}
                                                                    onChange={(event) => handleUpdateProduct(index, { freightCost: +event.target.value })}
                                                                    className="mt-2 w-full bg-transparent text-xl font-black text-white outline-none"
                                                                />
                                                            </div>
                                                            <div className="rounded-[1.2rem] border border-white/10 bg-slate-950/60 p-3">
                                                                <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Costo aterrizado</label>
                                                                <p className="mt-2 text-xl font-black text-white">{currency(landedCost)}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => handleRemoveProduct(index)}
                                                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                                                        title="Eliminar producto"
                                                    >
                                                        <XMarkIcon />
                                                    </button>
                                                </div>

                                                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
                                                    <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Tamanos disponibles</p>
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {variety?.sizes.length ? (
                                                                variety.sizes.map((size) => {
                                                                    const enabled = product.availableSizes.includes(size);
                                                                    return (
                                                                        <label
                                                                            key={size}
                                                                            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${
                                                                                enabled
                                                                                    ? 'border-brand-300/30 bg-brand-400/12 text-brand-100'
                                                                                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'
                                                                            }`}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={enabled}
                                                                                onChange={() => {
                                                                                    const nextSizes = enabled
                                                                                        ? product.availableSizes.filter((currentSize) => currentSize !== size)
                                                                                        : [...product.availableSizes, size];
                                                                                    handleUpdateProduct(index, { availableSizes: nextSizes });
                                                                                }}
                                                                                className="rounded border-white/20 bg-transparent"
                                                                            />
                                                                            {size}
                                                                        </label>
                                                                    );
                                                                })
                                                            ) : (
                                                                <p className="text-sm text-slate-500">Selecciona primero una variedad para configurar tamanos.</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Empaques</p>
                                                                <p className="mt-1 text-sm text-slate-400">Define la forma en que cotiza este proveedor.</p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleAddPackaging(index)}
                                                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/[0.08]"
                                                            >
                                                                <PlusIcon /> Empaque
                                                            </button>
                                                        </div>

                                                        <div className="mt-3 space-y-2">
                                                            {product.packagingOptions.map((option, optionIndex) => (
                                                                <div key={`${selectedSupplier.id}-${index}-${optionIndex}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr),120px,44px]">
                                                                    <input
                                                                        value={option.name}
                                                                        onChange={(event) => {
                                                                            const nextOptions = [...product.packagingOptions];
                                                                            nextOptions[optionIndex].name = event.target.value;
                                                                            handleUpdateProduct(index, { packagingOptions: nextOptions });
                                                                        }}
                                                                        placeholder="Nombre"
                                                                        className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-300"
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        value={option.cost}
                                                                        onChange={(event) => {
                                                                            const nextOptions = [...product.packagingOptions];
                                                                            nextOptions[optionIndex].cost = +event.target.value;
                                                                            handleUpdateProduct(index, { packagingOptions: nextOptions });
                                                                        }}
                                                                        placeholder="Costo"
                                                                        className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-300"
                                                                    />
                                                                    <button
                                                                        onClick={() => handleRemovePackaging(index, optionIndex)}
                                                                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
                                                                        title="Eliminar empaque"
                                                                    >
                                                                        <XMarkIcon />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-5">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Notas operativas</label>
                                                    <textarea
                                                        value={product.notes || ''}
                                                        onChange={(event) => handleUpdateProduct(index, { notes: event.target.value })}
                                                        placeholder="Origen, frecuencia, comportamiento de calidad, observaciones..."
                                                        rows={3}
                                                        className="mt-2 w-full rounded-[1.2rem] border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-300"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {selectedSupplier.supplies.length === 0 && (
                                        <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-slate-950/40 p-10 text-center">
                                            <p className="text-lg font-black text-white">Todavia no hay productos configurados.</p>
                                            <p className="mt-2 text-sm text-slate-400">Agrega la primera linea para registrar costo, empaque y tamanos disponibles.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </>
                    ) : (
                        <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-10 text-center shadow-panel">
                            <p className="text-lg font-black text-white">Selecciona un proveedor para empezar.</p>
                            <p className="mt-2 text-sm text-slate-400">Desde aqui se concentra el costo aterrizado y la cobertura real de compra.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Suppliers;
