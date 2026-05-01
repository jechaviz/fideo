import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { CrateLoan, Customer, PaymentMethod, PaymentStatus, Sale } from '../types';
import { findCustomerForSale, loanBelongsToCustomer } from '../utils/customerIdentity';

type TaskStatus = 'assigned' | 'acknowledged' | 'in_progress' | 'blocked' | 'done';

interface TaskAssignment {
    id: string;
    kind: string;
    role: string;
    status: TaskStatus;
    saleId: string;
    employeeId?: string;
    title: string;
    description: string;
    blockReason?: string;
}

interface TaskViewBridge {
    taskAssignments?: TaskAssignment[];
    authProfile?: {
        employeeId?: string | null;
        name?: string | null;
    } | null;
    acknowledgeTask?: (taskId: string) => void;
    startTask?: (taskId: string) => void;
    blockTask?: (taskId: string, reason: string) => void;
}

const surfaceClass = 'glass-panel-dark rounded-[1.6rem] border border-white/10';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';
const fieldClass =
    'mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20';
const secondaryButtonClass =
    'inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white';

const statusMeta: Record<TaskStatus, { label: string; tone: string }> = {
    assigned: {
        label: 'Asignada',
        tone: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    },
    acknowledged: {
        label: 'Lista',
        tone: 'border-brand-400/20 bg-brand-400/10 text-brand-200',
    },
    in_progress: {
        label: 'En ruta',
        tone: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    },
    blocked: {
        label: 'Bloqueada',
        tone: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    },
    done: {
        label: 'Cerrada',
        tone: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    },
};

const statusRank: Record<TaskStatus, number> = {
    in_progress: 0,
    acknowledged: 1,
    assigned: 2,
    blocked: 3,
    done: 4,
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() || '';

const isDelivererTask = (task: TaskAssignment) => normalize(task.role) === 'repartidor';

const formatTaskTime = (sale?: Sale) =>
    sale ? new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--:--';

const buildSaleSummary = (sale?: Sale) =>
    sale ? `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} (${sale.size})` : null;

const CompleteDeliveryModal: React.FC<{
    sale: Sale;
    isOpen: boolean;
    onClose: () => void;
    onComplete: (saleId: string, paymentStatus: PaymentStatus, paymentMethod: PaymentMethod, paymentNotes?: string) => void;
}> = ({ sale, isOpen, onClose, onComplete }) => {
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pagado');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
    const [paymentNotes, setPaymentNotes] = useState('');

    if (!isOpen) return null;

    const handlePaymentStatusChange = (nextStatus: PaymentStatus) => {
        setPaymentStatus(nextStatus);
        if (nextStatus === 'En Deuda') {
            setPaymentMethod('N/A');
        } else if (paymentMethod === 'N/A') {
            setPaymentMethod('Efectivo');
        }
    };

    const handleSubmit = () => {
        onComplete(sale.id, paymentStatus, paymentMethod, paymentNotes);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${surfaceClass} w-full max-w-md p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-sky-300">Cierre de ruta</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Confirmar entrega</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Registra el resultado para <span className="font-bold text-white">{sale.customer}</span>.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Resultado</label>
                        <select
                            value={paymentStatus}
                            onChange={(event) => handlePaymentStatusChange(event.target.value as PaymentStatus)}
                            className={fieldClass}
                        >
                            <option value="Pagado">Pagado</option>
                            <option value="En Deuda">En deuda</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Metodo de pago</label>
                        <select
                            value={paymentMethod}
                            onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                            className={fieldClass}
                            disabled={paymentStatus === 'En Deuda'}
                        >
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Notas</label>
                        <textarea
                            value={paymentNotes}
                            onChange={(event) => setPaymentNotes(event.target.value)}
                            rows={3}
                            placeholder={paymentStatus === 'En Deuda' ? 'Ej. paga el lunes' : 'Opcional'}
                            className={`${fieldClass} resize-none`}
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className={secondaryButtonClass}>
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300"
                    >
                        Finalizar entrega
                    </button>
                </div>
            </div>
        </div>
    );
};

const BlockTaskModal: React.FC<{
    task: TaskAssignment | null;
    reason: string;
    onReasonChange: (value: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ task, reason, onReasonChange, onClose, onConfirm }) => {
    if (!task) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${surfaceClass} w-full max-w-md p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-rose-300">Bloqueo</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Reportar incidencia</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Deja contexto para la tarea <span className="font-bold text-white">{task.title}</span>.
                    </p>
                </div>

                <div>
                    <label className={labelClass}>Motivo</label>
                    <textarea
                        value={reason}
                        onChange={(event) => onReasonChange(event.target.value)}
                        rows={3}
                        placeholder="Ej. cliente ausente o direccion cerrada"
                        className="mt-2 block w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-rose-400/40 focus:ring-2 focus:ring-rose-400/20"
                    />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className={secondaryButtonClass}>
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!reason.trim()}
                        className="rounded-2xl bg-rose-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Guardar bloqueo
                    </button>
                </div>
            </div>
        </div>
    );
};

