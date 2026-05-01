import React, { useEffect, useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { AssignmentInterpretation, CrateLoan, Customer, Employee, InterpretationType, PaymentMethod, PaymentStatus, Sale } from '../types';
import { findCustomerForSale, loanBelongsToCustomer } from '../utils/customerIdentity';

const panelClass = 'glass-panel-dark rounded-[2rem] border border-white/10';
const fieldClass = 'mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20';
const secondaryButtonClass = 'rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

type OperationalTaskStatus = 'assigned' | 'acknowledged' | 'in_progress' | 'blocked' | 'done';
type OperationalTaskStage = 'packing' | 'assignment' | 'route' | 'other';
type LooseRecord = Record<string, unknown>;

type DeliveryTask = {
    id: string;
    stage: OperationalTaskStage;
    status: OperationalTaskStatus;
    title: string;
    description: string;
    customerName: string;
    sale?: Sale;
    assigneeId?: string;
    assigneeName?: string;
    destination?: string;
    locationQuery?: string;
    blockedReason?: string;
    notes?: string;
    timestamp: Date;
    acknowledgedAt?: Date;
};

const taskStatusLabelMap: Record<OperationalTaskStatus, string> = {
    assigned: 'Pendiente',
    acknowledged: 'Acusada',
    in_progress: 'En curso',
    blocked: 'Bloqueada',
    done: 'Hecha',
};

const taskStatusToneMap: Record<OperationalTaskStatus, string> = {
    assigned: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    acknowledged: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    in_progress: 'border-brand-400/20 bg-brand-400/10 text-brand-200',
    blocked: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    done: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
};

const taskStageLabelMap: Record<OperationalTaskStage, string> = {
    packing: 'Empaque',
    assignment: 'Asignacion',
    route: 'Ruta',
    other: 'Operacion',
};

const taskStageToneMap: Record<OperationalTaskStage, string> = {
    packing: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
    assignment: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    route: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    other: 'border-white/10 bg-white/5 text-slate-300',
};

const taskStageIconMap: Record<OperationalTaskStage, string> = {
    packing: 'fa-box-open',
    assignment: 'fa-user-plus',
    route: 'fa-truck',
    other: 'fa-list-check',
};

const taskSortOrder: Record<OperationalTaskStatus, number> = {
    blocked: 0,
    assigned: 1,
    acknowledged: 2,
    in_progress: 3,
    done: 4,
};

const saleStatusToStageMap: Partial<Record<Sale['status'], OperationalTaskStage>> = {
    'Pendiente de Empaque': 'packing',
    'Listo para Entrega': 'assignment',
    'En Ruta': 'route',
};

const saleStatusToTaskStatusMap: Partial<Record<Sale['status'], OperationalTaskStatus>> = {
    'Pendiente de Empaque': 'assigned',
    'Listo para Entrega': 'assigned',
    'En Ruta': 'in_progress',
    Completado: 'done',
    Cancelado: 'done',
};

const asRecord = (value: unknown): LooseRecord | null => (value && typeof value === 'object' ? (value as LooseRecord) : null);

const readString = (sources: Array<LooseRecord | null>, keys: string[]) => {
    for (const source of sources) {
        if (!source) continue;
        for (const key of keys) {
            const value = source[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
    }
    return undefined;
};

const toDate = (value: unknown) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return undefined;
};

const readDate = (sources: Array<LooseRecord | null>, keys: string[]) => {
    for (const source of sources) {
        if (!source) continue;
        for (const key of keys) {
            const parsed = toDate(source[key]);
            if (parsed) return parsed;
        }
    }
    return undefined;
};

const normalizeTaskStatus = (value: unknown): OperationalTaskStatus | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (normalized === 'assigned' || normalized === 'acknowledged' || normalized === 'in_progress' || normalized === 'blocked' || normalized === 'done') {
        return normalized;
    }
    if (normalized === 'inprogress') return 'in_progress';
    if (normalized === 'pending' || normalized === 'todo') return 'assigned';
    if (normalized === 'started' || normalized === 'active') return 'in_progress';
    return undefined;
};

const inferTaskStage = (signals: string[], sale?: Sale): OperationalTaskStage => {
    const haystack = signals.join(' ').toLowerCase();
    if (/(pack|empaque|empacar|picker|prepar)/.test(haystack)) return 'packing';
    if (/(assign|asign|dispatch|driver|repartidor)/.test(haystack)) return 'assignment';
    if (/(route|ruta|delivery|entrega|reparto|en_ruta)/.test(haystack)) return 'route';
    if (sale) return saleStatusToStageMap[sale.status] || 'other';
    return 'other';
};

const buildSaleDescription = (sale: Sale) => `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} ${sale.quality}`;

const compareTasks = (left: DeliveryTask, right: DeliveryTask) => {
    const statusDelta = taskSortOrder[left.status] - taskSortOrder[right.status];
    if (statusDelta !== 0) return statusDelta;
    return left.timestamp.getTime() - right.timestamp.getTime();
};

const findCustomerForTask = (customers: Customer[], task: DeliveryTask) => {
    if (task.sale) return findCustomerForSale(customers, task.sale);
    return customers.find((customer) => customer.name.toLowerCase() === task.customerName.toLowerCase());
};

const buildTaskFromSale = (sale: Sale, employees: Employee[]): DeliveryTask | null => {
    const stage = saleStatusToStageMap[sale.status];
    const status = saleStatusToTaskStatusMap[sale.status];
    if (!stage || !status || status === 'done') return null;

    return {
        id: `sale_fallback_${sale.id}_${stage}`,
        stage,
        status,
        title: stage === 'packing' ? 'Empaque pendiente' : stage === 'assignment' ? 'Asignar ruta' : 'Entrega en curso',
        description: buildSaleDescription(sale),
        customerName: sale.customer,
        sale,
        assigneeId: sale.assignedEmployeeId,
        assigneeName: employees.find((employee) => employee.id === sale.assignedEmployeeId)?.name,
        destination: sale.destination,
        locationQuery: sale.locationQuery,
        notes: sale.paymentNotes,
        timestamp: sale.timestamp,
        acknowledgedAt: stage === 'route' ? sale.timestamp : undefined,
    };
};

const buildTaskFromAssignment = (input: unknown, sales: Sale[], employees: Employee[], index: number): DeliveryTask | null => {
    const task = asRecord(input);
    if (!task) return null;

    const saleRecord = asRecord(task.sale);
    const sources = [task, asRecord(task.payload), asRecord(task.context), asRecord(task.metadata), saleRecord, asRecord(task.assignee), asRecord(task.owner)];
    const saleId = readString(sources, ['saleId', 'relatedSaleId', 'orderId', 'order_id', 'relatedId']) || (typeof saleRecord?.id === 'string' ? saleRecord.id : undefined);
    const sale = saleId ? sales.find((item) => item.id === saleId) : undefined;
    const stageSignals = [
        readString(sources, ['taskType', 'type', 'kind', 'category', 'operation', 'stage', 'workflow']),
        readString(sources, ['title', 'label', 'name']),
        readString(sources, ['description', 'summary']),
        sale?.status,
    ].filter((value): value is string => Boolean(value));

    const stage = inferTaskStage(stageSignals, sale);
    const status =
        normalizeTaskStatus(readString(sources, ['status', 'state'])) ||
        (sale ? saleStatusToTaskStatusMap[sale.status] : undefined) ||
        'assigned';

    if (status === 'done') return null;

    const assigneeId = readString(sources, ['assigneeId', 'employeeId', 'driverId', 'ownerId', 'assignedEmployeeId']);
    const assigneeName =
        readString(sources, ['assigneeName', 'employeeName', 'driverName', 'ownerName']) ||
        employees.find((employee) => employee.id === assigneeId)?.name ||
        employees.find((employee) => employee.id === sale?.assignedEmployeeId)?.name;
    const customerName =
        readString(sources, ['customerName', 'customer', 'clientName']) ||
        sale?.customer ||
        'Cliente';
    const title =
        readString(sources, ['title', 'label', 'name']) ||
        (stage === 'packing'
            ? 'Empaque pendiente'
            : stage === 'assignment'
              ? 'Asignar ruta'
              : stage === 'route'
                ? 'Ruta de entrega'
                : 'Tarea operativa');
    const description =
        readString(sources, ['description', 'summary']) ||
        (sale ? buildSaleDescription(sale) : customerName);
    const timestamp =
        readDate(sources, ['dueAt', 'scheduledAt', 'createdAt', 'updatedAt', 'timestamp']) ||
        sale?.timestamp ||
        new Date();
    const acknowledgedAt =
        readDate(sources, ['acknowledgedAt', 'ackedAt', 'startedAt']) ||
        (status === 'acknowledged' || status === 'in_progress' ? timestamp : undefined);

    return {
        id: readString(sources, ['id']) || `task_${index}`,
        stage,
        status,
        title,
        description,
        customerName,
        sale,
        assigneeId,
        assigneeName,
        destination: readString(sources, ['destination', 'address']) || sale?.destination,
        locationQuery: readString(sources, ['locationQuery', 'mapsQuery']) || sale?.locationQuery,
        blockedReason: status === 'blocked' ? readString(sources, ['blockedReason', 'blockReason', 'issue', 'holdReason']) : undefined,
        notes: readString(sources, ['notes', 'note', 'instructions', 'deliveryNotes']) || sale?.paymentNotes,
        timestamp,
        acknowledgedAt,
    };
};

interface DeliveryModalProps {
    sale: Sale;
    employees: Employee[];
    isOpen: boolean;
    onClose: () => void;
    onAssign: (saleId: string, employeeId: string) => void;
}

const AssignDeliveryModal: React.FC<DeliveryModalProps> = ({ sale, employees, isOpen, onClose, onAssign }) => {
    const drivers = useMemo(() => employees.filter((employee) => employee.role === 'Repartidor'), [employees]);
    const [selectedEmployee, setSelectedEmployee] = useState<string>(drivers[0]?.id || '');

    useEffect(() => {
        setSelectedEmployee(drivers[0]?.id || '');
    }, [drivers]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedEmployee) {
            onAssign(sale.id, selectedEmployee);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${panelClass} w-full max-w-md p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Asignacion</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Asignar entrega</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Enruta el pedido de <span className="font-bold text-white">{sale.customer}</span> con el repartidor disponible.
                    </p>
                </div>

                <div>
                    <label htmlFor="employee" className={labelClass}>Repartidor</label>
                    <select id="employee" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={fieldClass}>
                        {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                                {driver.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className={secondaryButtonClass}>Cancelar</button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedEmployee}
                        className="rounded-2xl bg-brand-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Confirmar asignacion
                    </button>
                </div>
            </div>
        </div>
    );
};

interface CompleteModalProps {
    sale: Sale;
    isOpen: boolean;
    onClose: () => void;
    onComplete: (saleId: string, paymentStatus: PaymentStatus, paymentMethod: PaymentMethod, paymentNotes?: string) => void;
}

const CompleteDeliveryModal: React.FC<CompleteModalProps> = ({ sale, isOpen, onClose, onComplete }) => {
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pagado');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
    const [paymentNotes, setPaymentNotes] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        onComplete(sale.id, paymentStatus, paymentMethod, paymentNotes);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${panelClass} w-full max-w-md p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Cierre de ruta</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Confirmar entrega</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Registra el resultado operativo y de cobro para <span className="font-bold text-white">{sale.customer}</span>.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Resultado</label>
                        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)} className={fieldClass}>
                            <option value="Pagado">Pagado</option>
                            <option value="En Deuda">En deuda (credito)</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Metodo de pago</label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
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
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            rows={3}
                            placeholder={paymentStatus === 'En Deuda' ? 'Ej. paga el lunes' : 'Opcional'}
                            className={`${fieldClass} resize-none`}
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className={secondaryButtonClass}>Cancelar</button>
                    <button onClick={handleSubmit} className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300">
                        Finalizar entrega
                    </button>
                </div>
            </div>
        </div>
    );
};

