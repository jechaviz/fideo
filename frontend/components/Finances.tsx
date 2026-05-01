import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { CashDrawer, CashDrawerActivity, Sale, TaskAssignment, TaskReport } from '../types';
import { findCustomerForSale, loanBelongsToCustomer } from '../utils/customerIdentity';

const surfaceClass = 'glass-panel-dark rounded-[1.8rem] border border-white/10';
const inputClass = 'mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-300/50 focus:outline-none';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const activityLabelMap: Record<string, string> = {
    INGRESO_VENTA: 'Ingreso',
    EGRESO_COMPRA: 'Compra',
    DEPOSITO_BANCO: 'Deposito',
    RETIRO_EFECTIVO: 'Retiro',
    SALDO_INICIAL: 'Apertura',
    CORTE_CIERRE: 'Corte',
};

const toValidDate = (value?: Date | string | null) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getAgeMinutes = (value?: Date | string | null) => {
    const date = toValidDate(value);
    if (!date) return null;
    return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
};

const formatAgeCompact = (value?: Date | string | null) => {
    const minutes = getAgeMinutes(value);
    if (minutes === null) return '';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
};

const parseDrawerDifference = (activity: CashDrawerActivity) => {
    const notes = activity.notes || '';
    const matched = notes.match(/Diferencia al cierre:\s*([+-]?\d+(?:\.\d+)?)/i);
    if (matched) return parseFloat(matched[1]);
    if (/diferencia al cierre/i.test(notes)) return activity.amount;
    return null;
};

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

type CashAttentionTone = 'critical' | 'warning' | 'info';

interface CashAttentionItem {
    id: string;
    title: string;
    detail: string;
    meta: string;
    tone: CashAttentionTone;
    amountLabel?: string;
    priority: number;
    timestamp?: Date | null;
}