const SectionHeader: React.FC<{ title: string; count: number }> = ({ title, count }) => (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
            <p className={labelClass}>Ruta</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{title}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm font-black text-white">
            {count}
        </span>
    </div>
);

const EmptySection: React.FC<{ title: string }> = ({ title }) => (
    <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
        <p className="text-sm font-semibold text-white">{title}</p>
    </div>
);

const DelivererTaskCard: React.FC<{
    task: TaskAssignment;
    sale?: Sale;
    customerDetails?: Customer;
    crateLoans: CrateLoan[];
    onAcknowledge?: (taskId: string) => void;
    onStart?: (taskId: string) => void;
    onBlock?: (task: TaskAssignment) => void;
    onCompleteClick: (sale: Sale) => void;
}> = ({ task, sale, customerDetails, crateLoans, onAcknowledge, onStart, onBlock, onCompleteClick }) => {
    const location = sale?.locationQuery || sale?.destination;
    const mapUrl = location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;
    const saleSummary = buildSaleSummary(sale);
    const pendingCrates = useMemo(
        () => (customerDetails ? crateLoans.filter((loan) => loanBelongsToCustomer(loan, customerDetails) && loan.status === 'Prestado') : []),
        [crateLoans, customerDetails],
    );

    return (
        <div className="flex h-full flex-col justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/15 hover:bg-white/[0.06]">
            <div>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className={labelClass}>{task.kind || 'task'}</p>
                        <h3 className="mt-2 truncate text-lg font-black tracking-tight text-white">
                            {sale?.customer || task.title}
                        </h3>
                        {saleSummary ? <p className="mt-1 text-sm text-slate-300">{saleSummary}</p> : null}
                    </div>
                    <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${statusMeta[task.status].tone}`}
                    >
                        {statusMeta[task.status].label}
                    </span>
                </div>

                {task.description ? <p className="mt-4 text-sm leading-6 text-slate-400">{task.description}</p> : null}

                <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className={labelClass}>Destino</p>
                            <p className="mt-2 text-sm text-slate-200">{sale?.destination || 'Pendiente de integracion'}</p>
                        </div>
                        <p className="text-xs font-mono text-slate-500">{formatTaskTime(sale)}</p>
                    </div>
                </div>

                {customerDetails?.deliveryNotes ? (
                    <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-200">Notas</p>
                        <p className="mt-2 text-sm italic text-sky-50">{customerDetails.deliveryNotes}</p>
                    </div>
                ) : null}

                {pendingCrates.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                        <p className="text-sm font-bold text-amber-100">
                            Recoger {pendingCrates.reduce((sum, loan) => sum + loan.quantity, 0)} caja(s).
                        </p>
                    </div>
                ) : null}

                {task.status === 'blocked' && task.blockReason ? (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-200">Motivo</p>
                        <p className="mt-2 text-sm text-rose-100">{task.blockReason}</p>
                    </div>
                ) : null}

                {!sale ? (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                        <p className="text-sm font-semibold text-amber-100">Venta pendiente de integracion.</p>
                    </div>
                ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
                {task.status === 'assigned' && onAcknowledge ? (
                    <button
                        onClick={() => onAcknowledge(task.id)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-brand-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                    >
                        Aceptar
                    </button>
                ) : null}

                {task.status === 'acknowledged' && onStart ? (
                    <button
                        onClick={() => onStart(task.id)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300"
                    >
                        Iniciar ruta
                    </button>
                ) : null}

                {task.status === 'in_progress' ? (
                    <button
                        onClick={() => sale && onCompleteClick(sale)}
                        disabled={!sale}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Completar
                    </button>
                ) : null}

                {task.status !== 'blocked' && onBlock ? (
                    <button onClick={() => onBlock(task)} className={secondaryButtonClass}>
                        Bloquear
                    </button>
                ) : null}

                {mapUrl ? (
                    <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                        title="Abrir mapa"
                    >
                        <i className="fa-solid fa-map-location-dot"></i>
                    </a>
                ) : null}
            </div>
        </div>
    );
};

const DelivererView: React.FC<{ data: BusinessData }> = ({ data }) => {
    const taskData = data as BusinessData & TaskViewBridge;
    const { completeSale, crateLoans, customers, sales } = data;
    const { acknowledgeTask, authProfile, blockTask, startTask, taskAssignments = [] } = taskData;

    const [completeModal, setCompleteModal] = useState<Sale | null>(null);
    const [blockingTask, setBlockingTask] = useState<TaskAssignment | null>(null);
    const [blockReason, setBlockReason] = useState('');

    const currentEmployeeId = authProfile?.employeeId || null;

    const salesById = useMemo(() => new Map(sales.map((sale) => [sale.id, sale])), [sales]);

    const deliveryTasks = useMemo(() => {
        return taskAssignments
            .filter((task) => {
                if (!isDelivererTask(task) || task.status === 'done') return false;
                if (!currentEmployeeId) return false;
                if (task.employeeId !== currentEmployeeId) return false;

                const sale = salesById.get(task.saleId);
                if (!sale) return true;
                if (sale.status === 'Completado' || sale.status === 'Cancelado') return false;
                return true;
            })
            .sort((left, right) => {
                const rankDiff = statusRank[left.status] - statusRank[right.status];
                if (rankDiff !== 0) return rankDiff;

                const leftTime = salesById.get(left.saleId)?.timestamp
                    ? new Date(salesById.get(left.saleId)!.timestamp).getTime()
                    : 0;
                const rightTime = salesById.get(right.saleId)?.timestamp
                    ? new Date(salesById.get(right.saleId)!.timestamp).getTime()
                    : 0;
                return leftTime - rightTime;
            });
    }, [currentEmployeeId, salesById, taskAssignments]);

    const pendingTasks = useMemo(
        () => deliveryTasks.filter((task) => task.status === 'assigned' || task.status === 'acknowledged'),
        [deliveryTasks],
    );
    const activeTasks = useMemo(
        () => deliveryTasks.filter((task) => task.status === 'in_progress'),
        [deliveryTasks],
    );
    const blockedTasks = useMemo(
        () => deliveryTasks.filter((task) => task.status === 'blocked'),
        [deliveryTasks],
    );

    const handleBlockOpen = (task: TaskAssignment) => {
        setBlockingTask(task);
        setBlockReason(task.blockReason || '');
    };

    const handleBlockClose = () => {
        setBlockingTask(null);
        setBlockReason('');
    };

    const handleConfirmBlock = () => {
        if (!blockingTask || !blockTask || !blockReason.trim()) return;
        blockTask(blockingTask.id, blockReason.trim());
        handleBlockClose();
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_30%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-sky-200">Ruta</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Mis tareas</h1>
                        <p className="mt-4 text-sm leading-6 text-slate-300">
                            {authProfile?.name ? `Panel activo para ${authProfile.name}.` : 'Panel operativo del repartidor.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[540px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Pendientes</p>
                            <p className="mt-2 text-3xl font-black text-white">{pendingTasks.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>En ruta</p>
                            <p className="mt-2 text-3xl font-black text-white">{activeTasks.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Bloqueadas</p>
                            <p className="mt-2 text-3xl font-black text-white">{blockedTasks.length}</p>
                        </div>
                    </div>
                </div>
            </section>

            {!currentEmployeeId ? (
                <section className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                    <p className="text-xl font-bold text-white">Sin repartidor autenticado.</p>
                    <p className="mt-2 text-sm text-slate-400">No hay un `employeeId` disponible para filtrar las tareas.</p>
                </section>
            ) : deliveryTasks.length > 0 ? (
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1.15fr_0.8fr]">
                    <div className={`${surfaceClass} p-5`}>
                        <SectionHeader title="Pendientes" count={pendingTasks.length} />
                        <div className="space-y-4">
                            {pendingTasks.length > 0 ? (
                                pendingTasks.map((task) => {
                                    const sale = salesById.get(task.saleId);
                                    const customerDetails = sale ? findCustomerForSale(customers, sale) : undefined;
                                    return (
                                        <DelivererTaskCard
                                            key={task.id}
                                            task={task}
                                            sale={sale}
                                            customerDetails={customerDetails}
                                            crateLoans={crateLoans}
                                            onAcknowledge={acknowledgeTask}
                                            onStart={startTask}
                                            onBlock={blockTask ? handleBlockOpen : undefined}
                                            onCompleteClick={setCompleteModal}
                                        />
                                    );
                                })
                            ) : (
                                <EmptySection title="No hay tareas por tomar." />
                            )}
                        </div>
                    </div>

                    <div className={`${surfaceClass} p-5`}>
                        <SectionHeader title="En ruta" count={activeTasks.length} />
                        <div className="space-y-4">
                            {activeTasks.length > 0 ? (
                                activeTasks.map((task) => {
                                    const sale = salesById.get(task.saleId);
                                    const customerDetails = sale ? findCustomerForSale(customers, sale) : undefined;
                                    return (
                                        <DelivererTaskCard
                                            key={task.id}
                                            task={task}
                                            sale={sale}
                                            customerDetails={customerDetails}
                                            crateLoans={crateLoans}
                                            onAcknowledge={acknowledgeTask}
                                            onStart={startTask}
                                            onBlock={blockTask ? handleBlockOpen : undefined}
                                            onCompleteClick={setCompleteModal}
                                        />
                                    );
                                })
                            ) : (
                                <EmptySection title="No tienes entregas en curso." />
                            )}
                        </div>
                    </div>

                    <div className={`${surfaceClass} p-5`}>
                        <SectionHeader title="Bloqueos" count={blockedTasks.length} />
                        <div className="space-y-4">
                            {blockedTasks.length > 0 ? (
                                blockedTasks.map((task) => {
                                    const sale = salesById.get(task.saleId);
                                    const customerDetails = sale ? findCustomerForSale(customers, sale) : undefined;
                                    return (
                                        <DelivererTaskCard
                                            key={task.id}
                                            task={task}
                                            sale={sale}
                                            customerDetails={customerDetails}
                                            crateLoans={crateLoans}
                                            onAcknowledge={acknowledgeTask}
                                            onStart={startTask}
                                            onBlock={undefined}
                                            onCompleteClick={setCompleteModal}
                                        />
                                    );
                                })
                            ) : (
                                <EmptySection title="Sin incidencias activas." />
                            )}
                        </div>
                    </div>
                </section>
            ) : (
                <section className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                    <p className="text-xl font-bold text-white">Ruta despejada.</p>
                    <p className="mt-2 text-sm text-slate-400">No tienes tareas de reparto activas en este momento.</p>
                </section>
            )}

            {completeModal ? (
                <CompleteDeliveryModal
                    sale={completeModal}
                    isOpen={Boolean(completeModal)}
                    onClose={() => setCompleteModal(null)}
                    onComplete={completeSale}
                />
            ) : null}

            <BlockTaskModal
                task={blockingTask}
                reason={blockReason}
                onReasonChange={setBlockReason}
                onClose={handleBlockClose}
                onConfirm={handleConfirmBlock}
            />
        </div>
    );
};

export default DelivererView;
