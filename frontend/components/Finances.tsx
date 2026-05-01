import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { CashDrawer, CashDrawerActivity, Sale } from '../types';
import { findCustomerForSale, loanBelongsToCustomer } from '../utils/customerIdentity';

const surfaceClass = 'glass-panel-dark rounded-[1.8rem] border border-white/10';
const inputClass = 'mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-300/50 focus:outline-none';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const getDebtAgeColor = (days: number) => {
    if (days > 60) return 'border-rose-400/20 bg-rose-400/10 text-rose-200';
    if (days > 30) return 'border-amber-400/20 bg-amber-400/10 text-amber-200';
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200';
};

interface CustomerDebtInfo {
    name: string;
    monetaryDebt: number;
    lentCratesValue: number;
    totalBalance: number;
    debtSales: (Sale & { ageDays: number })[];
}

const MetricCard: React.FC<{ title: string; value: string; subtext: string; accent: string }> = ({
    title,
    value,
    subtext,
    accent,
}) => (
    <div className={`${surfaceClass} p-5`}>
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className={labelClass}>{title}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
                <p className="mt-2 text-sm text-slate-400">{subtext}</p>
            </div>
            <div className={`h-12 w-12 rounded-2xl border ${accent}`} />
        </div>
    </div>
);

const SegmentedButton: React.FC<{
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            active
                ? 'bg-brand-400 text-slate-950'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
    >
        {children}
    </button>
);

const ModalShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-[0_32px_120px_rgba(15,23,42,0.5)]">
            <h3 className="text-xl font-black tracking-tight text-white">{title}</h3>
            <div className="mt-5">{children}</div>
        </div>
    </div>
);

