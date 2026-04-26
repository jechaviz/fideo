import React, { useState, useMemo, useEffect } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Supplier, SuppliedProduct } from '../types';
import { XMarkIcon, ArrowUturnLeftIcon, PlusIcon } from './icons/Icons';

const Suppliers: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { suppliers, productGroups, updateSupplier } = data;
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(suppliers[0]?.id || null);
    
    const [showList, setShowList] = useState(false);
    useEffect(() => {
        setShowList(window.innerWidth < 1024 && !selectedSupplierId);
    }, [selectedSupplierId]);


    const flatActiveVarieties = useMemo(() => productGroups
        .filter(pg => !pg.archived)
        .flatMap(pg => pg.varieties.filter(v => !v.archived).map(v => ({ ...v, groupName: pg.name }))), [productGroups]);

    const selectedSupplier = useMemo(() => {
        return suppliers.find(s => s.id === selectedSupplierId);
    }, [suppliers, selectedSupplierId]);

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
            notes: ''
        };
        handleUpdate({ supplies: [...selectedSupplier.supplies, newProduct] });
    };

    const handleUpdateProduct = (index: number, productUpdates: Partial<SuppliedProduct>) => {
        if (!selectedSupplier) return;
        const newSupplies = [...selectedSupplier.supplies];
        newSupplies[index] = { ...newSupplies[index], ...productUpdates };
        handleUpdate({ supplies: newSupplies });
    };
    
    const handleRemoveProduct = (index: number) => {
        if (!selectedSupplier) return;
        const newSupplies = selectedSupplier.supplies.filter((_, i) => i !== index);
        handleUpdate({ supplies: newSupplies });
    };

    const handleSelectSupplier = (id: string) => {
        setSelectedSupplierId(id);
        if(window.innerWidth < 1024) {
            setShowList(false);
        }
    }

    const SupplierList = () => (
         <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 px-2">Lista de Proveedores</h2>
            <ul className="space-y-1">
                {suppliers.map(supplier => (
                    <li key={supplier.id}>
                        <button
                            onClick={() => handleSelectSupplier(supplier.id)}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${selectedSupplierId === supplier.id ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            {supplier.name}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Proveedores</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="hidden lg:block lg:col-span-1">
                    <div className="sticky top-6">
                        <SupplierList />
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <div className={`lg:hidden ${!showList ? 'hidden' : 'block'}`}>
                        <SupplierList />
                    </div>
                    <div className={`lg:block ${showList ? 'hidden' : 'block'}`}>
                        {selectedSupplier ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 space-y-6">
                                <button onClick={() => setShowList(true)} className="lg:hidden text-gray-500 dark:text-gray-400 mb-2 text-sm flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200">
                                    <ArrowUturnLeftIcon /> Volver a la lista
                                </button>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-500 dark:text-gray-400">Nombre del Proveedor</label>
                                    <input type="text" value={selectedSupplier.name} onChange={e => handleUpdate({ name: e.target.value })} className="w-full p-2 text-xl font-bold border-b-2 border-transparent focus:border-green-500 bg-transparent dark:text-gray-100 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-500 dark:text-gray-400">Contacto</label>
                                    <input type="text" value={selectedSupplier.contact} onChange={e => handleUpdate({ contact: e.target.value })} className="w-full p-2 border-b-2 border-transparent focus:border-green-500 bg-transparent dark:text-gray-300 transition-colors" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">Productos Suministrados</h3>
                                    <div className="space-y-4">
                                        {selectedSupplier.supplies.map((product, index) => {
                                            const variety = flatActiveVarieties.find(v => v.id === product.varietyId);
                                            return (
                                            <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600">
                                                <div className="flex justify-between items-center">
                                                    <select value={product.varietyId} onChange={e => handleUpdateProduct(index, { varietyId: e.target.value })} className="font-bold text-md p-1 bg-transparent dark:text-gray-200">
                                                        <option value="">Seleccionar producto...</option>
                                                        {flatActiveVarieties.map(v => <option key={v.id} value={v.id}>{v.groupName} {v.name}</option>)}
                                                    </select>
                                                    <button onClick={() => handleRemoveProduct(index)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><XMarkIcon /></button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 mt-2">
                                                    <div>
                                                        <label className="text-xs font-semibold dark:text-gray-400">Costo Base</label>
                                                        <input type="number" value={product.baseCost} onChange={e => handleUpdateProduct(index, { baseCost: +e.target.value })} className="w-full p-1 rounded border dark:bg-gray-800 dark:border-gray-600"/>
                                                    </div>
                                                     <div>
                                                        <label className="text-xs font-semibold dark:text-gray-400">Costo Flete</label>
                                                        <input type="number" value={product.freightCost} onChange={e => handleUpdateProduct(index, { freightCost: +e.target.value })} className="w-full p-1 rounded border dark:bg-gray-800 dark:border-gray-600"/>
                                                    </div>
                                                </div>
                                                 <div>
                                                    <label className="text-xs font-semibold dark:text-gray-400 mt-2 block">Tamaños Disponibles</label>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                    {variety && variety.sizes.map(size => (
                                                        <label key={size} className="flex items-center gap-1 text-xs p-1 rounded-full cursor-pointer border dark:border-gray-600">
                                                            <input type="checkbox" checked={product.availableSizes.includes(size)} onChange={() => {
                                                                const newSizes = product.availableSizes.includes(size) ? product.availableSizes.filter(s => s !== size) : [...product.availableSizes, size];
                                                                handleUpdateProduct(index, { availableSizes: newSizes });
                                                            }} className="rounded"/>
                                                            {size}
                                                        </label>
                                                    ))}
                                                    </div>
                                                </div>
                                                 <div>
                                                    <label className="text-xs font-semibold dark:text-gray-400 mt-2 block">Empaques</label>
                                                    {product.packagingOptions.map((opt, optIndex) => (
                                                        <div key={optIndex} className="flex gap-2 items-center mt-1">
                                                            <input value={opt.name} onChange={e => {
                                                                const newOpts = [...product.packagingOptions]; newOpts[optIndex].name = e.target.value;
                                                                handleUpdateProduct(index, {packagingOptions: newOpts})
                                                            }} placeholder="Nombre" className="w-1/2 p-1 rounded border dark:bg-gray-800 dark:border-gray-600"/>
                                                             <input type="number" value={opt.cost} onChange={e => {
                                                                const newOpts = [...product.packagingOptions]; newOpts[optIndex].cost = +e.target.value;
                                                                handleUpdateProduct(index, {packagingOptions: newOpts})
                                                            }} placeholder="Costo" className="w-1/2 p-1 rounded border dark:bg-gray-800 dark:border-gray-600"/>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold dark:text-gray-400 mt-2 block">Notas</label>
                                                    <input value={product.notes || ''} onChange={e => handleUpdateProduct(index, { notes: e.target.value })} placeholder="Ej. Fruta de invernadero" className="w-full p-1 rounded border dark:bg-gray-800 dark:border-gray-600"/>
                                                </div>
                                            </div>
                                            );
                                        })}
                                        <button onClick={handleAddProduct} className="w-full text-center p-2 mt-4 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 font-semibold rounded-lg hover:bg-green-200 dark:hover:bg-green-900">
                                            <PlusIcon /> Añadir Producto
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md lg:hidden">
                                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Selecciona un proveedor</h2>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">Elige un proveedor de la lista para ver o editar sus detalles.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Suppliers;
