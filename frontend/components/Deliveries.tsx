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

type PresenceSignal = {
    label: string;
    tone: string;
    lastSeenAt: Date;
};

type PresenceEntry = {
    lastSeenAt: Date;
    source: 'checkin' | 'activity' | 'report';
};

type LiveActivityItem = {
    id: string;
    summary: string;
    meta?: string;
    createdAt: Date;
    tone: string;
    icon: string;
    pill: string;
};

type AttentionItem = {
    id: string;
    title: string;
    customerName: string;
    label: string;
    meta: string;
    tone: string;
    priority: number;
    timestamp: Date;
};

type ExternalTaskReportIndex = {
    byTaskId: Map<string, TaskReport[]>;
    bySaleId: Map<string, TaskReport[]>;
};

type DeliveryTask = {
    id: string;
    source: TaskSource;
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
    ownerId?: string;
    ownerName?: string;
    blockedReason?: string;
    notes?: string;
    timestamp: Date;
    createdAt?: Date;
    updatedAt?: Date;
    acknowledgedAt?: Date;
    blockedAt?: Date;
    reports: TaskReport[];
    signals: TaskSignal[];
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

const getAgeMinutes = (timestamp?: Date) => {
    if (!timestamp) return undefined;
    return Math.max(1, Math.floor((Date.now() - timestamp.getTime()) / 60000));
};

const normalizeNameKey = (value?: string | null) => (value ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '');

const mergeTaskReports = (primary: TaskReport[], secondary: TaskReport[]) => {
    const merged = [...primary, ...secondary].sort((left, right) => (right.createdAt?.getTime() || 0) - (left.createdAt?.getTime() || 0));
    const seen = new Set<string>();
    return merged.filter((report) => {
        const key = `${report.id}|${report.kind}|${report.createdAt?.getTime() || 0}|${report.summary.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const mergeTaskSignals = (primary: TaskSignal[], secondary: TaskSignal[]) => {
    const merged = [...primary];
    secondary.forEach((signal) => {
        const existingIndex = merged.findIndex((item) => item.id === signal.id);
        if (existingIndex >= 0) {
            merged[existingIndex] = signal;
            return;
        }
        merged.push(signal);
    });
    return merged;
};

const buildExternalTaskReportIndex = (taskReports: BusinessData['taskReports']): ExternalTaskReportIndex => {
    const byTaskId = new Map<string, TaskReport[]>();
    const bySaleId = new Map<string, TaskReport[]>();

    const push = (collection: Map<string, TaskReport[]>, key: string | null | undefined, report: TaskReport) => {
        if (!key) return;
        const current = collection.get(key);
        if (current) {
            current.push(report);
            return;
        }
        collection.set(key, [report]);
    };

    taskReports.forEach((report) => {
        const normalizedReport: TaskReport = {
            id: report.id,
            kind:
                report.escalationStatus === 'pending' || report.escalationStatus === 'sent'
                    ? 'escalation'
                    : report.kind === 'blocker'
                      ? 'blocker'
                      : 'report',
            summary: report.summary,
            detail: report.detail || report.evidence || undefined,
            authorName: report.employeeName || undefined,
            createdAt: toDate(report.createdAt),
        };

        push(byTaskId, report.taskId, normalizedReport);
        push(bySaleId, report.saleId, normalizedReport);
    });

    return { byTaskId, bySaleId };
};

const buildPresenceIndex = (
    activities: BusinessData['activities'],
    activityLog: BusinessData['activityLog'],
    taskReports: BusinessData['taskReports'],
) => {
    const presenceIndex = new Map<string, PresenceEntry>();

    const updatePresence = (name: string | null | undefined, timestamp: Date | undefined, source: PresenceEntry['source']) => {
        const key = normalizeNameKey(name);
        if (!key || !timestamp) return;

        const current = presenceIndex.get(key);
        if (!current || timestamp.getTime() > current.lastSeenAt.getTime()) {
            presenceIndex.set(key, { lastSeenAt: timestamp, source });
        }
    };

    activities.forEach((activity) => {
        updatePresence(activity.employee, toDate(activity.timestamp), 'checkin');
    });

    activityLog.forEach((entry) => {
        const timestamp = toDate(entry.timestamp);
        const details = asRecord(entry.details);
        ['Empleado', 'Repartidor', 'Empacador', 'Responsable'].forEach((key) => {
            const candidate = details?.[key];
            if (typeof candidate === 'string') {
                updatePresence(candidate, timestamp, entry.type === 'LLEGADA_EMPLEADO' ? 'checkin' : 'activity');
            }
        });
    });

    taskReports.forEach((report) => {
        updatePresence(report.employeeName, toDate(report.createdAt), 'report');
    });

    return presenceIndex;
};

const getPresenceSignal = (presenceIndex: Map<string, PresenceEntry>, ...candidates: Array<string | null | undefined>) => {
    for (const candidate of candidates) {
        const key = normalizeNameKey(candidate);
        if (!key) continue;
        const presence = presenceIndex.get(key);
        if (!presence) continue;

        const ageMinutes = getAgeMinutes(presence.lastSeenAt) || Number.MAX_SAFE_INTEGER;
        return {
            label: `Ult. senal ${formatAgeCompact(presence.lastSeenAt) || 'ahora'}`,
            tone:
                ageMinutes <= 20
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                    : ageMinutes <= 120
                      ? 'border-sky-400/20 bg-sky-400/10 text-sky-100'
                      : 'border-white/10 bg-white/5 text-slate-300',
            lastSeenAt: presence.lastSeenAt,
        } satisfies PresenceSignal;
    }

    return undefined;
};

const attachExternalReportsToTask = (task: DeliveryTask, externalReports: ExternalTaskReportIndex): DeliveryTask => {
    const linkedReports = [
        ...(externalReports.byTaskId.get(task.id) || []),
        ...(task.sale ? externalReports.bySaleId.get(task.sale.id) || [] : []),
    ];
    if (!linkedReports.length) return task;

    const reports = mergeTaskReports(task.reports, linkedReports);
    const signals = mergeTaskSignals(
        task.signals,
        buildTaskSignals({
            sources: [],
            status: task.status,
            createdAt: task.createdAt,
            acknowledgedAt: task.acknowledgedAt,
            reports,
            allowAckSignal: true,
        }),
    );

    return {
        ...task,
        reports,
        signals,
    };
};

const buildAttentionItems = (tasks: DeliveryTask[]) =>
    tasks
        .map((task) => {
            const noAckSignal = task.signals.find((signal) => signal.id === 'no_ack');
            const escalated = task.signals.some((signal) => signal.id === 'escalation');
            const blocked = task.status === 'blocked';
            if (!noAckSignal && !escalated && !blocked && task.reports.length === 0) return null;

            const priority = escalated ? 0 : blocked ? 1 : noAckSignal ? ((getAgeMinutes(task.createdAt) || 0) >= 45 ? 1 : 2) : 3;
            const meta = [
                taskStageLabelMap[task.stage],
                task.assigneeName || task.ownerName,
                task.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            ]
                .filter(Boolean)
                .join(' / ');

            const nextItem: AttentionItem = {
                id: task.id,
                title: task.title,
                customerName: task.customerName,
                label: escalated ? 'Escalada activa' : blocked ? 'Bloqueo activo' : noAckSignal?.label || `${task.reports.length} reporte(s)`,
                meta,
                tone:
                    escalated || blocked
                        ? 'border-rose-400/20 bg-rose-400/10 text-rose-50'
                        : noAckSignal
                          ? 'border-amber-400/20 bg-amber-400/10 text-amber-50'
                          : 'border-white/10 bg-white/[0.03] text-slate-200',
                priority,
                timestamp: task.timestamp,
            };

            return nextItem;
        })
        .filter((item): item is AttentionItem => item !== null)
        .sort((left, right) => left.priority - right.priority || left.timestamp.getTime() - right.timestamp.getTime())
        .slice(0, 5);

const buildLiveActivity = (tasks: DeliveryTask[], activityLog: BusinessData['activityLog']) => {
    const reportEvents = tasks.flatMap((task) =>
        task.reports.map((report) => ({
            id: `task_report_${task.id}_${report.id}`,
            summary: report.summary,
            meta: [task.customerName, report.authorName || task.ownerName || task.assigneeName, formatAgeCompact(report.createdAt)].filter(Boolean).join(' / '),
            createdAt: report.createdAt || task.updatedAt || task.createdAt || task.timestamp,
            tone: reportToneMap[report.kind],
            icon: reportIconMap[report.kind],
            pill: taskStageLabelMap[task.stage],
        })),
    );

    const logEvents = activityLog
        .filter((entry) => entry.type === 'LLEGADA_EMPLEADO' || entry.type === 'ASIGNACION_ENTREGA' || entry.type === 'PEDIDO_EMPACADO' || entry.type === 'COMPLETA_VENTA')
        .map((entry) => {
            const timestamp = toDate(entry.timestamp) || new Date();
            const details = asRecord(entry.details);
            const actorName = ['Empleado', 'Repartidor'].map((key) => (typeof details?.[key] === 'string' ? (details[key] as string) : undefined)).find(Boolean);

            if (entry.type === 'LLEGADA_EMPLEADO') {
                return {
                    id: `activity_${entry.id}`,
                    summary: entry.description,
                    meta: [actorName, formatAgeCompact(timestamp)].filter(Boolean).join(' / '),
                    createdAt: timestamp,
                    tone: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
                    icon: 'fa-user-check',
                    pill: 'Presencia',
                } satisfies LiveActivityItem;
            }

            if (entry.type === 'ASIGNACION_ENTREGA') {
                return {
                    id: `activity_${entry.id}`,
                    summary: entry.description,
                    meta: [actorName, formatAgeCompact(timestamp)].filter(Boolean).join(' / '),
                    createdAt: timestamp,
                    tone: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
                    icon: 'fa-user-plus',
                    pill: 'Asignacion',
                } satisfies LiveActivityItem;
            }

            if (entry.type === 'PEDIDO_EMPACADO') {
                return {
                    id: `activity_${entry.id}`,
                    summary: entry.description,
                    meta: formatAgeCompact(timestamp),
                    createdAt: timestamp,
                    tone: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
                    icon: 'fa-box-open',
                    pill: 'Empaque',
                } satisfies LiveActivityItem;
            }

            return {
                id: `activity_${entry.id}`,
                summary: entry.description,
                meta: formatAgeCompact(timestamp),
                createdAt: timestamp,
                tone: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
                icon: 'fa-truck-fast',
                pill: 'Entrega',
            } satisfies LiveActivityItem;
        });

    return [...reportEvents, ...logEvents]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 6);
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
        source: 'fallback',
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
        createdAt: sale.timestamp,
        updatedAt: sale.timestamp,
        acknowledgedAt: stage === 'route' ? sale.timestamp : undefined,
        ownerId: sale.assignedEmployeeId,
        ownerName: employees.find((employee) => employee.id === sale.assignedEmployeeId)?.name,
        reports: [],
        signals: [],
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
    const createdAt = readDate(sources, ['createdAt', 'timestamp']) || sale?.timestamp || timestamp;
    const updatedAt = readDate(sources, ['updatedAt', 'lastUpdatedAt', 'timestamp']) || createdAt;
    const acknowledgedAt =
        readDate(sources, ['acknowledgedAt', 'ackedAt', 'startedAt']) ||
        (status === 'acknowledged' || status === 'in_progress' ? timestamp : undefined);
    const blockedAt = readDate(sources, ['blockedAt', 'holdAt']) || (status === 'blocked' ? updatedAt : undefined);
    const blockedReason = status === 'blocked' ? readString(sources, ['blockedReason', 'blockReason', 'issue', 'holdReason']) : undefined;
    const ownerId = readString(sources, ['ownerId', 'resolverId', 'employeeId', 'assigneeId', 'driverId', 'assignedEmployeeId']) || assigneeId;
    const ownerName =
        readString(sources, ['ownerName', 'resolverName', 'owner']) ||
        assigneeName ||
        employees.find((employee) => employee.id === ownerId)?.name;
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
        ownerId,
        ownerName,
        blockedReason,
        notes: readString(sources, ['notes', 'note', 'instructions', 'deliveryNotes']) || sale?.paymentNotes,
        timestamp,
        createdAt,
        updatedAt,
        acknowledgedAt,
        blockedAt,
        reports,
        signals,
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
    presence?: PresenceSignal;
    customerDetails?: Customer;
    crateLoans: CrateLoan[];
    onPack: (saleId: string) => void;
    onAssignClick: (sale: Sale) => void;
    onCompleteClick: (sale: Sale) => void;
}> = ({ task, presence, customerDetails, crateLoans, onPack, onAssignClick, onCompleteClick }) => {
    const location = task.locationQuery || task.destination;
    const mapUrl = location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;
    const pendingCrates = useMemo(
        () => (customerDetails ? crateLoans.filter((loan) => loanBelongsToCustomer(loan, customerDetails) && loan.status === 'Prestado') : []),
        [crateLoans, customerDetails],
    );
    const noteText = task.notes || customerDetails?.deliveryNotes;
    const recentReports = task.reports.slice(0, 2);
    const blockedOwnerName = task.ownerName || task.assigneeName;
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

                {(task.signals.length > 0 || task.reports.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-2">
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

                <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/60 p-4">
                    <p className={labelClass}>Destino</p>
                    <p className="mt-2 text-sm text-slate-200">{task.destination || task.sale?.destination || 'Sin direccion'}</p>
                    {task.assigneeName && <p className="mt-3 text-sm font-semibold text-slate-300">Responsable: {task.assigneeName}</p>}
                    {task.ownerName && task.ownerName !== task.assigneeName && <p className="mt-2 text-sm font-semibold text-slate-400">Owner: {task.ownerName}</p>}
                    {presence && (
                        <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.16em] ${presence.tone}`}>
                            {presence.label}
                        </span>
                    )}
                    {task.sale && <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Pedido: {task.sale.status}</p>}
                </div>

                {task.blockedReason && (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-200">Bloqueo</p>
                        <p className="mt-2 text-sm text-rose-50">{task.blockedReason}</p>
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

                {recentReports.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className={labelClass}>Reportes</p>
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">recientes</span>
                        </div>
                        <div className="mt-3 space-y-3">
                            {recentReports.map((report) => (
                                <div key={`${task.id}_${report.id}`} className={`rounded-2xl border px-3 py-3 ${reportToneMap[report.kind]}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-current">{report.summary}</p>
                                            {report.detail && <p className="mt-1 text-xs leading-5 text-slate-300">{report.detail}</p>}
                                        </div>
                                        <i className={`fa-solid ${reportIconMap[report.kind]} mt-0.5 text-xs opacity-80`}></i>
                                    </div>
                                    {(report.authorName || report.createdAt) && (
                                        <p className="mt-2 text-[11px] font-semibold text-slate-400">
                                            {[report.authorName, report.createdAt?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' / ')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
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
    const { sales, employees, customers, crateLoans, completeSale, markOrderAsPacked, approveInterpretation, taskReports, activities, activityLog } = data;
    const taskAssignments = ((data as BusinessData & { taskAssignments?: unknown }).taskAssignments ?? []) as unknown[];
    const [assignModal, setAssignModal] = useState<Sale | null>(null);
    const [completeModal, setCompleteModal] = useState<Sale | null>(null);
    const externalTaskReports = useMemo(() => buildExternalTaskReportIndex(taskReports), [taskReports]);
    const presenceIndex = useMemo(() => buildPresenceIndex(activities, activityLog, taskReports), [activities, activityLog, taskReports]);

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

        return [...normalizedTasks, ...fallbackTasks].map((task) => attachExternalReportsToTask(task, externalTaskReports)).sort(compareTasks);
    }, [employees, externalTaskReports, sales, taskAssignments]);

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

    const operationalIndicators = useMemo(
        () =>
            operationalTasks.reduce(
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
        [operationalTasks],
    );

    const packingTasks = useMemo(() => operationalTasks.filter((task) => task.stage === 'packing'), [operationalTasks]);
    const assignmentTasks = useMemo(() => operationalTasks.filter((task) => task.stage === 'assignment'), [operationalTasks]);
    const attentionItems = useMemo(() => buildAttentionItems(operationalTasks), [operationalTasks]);
    const liveActivity = useMemo(() => buildLiveActivity(operationalTasks, activityLog), [activityLog, operationalTasks]);
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

        return [...groupedRoutes.values()]
            .map((group) => ({
                ...group,
                presence: getPresenceSignal(presenceIndex, group.driverName),
                noAck: group.tasks.filter((task) => task.signals.some((signal) => signal.id === 'no_ack')).length,
                escalated: group.tasks.filter((task) => task.signals.some((signal) => signal.id === 'escalation')).length,
            }))
            .sort((left, right) => left.driverName.localeCompare(right.driverName));
    }, [operationalTasks, presenceIndex]);
    const routePresenceSummary = useMemo(() => {
        const namedRoutes = routesByDriver.filter((group) => group.driverName !== 'Sin asignar');
        return {
            total: namedRoutes.length,
            withSignal: namedRoutes.filter((group) => group.presence).length,
        };
    }, [routesByDriver]);

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

                <div className="mt-5 flex flex-wrap gap-2">
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
                    {routePresenceSummary.total > 0 && (
                        <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">
                            Con senal {routePresenceSummary.withSignal}/{routePresenceSummary.total}
                        </span>
                    )}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <div className={`${panelClass} p-5`}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className={labelClass}>SLA inmediato</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Sin acuse y escalacion</h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                            {attentionItems.length} foco
                        </span>
                    </div>

                    <div className="mt-4 space-y-3">
                        {attentionItems.length > 0 ? (
                            attentionItems.map((item) => (
                                <div key={item.id} className={`rounded-2xl border px-4 py-3 ${item.tone}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-current">{item.customerName}</p>
                                            <p className="mt-1 text-sm text-current/90">{item.title}</p>
                                        </div>
                                        <span className="rounded-full border border-current/15 bg-black/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-current">
                                            {item.label}
                                        </span>
                                    </div>
                                    {item.meta && <p className="mt-2 text-[11px] font-semibold text-current/80">{item.meta}</p>}
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
                                <p className="text-sm font-semibold text-white">Sin riesgos SLA activos.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`${panelClass} p-5`}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className={labelClass}>Realtime</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Actividad en vivo</h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                            {liveActivity.length}
                        </span>
                    </div>

                    <div className="mt-4 space-y-3">
                        {liveActivity.length > 0 ? (
                            liveActivity.map((item) => (
                                <div key={item.id} className={`rounded-2xl border px-4 py-3 ${item.tone}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full border border-current/15 bg-black/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-current">
                                                    {item.pill}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm font-semibold text-current">{item.summary}</p>
                                            {item.meta && <p className="mt-2 text-[11px] font-semibold text-current/80">{item.meta}</p>}
                                        </div>
                                        <i className={`fa-solid ${item.icon} mt-1 text-xs opacity-80`}></i>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
                                <p className="text-sm font-semibold text-white">Sin actividad operativa reciente.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <PrepColumn title="Empaque" eyebrow="" count={packingTasks.length} accent="text-amber-200">
                    {packingTasks.map((task) => (
                        <DeliveryCard
                            key={task.id}
                            task={task}
                            presence={getPresenceSignal(presenceIndex, task.assigneeName, task.ownerName)}
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
                            presence={getPresenceSignal(presenceIndex, task.assigneeName, task.ownerName)}
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
                        {routesByDriver.map(({ driverName, driverId, tasks, presence, noAck, escalated }) => (
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
                                        {presence && (
                                            <span className={`rounded-full border px-4 py-2 text-sm font-black ${presence.tone}`}>
                                                {presence.label}
                                            </span>
                                        )}
                                        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-100">
                                            {tasks.length} tareas
                                        </span>
                                        {noAck > 0 && (
                                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-100">
                                                {noAck} sin acuse
                                            </span>
                                        )}
                                        {escalated > 0 && (
                                            <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-black text-rose-100">
                                                {escalated} escalada(s)
                                            </span>
                                        )}
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
                                            presence={getPresenceSignal(presenceIndex, task.assigneeName, task.ownerName)}
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