const CashDrawerManager: React.FC<{
    drawer: CashDrawer;
    activities: CashDrawerActivity[];
    onOpen: (id: string, balance: number) => void;
    onClose: (id: string, counted: number, notes?: string) => void;
}> = ({ drawer, activities, onOpen, onClose }) => {
    const [openModal, setOpenModal] = useState(false);
    const [closeModal, setCloseModal] = useState(false);
    const [initialBalance, setInitialBalance] = useState('');
    const [countedAmount, setCountedAmount] = useState('');
    const [closeNotes, setCloseNotes] = useState('');

    const expectedBalance = drawer.balance;
    const difference = parseFloat(countedAmount) - expectedBalance;

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_36%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-sky-200">Caja operativa</p>
                        <h2 className="mt-3 text-4xl font-black tracking-tight text-white">{drawer.name}</h2>
                        <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">
                            {drawer.status}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Saldo actual</p>
                            <p className="mt-2 text-3xl font-black text-white">{formatCurrency(drawer.balance)}</p>
                        </div>
                        <button
                            onClick={() => (drawer.status === 'Cerrada' ? setOpenModal(true) : setCloseModal(true))}
                            className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                                drawer.status === 'Cerrada'
                                    ? 'bg-brand-400 text-slate-950 hover:bg-brand-300'
                                    : 'bg-rose-500 text-white hover:bg-rose-400'
                            }`}
                        >
                            {drawer.status === 'Cerrada' ? 'Abrir caja' : 'Cerrar caja'}
                        </button>
                    </div>
                </div>
            </section>

            <section className={`${surfaceClass} p-6`}>
                <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                        <p className={labelClass}>Timeline</p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Movimientos recientes</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">
                        {activities.length} registros
                    </span>
                </div>

                <div className="space-y-3">
                    {activities.slice(0, 20).map((activity) => (
                        <div key={activity.id} className="flex flex-col gap-3 rounded-[1.4rem] border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm font-semibold capitalize text-white">
                                    {activity.type.replace(/_/g, ' ').toLowerCase()}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {activity.notes || new Date(activity.timestamp).toLocaleString('es-MX')}
                                </p>
                            </div>
                            <p className={`text-lg font-black ${activity.amount >= 0 ? 'text-brand-200' : 'text-rose-300'}`}>
                                {formatCurrency(activity.amount)}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {openModal && (
                <ModalShell title="Abrir caja">
                    <label className={`block ${labelClass}`}>Saldo inicial</label>
                    <input
                        type="number"
                        value={initialBalance}
                        onChange={(event) => setInitialBalance(event.target.value)}
                        placeholder="5000"
                        className={inputClass}
                    />
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setOpenModal(false)}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => {
                                onOpen(drawer.id, parseFloat(initialBalance) || 0);
                                setOpenModal(false);
                            }}
                            className="rounded-full bg-brand-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                        >
                            Confirmar
                        </button>
                    </div>
                </ModalShell>
            )}

            {closeModal && (
                <ModalShell title="Corte de caja">
                    <div className="space-y-4 text-sm">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Saldo esperado</p>
                            <p className="mt-2 text-xl font-black text-white">{formatCurrency(expectedBalance)}</p>
                        </div>

                        <div>
                            <label className={`block ${labelClass}`}>Saldo contado</label>
                            <input
                                type="number"
                                value={countedAmount}
                                onChange={(event) => setCountedAmount(event.target.value)}
                                className={inputClass}
                            />
                        </div>

                        <div
                            className={`rounded-2xl border px-4 py-3 ${
                                !countedAmount
                                    ? 'border-white/10 bg-white/5 text-slate-300'
                                    : difference === 0
                                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                                      : 'border-rose-400/20 bg-rose-400/10 text-rose-200'
                            }`}
                        >
                            <p className={labelClass}>Diferencia</p>
                            <p className="mt-2 text-xl font-black">
                                {countedAmount ? formatCurrency(difference) : '-'}
                            </p>
                        </div>

                        <div>
                            <label className={`block ${labelClass}`}>Notas</label>
                            <textarea
                                value={closeNotes}
                                onChange={(event) => setCloseNotes(event.target.value)}
                                rows={3}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setCloseModal(false)}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => {
                                onClose(drawer.id, parseFloat(countedAmount) || 0, closeNotes);
                                setCloseModal(false);
                            }}
                            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-400"
                        >
                            Confirmar cierre
                        </button>
                    </div>
                </ModalShell>
            )}
        </div>
    );
};

const Finances: React.FC<{ data: BusinessData }> = ({ data }) => {
    const {
        sales,
        customers,
        payments,
        crateLoans,
        crateTypes,
        cashDrawers,
        cashDrawerActivities,
        closeCashDrawer,
        openCashDrawer,
    } = data;
    const [activeTab, setActiveTab] = useState<'debt' | 'cash'>('debt');

    const financialData = useMemo(() => {
        const debtByCustomer: Record<string, CustomerDebtInfo> = {};
        const now = new Date();
        const nowTime = now.getTime();
        const activeLoans = crateLoans.filter((loan) => loan.status === 'Prestado' || loan.status === 'No Devuelto');

        customers.forEach((customer) => {
            debtByCustomer[customer.id] = {
                name: customer.name,
                monetaryDebt: 0,
                lentCratesValue: 0,
                totalBalance: 0,
                debtSales: [],
            };
        });

        const completedSales = sales.filter((sale) => sale.status === 'Completado' && sale.paymentStatus === 'En Deuda');

        for (const sale of completedSales) {
            const customerId = findCustomerForSale(customers, sale)?.id;
            if (!customerId) continue;
            const ageDays = Math.floor((nowTime - new Date(sale.timestamp).getTime()) / (1000 * 3600 * 24));
            debtByCustomer[customerId].debtSales.push({ ...sale, ageDays });
        }

        Object.keys(debtByCustomer).forEach((customerId) => {
            const customerSales = debtByCustomer[customerId].debtSales;
            const customerPayments = payments.filter((payment) => payment.customerId === customerId);
            const totalBilled = customerSales.reduce((sum, sale) => sum + sale.price, 0);
            const totalPaid = customerPayments.reduce((sum, payment) => sum + payment.amount, 0);
            const customer = customers.find((item) => item.id === customerId);
            const customerLoans = customer ? activeLoans.filter((loan) => loanBelongsToCustomer(loan, customer)) : [];
            const customerLentCratesValue = customerLoans.reduce((sum, loan) => {
                const crateType = crateTypes.find((item) => item.id === loan.crateTypeId);
                return sum + loan.quantity * (crateType?.cost || 50);
            }, 0);

            debtByCustomer[customerId].monetaryDebt = Math.max(0, totalBilled - totalPaid);
            debtByCustomer[customerId].lentCratesValue = customerLentCratesValue;
            debtByCustomer[customerId].totalBalance = debtByCustomer[customerId].monetaryDebt + customerLentCratesValue;
        });

        const customersWithDebt = Object.values(debtByCustomer)
            .filter((customer) => customer.totalBalance > 0)
            .sort((a, b) => b.totalBalance - a.totalBalance);

        const totalMonetaryDebt = customersWithDebt.reduce((sum, customer) => sum + customer.monetaryDebt, 0);
        const totalLentAssetValue = activeLoans.reduce((sum, loan) => {
            const crateType = crateTypes.find((item) => item.id === loan.crateTypeId);
            return sum + loan.quantity * (crateType?.cost || 50);
        }, 0);

        const lentCratesByCustomer = customers
            .map((customer) => {
                const loans = activeLoans
                    .filter((loan) => loanBelongsToCustomer(loan, customer))
                    .map((loan) => ({
                        ...loan,
                        isOverdue: new Date(loan.dueDate) < now,
                        crateTypeName: crateTypes.find((item) => item.id === loan.crateTypeId)?.name || 'N/A',
                    }));
                return { customerName: customer.name, loans };
            })
            .filter((customer) => customer.loans.length > 0);

        return { customersWithDebt, lentCratesByCustomer, totalLentAssetValue, totalMonetaryDebt };
    }, [crateLoans, crateTypes, customers, payments, sales]);

    const primaryDrawer = cashDrawers[0];

    return (
        <div className="space-y-6">
            <section className="rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-sky-200">Rentabilidad</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                            Caja, deuda y activos prestados en una sola lectura.
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Da seguimiento a cuentas por cobrar, valor expuesto en cajas y salud diaria del flujo de efectivo.
                        </p>
                    </div>

                    <div className="rounded-full border border-white/10 bg-white/5 p-1">
                        <SegmentedButton active={activeTab === 'debt'} onClick={() => setActiveTab('debt')}>
                            Cuentas por cobrar
                        </SegmentedButton>
                        <SegmentedButton active={activeTab === 'cash'} onClick={() => setActiveTab('cash')}>
                            Gestion de caja
                        </SegmentedButton>
                    </div>
                </div>
            </section>

            {activeTab === 'debt' && (
                <div className="space-y-6">
                    <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <MetricCard
                            title="Deuda monetaria"
                            value={formatCurrency(financialData.totalMonetaryDebt)}
                            subtext="Ventas a credito pendientes de cobro."
                            accent="border-amber-400/40 bg-amber-400/10"
                        />
                        <MetricCard
                            title="Valor expuesto en cajas"
                            value={formatCurrency(financialData.totalLentAssetValue)}
                            subtext="Costo estimado de activos aun fuera."
                            accent="border-sky-400/40 bg-sky-400/10"
                        />
                    </section>

                    <section className={`${surfaceClass} overflow-hidden`}>
                        <div className="border-b border-white/10 px-6 py-5">
                            <p className={labelClass}>Activos prestados</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Cajas en campo</h2>
                        </div>

                        {financialData.lentCratesByCustomer.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead className="border-b border-white/10 bg-white/[0.03]">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Cliente</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Detalle</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financialData.lentCratesByCustomer.map((item) => (
                                            <tr key={item.customerName} className="border-b border-white/5 align-top">
                                                <td className="px-6 py-5 font-semibold text-white">{item.customerName}</td>
                                                <td className="px-6 py-5">
                                                    <div className="space-y-2">
                                                        {item.loans.map((loan) => (
                                                            <p key={loan.id} className="text-sm text-slate-300">
                                                                {loan.quantity} x {loan.crateTypeName}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="space-y-2">
                                                        {item.loans.map((loan) => (
                                                            <div key={loan.id}>
                                                                {loan.status === 'No Devuelto' ? (
                                                                    <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-rose-200">
                                                                        No devuelto
                                                                    </span>
                                                                ) : (
                                                                    <span
                                                                        className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${
                                                                            loan.isOverdue
                                                                                ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                                                                                : 'border-white/10 bg-white/5 text-slate-300'
                                                                        }`}
                                                                    >
                                                                        Vence {new Date(loan.dueDate).toLocaleDateString('es-MX')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-6 py-14 text-center">
                                <p className="text-lg font-semibold text-white">Sin cajas pendientes.</p>
                                <p className="mt-2 text-sm text-slate-400">No hay activos prestados fuera del negocio.</p>
                            </div>
                        )}
                    </section>

                    <section className={`${surfaceClass} overflow-hidden`}>
                        <div className="border-b border-white/10 px-6 py-5">
                            <p className={labelClass}>Cobranza</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Balance por cliente</h2>
                        </div>

                        {financialData.customersWithDebt.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead className="border-b border-white/10 bg-white/[0.03]">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Cliente</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Deuda</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Valor cajas</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Total</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financialData.customersWithDebt.map((customer) => (
                                            <tr key={customer.name} className="border-b border-white/5 align-top">
                                                <td className="px-6 py-5 font-semibold text-white">{customer.name}</td>
                                                <td className="px-6 py-5 text-sm font-semibold text-amber-200">
                                                    {customer.monetaryDebt > 0 ? formatCurrency(customer.monetaryDebt) : '-'}
                                                </td>
                                                <td className="px-6 py-5 text-sm font-semibold text-sky-200">
                                                    {customer.lentCratesValue > 0 ? formatCurrency(customer.lentCratesValue) : '-'}
                                                </td>
                                                <td className="px-6 py-5 text-sm font-black text-rose-200">
                                                    {formatCurrency(customer.totalBalance)}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="space-y-3">
                                                        {customer.debtSales.map((sale) => (
                                                            <div key={sale.id} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-3">
                                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                                    <div>
                                                                        <p className="font-semibold text-white">{formatCurrency(sale.price)}</p>
                                                                        <p className="mt-1 text-xs text-slate-400">
                                                                            {new Date(sale.timestamp).toLocaleDateString('es-MX')}
                                                                        </p>
                                                                        {sale.paymentNotes && (
                                                                            <p className="mt-1 text-xs italic text-slate-500">
                                                                                Nota: "{sale.paymentNotes}"
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${getDebtAgeColor(sale.ageDays)}`}>
                                                                        {sale.ageDays} dia{sale.ageDays !== 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-6 py-14 text-center">
                                <p className="text-lg font-semibold text-white">Sin saldos pendientes.</p>
                                <p className="mt-2 text-sm text-slate-400">La cartera se encuentra al corriente en este momento.</p>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {activeTab === 'cash' &&
                (primaryDrawer ? (
                    <CashDrawerManager
                        drawer={primaryDrawer}
                        activities={cashDrawerActivities.filter((activity) => activity.drawerId === primaryDrawer.id)}
                        onOpen={openCashDrawer}
                        onClose={closeCashDrawer}
                    />
                ) : (
                    <section className={`${surfaceClass} px-6 py-14 text-center`}>
                        <p className="text-lg font-semibold text-white">Sin caja configurada.</p>
                        <p className="mt-2 text-sm text-slate-400">No hay una caja principal disponible para administrar.</p>
                    </section>
                ))}
        </div>
    );
};

export default Finances;
