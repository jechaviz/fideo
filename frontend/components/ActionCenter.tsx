import React, { useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { ActionItem, Sale, View } from '../types';

type OperationalTaskStatus = 'assigned' | 'acknowledged' | 'in_progress' | 'blocked' | 'done';
type OperationalTaskStage = 'packing' | 'assignment' | 'route' | 'other';
type LooseRecord = Record<string, unknown>;
type TaskSource = 'assignment' | 'fallback';
type TaskReportKind = 'report' | 'blocker' | 'escalation';

type TaskReport = {
    id: string;
    kind: TaskReportKind;
    summary: string;
    detail?: string;
    authorName?: string;
    createdAt?: Date;
};

type TaskSignal = {
    id: string;
    label: string;
    tone: string;
};

type QueueTask = {
    id: string;
    source: TaskSource;
    saleId?: string;
    stage: OperationalTaskStage;
    status: OperationalTaskStatus;
    title: string;
    description: string;
    customerName?: string;
    assigneeName?: string;
    ownerName?: string;
    blockedReason?: string;
    timestamp: Date;
    createdAt?: Date;
    updatedAt?: Date;
    blockedAt?: Date;
    reports: TaskReport[];
    signals: TaskSignal[];
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

const reportToneMap: Record<TaskReportKind, string> = {
    report: 'border-white/10 bg-white/[0.03] text-slate-200',
    blocker: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    escalation: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
};

const reportIconMap: Record<TaskReportKind, string> = {
    report: 'fa-file-lines',
    blocker: 'fa-circle-exclamation',
    escalation: 'fa-bolt',
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

const readValue = (sources: Array<LooseRecord | null>, keys: string[]) => {
    for (const source of sources) {
        if (!source) continue;
        for (const key of keys) {
            const value = source[key];
            if (value !== undefined && value !== null) return value;
        }
    }
    return undefined;
};

const readBoolean = (sources: Array<LooseRecord | null>, keys: string[]) => {
    const value = readValue(sources, keys);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'si', 'urgent'].includes(normalized)) return true;
        if (['false', '0', 'no'].includes(normalized)) return false;
    }
    return undefined;
};

const collectValues = (sources: Array<LooseRecord | null>, keys: string[]) => {
    const values: unknown[] = [];
    for (const source of sources) {
        if (!source) continue;
        for (const key of keys) {
            const value = source[key];
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                values.push(...value);
                continue;
            }
            values.push(value);
        }
    }
    return values;
};