const DeliveryCard: React.FC<{
    task: DeliveryTask;
    customerDetails?: Customer;
    crateLoans: CrateLoan[];
    onPack: (saleId: string) => void;
    onAssignClick: (sale: Sale) => void;
    onCompleteClick: (sale: Sale) => void;
}> = ({ task, customerDetails, crateLoans, onPack, onAssignClick, onCompleteClick }) => {
    const location = task.locationQuery || task.destination;
    const mapUrl = location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;
    const pendingCrates = useMemo(
        () => (customerDetails ? crateLoans.filter((loan) => loanBelongsToCustomer(loan, customerDetails) && loan.status === 'Prestado') : []),
        [crateLoans, customerDetails],
    );
    const noteText = task.notes || customerDetails?.deliveryNotes;
    const canPack = Boolean(task.sale && task.stage === 'packing' && task.sale.status === 'Pendiente de Empaque' && task.status !== 'blocked');
    const canAssign = Boolean(task.sale && task.stage === 'assignment' && task.sale.status === 'Listo para Entrega' && task.status !== 'blocked');
    const canComplete = Boolean(task.sale && task.stage === 'route' && task.sale.status === 'En Ruta' && task.status !== 'blocked');

    return (
        <div className="flex h-full flex-col justify-between rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/15 hover:bg-white/[0.06]">
            <div>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-lg font-black tracking-tight text-white">{task.customerName}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-200">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-300">{task.description}</p>
                    </div>
                    <div className="text-right">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${taskStatusToneMap[task.status]}`}>
                            {taskStatusLabelMap[task.status]}
                        </span>
                        <p className="mt-2 text-xs font-mono text-slate-500">
                            {task.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${taskStageToneMap[task.stage]}`}>
                        <i className={`fa-solid ${taskStageIconMap[task.stage]} text-[11px]`}></i>
                        {taskStageLabelMap[task.stage]}
                    </span>
                    {task.acknowledgedAt && (task.status === 'acknowledged' || task.status === 'in_progress') && (
                        <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-sky-100">
                            Acuse {task.acknowledgedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/60 p-4">
                    <p className={labelClass}>Destino</p>
                    <p className="mt-2 text-sm text-slate-200">{task.destination || task.sale?.destination || 'Sin direccion'}</p>
                    {task.assigneeName && <p className="mt-3 text-sm font-semibold text-slate-300">Responsable: {task.assigneeName}</p>}
                    {task.sale && <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Pedido: {task.sale.status}</p>}
                </div>

                {task.blockedReason && (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-200">Bloqueo</p>
                        <p className="mt-2 text-sm text-rose-50">{task.blockedReason}</p>
                    </div>
                )}

                {noteText && (
                    <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-200">Notas</p>
                        <p className="mt-2 text-sm italic text-sky-50">{noteText}</p>
                    </div>
                )}

                {pendingCrates.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                        <p className="text-sm font-bold text-amber-100">
                            Recoger {pendingCrates.reduce((sum, loan) => sum + loan.quantity, 0)} caja(s) pendientes.
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
                {canPack && task.sale && (
                    <button
                        onClick={() => onPack(task.sale.id)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-brand-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                    >
                        Marcar empacado
                    </button>
                )}
                {canAssign && task.sale && (
                    <button
                        onClick={() => onAssignClick(task.sale)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300"
                    >
                        Asignar repartidor
                    </button>
                )}
                {canComplete && task.sale && (
                    <button
                        onClick={() => onCompleteClick(task.sale)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300"
                    >
                        Completar entrega
                    </button>
                )}
                {mapUrl && (
                    <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                        title="Abrir mapa"
                    >
                        <i className="fa-solid fa-map-location-dot"></i>
                    </a>
                )}
            </div>
        </div>
    );
};

const PrepColumn: React.FC<{ title: string; eyebrow: string; count: number; accent: string; children: React.ReactNode }> = ({ title, eyebrow, count, accent, children }) => (
    <div className={`${panelClass} flex h-full flex-col p-5`}>
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
                {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p> : null}
                <h2 className={`mt-2 text-2xl font-black tracking-tight ${accent}`}>{title}</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm font-black text-white">{count}</span>
        </div>

        <div className="flex-grow space-y-4 overflow-y-auto pr-1">
            {count > 0 ? children : <p className="py-10 text-center text-sm text-slate-500">No hay tareas en esta etapa.</p>}
        </div>
    </div>
);

const Deliveries: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { sales, employees, customers, crateLoans, completeSale, markOrderAsPacked, approveInterpretation } = data;
    const taskAssignments = ((data as BusinessData & { taskAssignments?: unknown }).taskAssignments ?? []) as unknown[];
    const [assignModal, setAssignModal] = useState<Sale | null>(null);
    const [completeModal, setCompleteModal] = useState<Sale | null>(null);

    const operationalTasks = useMemo(() => {
        const normalizedTasks = Array.isArray(taskAssignments)
            ? taskAssignments
                  .map((task, index) => buildTaskFromAssignment(task, sales, employees, index))
                  .filter((task): task is DeliveryTask => Boolean(task))
            : [];

        const coveredStages = new Set(
            normalizedTasks
                .filter((task) => task.sale)
                .map((task) => `${task.sale.id}:${task.stage}`),
        );

        const fallbackTasks = sales
            .map((sale) => buildTaskFromSale(sale, employees))
            .filter((task): task is DeliveryTask => Boolean(task))
            .filter((task) => !task.sale || !coveredStages.has(`${task.sale.id}:${task.stage}`));

        return [...normalizedTasks, ...fallbackTasks].sort(compareTasks);
    }, [employees, sales, taskAssignments]);

    const signalCounts = useMemo(
        () =>
            operationalTasks.reduce(
                (accumulator, task) => {
                    accumulator.open += 1;
                    accumulator[task.status] += 1;
                    return accumulator;
                },
                {
                    open: 0,
                    assigned: 0,
                    acknowledged: 0,
                    in_progress: 0,
                    blocked: 0,
                    done: 0,
                } as Record<OperationalTaskStatus | 'open', number>,
            ),
        [operationalTasks],
    );

    const packingTasks = useMemo(() => operationalTasks.filter((task) => task.stage === 'packing'), [operationalTasks]);
    const assignmentTasks = useMemo(() => operationalTasks.filter((task) => task.stage === 'assignment'), [operationalTasks]);
    const routesByDriver = useMemo(() => {
        const groupedRoutes = new Map<string, { driverName: string; driverId?: string; tasks: DeliveryTask[] }>();

        operationalTasks
            .filter((task) => task.stage === 'route')
            .forEach((task) => {
                const key = task.assigneeId || task.assigneeName || 'sin_asignar';
                const currentGroup = groupedRoutes.get(key);
                if (currentGroup) {
                    currentGroup.tasks.push(task);
                    currentGroup.tasks.sort(compareTasks);
                    return;
                }

                groupedRoutes.set(key, {
                    driverName: task.assigneeName || 'Sin asignar',
                    driverId: task.assigneeId,
                    tasks: [task],
                });
            });

        return [...groupedRoutes.values()].sort((left, right) => left.driverName.localeCompare(right.driverName));
    }, [operationalTasks]);

    const handleAssign = (saleId: string, employeeId: string) => {
        const sale = sales.find((item) => item.id === saleId);
        const employee = employees.find((item) => item.id === employeeId);
        if (!sale || !employee) return;

        const interpretation: AssignmentInterpretation = {
            type: InterpretationType.ASIGNACION_ENTREGA,
            certainty: 1.0,
            explanation: 'Asignacion manual desde la vista de Entregas.',
            originalMessage: `Asignar ${employee.name} a ${sale.customer}`,
            sender: 'Admin',
            data: { employeeName: employee.name, customerName: sale.customer },
        };
        const messageId = data.addInterpretedMessage(interpretation);
        void approveInterpretation(messageId);
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Operacion en piso</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">Entregas</h1>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:min-w-[420px] lg:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Pendientes</p>
                            <p className="mt-2 text-2xl font-black text-white">{signalCounts.assigned}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Acuses</p>
                            <p className="mt-2 text-2xl font-black text-white">{signalCounts.acknowledged}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Bloqueos</p>
                            <p className="mt-2 text-2xl font-black text-white">{signalCounts.blocked}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>En curso</p>
                            <p className="mt-2 text-2xl font-black text-white">{signalCounts.in_progress}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <PrepColumn title="Empaque" eyebrow="" count={packingTasks.length} accent="text-amber-200">
                    {packingTasks.map((task) => (
                        <DeliveryCard
                            key={task.id}
                            task={task}
                            customerDetails={findCustomerForTask(customers, task)}
                            crateLoans={crateLoans}
                            onPack={markOrderAsPacked}
                            onAssignClick={setAssignModal}
                            onCompleteClick={setCompleteModal}
                        />
                    ))}
                </PrepColumn>

                <PrepColumn title="Asignacion" eyebrow="" count={assignmentTasks.length} accent="text-brand-200">
                    {assignmentTasks.map((task) => (
                        <DeliveryCard
                            key={task.id}
                            task={task}
                            customerDetails={findCustomerForTask(customers, task)}
                            crateLoans={crateLoans}
                            onPack={markOrderAsPacked}
                            onAssignClick={setAssignModal}
                            onCompleteClick={setCompleteModal}
                        />
                    ))}
                </PrepColumn>
            </section>

            <section className={`${panelClass} p-6 md:p-7`}>
                <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Ruta</h2>
                    </div>
                    <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_14px_rgba(163,230,53,0.75)]"></span>
                        {routesByDriver.length} frente(s)
                    </div>
                </div>

                {routesByDriver.length > 0 ? (
                    <div className="space-y-6">
                        {routesByDriver.map(({ driverName, driverId, tasks }) => (
                            <div key={driverId || driverName} className="rounded-[1.9rem] border border-white/10 bg-white/[0.03] p-5">
                                <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200">
                                            <i className="fa-solid fa-truck"></i>
                                        </div>
                                        <div>
                                            <p className={labelClass}>Responsable</p>
                                            <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{driverName}</h3>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-100">
                                            {tasks.length} tareas
                                        </span>
                                        {tasks.some((task) => task.status === 'blocked') && (
                                            <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-black text-rose-100">
                                                {tasks.filter((task) => task.status === 'blocked').length} bloqueo(s)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {tasks.map((task) => (
                                        <DeliveryCard
                                            key={task.id}
                                            task={task}
                                            customerDetails={findCustomerForTask(customers, task)}
                                            crateLoans={crateLoans}
                                            onPack={markOrderAsPacked}
                                            onAssignClick={setAssignModal}
                                            onCompleteClick={setCompleteModal}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                        <p className="text-xl font-bold text-white">No hay rutas activas.</p>
                        <p className="mt-2 text-sm text-slate-400">Las tareas de entrega apareceran aqui en cuanto entren a esta etapa.</p>
                    </div>
                )}
            </section>

            {assignModal && <AssignDeliveryModal sale={assignModal} employees={employees} isOpen={!!assignModal} onClose={() => setAssignModal(null)} onAssign={handleAssign} />}
            {completeModal && <CompleteDeliveryModal sale={completeModal} isOpen={!!completeModal} onClose={() => setCompleteModal(null)} onComplete={completeSale} />}
        </div>
    );
};

export default Deliveries;
