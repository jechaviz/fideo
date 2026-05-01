import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { CrateLoan, Customer, PaymentMethod, PaymentStatus, Sale, TaskAssignment as SharedTaskAssignment, TaskStatus } from '../types';
import { findCustomerForSale, loanBelongsToCustomer } from '../utils/customerIdentity';

type TaskReportType = 'note' | 'incident' | 'closure';
type MaybePromise = void | Promise<void>;

interface TaskReportEntry {
    id?: string;
    type: TaskReportType;
    message: string;
    createdAt?: Date | string;
    authorId?: string | null;
    authorName?: string | null;
}

type DelivererTask = SharedTaskAssignment & {
    reports?: TaskReportEntry[];
};

interface TaskReportPayload {
    type: TaskReportType;
    message: string;
    createdAt: Date;
    authorId?: string | null;
    authorName?: string | null;
}

interface TaskViewBridge {
    taskAssignments?: DelivererTask[];
    authProfile?: {
        employeeId?: string | null;
        name?: string | null;
    } | null;
    acknowledgeTask?: (taskId: string) => void;
    startTask?: (taskId: string) => void;
    submitTaskReport?: (taskId: string, report: TaskReportPayload) => MaybePromise;
    blockTask?: (taskId: string, reason: string) => MaybePromise;
    completeTask?: (taskId: string) => MaybePromise;
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

const reportMeta: Record<
    TaskReportType,
    { label: string; chipTone: string; buttonTone: string; placeholder: string; focusTone: string }
> = {
    note: {
        label: 'Nota',
        chipTone: 'border-brand-400/20 bg-brand-400/10 text-brand-200',
        buttonTone: 'bg-brand-400 text-slate-950 hover:bg-brand-300',
        placeholder: 'Ej. cliente confirma recibo o deja instruccion breve',
        focusTone: 'focus:border-brand-400/40 focus:ring-brand-400/20',
    },
    incident: {
        label: 'Incidencia',
        chipTone: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
        buttonTone: 'bg-rose-400 text-slate-950 hover:bg-rose-300',
        placeholder: 'Ej. cliente ausente, acceso cerrado o direccion no responde',
        focusTone: 'focus:border-rose-400/40 focus:ring-rose-400/20',
    },
    closure: {
        label: 'Cierre',
        chipTone: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
        buttonTone: 'bg-emerald-400 text-slate-950 hover:bg-emerald-300',
        placeholder: 'Ej. entrega hecha, recibio porteria o entrega parcial confirmada',
        focusTone: 'focus:border-emerald-400/40 focus:ring-emerald-400/20',
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

const isDelivererTask = (task: DelivererTask) => normalize(task.role) === 'repartidor';

const formatTaskTime = (sale?: Sale) =>
    sale ? new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--:--';

const buildSaleSummary = (sale?: Sale) =>
    sale ? `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} (${sale.size})` : null;

const getDateValue = (value?: Date | string | null) => {
    if (!value) return 0;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatTaskTimestamp = (value?: Date | string | null) => {
    if (!value) return 'Sin registro';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin registro';

    const now = new Date();
    const sameDay =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    return sameDay
        ? date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleString('es-MX', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
          });
};

const getTaskCheckpoint = (task: DelivererTask) => {
    switch (task.status) {
        case 'assigned':
            return { label: 'Asignada', time: formatTaskTimestamp(task.updatedAt) };
        case 'acknowledged':
            return { label: 'Tomada', time: formatTaskTimestamp(task.acknowledgedAt || task.updatedAt) };
        case 'in_progress':
            return { label: 'En ruta', time: formatTaskTimestamp(task.startedAt || task.updatedAt) };
        case 'blocked':
            return { label: 'Bloqueada', time: formatTaskTimestamp(task.blockedAt || task.updatedAt) };
        case 'done':
            return { label: 'Cerrada', time: formatTaskTimestamp(task.completedAt || task.updatedAt) };
        default:
            return { label: 'Activa', time: formatTaskTimestamp(task.updatedAt) };
    }
};

const getTaskOwnerLabel = (task: DelivererTask, viewerEmployeeId?: string | null, viewerName?: string | null) => {
    if (task.employeeName) return task.employeeName;
    if (task.employeeId && viewerEmployeeId && task.employeeId === viewerEmployeeId) return viewerName || 'Tu ruta';
    if (task.employeeId) return 'Asignado';
    return 'Sin asignar';
};

const getTaskOwnerCaption = (task: DelivererTask, viewerEmployeeId?: string | null) => {
    if (!task.employeeId) return 'Pendiente de ownership';
    if (viewerEmployeeId && task.employeeId === viewerEmployeeId) return 'Ownership activo';
    return 'Asignacion confirmada';
};

const getAvailableReportTypes = (
    task: DelivererTask | null,
    capabilities: Pick<TaskViewBridge, 'submitTaskReport' | 'blockTask' | 'completeTask'>,
) => {
    const available: TaskReportType[] = [];

    if (capabilities.submitTaskReport) {
        available.push('note');
    }

    if (task && task.status !== 'blocked' && capabilities.blockTask) {
        available.push('incident');
    }

    if (task && task.status === 'in_progress' && capabilities.completeTask) {
        available.push('closure');
    }

    return available;
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

const TaskReportModal: React.FC<{
    task: DelivererTask | null;
    reportType: TaskReportType;
    availableTypes: TaskReportType[];
    message: string;
    error?: string | null;
    submitting: boolean;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    onTypeChange: (type: TaskReportType) => void;
    onMessageChange: (value: string) => void;
    onPaymentStatusChange: (value: PaymentStatus) => void;
    onPaymentMethodChange: (value: PaymentMethod) => void;
    onClose: () => void;
    onSubmit: () => void;
}> = ({
    task,
    reportType,
    availableTypes,
    message,
    error,
    submitting,
    paymentStatus,
    paymentMethod,
    onTypeChange,
    onMessageChange,
    onPaymentStatusChange,
    onPaymentMethodChange,
    onClose,
    onSubmit,
}) => {
    if (!task) return null;

    const activeMeta = reportMeta[reportType];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${surfaceClass} w-full max-w-lg p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-sky-300">Seguimiento</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Actualizar tarea</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        {task.customerName || task.title}
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {(['note', 'incident', 'closure'] as TaskReportType[]).map((type) => {
                        const meta = reportMeta[type];
                        const isActive = type === reportType;
                        const isAvailable = availableTypes.includes(type);

                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => onTypeChange(type)}
                                disabled={!isAvailable || submitting}
                                className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                                    isActive
                                        ? `${meta.chipTone} border-current`
                                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                } disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                                {meta.label}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-5">
                    <label className={labelClass}>{activeMeta.label}</label>
                    <textarea
                        value={message}
                        onChange={(event) => onMessageChange(event.target.value)}
                        rows={4}
                        placeholder={activeMeta.placeholder}
                        className={`${fieldClass} resize-none ${activeMeta.focusTone}`}
                    />
                    {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
                </div>

                {reportType === 'closure' ? (
                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className={labelClass}>Cobro</label>
                            <select
                                value={paymentStatus}
                                onChange={(event) => onPaymentStatusChange(event.target.value as PaymentStatus)}
                                className={fieldClass}
                            >
                                <option value="Pagado">Pagado</option>
                                <option value="En Deuda">En deuda</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Metodo</label>
                            <select
                                value={paymentMethod}
                                onChange={(event) => onPaymentMethodChange(event.target.value as PaymentMethod)}
                                className={fieldClass}
                                disabled={paymentStatus === 'En Deuda'}
                            >
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="N/A">N/A</option>
                            </select>
                        </div>
                    </div>
                ) : null}

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} disabled={submitting} className={secondaryButtonClass}>
                        Cancelar
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={!message.trim() || submitting}
                        className={`rounded-2xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${activeMeta.buttonTone}`}
                    >
                        {submitting ? 'Guardando...' : activeMeta.label}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DelivererTaskCard: React.FC<{
    task: DelivererTask;
    sale?: Sale;
    customerDetails?: Customer;
    crateLoans: CrateLoan[];
    viewerEmployeeId?: string | null;
    viewerName?: string | null;
    canAddNote: boolean;
    canReportIncident: boolean;
    canCloseTask: boolean;
    onAcknowledge?: (taskId: string) => void;
    onStart?: (taskId: string) => void;
    onOpenReport: (task: DelivererTask, type: TaskReportType) => void;
}> = ({
    task,
    sale,
    customerDetails,
    crateLoans,
    viewerEmployeeId,
    viewerName,
    canAddNote,
    canReportIncident,
    canCloseTask,
    onAcknowledge,
    onStart,
    onOpenReport,
}) => {
    const location = sale?.locationQuery || sale?.destination;
    const mapUrl = location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;
    const saleSummary = buildSaleSummary(sale);
    const taskCheckpoint = getTaskCheckpoint(task);
    const ownerLabel = getTaskOwnerLabel(task, viewerEmployeeId, viewerName);
    const ownerCaption = getTaskOwnerCaption(task, viewerEmployeeId);

    const pendingCrates = useMemo(
        () => (customerDetails ? crateLoans.filter((loan) => loanBelongsToCustomer(loan, customerDetails) && loan.status === 'Prestado') : []),
        [crateLoans, customerDetails],
    );

    const reportFeed = useMemo(() => {
        const reports = [...(task.reports || [])]
            .sort((left, right) => getDateValue(right.createdAt) - getDateValue(left.createdAt))
            .slice(0, 2);

        if (reports.length > 0) return reports;

        if (task.status === 'blocked' && task.blockReason) {
            return [
                {
                    id: `${task.id}_blocked`,
                    type: 'incident' as const,
                    message: task.blockReason,
                    createdAt: task.blockedAt || task.updatedAt,
                    authorName: task.employeeName || null,
                },
            ];
        }

        return [];
    }, [task.blockReason, task.blockedAt, task.employeeName, task.id, task.reports, task.status, task.updatedAt]);

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

                <div className="mt-4 grid gap-3 rounded-2xl border border-white/8 bg-slate-950/60 p-4 sm:grid-cols-3">
                    <div className="min-w-0">
                        <p className={labelClass}>Destino</p>
                        <p className="mt-2 text-sm text-slate-200">{sale?.destination || 'Pendiente de integracion'}</p>
                        <p className="mt-1 text-xs font-mono text-slate-500">{formatTaskTime(sale)}</p>
                    </div>
                    <div className="min-w-0">
                        <p className={labelClass}>Responsable</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold text-white">{ownerLabel}</p>
                            {viewerEmployeeId && task.employeeId === viewerEmployeeId ? (
                                <span className="rounded-full border border-brand-400/20 bg-brand-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-200">
                                    Tuya
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{ownerCaption}</p>
                    </div>
                    <div className="min-w-0">
                        <p className={labelClass}>Seguimiento</p>
                        <p className="mt-2 text-sm font-semibold text-white">{taskCheckpoint.label}</p>
                        <p className="mt-1 text-xs text-slate-400">{taskCheckpoint.time}</p>
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

                {reportFeed.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className={labelClass}>Reportes</p>
                        <div className="mt-3 space-y-3">
                            {reportFeed.map((report, index) => (
                                <div key={report.id || `${task.id}_report_${index}`} className="rounded-2xl border border-white/8 bg-slate-950/50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <span
                                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${reportMeta[report.type].chipTone}`}
                                        >
                                            {reportMeta[report.type].label}
                                        </span>
                                        <span className="text-xs text-slate-500">{formatTaskTimestamp(report.createdAt)}</span>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-slate-200">{report.message}</p>
                                    {report.authorName ? <p className="mt-2 text-xs text-slate-500">{report.authorName}</p> : null}
                                </div>
                            ))}
                        </div>
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

                {task.status === 'in_progress' && canCloseTask ? (
                    <button
                        onClick={() => onOpenReport(task, 'closure')}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                    >
                        Cerrar
                    </button>
                ) : null}

                {canAddNote ? (
                    <button onClick={() => onOpenReport(task, 'note')} className={secondaryButtonClass}>
                        Nota
                    </button>
                ) : null}

                {task.status !== 'blocked' && canReportIncident ? (
                    <button onClick={() => onOpenReport(task, 'incident')} className={secondaryButtonClass}>
                        Incidencia
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
    const { acknowledgeTask, authProfile, blockTask, completeTask, startTask, submitTaskReport, taskAssignments = [] } = taskData;

    const [reportingTask, setReportingTask] = useState<DelivererTask | null>(null);
    const [reportType, setReportType] = useState<TaskReportType>('note');
    const [reportMessage, setReportMessage] = useState('');
    const [reportError, setReportError] = useState<string | null>(null);
    const [submittingReport, setSubmittingReport] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pagado');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');

    const currentEmployeeId = authProfile?.employeeId || null;
    const currentEmployeeName = authProfile?.name || null;
    const hasTaskIdentity = Boolean(currentEmployeeId || normalize(currentEmployeeName));

    const salesById = useMemo(() => new Map(sales.map((sale) => [sale.id, sale])), [sales]);

    const deliveryTasks = useMemo(() => {
        return taskAssignments
            .filter((task) => {
                if (!isDelivererTask(task) || task.status === 'done') return false;
                if (!hasTaskIdentity) return false;

                const matchesEmployeeById = Boolean(currentEmployeeId && task.employeeId === currentEmployeeId);
                const matchesEmployeeByName = Boolean(currentEmployeeName && normalize(task.employeeName) === normalize(currentEmployeeName));
                if (!matchesEmployeeById && !matchesEmployeeByName) return false;

                const sale = salesById.get(task.saleId || '');
                if (!sale) return true;
                if (sale.status === 'Completado' || sale.status === 'Cancelado') return false;
                return true;
            })
            .sort((left, right) => {
                const rankDiff = statusRank[left.status] - statusRank[right.status];
                if (rankDiff !== 0) return rankDiff;

                const leftTime = salesById.get(left.saleId || '')?.timestamp
                    ? new Date(salesById.get(left.saleId || '')!.timestamp).getTime()
                    : 0;
                const rightTime = salesById.get(right.saleId || '')?.timestamp
                    ? new Date(salesById.get(right.saleId || '')!.timestamp).getTime()
                    : 0;
                return leftTime - rightTime;
            });
    }, [currentEmployeeId, currentEmployeeName, hasTaskIdentity, salesById, taskAssignments]);

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

    const modalAvailableTypes = getAvailableReportTypes(reportingTask, { submitTaskReport, blockTask, completeTask });

    const handleOpenReport = (task: DelivererTask, preferredType: TaskReportType) => {
        const availableTypes = getAvailableReportTypes(task, { submitTaskReport, blockTask, completeTask });
        if (availableTypes.length === 0) return;

        setReportingTask(task);
        setReportType(availableTypes.includes(preferredType) ? preferredType : availableTypes[0]);
        setReportMessage(preferredType === 'incident' ? task.blockReason || '' : '');
        setPaymentStatus('Pagado');
        setPaymentMethod('Efectivo');
        setReportError(null);
    };

    const handleCloseReport = () => {
        setReportingTask(null);
        setReportType('note');
        setReportMessage('');
        setPaymentStatus('Pagado');
        setPaymentMethod('Efectivo');
        setReportError(null);
        setSubmittingReport(false);
    };

    const handleSubmitReport = async () => {
        if (!reportingTask) return;

        const trimmedMessage = reportMessage.trim();
        if (!trimmedMessage) return;

        setSubmittingReport(true);
        setReportError(null);

        try {
            const payload: TaskReportPayload = {
                type: reportType,
                message: trimmedMessage,
                createdAt: new Date(),
                authorId: currentEmployeeId,
                authorName: currentEmployeeName,
            };

            if (submitTaskReport) {
                await Promise.resolve(submitTaskReport(reportingTask.id, payload));
            }

            if (reportType === 'incident' && blockTask) {
                await Promise.resolve(blockTask(reportingTask.id, trimmedMessage));
            }

            if (reportType === 'closure' && completeTask) {
                const sale = salesById.get(reportingTask.saleId || '');
                if (sale) {
                    await Promise.resolve(
                        completeSale(
                            sale.id,
                            paymentStatus,
                            paymentStatus === 'En Deuda' ? 'N/A' : paymentMethod,
                            trimmedMessage,
                        ),
                    );
                }
                await Promise.resolve(completeTask(reportingTask.id));
            }

            handleCloseReport();
        } catch (error) {
            console.error('No se pudo guardar el seguimiento de la tarea.', error);
            setReportError('No se pudo guardar el seguimiento.');
            setSubmittingReport(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_30%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-sky-200">Ruta</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Mis tareas</h1>
                        <p className="mt-4 text-sm leading-6 text-slate-300">
                            {authProfile?.name
                                ? `Panel activo para ${authProfile.name}. Ownership y estado siempre visibles.`
                                : 'Panel operativo del repartidor.'}
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

            {!hasTaskIdentity ? (
                <section className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                    <p className="text-xl font-bold text-white">Sin repartidor autenticado.</p>
                    <p className="mt-2 text-sm text-slate-400">
                        No hay `employeeId` o nombre de empleado disponible para filtrar ownership.
                    </p>
                </section>
            ) : deliveryTasks.length > 0 ? (
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1.15fr_0.8fr]">
                    <div className={`${surfaceClass} p-5`}>
                        <SectionHeader title="Pendientes" count={pendingTasks.length} />
                        <div className="space-y-4">
                            {pendingTasks.length > 0 ? (
                                pendingTasks.map((task) => {
                                    const sale = salesById.get(task.saleId || '');
                                    const customerDetails = sale ? findCustomerForSale(customers, sale) : undefined;

                                    return (
                                        <DelivererTaskCard
                                            key={task.id}
                                            task={task}
                                            sale={sale}
                                            customerDetails={customerDetails}
                                            crateLoans={crateLoans}
                                            viewerEmployeeId={currentEmployeeId}
                                            viewerName={currentEmployeeName}
                                            canAddNote={Boolean(submitTaskReport)}
                                            canReportIncident={Boolean(blockTask)}
                                            canCloseTask={Boolean(completeTask)}
                                            onAcknowledge={acknowledgeTask}
                                            onStart={startTask}
                                            onOpenReport={handleOpenReport}
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
                                    const sale = salesById.get(task.saleId || '');
                                    const customerDetails = sale ? findCustomerForSale(customers, sale) : undefined;

                                    return (
                                        <DelivererTaskCard
                                            key={task.id}
                                            task={task}
                                            sale={sale}
                                            customerDetails={customerDetails}
                                            crateLoans={crateLoans}
                                            viewerEmployeeId={currentEmployeeId}
                                            viewerName={currentEmployeeName}
                                            canAddNote={Boolean(submitTaskReport)}
                                            canReportIncident={Boolean(blockTask)}
                                            canCloseTask={Boolean(completeTask)}
                                            onAcknowledge={acknowledgeTask}
                                            onStart={startTask}
                                            onOpenReport={handleOpenReport}
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
                                    const sale = salesById.get(task.saleId || '');
                                    const customerDetails = sale ? findCustomerForSale(customers, sale) : undefined;

                                    return (
                                        <DelivererTaskCard
                                            key={task.id}
                                            task={task}
                                            sale={sale}
                                            customerDetails={customerDetails}
                                            crateLoans={crateLoans}
                                            viewerEmployeeId={currentEmployeeId}
                                            viewerName={currentEmployeeName}
                                            canAddNote={Boolean(submitTaskReport)}
                                            canReportIncident={false}
                                            canCloseTask={false}
                                            onAcknowledge={acknowledgeTask}
                                            onStart={startTask}
                                            onOpenReport={handleOpenReport}
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

            <TaskReportModal
                task={reportingTask}
                reportType={reportType}
                availableTypes={modalAvailableTypes}
                message={reportMessage}
                error={reportError}
                submitting={submittingReport}
                paymentStatus={paymentStatus}
                paymentMethod={paymentMethod}
                onTypeChange={setReportType}
                onMessageChange={setReportMessage}
                onPaymentStatusChange={setPaymentStatus}
                onPaymentMethodChange={setPaymentMethod}
                onClose={handleCloseReport}
                onSubmit={handleSubmitReport}
            />
        </div>
    );
};

export default DelivererView;