const formatAgeCompact = (timestamp?: Date) => {
    if (!timestamp) return undefined;
    const elapsedMinutes = Math.max(1, Math.floor((Date.now() - timestamp.getTime()) / 60000));
    if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h`;
    return `${Math.floor(elapsedHours / 24)}d`;
};

const normalizeReportKind = (value: unknown, summary = ''): TaskReportKind => {
    const normalized = typeof value === 'string' ? value.toLowerCase().trim() : '';
    const haystack = `${normalized} ${summary}`.toLowerCase();
    if (/escal/.test(haystack)) return 'escalation';
    if (/(block|bloque|inciden|hold|issue)/.test(haystack)) return 'blocker';
    return 'report';
};

const buildTaskReport = (input: unknown, fallbackAuthor: string | undefined, index: number): TaskReport | null => {
    if (typeof input === 'string' && input.trim()) {
        const summary = input.trim();
        return {
            id: `report_${index}_${summary.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            kind: normalizeReportKind(undefined, summary),
            summary,
            authorName: fallbackAuthor,
        };
    }

    const report = asRecord(input);
    if (!report) return null;

    const sources = [report, asRecord(report.payload), asRecord(report.context), asRecord(report.metadata)];
    const summary =
        readString(sources, ['summary', 'title', 'label', 'message', 'text', 'note', 'statusText', 'headline']) ||
        readString(sources, ['description', 'detail', 'body']);
    if (!summary) return null;

    const detail = readString(sources, ['description', 'detail', 'body', 'context', 'notes', 'resolution']);

    return {
        id: readString(sources, ['id']) || `report_${index}_${summary.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        kind: normalizeReportKind(readString(sources, ['kind', 'type', 'category', 'status']), summary),
        summary,
        detail: detail && detail !== summary ? detail : undefined,
        authorName: readString(sources, ['authorName', 'reporterName', 'employeeName', 'userName', 'ownerName', 'assigneeName']) || fallbackAuthor,
        createdAt: readDate(sources, ['createdAt', 'updatedAt', 'timestamp', 'reportedAt', 'loggedAt', 'at']),
    };
};

const buildTaskReports = (
    sources: Array<LooseRecord | null>,
    fallbackAuthor: string | undefined,
    blockedReason?: string,
    blockedAt?: Date,
) => {
    const reportCandidates = [
        ...collectValues(sources, ['reports', 'taskReports', 'statusReports', 'updates', 'reportLog', 'timeline', 'events', 'activity']),
        ...collectValues(sources, ['latestReport', 'lastReport', 'report', 'statusReport', 'latestUpdate']),
    ];

    if (blockedReason) {
        reportCandidates.push({
            id: `blocked_${blockedReason.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            kind: 'blocker',
            summary: blockedReason,
            createdAt: blockedAt,
            authorName: fallbackAuthor,
        });
    }

    const reports = reportCandidates
        .map((candidate, index) => buildTaskReport(candidate, fallbackAuthor, index))
        .filter((report): report is TaskReport => Boolean(report))
        .sort((left, right) => (right.createdAt?.getTime() || 0) - (left.createdAt?.getTime() || 0));

    const seen = new Set<string>();
    return reports.filter((report) => {
        const key = `${report.kind}|${report.createdAt?.getTime() || 0}|${report.summary.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const buildEscalationLabel = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return `Escalada L${value}`;
    if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim();
        return /^\d+$/.test(trimmed) ? `Escalada L${trimmed}` : `Escalada ${trimmed}`;
    }
    return 'Escalada';
};

const buildTaskSignals = ({
    sources,
    status,
    createdAt,
    acknowledgedAt,
    reports,
    allowAckSignal,
}: {
    sources: Array<LooseRecord | null>;
    status: OperationalTaskStatus;
    createdAt?: Date;
    acknowledgedAt?: Date;
    reports: TaskReport[];
    allowAckSignal: boolean;
}) => {
    const signals: TaskSignal[] = [];
    const escalationLevel = readValue(sources, ['escalationLevel', 'escalationTier', 'severity']);
    const escalated =
        readBoolean(sources, ['escalated', 'isEscalated', 'needsEscalation', 'requiresAttention']) ||
        Boolean(readDate(sources, ['escalatedAt', 'escalationAt', 'escalationRequestedAt'])) ||
        Boolean(readString(sources, ['escalationReason', 'escalationSummary', 'escalationNote'])) ||
        reports.some((report) => report.kind === 'escalation');

    if (escalated) {
        signals.push({
            id: 'escalation',
            label: buildEscalationLabel(escalationLevel),
            tone: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
        });
    }

    if (allowAckSignal && status === 'assigned' && !acknowledgedAt) {
        signals.push({
            id: 'no_ack',
            label: createdAt ? `Sin acuse ${formatAgeCompact(createdAt)}` : 'Sin acuse',
            tone: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
        });
    }

    return signals;
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
        source: 'fallback',
        saleId: sale.id,
        stage,
        status,
        title: stage === 'packing' ? 'Empaque pendiente' : stage === 'assignment' ? 'Asignar ruta' : 'Entrega en curso',
        description: buildSaleDescription(sale),
        customerName: sale.customer,
        assigneeName: undefined,
        ownerName: undefined,
        blockedReason: undefined,
        timestamp: sale.timestamp,
        createdAt: sale.timestamp,
        updatedAt: sale.timestamp,
        blockedAt: undefined,
        reports: [],
        signals: [],
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
    const timestamp = readDate(sources, ['dueAt', 'scheduledAt', 'createdAt', 'updatedAt', 'timestamp']) || sale?.timestamp || new Date();
    const createdAt = readDate(sources, ['createdAt', 'timestamp']) || sale?.timestamp || timestamp;
    const updatedAt = readDate(sources, ['updatedAt', 'lastUpdatedAt', 'timestamp']) || createdAt;
    const acknowledgedAt =
        readDate(sources, ['acknowledgedAt', 'ackedAt', 'startedAt']) ||
        (status === 'acknowledged' || status === 'in_progress' ? timestamp : undefined);
    const blockedAt = readDate(sources, ['blockedAt', 'holdAt']) || (status === 'blocked' ? updatedAt : undefined);
    const blockedReason = status === 'blocked' ? readString(sources, ['blockedReason', 'blockReason', 'issue', 'holdReason']) : undefined;
    const assigneeName = readString(sources, ['assigneeName', 'employeeName', 'driverName', 'ownerName']);
    const ownerName = readString(sources, ['ownerName', 'resolverName']) || assigneeName;
    const reports = buildTaskReports(sources, ownerName || assigneeName, blockedReason, blockedAt);
    const signals = buildTaskSignals({
        sources,
        status,
        createdAt,
        acknowledgedAt,
        reports,
        allowAckSignal: true,
    });

    return {
        id: readString(sources, ['id']) || `task_${index}`,
        source: 'assignment',
        saleId,
        stage,
        status,
        title,
        description: readString(sources, ['description', 'summary']) || (sale ? buildSaleDescription(sale) : customerName || 'Sin detalle'),
        customerName,
        assigneeName,
        ownerName,
        blockedReason,
        timestamp,
        createdAt,
        updatedAt,
        blockedAt,
        reports,
        signals,
        targetView: 'deliveries',
        ctaText: 'Abrir entregas',
    };
};

const QueueTaskCard: React.FC<{ task: QueueTask; onOpen: (task: QueueTask) => void }> = ({ task, onOpen }) => {
    const latestReport = task.reports[0];
    const blockedOwnerName = task.ownerName || task.assigneeName;

    return (
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

            {(task.signals.length > 0 || task.reports.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {task.signals.map((signal) => (
                        <span key={`${task.id}_${signal.id}`} className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${signal.tone}`}>
                            {signal.label}
                        </span>
                    ))}
                    {task.reports.length > 0 && (
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                            {task.reports.length} reporte(s)
                        </span>
                    )}
                </div>
            )}

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
                {task.ownerName && task.ownerName !== task.assigneeName && (
                    <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-violet-100">
                        Owner {task.ownerName}
                    </span>
                )}
            </div>

            {task.blockedReason && (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-50">
                    <p>{task.blockedReason}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-950/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100">
                            {blockedOwnerName ? `Owner ${blockedOwnerName}` : 'Sin owner'}
                        </span>
                        {task.blockedAt && (
                            <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-950/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100">
                                {task.blockedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {latestReport && (
                <div className={`mt-4 rounded-2xl border px-3 py-3 ${reportToneMap[latestReport.kind]}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Reporte reciente</p>
                            <p className="mt-2 text-sm font-semibold text-current">{latestReport.summary}</p>
                            {latestReport.detail && <p className="mt-1 text-xs leading-5 text-slate-300">{latestReport.detail}</p>}
                        </div>
                        <i className={`fa-solid ${reportIconMap[latestReport.kind]} mt-0.5 text-xs opacity-80`}></i>
                    </div>
                    {(latestReport.authorName || latestReport.createdAt) && (
                        <p className="mt-2 text-[11px] font-semibold text-slate-400">
                            {[latestReport.authorName, latestReport.createdAt?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' / ')}
                        </p>
                    )}
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
};

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

    const operationalIndicators = useMemo(
        () =>
            queueTasks.reduce(
                (accumulator, task) => {
                    if (task.signals.some((signal) => signal.id === 'no_ack')) accumulator.noAck += 1;
                    if (task.signals.some((signal) => signal.id === 'escalation')) accumulator.escalated += 1;
                    if (task.reports.length > 0) accumulator.reported += task.reports.length;
                    if (task.status === 'blocked' && (task.ownerName || task.assigneeName)) accumulator.blockedOwned += 1;
                    return accumulator;
                },
                {
                    noAck: 0,
                    escalated: 0,
                    reported: 0,
                    blockedOwned: 0,
                },
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

            <section className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                    Reportes {operationalIndicators.reported}
                </span>
                <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100">
                    Escaladas {operationalIndicators.escalated}
                </span>
                <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">
                    Sin acuse {operationalIndicators.noAck}
                </span>
                <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-100">
                    Bloqueos c/owner {operationalIndicators.blockedOwned}
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
