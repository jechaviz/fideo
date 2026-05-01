import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale } from '../types';
import { loanBelongsToCustomer, saleBelongsToCustomer } from '../utils/customerIdentity';

type CustomerTab = 'today_orders' | 'order_history' | 'crates' | 'prices';

const surfaceClass = 'glass-panel-dark rounded-[1.6rem] border border-white/10';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const TabButton: React.FC<{
    name: string;
    tab: CustomerTab;
    activeTab: CustomerTab;
    setActiveTab: (tab: CustomerTab) => void;
}> = ({ name, tab, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === tab
                ? 'bg-white text-slate-950'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
    >
        {name}
    </button>
);

const OrderList: React.FC<{ sales: Sale[]; emptyTitle: string; emptyBody: string }> = ({
    sales,
    emptyBody,
    emptyTitle,
}) => (
    <div className="space-y-3">
        {sales.length > 0 ? (
            sales.map((sale) => (
                <div key={sale.id} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="font-semibold text-white">
                                {sale.quantity}x {sale.varietyName} {sale.size}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                {new Date(sale.timestamp).toLocaleString('es-MX')} | {sale.status} | {sale.paymentStatus}
                            </p>
                        </div>
                        <p className="text-lg font-black text-brand-200">{formatCurrency(sale.price)}</p>
                    </div>
                </div>
            ))
        ) : (
            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                <p className="text-lg font-semibold text-white">{emptyTitle}</p>
                <p className="mt-2 text-sm text-slate-400">{emptyBody}</p>
            </div>
        )}
    </div>
);

const CustomerView: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { crateLoans, crateTypes, currentCustomerId, customers, payments, productGroups, sales } = data;
    const [activeTab, setActiveTab] = useState<CustomerTab>('today_orders');

    const customer = useMemo(
        () => customers.find((item) => item.id === currentCustomerId),
        [currentCustomerId, customers],
    );

    const totalBalance = useMemo(() => {
        if (!customer) return 0;
        const debtFromSales = sales
            .filter((sale) => saleBelongsToCustomer(sale, customer) && sale.paymentStatus === 'En Deuda' && sale.status === 'Completado')
            .reduce((sum, sale) => sum + sale.price, 0);
        const totalPayments = payments
            .filter((payment) => payment.customerId === customer.id)
            .reduce((sum, payment) => sum + payment.amount, 0);
        const monetaryDebt = Math.max(0, debtFromSales - totalPayments);
        const loans = crateLoans.filter(
            (loan) => loanBelongsToCustomer(loan, customer) && (loan.status === 'Prestado' || loan.status === 'No Devuelto'),
        );
        const lentCratesValue = loans.reduce((sum, loan) => {
            const crateType = crateTypes.find((item) => item.id === loan.crateTypeId);
            return sum + loan.quantity * (crateType?.cost || 50);
        }, 0);
        return monetaryDebt + lentCratesValue;
    }, [crateLoans, crateTypes, customer, payments, sales]);

    const { historicalSales, todaySales } = useMemo(() => {
        const allSales = sales
            .filter((sale) => customer && saleBelongsToCustomer(sale, customer))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return {
            todaySales: allSales.filter((sale) => new Date(sale.timestamp) >= today),
            historicalSales: allSales.filter((sale) => new Date(sale.timestamp) < today),
        };
    }, [customer, sales]);

    const customerLoans = useMemo(
        () =>
            crateLoans
                .filter((loan) => customer && loanBelongsToCustomer(loan, customer))
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
        [crateLoans, customer],
    );

    if (!customer) {
        return (
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                <h2 className="text-xl font-black text-white">Cliente no encontrado</h2>
                <p className="mt-2 text-sm text-slate-400">No fue posible cargar el portal para esta cuenta.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_32%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Portal cliente</p>
                        <h2 className="mt-3 text-4xl font-black tracking-tight text-white">Bienvenido, {customer.name}</h2>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Consulta pedidos, cajas prestadas y condiciones especiales de compra desde una vista clara y directa.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[540px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Balance total</p>
                            <p className="mt-2 text-3xl font-black text-white">{formatCurrency(totalBalance)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Pedidos hoy</p>
                            <p className="mt-2 text-3xl font-black text-white">{todaySales.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Precios especiales</p>
                            <p className="mt-2 text-3xl font-black text-white">{customer.specialPrices.length}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className={`${surfaceClass} p-3`}>
                <div className="flex flex-wrap gap-2">
                    <TabButton name="Pedido de hoy" tab="today_orders" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton name="Historial" tab="order_history" activeTab={activeTab} setActiveTab={setActiveTab} />
                    {customerLoans.length > 0 && (
                        <TabButton name="Mis cajas" tab="crates" activeTab={activeTab} setActiveTab={setActiveTab} />
                    )}
                    {customer.specialPrices.length > 0 && (
                        <TabButton name="Mis precios" tab="prices" activeTab={activeTab} setActiveTab={setActiveTab} />
                    )}
                </div>
            </section>

            <section className={`${surfaceClass} p-6`}>
                {activeTab === 'today_orders' && (
                    <OrderList
                        sales={todaySales}
                        emptyTitle="Todavia no hay pedidos para hoy."
                        emptyBody="Cuando se registren tus compras del dia apareceran aqui."
                    />
                )}

                {activeTab === 'order_history' && (
                    <OrderList
                        sales={historicalSales}
                        emptyTitle="Sin historial disponible."
                        emptyBody="Aun no encontramos pedidos anteriores para esta cuenta."
                    />
                )}

                {activeTab === 'crates' && (
                    <div className="space-y-3">
                        {customerLoans.length > 0 ? (
                            customerLoans.map((loan) => {
                                const crateType = crateTypes.find((item) => item.id === loan.crateTypeId);
                                const isOverdue = new Date(loan.dueDate) < new Date() && loan.status === 'Prestado';

                                return (
                                    <div
                                        key={loan.id}
                                        className={`rounded-[1.4rem] border p-4 ${
                                            isOverdue
                                                ? 'border-rose-400/20 bg-rose-400/10'
                                                : 'border-amber-400/20 bg-amber-400/10'
                                        }`}
                                    >
                                        <p className="font-semibold text-white">
                                            {loan.quantity} x {crateType?.name || 'Caja'}
                                        </p>
                                        <p className={`mt-2 text-sm ${isOverdue ? 'text-rose-200' : 'text-amber-200'}`}>
                                            {loan.status} | Vence: {new Date(loan.dueDate).toLocaleDateString('es-MX')}
                                        </p>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                                <p className="text-lg font-semibold text-white">Sin cajas registradas.</p>
                                <p className="mt-2 text-sm text-slate-400">No tienes prestamos activos en este momento.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'prices' && (
                    <div className="space-y-3">
                        {customer.specialPrices.length > 0 ? (
                            customer.specialPrices.map((specialPrice) => {
                                const productGroup = productGroups.find((group) =>
                                    group.varieties.some((variety) => variety.id === specialPrice.varietyId),
                                );
                                const variety = productGroup?.varieties.find(
                                    (item) => item.id === specialPrice.varietyId,
                                );

                                return (
                                    <div key={`${specialPrice.varietyId}-${specialPrice.size}-${specialPrice.state}-${specialPrice.quality}`} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="font-semibold text-white">
                                                    {productGroup?.name} {variety?.name} ({specialPrice.size})
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    {specialPrice.quality} | {specialPrice.state}
                                                </p>
                                            </div>
                                            <p className="text-lg font-black text-brand-200">
                                                {formatCurrency(specialPrice.price)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                                <p className="text-lg font-semibold text-white">Sin precios especiales.</p>
                                <p className="mt-2 text-sm text-slate-400">Tus condiciones personalizadas apareceran aqui cuando existan.</p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default CustomerView;
