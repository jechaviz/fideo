import React, { useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { PurchaseOrder } from '../types';

const surfaceClass = 'glass-panel-dark rounded-[1.6rem] border border-white/10';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const getStatusColor = (status: PurchaseOrder['status']) => {
    switch (status) {
        case 'Pendiente':
            return 'border-amber-400/20 bg-amber-400/10 text-amber-200';
        case 'Ordenado':
            return 'border-sky-400/20 bg-sky-400/10 text-sky-200';
        case 'Recibido':
            return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200';
    }
};

const SupplierView: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { currentSupplierId, productGroups, purchaseOrders, suppliers } = data;

    const supplier = useMemo(
        () => suppliers.find((item) => item.id === currentSupplierId),
        [currentSupplierId, suppliers],
    );

    const supplierOrders = useMemo(() => {
        if (!supplier) return [];
        return purchaseOrders
            .filter((purchaseOrder) => purchaseOrder.supplierId === supplier.id)
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }, [purchaseOrders, supplier]);

    const getVarietyName = (id: string) => {
        for (const group of productGroups) {
            const variety = group.varieties.find((item) => item.id === id);
            if (variety) return `${group.name} ${variety.name}`;
        }
        return 'Producto desconocido';
    };

    const totalOrdered = useMemo(
        () => supplierOrders.reduce((sum, order) => sum + order.totalCost, 0),
        [supplierOrders],
    );

    if (!supplier) {
        return (
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                <h2 className="text-xl font-black text-white">Proveedor no encontrado</h2>
                <p className="mt-2 text-sm text-slate-400">No fue posible cargar la vista del proveedor.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_32%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-sky-200">Portal proveedor</p>
                        <h2 className="mt-3 text-4xl font-black tracking-tight text-white">{supplier.name}</h2>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Consulta ordenes de compra, montos y estado operativo de cada solicitud desde un portal claro y premium.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[560px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Ordenes</p>
                            <p className="mt-2 text-3xl font-black text-white">{supplierOrders.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Monto total</p>
                            <p className="mt-2 text-3xl font-black text-white">{formatCurrency(totalOrdered)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Ultimo estado</p>
                            <p className="mt-2 text-lg font-black text-white">
                                {supplierOrders[0]?.status || 'Sin actividad'}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className={`${surfaceClass} overflow-hidden`}>
                <div className="border-b border-white/10 px-6 py-5">
                    <p className={labelClass}>Ordenes de compra</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Historial reciente</h3>
                </div>

                {supplierOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="border-b border-white/10 bg-white/[0.03]">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Fecha</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Producto</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Cantidad</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Costo</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {supplierOrders.map((order) => (
                                    <tr key={order.id} className="border-b border-white/5">
                                        <td className="px-6 py-5 text-sm text-slate-300">
                                            {new Date(order.orderDate).toLocaleDateString('es-MX')}
                                        </td>
                                        <td className="px-6 py-5 text-sm font-semibold text-white">
                                            {getVarietyName(order.varietyId)} ({order.size})
                                        </td>
                                        <td className="px-6 py-5 text-sm text-slate-300">
                                            {order.quantity} {order.packaging}
                                        </td>
                                        <td className="px-6 py-5 text-sm font-black text-brand-200">
                                            {formatCurrency(order.totalCost)}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-6 py-14 text-center">
                        <p className="text-lg font-semibold text-white">Sin ordenes para mostrar.</p>
                        <p className="mt-2 text-sm text-slate-400">Aun no se han registrado compras asociadas a este proveedor.</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default SupplierView;
