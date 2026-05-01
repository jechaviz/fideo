import React, { useEffect, useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { CreditStatus, Customer, FruitState, Payment, Quality, Sale } from '../types';
import { findCustomerForSale, loanBelongsToCustomer, saleBelongsToCustomer } from '../utils/customerIdentity';
import {
    ArrowUturnLeftIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    FinanceIcon,
    GridIcon,
    ListIcon,
    PlusIcon,
    SettingsIcon,
    SparklesIcon,
    XMarkIcon,
} from './icons/Icons';
import MessageConfig from './MessageConfig';
import Promotions from './Promotions';

const CREDIT_STATUSES: CreditStatus[] = ['Confiable', 'En Observación', 'Contado Solamente'];
type MainTab = 'dashboard' | 'directory' | 'messages';
type MessageSubTab = 'config' | 'campaigns';
type DirectoryViewMode = 'list' | 'grid';
type CustomerTab = 'insights' | 'details' | 'orders' | 'crates' | 'prices';

const surfaceClass = 'glass-panel-dark rounded-[1.8rem] border border-white/10';
const inputClass = 'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-300/50 focus:outline-none';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const getCreditTone = (status: string) => {
    switch (status) {
        case 'Confiable':
            return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
        case 'En Observacion':
        case 'En Observación':
            return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
        default:
            return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
    }
};

const getAgeLabel = (sale?: Sale) => {
    if (!sale) return 'Sin compras recientes';
    const ageDays = Math.floor((Date.now() - new Date(sale.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays <= 0) return 'Activo hoy';
    if (ageDays === 1) return 'Activo hace 1 dia';
    return `Activo hace ${ageDays} dias`;
};

const SummaryCard: React.FC<{
    title: string;
    value: string;
    subtext: string;
    icon: React.ReactNode;
    accent: string;
}> = ({ title, value, subtext, icon, accent }) => (
    <div className={`${surfaceClass} p-5`}>
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className={labelClass}>{title}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
                <p className="mt-2 text-sm text-slate-400">{subtext}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${accent}`}>
                {icon}
            </div>
        </div>
    </div>
);

const MetricChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <p className={labelClass}>{label}</p>
        <p className="mt-2 text-lg font-black text-white">{value}</p>
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
                : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
    >
        {children}
    </button>
);

const CustomerSummaryCard: React.FC<{
    customer: Customer;
    sales: Sale[];
    payments: Payment[];
    onClick: () => void;
}> = ({ customer, sales, payments, onClick }) => {
    const stats = useMemo(() => {
        const debtFromSales = sales
            .filter((sale) => saleBelongsToCustomer(sale, customer) && sale.paymentStatus === 'En Deuda' && sale.status === 'Completado')
            .reduce((sum, sale) => sum + sale.price, 0);
        const totalPayments = payments
            .filter((payment) => payment.customerId === customer.id)
            .reduce((sum, payment) => sum + payment.amount, 0);
        const monetaryDebt = Math.max(0, debtFromSales - totalPayments);
        const lastSale = sales
            .filter((sale) => saleBelongsToCustomer(sale, customer))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        const productCounts: Record<string, number> = {};
        sales
            .filter((sale) => saleBelongsToCustomer(sale, customer))
            .forEach((sale) => {
                productCounts[sale.productGroupName] = (productCounts[sale.productGroupName] || 0) + 1;
            });

        return {
            monetaryDebt,
            lastSale,
            topProducts: Object.entries(productCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name]) => name),
        };
    }, [customer, payments, sales]);

    const creditUsagePct = customer.creditLimit ? Math.min(100, (stats.monetaryDebt / customer.creditLimit) * 100) : 0;

    return (
        <button
            onClick={onClick}
            className={`${surfaceClass} group flex h-full flex-col justify-between p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-300/30 hover:bg-white/[0.08]`}
        >
            <div>
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className={labelClass}>Cuenta clave</p>
                        <h3 className="mt-2 truncate text-xl font-black tracking-tight text-white">{customer.name}</h3>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${getCreditTone(customer.creditStatus)}`}>
                        {customer.creditStatus}
                    </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <MetricChip label="Deuda actual" value={formatCurrency(stats.monetaryDebt)} />
                    <MetricChip label="Ultima actividad" value={getAgeLabel(stats.lastSale)} />
                </div>

                <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>Uso de credito</span>
                        <span>{customer.creditLimit ? `${creditUsagePct.toFixed(0)}%` : 'Sin limite'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                        <div
                            className={`h-2 rounded-full ${
                                creditUsagePct > 90 ? 'bg-rose-400' : creditUsagePct > 65 ? 'bg-amber-400' : 'bg-brand-400'
                            }`}
                            style={{ width: `${customer.creditLimit ? creditUsagePct : 0}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-6 flex items-end justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                    {stats.topProducts.length > 0 ? (
                        stats.topProducts.map((product) => (
                            <span key={product} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                                {product}
                            </span>
                        ))
                    ) : (
                        <span className="text-sm text-slate-500">Sin patron comercial todavia.</span>
                    )}
                </div>
                <span className="flex items-center gap-2 text-sm font-semibold text-brand-200 transition group-hover:text-brand-100">
                    Abrir perfil
                    <ChevronRightIcon />
                </span>
            </div>
        </button>
    );
};

const DirectoryCard: React.FC<{ customer: Customer; onClick: () => void }> = ({ customer, onClick }) => (
    <button
        onClick={onClick}
        className={`${surfaceClass} flex h-full flex-col justify-between p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-300/30 hover:bg-white/[0.08]`}
    >
        <div>
            <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-black text-white">
                    {customer.name.charAt(0)}
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${getCreditTone(customer.creditStatus)}`}>
                    {customer.creditStatus}
                </span>
            </div>
            <h3 className="mt-4 text-lg font-black tracking-tight text-white">{customer.name}</h3>
            <p className="mt-2 text-sm text-slate-400">
                {customer.contacts.find((contact) => contact.isPrimary)?.name || 'Sin contacto principal'}
            </p>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm text-slate-400">
            <span>{customer.contacts.length} contacto(s)</span>
            <span className="font-semibold text-brand-200">Ver detalle</span>
        </div>
    </button>
);

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

const CustomerCommandCenter: React.FC<{ data: BusinessData; customerId: string; onBack: () => void }> = ({
    data,
    customerId,
    onBack,
}) => {
    const {
        customers,
        sales,
        payments,
        crateLoans,
        crateTypes,
        generateCustomerSummary,
        aiCustomerSummary,
        isGeneratingSummary,
    } = data;

    const [activeTab, setActiveTab] = useState<CustomerTab>('insights');
    const customer = useMemo(() => customers.find((item) => item.id === customerId), [customerId, customers]);

    const { monetaryDebt, lentCratesValue, totalBalance, totalOrders } = useMemo(() => {
        if (!customer) {
            return { monetaryDebt: 0, lentCratesValue: 0, totalBalance: 0, totalOrders: 0 };
        }

        const debtFromSales = sales
            .filter((sale) => saleBelongsToCustomer(sale, customer) && sale.paymentStatus === 'En Deuda' && sale.status === 'Completado')
            .reduce((sum, sale) => sum + sale.price, 0);
        const totalPayments = payments
            .filter((payment) => payment.customerId === customer.id)
            .reduce((sum, payment) => sum + payment.amount, 0);
        const finalMonetaryDebt = Math.max(0, debtFromSales - totalPayments);
        const loans = crateLoans.filter(
            (loan) => loanBelongsToCustomer(loan, customer) && (loan.status === 'Prestado' || loan.status === 'No Devuelto'),
        );
        const finalLentCratesValue = loans.reduce((sum, loan) => {
            const crateType = crateTypes.find((item) => item.id === loan.crateTypeId);
            return sum + loan.quantity * (crateType?.cost || 50);
        }, 0);

        return {
            monetaryDebt: finalMonetaryDebt,
            lentCratesValue: finalLentCratesValue,
            totalBalance: finalMonetaryDebt + finalLentCratesValue,
            totalOrders: sales.filter((sale) => saleBelongsToCustomer(sale, customer)).length,
        };
    }, [crateLoans, crateTypes, customer, payments, sales]);

    if (!customer) {
        return (
            <div className={`${surfaceClass} p-8 text-center`}>
                <h2 className="text-xl font-black text-white">Cliente no encontrado</h2>
                <p className="mt-2 text-sm text-slate-400">No pudimos reconstruir este perfil comercial.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.16),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                    <ArrowUturnLeftIcon />
                    Volver a clientes
                </button>

                <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Cuenta</p>
                        <h2 className="mt-3 text-4xl font-black tracking-tight text-white">{customer.name}</h2>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {customer.contacts.map((contact) => (
                                <span
                                    key={contact.name}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                        contact.isPrimary
                                            ? 'border-brand-300/30 bg-brand-300/10 text-brand-100'
                                            : 'border-white/10 bg-white/5 text-slate-300'
                                    }`}
                                >
                                    {contact.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[540px]">
                        <MetricChip label="Balance total" value={formatCurrency(totalBalance)} />
                        <MetricChip label="Deuda monetaria" value={formatCurrency(monetaryDebt)} />
                        <MetricChip label="Pedidos historicos" value={totalOrders.toString()} />
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className={labelClass}>Credito</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">{customer.creditStatus}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className={labelClass}>Limite</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">
                            {customer.creditLimit ? formatCurrency(customer.creditLimit) : 'Sin limite'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className={labelClass}>Cajas expuestas</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">{formatCurrency(lentCratesValue)}</p>
                    </div>
                </div>
            </section>

            <section className={`${surfaceClass} p-3`}>
                <div className="flex flex-wrap gap-2">
                    <TabButton name="Analisis IA" tab="insights" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton name="Detalles" tab="details" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton name="Pedidos" tab="orders" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton name="Cajas" tab="crates" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton name="Precios" tab="prices" activeTab={activeTab} setActiveTab={setActiveTab} />
                </div>
            </section>

            <section className={`${surfaceClass} p-6`}>
                {activeTab === 'insights' && (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <p className={labelClass}>Motor Fideo</p>
                                <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Lectura comercial del cliente</h3>
                                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                                    Genera un resumen con patrones de compra, riesgo de credito y oportunidades de venta.
                                </p>
                            </div>
                            <button
                                onClick={() => generateCustomerSummary(customer.id)}
                                disabled={isGeneratingSummary}
                                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-400 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isGeneratingSummary ? (
                                    <div className="h-5 w-5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                                ) : (
                                    <SparklesIcon />
                                )}
                                <span>{isGeneratingSummary ? 'Analizando...' : 'Generar lectura'}</span>
                            </button>
                        </div>

                        {aiCustomerSummary ? (
                            <div
                                className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-200"
                                dangerouslySetInnerHTML={{
                                    __html: aiCustomerSummary.error
                                        ? `<p class="text-rose-300">${aiCustomerSummary.error}</p>`
                                        : aiCustomerSummary.content
                                              .replace(/### (.*)/g, '<h3 class="mt-6 text-lg font-black text-white">$1</h3>')
                                              .replace(/\* (.*)/g, '<li class="ml-5">$1</li>'),
                                }}
                            />
                        ) : !isGeneratingSummary ? (
                            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                                <p className="text-lg font-semibold text-white">Listo para construir una lectura accionable.</p>
                                <p className="mt-2 text-sm text-slate-400">
                                    Usa el resumen para decidir credito, frecuencia de seguimiento y ofertas especiales.
                                </p>
                            </div>
                        ) : null}
                    </div>
                )}

                {activeTab === 'details' && <CustomerDetails data={data} customer={customer} />}
                {activeTab === 'orders' && <CustomerOrders data={data} customer={customer} />}
                {activeTab === 'crates' && <CustomerCrates data={data} customer={customer} />}
                {activeTab === 'prices' && <CustomerPrices data={data} customer={customer} />}
            </section>
        </div>
    );
};

const Customers: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { customers, payments, sales } = data;
    const [mainTab, setMainTab] = useState<MainTab>('dashboard');
    const [messageSubTab, setMessageSubTab] = useState<MessageSubTab>('config');
    const [directoryView, setDirectoryView] = useState<DirectoryViewMode>('list');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    useEffect(() => {
        if (mainTab !== 'dashboard') {
            setSelectedCustomerId(null);
        }
    }, [mainTab]);

    const portfolioStats = useMemo(() => {
        let totalDebt = 0;
        const activeCustomerIds = new Set<string>();
        const currentDate = new Date();
        const thirtyDaysAgo = new Date(currentDate.setDate(currentDate.getDate() - 30));

        customers.forEach((customer) => {
            const debt =
                sales
                    .filter((sale) => saleBelongsToCustomer(sale, customer) && sale.paymentStatus === 'En Deuda')
                    .reduce((sum, sale) => sum + sale.price, 0) -
                payments
                    .filter((payment) => payment.customerId === customer.id)
                    .reduce((sum, payment) => sum + payment.amount, 0);
            totalDebt += Math.max(0, debt);
        });

        sales.forEach((sale) => {
            if (new Date(sale.timestamp) > thirtyDaysAgo) {
                const customer = findCustomerForSale(customers, sale);
                if (customer) activeCustomerIds.add(customer.id);
            }
        });

        return {
            totalDebt,
            activeCount: activeCustomerIds.size,
            totalCustomers: customers.length,
            inactiveCount: Math.max(0, customers.length - activeCustomerIds.size),
        };
    }, [customers, payments, sales]);

    return (
        <div className="space-y-6">
            <section className="rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.16),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Relaciones clave</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                            Cliente, credito y oportunidad en la misma vista.
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Prioriza cartera, entiende actividad reciente y activa mensajes comerciales sin perder el contexto del cliente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[560px]">
                        <MetricChip label="Cartera activa" value={formatCurrency(portfolioStats.totalDebt)} />
                        <MetricChip label="Clientes activos 30d" value={`${portfolioStats.activeCount}`} />
                        <MetricChip label="Sin actividad reciente" value={`${portfolioStats.inactiveCount}`} />
                    </div>
                </div>
            </section>

            {!selectedCustomerId && (
                <section className={`${surfaceClass} p-3`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                            <SegmentedButton active={mainTab === 'dashboard'} onClick={() => setMainTab('dashboard')}>
                                Dashboard
                            </SegmentedButton>
                            <SegmentedButton active={mainTab === 'directory'} onClick={() => setMainTab('directory')}>
                                Directorio
                            </SegmentedButton>
                            <SegmentedButton active={mainTab === 'messages'} onClick={() => setMainTab('messages')}>
                                Mensajes
                            </SegmentedButton>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">
                            {customers.length} cuentas en cartera
                        </div>
                    </div>
                </section>
            )}

            <div className="flex-1">
                {selectedCustomerId ? (
                    <CustomerCommandCenter
                        data={data}
                        customerId={selectedCustomerId}
                        onBack={() => setSelectedCustomerId(null)}
                    />
                ) : (
                    <>
                        {mainTab === 'dashboard' && (
                            <div className="space-y-6">
                                <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    <SummaryCard
                                        title="Cartera vencida"
                                        value={formatCurrency(portfolioStats.totalDebt)}
                                        subtext="Saldo total pendiente de cobro."
                                        icon={<FinanceIcon />}
                                        accent="border-amber-400/40 bg-amber-400/10 text-amber-200"
                                    />
                                    <SummaryCard
                                        title="Clientes activos"
                                        value={`${portfolioStats.activeCount} / ${portfolioStats.totalCustomers}`}
                                        subtext="Actividad registrada en los ultimos 30 dias."
                                        icon={<CheckCircleIcon />}
                                        accent="border-brand-400/40 bg-brand-400/10 text-brand-200"
                                    />
                                    <SummaryCard
                                        title="Salud comercial"
                                        value={portfolioStats.totalDebt > 0 ? 'Atencion' : 'Estable'}
                                        subtext="Lectura rapida para seguimiento y cobro."
                                        icon={<SparklesIcon />}
                                        accent="border-sky-400/40 bg-sky-400/10 text-sky-200"
                                    />
                                </section>

                                <section className="space-y-4">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                        <div>
                                            <p className={labelClass}>Focus list</p>
                                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Atencion prioritaria</h2>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            Abre un perfil para ajustar credito, revisar pedidos o lanzar seguimiento comercial.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                        {customers.map((customer) => (
                                            <CustomerSummaryCard
                                                key={customer.id}
                                                customer={customer}
                                                sales={sales}
                                                payments={payments}
                                                onClick={() => setSelectedCustomerId(customer.id)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            </div>
                        )}

                        {mainTab === 'directory' && (
                            <div className="space-y-6">
                                <section className={`${surfaceClass} p-5`}>
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className={labelClass}>Directorio comercial</p>
                                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Base de clientes</h2>
                                            <p className="mt-2 text-sm text-slate-400">
                                                Navega por cuenta, contacto principal y estatus de credito.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="rounded-full border border-white/10 bg-white/5 p-1">
                                                <button
                                                    onClick={() => setDirectoryView('list')}
                                                    className={`h-11 w-11 rounded-full transition ${
                                                        directoryView === 'list'
                                                            ? 'bg-white text-slate-950'
                                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                    }`}
                                                    aria-label="Vista de lista"
                                                >
                                                    <ListIcon />
                                                </button>
                                                <button
                                                    onClick={() => setDirectoryView('grid')}
                                                    className={`ml-1 h-11 w-11 rounded-full transition ${
                                                        directoryView === 'grid'
                                                            ? 'bg-white text-slate-950'
                                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                    }`}
                                                    aria-label="Vista de cuadricula"
                                                >
                                                    <GridIcon />
                                                </button>
                                            </div>
                                            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">
                                                {customers.length} registros
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {directoryView === 'list' ? (
                                    <section className={`${surfaceClass} overflow-hidden`}>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full">
                                                <thead className="border-b border-white/10 bg-white/[0.03]">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Cliente</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Contacto</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Credito</th>
                                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Accion</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {customers.map((customer) => (
                                                        <tr key={customer.id} className="border-b border-white/5 transition hover:bg-white/[0.04]">
                                                            <td className="px-6 py-4 font-semibold text-white">{customer.name}</td>
                                                            <td className="px-6 py-4 text-sm text-slate-300">
                                                                {customer.contacts.map((contact) => contact.name).join(', ')}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${getCreditTone(customer.creditStatus)}`}>
                                                                    {customer.creditStatus}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => setSelectedCustomerId(customer.id)}
                                                                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-brand-200 transition hover:bg-white/10 hover:text-white"
                                                                >
                                                                    Abrir
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                ) : (
                                    <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                                        {customers.map((customer) => (
                                            <DirectoryCard
                                                key={customer.id}
                                                customer={customer}
                                                onClick={() => setSelectedCustomerId(customer.id)}
                                            />
                                        ))}
                                    </section>
                                )}
                            </div>
                        )}

                        {mainTab === 'messages' && (
                            <div className="space-y-6">
                                <section className={`${surfaceClass} p-5`}>
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className={labelClass}>Playbooks</p>
                                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Mensajeria y activacion</h2>
                                            <p className="mt-2 text-sm text-slate-400">
                                                Configura plantillas y arma campanas con foco directo en conversion.
                                            </p>
                                        </div>

                                        <div className="rounded-full border border-white/10 bg-white/5 p-1">
                                            <SegmentedButton active={messageSubTab === 'config'} onClick={() => setMessageSubTab('config')}>
                                                Configuracion
                                            </SegmentedButton>
                                            <SegmentedButton active={messageSubTab === 'campaigns'} onClick={() => setMessageSubTab('campaigns')}>
                                                Campanas
                                            </SegmentedButton>
                                        </div>
                                    </div>
                                </section>

                                {messageSubTab === 'config' && (
                                    <section className={`${surfaceClass} p-6`}>
                                        <div className="mb-6 flex items-start gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-400/10 text-sky-200">
                                                <SettingsIcon />
                                            </div>
                                            <div>
                                                <p className={labelClass}>Configuracion</p>
                                                <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Plantillas y tono comercial</h3>
                                            </div>
                                        </div>
                                        <MessageConfig data={data} />
                                    </section>
                                )}

                                {messageSubTab === 'campaigns' && (
                                    <section className={`${surfaceClass} p-6`}>
                                        <div className="mb-6 flex items-start gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-400/40 bg-brand-400/10 text-brand-200">
                                                <SparklesIcon />
                                            </div>
                                            <div>
                                                <p className={labelClass}>Activacion</p>
                                                <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Campanas de promocion</h3>
                                            </div>
                                        </div>
                                        <Promotions data={data} />
                                    </section>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const CustomerDetails: React.FC<{ data: BusinessData; customer: Customer }> = ({ data, customer }) => {
    const { updateCustomer } = data;
    const [customerData, setCustomerData] = useState<Partial<Customer>>(customer);
    const [newContactName, setNewContactName] = useState('');

    useEffect(() => setCustomerData(customer), [customer]);

    const handleBlur = () => {
        const updates = { ...customerData };
        if (updates.creditLimit) updates.creditLimit = Number(updates.creditLimit);
        updateCustomer(customer.id, updates);
    };

    const handleAddContact = () => {
        if (!newContactName.trim()) return;
        const updatedContacts = [...customer.contacts, { name: newContactName.trim(), isPrimary: false }];
        updateCustomer(customer.id, { contacts: updatedContacts });
        setNewContactName('');
    };

    const handleRemoveContact = (contactNameToRemove: string) => {
        const updatedContacts = customer.contacts.filter(
            (contact) => contact.name !== contactNameToRemove && !contact.isPrimary,
        );
        updateCustomer(customer.id, { contacts: updatedContacts });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                    <label className={`mb-2 block ${labelClass}`}>Nivel de confianza</label>
                    <select
                        value={customerData.creditStatus || ''}
                        onChange={(event) =>
                            setCustomerData((current) => ({ ...current, creditStatus: event.target.value as CreditStatus }))
                        }
                        onBlur={handleBlur}
                        className={inputClass}
                    >
                        {CREDIT_STATUSES.map((status) => (
                            <option key={status} value={status} className="bg-slate-900">
                                {status}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={`mb-2 block ${labelClass}`}>Limite de credito</label>
                    <input
                        type="number"
                        placeholder="Sin limite"
                        value={customerData.creditLimit || ''}
                        onChange={(event) =>
                            setCustomerData((current) => ({
                                ...current,
                                creditLimit: Number(event.target.value) || undefined,
                            }))
                        }
                        onBlur={handleBlur}
                        className={inputClass}
                        disabled={customerData.creditStatus !== 'Confiable'}
                    />
                </div>
            </div>

            <div className={`${surfaceClass} p-5`}>
                <p className={labelClass}>Contactos</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {customer.contacts.map((contact) => (
                        <div
                            key={contact.name}
                            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${
                                contact.isPrimary
                                    ? 'border-brand-300/30 bg-brand-300/10 text-brand-100'
                                    : 'border-white/10 bg-white/5 text-slate-200'
                            }`}
                        >
                            <span>{contact.name}</span>
                            {!contact.isPrimary && (
                                <button
                                    onClick={() => handleRemoveContact(contact.name)}
                                    className="text-slate-400 transition hover:text-rose-300"
                                >
                                    <XMarkIcon />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                        type="text"
                        value={newContactName}
                        onChange={(event) => setNewContactName(event.target.value)}
                        placeholder="Agregar contacto o apodo"
                        className={inputClass}
                    />
                    <button
                        onClick={handleAddContact}
                        className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand-400 px-4 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                    >
                        <PlusIcon />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr]">
                <div>
                    <label className={`mb-2 block ${labelClass}`}>Dias de compra</label>
                    <input
                        type="text"
                        placeholder="Lunes, Miercoles"
                        value={customerData.schedule?.days.join(', ') || ''}
                        onChange={(event) =>
                            setCustomerData((current) => ({
                                ...current,
                                schedule: {
                                    ...current.schedule,
                                    days: event.target.value.split(',').map((value) => value.trim()),
                                },
                            }))
                        }
                        onBlur={handleBlur}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className={`mb-2 block ${labelClass}`}>Ventana horaria</label>
                    <input
                        type="text"
                        placeholder="05:00 - 07:00"
                        value={customerData.schedule?.time || ''}
                        onChange={(event) =>
                            setCustomerData((current) => ({
                                ...current,
                                schedule: { ...current.schedule, time: event.target.value },
                            }))
                        }
                        onBlur={handleBlur}
                        className={inputClass}
                    />
                </div>
            </div>

            <div>
                <label className={`mb-2 block ${labelClass}`}>Notas de entrega</label>
                <textarea
                    value={customerData.deliveryNotes || ''}
                    onChange={(event) =>
                        setCustomerData((current) => ({ ...current, deliveryNotes: event.target.value }))
                    }
                    onBlur={handleBlur}
                    placeholder="Camioneta blanca, rampa C, llamada previa..."
                    rows={3}
                    className={inputClass}
                />
            </div>
        </div>
    );
};

const CustomerOrders: React.FC<{ data: BusinessData; customer: Customer }> = ({ data, customer }) => {
    const customerSales = useMemo(
        () =>
            data.sales
                .filter((sale) => saleBelongsToCustomer(sale, customer))
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
        [customer, data.sales],
    );

    return (
        <div className="space-y-3">
            {customerSales.length > 0 ? (
                customerSales.map((sale) => (
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
                    <p className="text-lg font-semibold text-white">Sin historial de pedidos.</p>
                    <p className="mt-2 text-sm text-slate-400">Todavia no hay ventas registradas para este cliente.</p>
                </div>
            )}
        </div>
    );
};

const CustomerCrates: React.FC<{ data: BusinessData; customer: Customer }> = ({ data, customer }) => {
    const { crateLoans, crateTypes, returnCrateLoan } = data;
    const customerLoans = useMemo(
        () =>
            crateLoans
                .filter((loan) => loanBelongsToCustomer(loan, customer))
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
        [crateLoans, customer],
    );

    return (
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
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="font-semibold text-white">
                                        {loan.quantity} x {crateType?.name || 'Caja'}
                                    </p>
                                    <p className={`mt-1 text-sm ${isOverdue ? 'text-rose-200' : 'text-amber-200'}`}>
                                        {loan.status} | Vence: {new Date(loan.dueDate).toLocaleDateString('es-MX')}
                                    </p>
                                </div>

                                {loan.status === 'Prestado' && (
                                    <button
                                        onClick={() => returnCrateLoan(loan.id)}
                                        className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-300/20 bg-brand-300/10 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-300/20"
                                        title="Registrar devolucion"
                                    >
                                        <ArrowUturnLeftIcon />
                                        Devolver
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                    <p className="text-lg font-semibold text-white">Sin cajas prestadas.</p>
                    <p className="mt-2 text-sm text-slate-400">No hay prestamos activos ni historial visible para esta cuenta.</p>
                </div>
            )}
        </div>
    );
};

const CustomerPrices: React.FC<{ data: BusinessData; customer: Customer }> = ({ data, customer }) => {
    const { productGroups, prices, qualities: qualityIcons, setSpecialPrice, stateIcons } = data;
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (key: string) =>
        setExpandedRows((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    const productVarietySizes = useMemo(
        () =>
            productGroups
                .filter((group) => !group.archived)
                .flatMap((group) =>
                    group.varieties
                        .filter((variety) => !variety.archived)
                        .flatMap((variety) => variety.sizes.map((size) => ({ group, variety, size }))),
                ),
        [productGroups],
    );

    const sellableStates: FruitState[] = ['Verde', 'Entrado', 'Maduro', 'Suave'];
    const sellableQualities: Quality[] = ['Normal', 'Con Defectos'];

    const handlePriceChange = (
        varietyId: string,
        size: string,
        quality: Quality,
        state: FruitState,
        price: string,
    ) => {
        const numericPrice = parseFloat(price);
        setSpecialPrice(customer.id, varietyId, size, quality, state, Number.isNaN(numericPrice) ? 0 : numericPrice);
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-400">
                Estos precios reemplazan el valor regular para este cliente cuando coinciden calidad y estado.
            </p>

            <div className="space-y-3">
                {productVarietySizes.map(({ group, variety, size }) => {
                    const productKey = `${variety.id}-${size}`;
                    const isExpanded = expandedRows.has(productKey);
                    const specialPricesForProduct = customer.specialPrices.filter(
                        (price) => price.varietyId === variety.id && price.size === size,
                    );

                    return (
                        <div key={productKey} className="rounded-[1.4rem] border border-white/10 bg-white/[0.03]">
                            <button
                                onClick={() => toggleRow(productKey)}
                                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.04]"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-400">
                                        {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                                    </span>
                                    <div>
                                        <p className="font-semibold text-white">
                                            {group.name} {variety.name}
                                        </p>
                                        <p className="text-sm text-slate-400">{size}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {specialPricesForProduct.length > 0 ? (
                                        <span className="rounded-full border border-brand-300/20 bg-brand-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-brand-100">
                                            {specialPricesForProduct.length} activo(s)
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-500">Sin override</span>
                                    )}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-white/10 px-4 py-4">
                                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                        {sellableQualities.map((quality) => (
                                            <div key={quality} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                                <h4 className="flex items-center gap-2 text-base font-black text-white">
                                                    <span className="text-lg">{qualityIcons[quality].icon}</span>
                                                    {quality}
                                                </h4>
                                                <div className="mt-4 space-y-3">
                                                    {sellableStates.map((state) => {
                                                        const specialPrice = specialPricesForProduct.find(
                                                            (price) => price.quality === quality && price.state === state,
                                                        )?.price;
                                                        const regularPrice = prices.find(
                                                            (price) =>
                                                                price.varietyId === variety.id &&
                                                                price.size === size &&
                                                                price.quality === quality &&
                                                                price.state === state,
                                                        )?.price;

                                                        return (
                                                            <div key={state} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px] md:items-center">
                                                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                                                                    <span className="text-lg">{stateIcons[state]}</span>
                                                                    {state}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    placeholder={regularPrice ? `Base: ${regularPrice}` : 'N/A'}
                                                                    defaultValue={specialPrice || ''}
                                                                    onBlur={(event) =>
                                                                        handlePriceChange(
                                                                            variety.id,
                                                                            size,
                                                                            quality,
                                                                            state,
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    className={inputClass}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Customers;