const attentionToneClass: Record<CashAttentionTone, string> = {
    critical: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    info: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
};

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
    attentionItems: CashAttentionItem[];
    attentionSummary: { critical: number; warning: number; pending: number; hasOpenDrawer: boolean };
    emphasizeCashOps: boolean;
    onOpen: (id: string, balance: number) => void;
    onClose: (id: string, counted: number, notes?: string) => void;
}> = ({ drawer, activities, attentionItems, attentionSummary, emphasizeCashOps, onOpen, onClose }) => {
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
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-sky-200">
                            {emphasizeCashOps ? 'Cajero' : 'Caja operativa'}
                        </p>
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

            <section className={`${surfaceClass} p-5`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className={labelClass}>Atencion inmediata</p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Excepciones de caja</h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <span
                            className={`rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] ${
                                attentionSummary.critical > 0
                                    ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
                                    : 'border-white/10 bg-white/5 text-slate-300'
                            }`}
                        >
                            Criticas {attentionSummary.critical}
                        </span>
                        <span
                            className={`rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] ${
                                attentionSummary.warning > 0
                                    ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                                    : 'border-white/10 bg-white/5 text-slate-300'
                            }`}
                        >
                            Alertas {attentionSummary.warning}
                        </span>
                        <span
                            className={`rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] ${
                                attentionSummary.pending > 0
                                    ? 'border-sky-400/20 bg-sky-400/10 text-sky-200'
                                    : 'border-white/10 bg-white/5 text-slate-300'
                            }`}
                        >
                            Pendientes {attentionSummary.pending}
                        </span>
                        {attentionSummary.hasOpenDrawer && (
                            <span className="rounded-full border border-brand-400/20 bg-brand-400/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-brand-200">
                                Caja abierta
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    {attentionItems.length > 0 ? (
                        attentionItems.map((item) => (
                            <div
                                key={item.id}
                                className={`flex flex-col gap-3 rounded-[1.35rem] border p-4 md:flex-row md:items-center md:justify-between ${attentionToneClass[item.tone]}`}
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-white">{item.title}</p>
                                    <p className="mt-1 text-sm text-slate-200">{item.detail}</p>
                                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.24em] text-current/80">
                                        {item.meta}
                                    </p>
                                </div>
                                {item.amountLabel && (
                                    <p className="text-lg font-black text-white md:text-right">{item.amountLabel}</p>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-300">
                            Sin alertas inmediatas.
                        </div>
                    )}
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
        taskAssignments,
        taskReports,
        currentRole,
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
    const cashAttention = useMemo(() => {
        if (!primaryDrawer) {
            return {
                items: [] as CashAttentionItem[],
                summary: { critical: 0, warning: 0, pending: 0, hasOpenDrawer: false },
            };
        }

        const drawerActivities = cashDrawerActivities
            .filter((activity) => activity.drawerId === primaryDrawer.id)
            .sort(
                (left, right) =>
                    (toValidDate(right.timestamp)?.getTime() || 0) - (toValidDate(left.timestamp)?.getTime() || 0),
            );

        const cashTasks = (taskAssignments || [])
            .filter((task: TaskAssignment) => task.role === 'Cajero' && task.status !== 'done')
            .sort(
                (left, right) =>
                    (toValidDate(right.updatedAt)?.getTime() || 0) - (toValidDate(left.updatedAt)?.getTime() || 0),
            );

        const cashReports = (taskReports || [])
            .filter(
                (report: TaskReport) =>
                    report.role === 'Cajero' &&
                    (report.status === 'open' || report.severity === 'high' || report.escalationStatus !== 'none'),
            )
            .sort(
                (left, right) =>
                    (toValidDate(right.createdAt)?.getTime() || 0) - (toValidDate(left.createdAt)?.getTime() || 0),
            );

        const criticalItems: CashAttentionItem[] = [];
        const warningItems: CashAttentionItem[] = [];
        const infoItems: CashAttentionItem[] = [];
        let critical = 0;
        let warning = 0;
        let pending = 0;

        const pushItem = (item: CashAttentionItem) => {
            if (item.tone === 'critical') {
                critical += 1;
                criticalItems.push(item);
                return;
            }
            if (item.tone === 'warning') {
                warning += 1;
                warningItems.push(item);
                return;
            }
            pending += 1;
            infoItems.push(item);
        };

        const openedAt = toValidDate(primaryDrawer.lastOpened);
        const openedMinutes = getAgeMinutes(openedAt);
        if (primaryDrawer.status === 'Abierta' && openedMinutes !== null) {
            const tone: CashAttentionTone = openedMinutes >= 720 ? 'critical' : openedMinutes >= 360 ? 'warning' : 'info';
            pushItem({
                id: `drawer_open_${primaryDrawer.id}`,
                title: openedMinutes >= 720 ? 'Caja abierta prolongada' : 'Caja abierta',
                detail: `${primaryDrawer.name} sigue abierta.`,
                meta: `Abierta ${formatAgeCompact(openedAt)}`,
                tone,
                amountLabel: formatCurrency(primaryDrawer.balance),
                priority: tone === 'critical' ? 0 : tone === 'warning' ? 1 : 2,
                timestamp: openedAt,
            });
        }

        drawerActivities
            .map((activity) => ({ activity, difference: parseDrawerDifference(activity) }))
            .filter((entry) => entry.difference !== null)
            .slice(0, 2)
            .forEach(({ activity, difference }, index) => {
                const amount = difference || 0;
                const tone: CashAttentionTone = Math.abs(amount) >= 1000 ? 'critical' : 'warning';
                const timestamp = toValidDate(activity.timestamp);
                pushItem({
                    id: `drawer_diff_${activity.id}_${index}`,
                    title: amount < 0 ? 'Faltante al cierre' : amount > 0 ? 'Sobrante al cierre' : 'Diferencia al cierre',
                    detail: activity.notes || 'Revision de corte requerida.',
                    meta: timestamp ? `Detectada ${formatAgeCompact(timestamp)}` : 'Revision reciente',
                    tone,
                    amountLabel: formatCurrency(amount),
                    priority: tone === 'critical' ? 0 : 1,
                    timestamp,
                });
            });

        cashReports.slice(0, 3).forEach((report) => {
            const tone: CashAttentionTone =
                report.escalationStatus === 'pending' || report.severity === 'high' ? 'critical' : 'warning';
            const timestamp = toValidDate(report.createdAt);
            pushItem({
                id: `cash_report_${report.id}`,
                title:
                    report.escalationStatus === 'pending'
                        ? 'Escalacion de caja'
                        : report.kind === 'blocker'
                          ? 'Bloqueo reportado'
                          : 'Incidente de caja',
                detail: report.summary,
                meta: `${report.employeeName || 'Caja'}${timestamp ? ` / ${formatAgeCompact(timestamp)}` : ''}`,
                tone,
                priority: tone === 'critical' ? 0 : 1,
                timestamp,
            });
        });

        cashTasks.slice(0, 3).forEach((task) => {
            const createdAt = toValidDate(task.createdAt);
            const updatedAt = toValidDate(task.updatedAt);
            const withoutAck =
                task.status === 'assigned' && !task.acknowledgedAt && (getAgeMinutes(createdAt) || 0) >= 20;
            const tone: CashAttentionTone =
                task.status === 'blocked' ? 'critical' : withoutAck ? 'warning' : 'info';
            const metaSource = task.status === 'blocked' ? toValidDate(task.blockedAt) || updatedAt : createdAt;
            pushItem({
                id: `cash_task_${task.id}`,
                title:
                    task.status === 'blocked'
                        ? 'Bloqueo operativo'
                        : withoutAck
                          ? 'Sin acuse'
                          : 'Seguimiento de caja',
                detail: task.blockReason || task.title,
                meta:
                    task.employeeName || metaSource
                        ? `${task.employeeName || 'Cajero'}${metaSource ? ` / ${formatAgeCompact(metaSource)}` : ''}`
                        : 'Caja',
                tone,
                priority: tone === 'critical' ? 0 : tone === 'warning' ? 1 : 2,
                timestamp: metaSource,
            });
        });

        const relevantMovement = drawerActivities.find((activity) => {
            if (activity.type === 'INGRESO_VENTA' || activity.type === 'SALDO_INICIAL') return false;
            if (parseDrawerDifference(activity) !== null) return false;
            return (getAgeMinutes(activity.timestamp) || Number.MAX_SAFE_INTEGER) <= 720;
        });

        if (relevantMovement) {
            const timestamp = toValidDate(relevantMovement.timestamp);
            pushItem({
                id: `cash_event_${relevantMovement.id}`,
                title: 'Movimiento relevante',
                detail:
                    relevantMovement.notes ||
                    activityLabelMap[relevantMovement.type] ||
                    relevantMovement.type.replace(/_/g, ' '),
                meta: timestamp ? `${activityLabelMap[relevantMovement.type] || 'Caja'} / ${formatAgeCompact(timestamp)}` : 'Caja',
                tone: 'info',
                amountLabel: formatCurrency(relevantMovement.amount),
                priority: 3,
                timestamp,
            });
        }

        const items = [...criticalItems, ...warningItems, ...infoItems]
            .sort((left, right) => {
                if (left.priority !== right.priority) return left.priority - right.priority;
                return (right.timestamp?.getTime() || 0) - (left.timestamp?.getTime() || 0);
            })
            .slice(0, 5);

        return {
            items,
            summary: {
                critical,
                warning,
                pending,
                hasOpenDrawer: primaryDrawer.status === 'Abierta',
            },
        };
    }, [cashDrawerActivities, primaryDrawer, taskAssignments, taskReports]);

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
                        attentionItems={cashAttention.items}
                        attentionSummary={cashAttention.summary}
                        emphasizeCashOps={currentRole === 'Cajero'}
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
