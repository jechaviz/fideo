import React, { useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { ActionItem, Sale, View } from '../types';

type OperationalTaskStatus = 'assigned' | 'acknowledged' | 'in_progress' | 'blocked' | 'done';
type OperationalTaskStage = 'packing' | 'assignment' | 'route' | 'other';
type LooseRecord = Record<string, unknown>;

type QueueTask = {
    id: string;
    saleId?: string;
    stage: OperationalTaskStage;
    status: OperationalTaskStatus;
    title: string;
    description: string;
    customerName?: string;
    assigneeName?: string;
    blockedReason?: string;
    timestamp: Date;
    targetView: View;
    ctaText: string;
};

const statusLabelMap: Record<OperationalTaskStatus, string> = {
    assigned: 'Pendiente',
    acknowledged: 'Acusada',
    in_progress: 'En curso',
    blocked: 'Bloqueada',
    done: 'Hecha',
};

const statusToneMap: Record<OperationalTaskStatus, string> = {
    assigned: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    acknowledged: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    in_progress: 'border-brand-400/20 bg-brand-400/10 text-brand-200',
    blocked: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    done: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
};

const stageLabelMap: Record<OperationalTaskStage, string> = {
    packing: 'Empaque',
    assignment: 'Asignacion',
    route: 'Ruta',
    other: 'Operacion',
};

const stageToneMap: Record<OperationalTaskStage, string> = {
    packing: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
    assignment: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    route: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    other: 'border-white/10 bg-white/5 text-slate-300',
};

const stageIconMap: Record<OperationalTaskStage, string> = {
    packing: 'fa-box-open',
    assignment: 'fa-user-plus',
    route: 'fa-truck',
    other: 'fa-list-check',
};

const actionIconMap: Record<ActionItem['type'], string> = {
    PACK_ORDER: 'fa-box-check',
    ASSIGN_DELIVERY: 'fa-truck',
    CONFIRM_PURCHASE_ORDER: 'fa-dolly',
    FOLLOW_UP_CRATE: 'fa-box-open',
    SMART_MOVE: 'fa-people-carry-box',
};

const actionToneMap: Record<ActionItem['type'], string> = {
    PACK_ORDER: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
    ASSIGN_DELIVERY: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    CONFIRM_PURCHASE_ORDER: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
    FOLLOW_UP_CRATE: 'border-orange-400/40 bg-orange-400/10 text-orange-200',
    SMART_MOVE: 'border-teal-400/40 bg-teal-400/10 text-teal-200',
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

const compareQueueTasks = (left: QueueTask, right: QueueTask) => {
    const statusDelta = taskSortOrder[left.status] - taskSortOrder[right.status];
    if (statusDelta !== 0) return statusDelta;
    return left.timestamp.getTime() - right.timestamp.getTime();
};

const buildTaskFromSale = (sale: Sale) => {
    const stage = saleStatusToStageMap[sale.status];
    const status = saleStatusToTaskStatusMap[sale.status];
    if (!stage || !status || status === 'done') return null;

    return {
        id: `sale_fallback_${sale.id}_${stage}`,
        saleId: sale.id,
        stage,
        status,
        title: stage === 'packing' ? 'Empaque pendiente' : stage === 'assignment' ? 'Asignar ruta' : 'Entrega en curso',
        description: buildSaleDescription(sale),
        customerName: sale.customer,
        assigneeName: undefined,
        blockedReason: undefined,
        timestamp: sale.timestamp,
        targetView: 'deliveries' as const,
        ctaText: 'Abrir entregas',
    } satisfies QueueTask;
};

const buildTaskFromAssignment = (input: unknown, sales: Sale[], index: number): QueueTask | null => {
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

    const customerName = readString(sources, ['customerName', 'customer', 'clientName']) || sale?.customer;
    const title =
        readString(sources, ['title', 'label', 'name']) ||
        (stage === 'packing'
            ? 'Empaque pendiente'
            : stage === 'assignment'
              ? 'Asignar ruta'
              : stage === 'route'
                ? 'Ruta de entrega'
                : 'Tarea operativa');

    return {
        id: readString(sources, ['id']) || `task_${index}`,
        saleId,
        stage,
        status,
        title,
        description: readString(sources, ['description', 'summary']) || (sale ? buildSaleDescription(sale) : customerName || 'Sin detalle'),
        customerName,
        assigneeName: readString(sources, ['assigneeName', 'employeeName', 'driverName', 'ownerName']),
        blockedReason: status === 'blocked' ? readString(sources, ['blockedReason', 'blockReason', 'issue', 'holdReason']) : undefined,
        timestamp: readDate(sources, ['dueAt', 'scheduledAt', 'createdAt', 'updatedAt', 'timestamp']) || sale?.timestamp || new Date(),
        targetView: 'deliveries',
        ctaText: 'Abrir entregas',
    };
};

const QueueTaskCard: React.FC<{ task: QueueTask; onOpen: (task: QueueTask) => void }> = ({ task, onOpen }) => (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border ${stageToneMap[task.stage]}`}>
                    <i className={`fa-solid ${stageIconMap[task.stage]} text-sm`}></i>
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{stageLabelMap[task.stage]}</p>
                    <p className="mt-2 text-lg font-black tracking-tight text-white">{task.title}</p>
                </div>
            </div>
            <div className="text-right">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${statusToneMap[task.status]}`}>
                    {statusLabelMap[task.status]}
                </span>
                <p className="mt-2 text-xs font-mono text-slate-500">
                    {task.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-300">{task.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
            {task.customerName && (
                <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                    {task.customerName}
                </span>
            )}
            {task.assigneeName && (
                <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-100">
                    {task.assigneeName}
                </span>
            )}
        </div>

        {task.blockedReason && (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-50">
                {task.blockedReason}
            </div>
        )}

        <button
            onClick={() => onOpen(task)}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-brand-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300"
        >
            {task.ctaText}
        </button>
    </div>
);

const QueueLane: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({ title, count, children }) => (
    <section className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-sm font-black text-white">{count}</span>
        </div>
        <div className="space-y-4">
            {count > 0 ? children : <p className="py-8 text-center text-sm text-slate-500">Sin tareas.</p>}
        </div>
    </section>
);

const SupportActionCard: React.FC<{ item: ActionItem; onAction: (item: ActionItem) => void }> = ({ item, onAction }) => (
    <div className="glass-panel-dark rounded-[1.8rem] border border-white/10 p-5">
        <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border ${actionToneMap[item.type]}`}>
                <i className={`fa-solid ${actionIconMap[item.type]} text-sm`}></i>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{item.type.replaceAll('_', ' ')}</p>
                <p className="mt-2 text-lg font-black tracking-tight text-white">{item.title}</p>
                <p className="mt-2 text-sm text-slate-400">{item.description}</p>
            </div>
        </div>
        <button
            onClick={() => onAction(item)}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
        >
            {item.cta.text}
        </button>
    </div>
);

const ActionCenter: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { actionItems, sales, setCurrentView } = data;
    const taskAssignments = ((data as BusinessData & { taskAssignments?: unknown }).taskAssignments ?? []) as unknown[];

    const queueTasks = useMemo(() => {
        const normalizedTasks = Array.isArray(taskAssignments)
            ? taskAssignments
                  .map((task, index) => buildTaskFromAssignment(task, sales, index))
                  .filter((task): task is QueueTask => Boolean(task))
            : [];

        const coveredStages = new Set(
            normalizedTasks
                .filter((task) => task.saleId)
                .map((task) => `${task.saleId}:${task.stage}`),
        );

        const fallbackTasks = sales
            .map((sale) => buildTaskFromSale(sale))
            .filter((task): task is QueueTask => Boolean(task))
            .filter((task) => !task.saleId || !coveredStages.has(`${task.saleId}:${task.stage}`));

        return [...normalizedTasks, ...fallbackTasks].sort(compareQueueTasks);
    }, [sales, taskAssignments]);

    const laneTasks = useMemo(
        () => ({
            assigned: queueTasks.filter((task) => task.status === 'assigned'),
            acknowledged: queueTasks.filter((task) => task.status === 'acknowledged'),
            inProgress: queueTasks.filter((task) => task.status === 'in_progress'),
            blocked: queueTasks.filter((task) => task.status === 'blocked'),
        }),
        [queueTasks],
    );

    const stageCounts = useMemo(
        () =>
            queueTasks.reduce(
                (accumulator, task) => {
                    accumulator[task.stage] += 1;
                    return accumulator;
                },
                { packing: 0, assignment: 0, route: 0, other: 0 } as Record<OperationalTaskStage, number>,
            ),
        [queueTasks],
    );

    const secondaryActionItems = useMemo(
        () => actionItems.filter((item) => item.type !== 'PACK_ORDER' && item.type !== 'ASSIGN_DELIVERY'),
        [actionItems],
    );

    const handleTaskOpen = (task: QueueTask) => {
        setCurrentView(task.targetView);
    };

    const handleAction = (item: ActionItem) => {
        setCurrentView(item.cta.targetView);
    };

    if (queueTasks.length === 0 && secondaryActionItems.length === 0) {
        return (
            <div className="space-y-6">
                <div className="glass-panel-dark rounded-[2rem] py-14 text-center">
                    <div className="mb-4 text-5xl text-brand-300">
                        <i className="fa-solid fa-check-double"></i>
                    </div>
                    <h2 className="text-xl font-black text-white">Todo en orden</h2>
                    <p className="mt-2 text-slate-400">No hay acciones pendientes en este momento.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Cola operativa</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Centro de Acciones</h1>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:min-w-[420px] lg:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Abiertas</p>
                        <p className="mt-2 text-2xl font-black text-white">{queueTasks.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Pendientes</p>
                        <p className="mt-2 text-2xl font-black text-white">{laneTasks.assigned.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Acuses</p>
                        <p className="mt-2 text-2xl font-black text-white">{laneTasks.acknowledged.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Bloqueos</p>
                        <p className="mt-2 text-2xl font-black text-white">{laneTasks.blocked.length}</p>
                    </div>
                </div>
            </div>

            <section className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${stageToneMap.packing}`}>
                    Empaque {stageCounts.packing}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${stageToneMap.assignment}`}>
                    Asignacion {stageCounts.assignment}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${stageToneMap.route}`}>
                    Ruta {stageCounts.route}
                </span>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
                <QueueLane title="Pendientes" count={laneTasks.assigned.length}>
                    {laneTasks.assigned.map((task) => <QueueTaskCard key={task.id} task={task} onOpen={handleTaskOpen} />)}
                </QueueLane>
                <QueueLane title="Acusadas" count={laneTasks.acknowledged.length}>
                    {laneTasks.acknowledged.map((task) => <QueueTaskCard key={task.id} task={task} onOpen={handleTaskOpen} />)}
                </QueueLane>
                <QueueLane title="En curso" count={laneTasks.inProgress.length}>
                    {laneTasks.inProgress.map((task) => <QueueTaskCard key={task.id} task={task} onOpen={handleTaskOpen} />)}
                </QueueLane>
                <QueueLane title="Bloqueadas" count={laneTasks.blocked.length}>
                    {laneTasks.blocked.map((task) => <QueueTaskCard key={task.id} task={task} onOpen={handleTaskOpen} />)}
                </QueueLane>
            </section>

            {secondaryActionItems.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Complementos</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Alertas fuera de ruta</h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">
                            {secondaryActionItems.length}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {secondaryActionItems.map((item) => (
                            <SupportActionCard key={item.id} item={item} onAction={handleAction} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default ActionCenter;
