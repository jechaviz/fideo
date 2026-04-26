import React, { useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { PurchaseOrder } from '../types';

const getStatusColor = (status: PurchaseOrder['status']) => {
    switch(status) {
        case 'Pendiente': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
        case 'Ordenado': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
        case 'Recibido': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    }
};

const SupplierView: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { suppliers, purchaseOrders, productGroups, currentSupplierId } = data;

    const supplier = useMemo(() => {
        return suppliers.find(s => s.id === currentSupplierId);
    }, [suppliers, currentSupplierId]);

    const supplierOrders = useMemo(() => {
        if (!supplier) return [];
        return purchaseOrders
            .filter(po => po.supplierId === supplier.id)
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }, [purchaseOrders, supplier]);

    const getVarietyName = (id: string) => {
        for (const group of productGroups) {
            const variety = group.varieties.find(v => v.id === id);
            if (variety) return `${group.name} ${variety.name}`;
        }
        return 'Producto Desconocido';
    };

    if (!supplier) {
        return (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Proveedor no encontrado</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">No se pudo cargar la información del proveedor.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Portal del Proveedor: {supplier.name}</h2>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cantidad</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Total</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {supplierOrders.map(order => (
                            <tr key={order.id}>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{new Date(order.orderDate).toLocaleDateString('es-MX')}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{getVarietyName(order.varietyId)} ({order.size})</td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{order.quantity} {order.packaging}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-green-700 dark:text-green-400">{order.totalCost.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'})}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                                        {order.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {supplierOrders.length === 0 && (
                    <div className="text-center py-10">
                        <p className="text-gray-500 dark:text-gray-400">No hay órdenes de compra para mostrar.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default SupplierView;
