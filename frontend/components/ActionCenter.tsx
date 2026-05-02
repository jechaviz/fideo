import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import {
    ActionItem,
    Employee,
    OperationalException,
    OperationalExceptionKind,
    OperationalExceptionSeverity,
    PresenceRosterEntry,
    Sale,
    TaskRole,
    TaskStatus,
    View,
} from '../types';

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

type ExceptionScope = 'Operacion' | 'Caja' | 'Cobro' | 'Credito' | 'Activo';

type ExceptionItem = {
    id: string;
    scope: ExceptionScope;
    title: string;
    detail: string;
    meta?: string;
    label: string;
    tone: string;
    icon: string;
    priority: number;
    timestamp: Date;
    targetView: View;
    ctaText: string;
    taskId?: string;
    saleId?: string;
    reportId?: string;
    drawerId?: string;
    employeeId?: string | null;
    employeeName?: string | null;
    taskRole?: TaskRole;
    taskStatus?: TaskStatus;
    exceptionKind?: OperationalExceptionKind;
    exceptionSeverity?: OperationalExceptionSeverity;
};

type CashPulse = {
    openDrawers: number;
    exposedCash: number;
    pendingCashSales: number;
    pendingCashAmount: number;
    overdueDebtCount: number;
    overdueCrateCount: number;
};

type ExternalTaskReportIndex = {
    byTaskId: Map<string, TaskReport[]>;
    bySaleId: Map<string, TaskReport[]>;
};

type QueueTask = {
    id: string;
    source: TaskSource;
    saleId?: string;
    employeeId?: string | null;
    role?: TaskRole;
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

type PresenceRosterLike = PresenceRosterEntry & {
    status?: PresenceRosterEntry['status'];
};

type AssigneeOption = {
    employeeId: string;
    name: string;
    role: Employee['role'];
    status: PresenceRosterEntry['status'];
    lastSeenAt?: Date;
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

const presenceStatusRank: Record<PresenceRosterEntry['status'], number> = {
    active: 0,
    background: 1,
    idle: 2,
    offline: 3,
};

const inferTaskRoleFromStage = (stage: OperationalTaskStage): TaskRole => {
    if (stage === 'packing') return 'Empacador';
    if (stage === 'assignment' || stage === 'route') return 'Repartidor';
    return 'Admin';
};

const toTaskRole = (value: unknown): TaskRole | undefined => {
    if (typeof value !== 'string') return undefined;
    if (value === 'Admin' || value === 'Repartidor' || value === 'Empacador' || value === 'Cajero') return value;
    return undefined;
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

const formatCurrencyCompact = (value: number) =>
    value.toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 0,
    });

const toNumber = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.replace(/[^0-9.-]+/g, '');
        if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return undefined;
        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
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

const attachExternalReportsToTask = (task: QueueTask, externalReports: ExternalTaskReportIndex): QueueTask => {
    const linkedReports = [
        ...(externalReports.byTaskId.get(task.id) || []),
        ...(task.saleId ? externalReports.bySaleId.get(task.saleId) || [] : []),
    ];
    if (!linkedReports.length) return task;

    const reports = mergeTaskReports(task.reports, linkedReports);
    const signals = mergeTaskSignals(
        task.signals,
        buildTaskSignals({
            sources: [],
            status: task.status,
            createdAt: task.createdAt,
            acknowledgedAt: undefined,
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

const buildAttentionItems = (tasks: QueueTask[]) =>
    tasks
        .map<AttentionItem | null>((task) => {
            const noAckSignal = task.signals.find((signal) => signal.id === 'no_ack');
            const escalated = task.signals.some((signal) => signal.id === 'escalation');
            const blocked = task.status === 'blocked';
            if (!noAckSignal && !escalated && !blocked && task.reports.length === 0) return null;

            const priority = escalated ? 0 : blocked ? 1 : noAckSignal ? ((getAgeMinutes(task.createdAt) || 0) >= 45 ? 1 : 2) : 3;
            const meta = [
                stageLabelMap[task.stage],
                task.assigneeName || task.ownerName,
                task.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            ]
                .filter(Boolean)
                .join(' / ');

            const nextItem: AttentionItem = {
                id: task.id,
                title: task.title,
                customerName: task.customerName || 'Operacion',
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

const buildLiveActivity = (tasks: QueueTask[], activityLog: BusinessData['activityLog']) => {
    const reportEvents = tasks.flatMap((task) =>
        task.reports.map((report) => ({
            id: `task_report_${task.id}_${report.id}`,
            summary: report.summary,
            meta: [task.customerName, report.authorName || task.ownerName || task.assigneeName, formatAgeCompact(report.createdAt)].filter(Boolean).join(' / '),
            createdAt: report.createdAt || task.updatedAt || task.createdAt || task.timestamp,
            tone: reportToneMap[report.kind],
            icon: reportIconMap[report.kind],
            pill: stageLabelMap[task.stage],
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

const exceptionScopeByKind: Record<OperationalExceptionKind, ExceptionScope> = {
    task_report: 'Operacion',
    task_blocked: 'Operacion',
    cash_drawer: 'Caja',
    sla: 'Operacion',
    system: 'Operacion',
    other: 'Operacion',
};

const exceptionToneBySeverity: Record<OperationalExceptionSeverity, string> = {
    critical: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
    high: 'border-amber-400/20 bg-amber-400/10 text-amber-50',
    normal: 'border-white/10 bg-white/[0.03] text-slate-100',
};

const exceptionIconByKind: Record<OperationalExceptionKind, string> = {
    task_report: 'fa-file-lines',
    task_blocked: 'fa-circle-exclamation',
    cash_drawer: 'fa-cash-register',
    sla: 'fa-hourglass-half',
    system: 'fa-bolt',
    other: 'fa-circle-info',
};

const exceptionViewByKind = (exception: OperationalException): View => {
    if (exception.drawerId || exception.kind === 'cash_drawer') return 'finances';
    if (exception.customerId || exception.customerName) return 'customers';
    if (exception.taskId || exception.saleId) return 'deliveries';
    return 'dashboard';
};

const dedupeExceptionItems = (items: ExceptionItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key =
            item.reportId ||
            (item.taskId ? `${item.exceptionKind || 'task'}:${item.taskId}` : undefined) ||
            (item.drawerId ? `${item.exceptionKind || 'drawer'}:${item.drawerId}` : undefined) ||
            item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const buildRuntimeExceptionItems = (exceptions: OperationalException[]): ExceptionItem[] =>
    exceptions
        .filter((exception) => exception.status !== 'resolved')
        .map<ExceptionItem>((exception) => ({
            id: exception.id,
            scope: exceptionScopeByKind[exception.kind] || 'Operacion',
            title: exception.title,
            detail: exception.detail || exception.summary,
            meta: [
                exception.employeeName,
                exception.role || undefined,
                formatAgeCompact(exception.lastSeenAt || exception.updatedAt || exception.createdAt),
            ]
                .filter(Boolean)
                .join(' / '),
            label: exception.severity === 'critical' ? 'Critica' : exception.severity === 'high' ? 'Alta' : 'Abierta',
            tone: exceptionToneBySeverity[exception.severity] || exceptionToneBySeverity.normal,
            icon: exceptionIconByKind[exception.kind] || 'fa-circle-info',
            priority: exception.severity === 'critical' ? 0 : exception.severity === 'high' ? 1 : 2,
            timestamp: exception.updatedAt || exception.lastSeenAt || exception.createdAt,
            targetView: exceptionViewByKind(exception),
            ctaText:
                exception.drawerId || exception.kind === 'cash_drawer'
                    ? 'Abrir caja'
                    : exception.taskId || exception.saleId
                      ? 'Abrir entregas'
                      : exception.customerId || exception.customerName
                        ? 'Ver clientes'
                        : 'Abrir',
            taskId: exception.taskId || undefined,
            saleId: exception.saleId || undefined,
            reportId: exception.reportId || undefined,
            drawerId: exception.drawerId || undefined,
            employeeId: exception.employeeId || undefined,
            employeeName: exception.employeeName || undefined,
            taskRole: toTaskRole(exception.role),
            exceptionKind: exception.kind,
            exceptionSeverity: exception.severity,
        }))
        .sort(compareExceptionItems);

const compareExceptionItems = (left: ExceptionItem, right: ExceptionItem) =>
    left.priority - right.priority || right.timestamp.getTime() - left.timestamp.getTime();

const buildExceptionStub = (item: ExceptionItem): OperationalException => ({
    id: item.id,
    kind:
        item.exceptionKind ||
        (item.reportId ? 'task_report' : item.drawerId ? 'cash_drawer' : item.taskStatus === 'blocked' ? 'task_blocked' : 'sla'),
    severity: item.exceptionSeverity || (item.priority === 0 ? 'critical' : item.priority <= 2 ? 'high' : 'normal'),
    status: 'open',
    title: item.title,
    summary: item.detail,
    detail: item.meta,
    createdAt: item.timestamp,
    updatedAt: item.timestamp,
    role: item.taskRole || null,
    employeeId: item.employeeId || null,
    employeeName: item.employeeName || null,
    taskId: item.taskId || null,
    saleId: item.saleId || null,
    reportId: item.reportId || null,
    drawerId: item.drawerId || null,
    source: 'action_center',
    meta: null,
});

const findOperationalExceptionRecord = (item: ExceptionItem, exceptions: OperationalException[]) =>
    exceptions.find((exception) => exception.id === item.id)
    || (item.reportId ? exceptions.find((exception) => exception.reportId === item.reportId && exception.status !== 'resolved') : undefined)
    || (item.taskId
        ? exceptions.find(
              (exception) =>
                  exception.taskId === item.taskId &&
                  exception.status !== 'resolved' &&
                  (!item.exceptionKind || exception.kind === item.exceptionKind || exception.kind === 'sla' || exception.kind === 'task_blocked'),
          )
        : undefined)
    || (item.drawerId
        ? exceptions.find(
              (exception) =>
                  exception.drawerId === item.drawerId &&
                  exception.status !== 'resolved' &&
                  (exception.kind === 'cash_drawer' || !item.exceptionKind),
          )
        : undefined)
    || null;

const getResolutionPayload = (item: ExceptionItem): { nextTaskStatus?: TaskStatus; resolutionNote?: string } => {
    if (item.taskStatus === 'assigned') {
        return { nextTaskStatus: 'acknowledged', resolutionNote: 'Acuse desde ActionCenter' };
    }
    if (item.taskStatus === 'blocked') {
        return { nextTaskStatus: 'in_progress', resolutionNote: 'Desbloqueada desde ActionCenter' };
    }
    if (item.reportId) {
        return { resolutionNote: 'Resuelta desde ActionCenter' };
    }
    return {};
};

const getFollowUpPayload = (item: ExceptionItem) => {
    const isBlocked = item.taskStatus === 'blocked' || item.exceptionKind === 'task_blocked';
    const isSla = item.exceptionKind === 'sla';
    const summary = isSla
        ? 'Seguimiento SLA'
        : isBlocked
          ? 'Seguimiento bloqueo'
          : item.reportId
            ? 'Seguimiento reporte'
            : 'Seguimiento operativo';

    return {
        note: summary,
        reason: [item.title, item.detail !== item.title ? item.detail : undefined, item.meta].filter(Boolean).join(' / ') || undefined,
        employeeId: item.employeeId || null,
        employeeName: item.employeeName || null,
    };
};

const getAssignableRolesForException = (item: ExceptionItem): TaskRole[] => {
    if (item.taskRole) {
        return item.taskRole === 'Admin' ? ['Admin'] : [item.taskRole, 'Admin'];
    }
    if (item.scope === 'Caja' || item.scope === 'Cobro' || item.scope === 'Credito') {
        return ['Cajero', 'Admin'];
    }
    if (item.scope === 'Activo') {
        return ['Admin'];
    }
    return ['Admin', 'Empacador', 'Repartidor'];
};

const buildAssigneeOptions = (item: ExceptionItem, employees: Employee[], staffPresence: PresenceRosterLike[]) => {
    const allowedRoles = new Set(getAssignableRolesForException(item));
    const presenceByEmployeeId = new Map<string, PresenceRosterLike>();

    staffPresence.forEach((entry) => {
        if (!entry.employeeId) return;
        const current = presenceByEmployeeId.get(entry.employeeId);
        const currentTimestamp = current?.lastSeenAt ? new Date(current.lastSeenAt).getTime() : 0;
        const nextTimestamp = entry.lastSeenAt ? new Date(entry.lastSeenAt).getTime() : 0;
        if (!current || nextTimestamp >= currentTimestamp) {
            presenceByEmployeeId.set(entry.employeeId, entry);
        }
    });

    return employees
        .filter((employee) => allowedRoles.has(employee.role as TaskRole))
        .map((employee) => {
            const presence = presenceByEmployeeId.get(employee.id);
            return {
                employeeId: employee.id,
                name: employee.name,
                role: employee.role,
                status: presence?.status || 'offline',
                lastSeenAt: toDate(presence?.lastSeenAt),
            } satisfies AssigneeOption;
        })
        .sort((left, right) => {
            const statusDelta = presenceStatusRank[left.status] - presenceStatusRank[right.status];
            if (statusDelta !== 0) return statusDelta;
            const leftRecent = left.lastSeenAt?.getTime() || 0;
            const rightRecent = right.lastSeenAt?.getTime() || 0;
            if (leftRecent !== rightRecent) return rightRecent - leftRecent;
            return left.name.localeCompare(right.name, 'es');
        });
};

const buildOperationalExceptionItems = (tasks: QueueTask[], presenceIndex: Map<string, PresenceEntry>) =>
    tasks
        .map<ExceptionItem | null>((task) => {
            const latestReport = task.reports[0];
            const noAckSignal = task.signals.find((signal) => signal.id === 'no_ack');
            const escalated = task.signals.some((signal) => signal.id === 'escalation');
            const presence = getPresenceSignal(presenceIndex, task.assigneeName, task.ownerName);
            const meta = [
                stageLabelMap[task.stage],
                task.assigneeName || task.ownerName,
                presence?.label,
            ]
                .filter(Boolean)
                .join(' / ');

            if (escalated) {
                return {
                    id: `exception_task_escalated_${task.id}`,
                    scope: 'Operacion',
                    title: task.title,
                    detail: latestReport?.summary || task.blockedReason || task.description,
                    meta,
                    label: 'Escalada',
                    tone: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
                    icon: 'fa-bolt',
                    priority: 0,
                    timestamp: latestReport?.createdAt || task.blockedAt || task.updatedAt || task.timestamp,
                    targetView: task.targetView,
                    ctaText: task.ctaText,
                    taskId: task.id,
                    saleId: task.saleId,
                    reportId: latestReport?.id,
                    employeeId: task.employeeId,
                    employeeName: task.assigneeName || task.ownerName,
                    taskRole: task.role,
                    taskStatus: task.status,
                    exceptionKind: latestReport?.id ? 'task_report' : 'task_blocked',
                    exceptionSeverity: 'critical',
                } satisfies ExceptionItem;
            }

            if (task.status === 'blocked') {
                return {
                    id: `exception_task_blocked_${task.id}`,
                    scope: 'Operacion',
                    title: task.title,
                    detail: task.blockedReason || latestReport?.summary || task.description,
                    meta,
                    label: 'Bloqueo',
                    tone: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
                    icon: 'fa-circle-exclamation',
                    priority: 1,
                    timestamp: task.blockedAt || latestReport?.createdAt || task.updatedAt || task.timestamp,
                    targetView: task.targetView,
                    ctaText: task.ctaText,
                    taskId: task.id,
                    saleId: task.saleId,
                    reportId: latestReport?.id,
                    employeeId: task.employeeId,
                    employeeName: task.assigneeName || task.ownerName,
                    taskRole: task.role,
                    taskStatus: task.status,
                    exceptionKind: 'task_blocked',
                    exceptionSeverity: 'high',
                } satisfies ExceptionItem;
            }

            if (noAckSignal) {
                const ageMinutes = getAgeMinutes(task.createdAt) || 0;
                return {
                    id: `exception_task_ack_${task.id}`,
                    scope: 'Operacion',
                    title: task.title,
                    detail: task.description,
                    meta,
                    label: noAckSignal.label,
                    tone: 'border-amber-400/20 bg-amber-400/10 text-amber-50',
                    icon: 'fa-hourglass-half',
                    priority: ageMinutes >= 45 ? 1 : 2,
                    timestamp: task.createdAt || task.timestamp,
                    targetView: task.targetView,
                    ctaText: task.ctaText,
                    taskId: task.id,
                    saleId: task.saleId,
                    employeeId: task.employeeId,
                    employeeName: task.assigneeName || task.ownerName,
                    taskRole: task.role,
                    taskStatus: task.status,
                    exceptionKind: 'sla',
                    exceptionSeverity: ageMinutes >= 45 ? 'critical' : 'high',
                } satisfies ExceptionItem;
            }

            if (latestReport) {
                return {
                    id: `exception_task_report_${task.id}`,
                    scope: 'Operacion',
                    title: task.title,
                    detail: latestReport.summary,
                    meta,
                    label: latestReport.kind === 'blocker' ? 'Incidencia' : 'Reporte',
                    tone:
                        latestReport.kind === 'blocker'
                            ? 'border-rose-400/20 bg-rose-400/10 text-rose-50'
                            : 'border-white/10 bg-white/[0.03] text-slate-100',
                    icon: latestReport.kind === 'blocker' ? 'fa-circle-exclamation' : 'fa-file-lines',
                    priority: latestReport.kind === 'blocker' ? 2 : 3,
                    timestamp: latestReport.createdAt || task.updatedAt || task.timestamp,
                    targetView: task.targetView,
                    ctaText: task.ctaText,
                    taskId: task.id,
                    saleId: task.saleId,
                    reportId: latestReport.id,
                    employeeId: task.employeeId,
                    employeeName: task.assigneeName || task.ownerName,
                    taskRole: task.role,
                    taskStatus: task.status,
                    exceptionKind: 'task_report',
                    exceptionSeverity: latestReport.kind === 'blocker' ? 'high' : 'normal',
                } satisfies ExceptionItem;
            }

            return null;
        })
        .filter((item): item is ExceptionItem => Boolean(item))
        .sort(compareExceptionItems);

const buildCashExceptionItems = ({
    cashDrawers,
    cashDrawerActivities,
    sales,
    crateLoans,
    crateTypes,
    activityLog,
}: {
    cashDrawers: BusinessData['cashDrawers'];
    cashDrawerActivities: BusinessData['cashDrawerActivities'];
    sales: BusinessData['sales'];
    crateLoans: BusinessData['crateLoans'];
    crateTypes: BusinessData['crateTypes'];
    activityLog: BusinessData['activityLog'];
}) => {
    const items: ExceptionItem[] = [];
    const now = new Date();

    cashDrawers.forEach((drawer) => {
        const lastOpened = toDate(drawer.lastOpened);
        const drawerActivities = cashDrawerActivities
            .filter((activity) => activity.drawerId === drawer.id)
            .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
        const lastActivity = drawerActivities[0];
        const openAge = getAgeMinutes(lastOpened);

        if (drawer.balance < 0) {
            items.push({
                id: `exception_drawer_negative_${drawer.id}`,
                scope: 'Caja',
                title: `${drawer.name} en negativo`,
                detail: 'La caja quedo por debajo de cero y requiere revision inmediata.',
                meta: [lastActivity ? `Ult. mov ${formatAgeCompact(toDate(lastActivity.timestamp))}` : undefined].filter(Boolean).join(' / '),
                label: formatCurrencyCompact(drawer.balance),
                tone: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
                icon: 'fa-cash-register',
                priority: 0,
                timestamp: toDate(lastActivity?.timestamp) || lastOpened || now,
                targetView: 'finances',
                ctaText: 'Abrir caja',
                drawerId: drawer.id,
                exceptionKind: 'cash_drawer',
                exceptionSeverity: 'critical',
            });
        }

        if (drawer.status === 'Abierta' && openAge && openAge >= 540) {
            items.push({
                id: `exception_drawer_open_${drawer.id}`,
                scope: 'Caja',
                title: `${drawer.name} sigue abierta`,
                detail: 'La caja lleva demasiado tiempo abierta y necesita corte o relevo.',
                meta: [lastActivity ? `Ult. mov ${formatAgeCompact(toDate(lastActivity.timestamp))}` : undefined].filter(Boolean).join(' / '),
                label: openAge >= 1440 ? `${Math.floor(openAge / 1440)}d` : `${Math.floor(openAge / 60)}h`,
                tone: 'border-amber-400/20 bg-amber-400/10 text-amber-50',
                icon: 'fa-lock-open',
                priority: 1,
                timestamp: lastOpened || now,
                targetView: 'finances',
                ctaText: 'Revisar corte',
                drawerId: drawer.id,
                exceptionKind: 'cash_drawer',
                exceptionSeverity: 'high',
            });
        }

        if (drawer.status === 'Abierta' && drawer.balance >= 15000) {
            items.push({
                id: `exception_drawer_exposure_${drawer.id}`,
                scope: 'Caja',
                title: `${drawer.name} con efectivo alto`,
                detail: 'Hay exposicion relevante en caja y conviene mover o cortar saldo.',
                meta: [lastActivity ? `Ult. mov ${formatAgeCompact(toDate(lastActivity.timestamp))}` : undefined].filter(Boolean).join(' / '),
                label: formatCurrencyCompact(drawer.balance),
                tone: 'border-sky-400/20 bg-sky-400/10 text-sky-50',
                icon: 'fa-vault',
                priority: 2,
                timestamp: toDate(lastActivity?.timestamp) || lastOpened || now,
                targetView: 'finances',
                ctaText: 'Ver caja',
                drawerId: drawer.id,
                exceptionKind: 'cash_drawer',
                exceptionSeverity: 'normal',
            });
        }
    });

    const cashPendingSales = sales.filter(
        (sale) =>
            sale.paymentMethod === 'Efectivo' &&
            sale.paymentStatus !== 'Pagado' &&
            sale.status !== 'Cancelado',
    );
    if (cashPendingSales.length > 0) {
        const total = cashPendingSales.reduce((sum, sale) => sum + sale.price, 0);
        const delivered = cashPendingSales.filter((sale) => sale.status === 'Completado').length;
        const onRoute = cashPendingSales.filter((sale) => sale.status === 'En Ruta').length;
        const pending = cashPendingSales.filter((sale) => sale.status === 'Listo para Entrega').length;
        items.push({
            id: 'exception_cash_pending_sales',
            scope: 'Cobro',
            title: 'Cobros en espera',
            detail: `${cashPendingSales.length} venta(s) en efectivo siguen fuera del cierre de caja.`,
            meta: [`${delivered} completadas`, `${onRoute} en ruta`, `${pending} listas`].filter(Boolean).join(' / '),
            label: formatCurrencyCompact(total),
            tone: delivered > 0 ? 'border-rose-400/20 bg-rose-400/10 text-rose-50' : 'border-amber-400/20 bg-amber-400/10 text-amber-50',
            icon: 'fa-money-bill-wave',
            priority: delivered > 0 ? 1 : 2,
            timestamp: cashPendingSales
                .map((sale) => new Date(sale.timestamp))
                .sort((left, right) => right.getTime() - left.getTime())[0] || now,
            targetView: 'finances',
            ctaText: 'Abrir finanzas',
            exceptionKind: 'other',
            exceptionSeverity: delivered > 0 ? 'high' : 'normal',
        });
    }

    const overdueDebtByCustomer = new Map<string, { total: number; oldestAge: number; count: number; lastTimestamp: Date }>();
    sales
        .filter((sale) => sale.status === 'Completado' && sale.paymentStatus === 'En Deuda')
        .forEach((sale) => {
            const ageDays = Math.max(1, Math.floor((now.getTime() - new Date(sale.timestamp).getTime()) / 86400000));
            if (ageDays < 3) return;

            const current = overdueDebtByCustomer.get(sale.customer);
            if (current) {
                current.total += sale.price;
                current.count += 1;
                current.oldestAge = Math.max(current.oldestAge, ageDays);
                if (new Date(sale.timestamp).getTime() > current.lastTimestamp.getTime()) current.lastTimestamp = new Date(sale.timestamp);
                return;
            }

            overdueDebtByCustomer.set(sale.customer, {
                total: sale.price,
                oldestAge: ageDays,
                count: 1,
                lastTimestamp: new Date(sale.timestamp),
            });
        });

    [...overdueDebtByCustomer.entries()]
        .sort((left, right) => right[1].total - left[1].total)
        .slice(0, 3)
        .forEach(([customerName, debt]) => {
            items.push({
                id: `exception_debt_${customerName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
                scope: 'Cobro',
                title: `Cobro vencido ${customerName}`,
                detail: `${debt.count} venta(s) completadas siguen abiertas en cartera.`,
                meta: `Mayor edad ${debt.oldestAge}d`,
                label: formatCurrencyCompact(debt.total),
                tone: debt.oldestAge >= 7 ? 'border-rose-400/20 bg-rose-400/10 text-rose-50' : 'border-amber-400/20 bg-amber-400/10 text-amber-50',
                icon: 'fa-file-invoice-dollar',
                priority: debt.oldestAge >= 7 ? 1 : 2,
                timestamp: debt.lastTimestamp,
                targetView: 'finances',
                ctaText: 'Ver cartera',
                exceptionKind: 'other',
                exceptionSeverity: debt.oldestAge >= 7 ? 'high' : 'normal',
            });
        });

    const overdueCrates = crateLoans.filter((loan) => loan.status !== 'Devuelto' && new Date(loan.dueDate) < now);
    if (overdueCrates.length > 0) {
        const exposure = overdueCrates.reduce((sum, loan) => {
            const crateType = crateTypes.find((item) => item.id === loan.crateTypeId);
            return sum + loan.quantity * (crateType?.cost || 50);
        }, 0);
        items.push({
            id: 'exception_overdue_crates',
            scope: 'Activo',
            title: 'Cajas vencidas en campo',
            detail: `${overdueCrates.length} prestamo(s) siguen sin retorno.`,
            meta: `${new Set(overdueCrates.map((loan) => loan.customer)).size} cliente(s)`,
            label: formatCurrencyCompact(exposure),
            tone: 'border-orange-400/20 bg-orange-400/10 text-orange-50',
            icon: 'fa-box-open',
            priority: 2,
            timestamp: overdueCrates
                .map((loan) => new Date(loan.dueDate))
                .sort((left, right) => right.getTime() - left.getTime())[0] || now,
            targetView: 'customers',
            ctaText: 'Ver clientes',
            exceptionKind: 'other',
            exceptionSeverity: 'normal',
        });
    }

    activityLog
        .filter((entry) => entry.type === 'CREDIT_REJECTED' || entry.type === 'CREDIT_LIMIT_EXCEEDED')
        .slice(0, 3)
        .forEach((entry) => {
            const timestamp = toDate(entry.timestamp) || now;
            const details = asRecord(entry.details);
            items.push({
                id: `exception_credit_${entry.id}`,
                scope: 'Credito',
                title: entry.type === 'CREDIT_LIMIT_EXCEEDED' ? 'Limite excedido' : 'Credito rechazado',
                detail: entry.description,
                meta: readString([details], ['Motivo', 'Cliente']) || formatAgeCompact(timestamp),
                label: formatAgeCompact(timestamp) || 'Ahora',
                tone: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
                icon: 'fa-credit-card',
                priority: 1,
                timestamp,
                targetView: 'customers',
                ctaText: 'Ver clientes',
                exceptionKind: 'other',
                exceptionSeverity: 'high',
            });
        });

    activityLog
        .filter((entry) => entry.type === 'CAJA_OPERACION')
        .forEach((entry) => {
            const timestamp = toDate(entry.timestamp) || now;
            const details = asRecord(entry.details);
            const difference = toNumber(details?.Diferencia);
            if (!difference) return;

            items.push({
                id: `exception_cash_difference_${entry.id}`,
                scope: 'Caja',
                title: 'Diferencia en corte',
                detail: entry.description,
                meta: formatAgeCompact(timestamp),
                label: `${difference > 0 ? '+' : ''}${formatCurrencyCompact(difference)}`,
                tone: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
                icon: 'fa-scale-balanced',
                priority: Math.abs(difference) >= 1000 ? 0 : 1,
                timestamp,
                targetView: 'finances',
                ctaText: 'Revisar caja',
                exceptionKind: 'cash_drawer',
                exceptionSeverity: Math.abs(difference) >= 1000 ? 'critical' : 'high',
            });
        });

    return items.sort(compareExceptionItems);
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
        employeeId: sale.assignedEmployeeId || null,
        role: inferTaskRoleFromStage(stage),
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
    const employeeId = readString(sources, ['employeeId', 'assigneeId', 'driverId', 'ownerId']) || sale?.assignedEmployeeId || null;
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
        employeeId,
        role: toTaskRole(readString(sources, ['role', 'taskRole', 'assignedRole'])) || inferTaskRoleFromStage(stage),
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

const QueueTaskCard: React.FC<{ task: QueueTask; onOpen: (task: QueueTask) => void; presence?: PresenceSignal }> = ({ task, onOpen, presence }) => {
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
                {presence && (
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.16em] ${presence.tone}`}>
                        {presence.label}
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

const exceptionScopeToneMap: Record<ExceptionScope, string> = {
    Operacion: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
    Caja: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    Cobro: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    Credito: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
    Activo: 'border-orange-400/20 bg-orange-400/10 text-orange-100',
};

const ExceptionRow: React.FC<{
    item: ExceptionItem;
    onOpen: (item: ExceptionItem) => void;
    onFollowUp: (item: ExceptionItem) => void;
    onResolve: (item: ExceptionItem) => void;
    onStartReassign: (item: ExceptionItem) => void;
    onCancelReassign: () => void;
    onConfirmReassign: (item: ExceptionItem) => void;
    onSelectAssignee: (itemId: string, employeeId: string) => void;
    assigneeOptions: AssigneeOption[];
    selectedAssigneeId?: string;
    isReassigning: boolean;
    isFollowingUp: boolean;
    isResolving: boolean;
    isSubmittingReassign: boolean;
    canFollowUp: boolean;
    canResolve: boolean;
    canReassign: boolean;
}> = ({
    item,
    onOpen,
    onFollowUp,
    onResolve,
    onStartReassign,
    onCancelReassign,
    onConfirmReassign,
    onSelectAssignee,
    assigneeOptions,
    selectedAssigneeId,
    isReassigning,
    isFollowingUp,
    isResolving,
    isSubmittingReassign,
    canFollowUp,
    canResolve,
    canReassign,
}) => (
    <div className={`rounded-[1.5rem] border px-4 py-3 ${item.tone}`}>
        <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-black/10">
                <i className={`fa-solid ${item.icon} text-sm text-current`}></i>
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${exceptionScopeToneMap[item.scope]}`}>
                        {item.scope}
                    </span>
                    <span className="inline-flex rounded-full border border-current/15 bg-black/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-current">
                        {item.label}
                    </span>
                </div>
                <p className="mt-2 text-sm font-black text-current">{item.title}</p>
                <p className="mt-1 text-sm leading-5 text-current/90">{item.detail}</p>
                {item.meta && <p className="mt-2 text-[11px] font-semibold text-current/75">{item.meta}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                    {canFollowUp && (
                        <button
                            onClick={() => onFollowUp(item)}
                            disabled={isFollowingUp}
                            className="inline-flex items-center justify-center rounded-2xl border border-current/15 bg-black/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-current transition hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {isFollowingUp ? '...' : 'Seguir'}
                        </button>
                    )}
                    <button
                        onClick={() => onResolve(item)}
                        disabled={!canResolve || isResolving}
                        className="inline-flex items-center justify-center rounded-2xl border border-current/15 bg-black/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-current transition hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {isResolving ? '...' : 'Resolver'}
                    </button>
                    <button
                        onClick={() => (isReassigning ? onCancelReassign() : onStartReassign(item))}
                        disabled={!canReassign || isSubmittingReassign}
                        className="inline-flex items-center justify-center rounded-2xl border border-current/15 bg-black/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-current transition hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {isReassigning ? 'Cerrar' : 'Mover'}
                    </button>
                </div>

                {isReassigning && (
                    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-current/15 bg-black/10 p-3 md:flex-row">
                        <select
                            value={selectedAssigneeId || ''}
                            onChange={(event) => onSelectAssignee(item.id, event.target.value)}
                            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-current/30"
                        >
                            <option value="">Asignar...</option>
                            {assigneeOptions.map((option) => (
                                <option key={option.employeeId} value={option.employeeId}>
                                    {option.name} · {option.role} · {option.status}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => onConfirmReassign(item)}
                            disabled={!selectedAssigneeId || isSubmittingReassign}
                            className="inline-flex items-center justify-center rounded-2xl bg-black/20 px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-current transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {isSubmittingReassign ? '...' : 'Confirmar'}
                        </button>
                    </div>
                )}
            </div>
            <button
                onClick={() => onOpen(item)}
                className="inline-flex flex-shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-black/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-current transition hover:bg-black/20"
            >
                {item.ctaText}
            </button>
        </div>
    </div>
);

const ActionCenter: React.FC<{ data: BusinessData }> = ({ data }) => {
    const {
        actionItems,
        employees,
        sales,
        setCurrentView,
        taskReports,
        activities,
        activityLog,
        currentRole,
        operationalExceptions,
        followUpException,
        reassignTask,
        resolveException,
        staffPresence,
        cashDrawers,
        cashDrawerActivities,
        crateLoans,
        crateTypes,
    } = data;
    const [activeReassignId, setActiveReassignId] = useState<string | null>(null);
    const [selectedAssignees, setSelectedAssignees] = useState<Record<string, string>>({});
    const [pendingAction, setPendingAction] = useState<{ itemId: string; kind: 'follow_up' | 'resolve' | 'reassign' } | null>(null);
    const taskAssignments = ((data as BusinessData & { taskAssignments?: unknown }).taskAssignments ?? []) as unknown[];
    const exceptionRecords = useMemo(
        () => (Array.isArray(operationalExceptions) ? (operationalExceptions as OperationalException[]) : []),
        [operationalExceptions],
    );
    const staffPresenceRoster = useMemo(
        () => (Array.isArray(staffPresence) ? (staffPresence as PresenceRosterLike[]) : []),
        [staffPresence],
    );
    const externalTaskReports = useMemo(() => buildExternalTaskReportIndex(taskReports), [taskReports]);
    const presenceIndex = useMemo(() => buildPresenceIndex(activities, activityLog, taskReports), [activities, activityLog, taskReports]);

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

        return [...normalizedTasks, ...fallbackTasks].map((task) => attachExternalReportsToTask(task, externalTaskReports)).sort(compareQueueTasks);
    }, [externalTaskReports, sales, taskAssignments]);

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
    const attentionItems = useMemo(() => buildAttentionItems(queueTasks), [queueTasks]);
    const liveActivity = useMemo(() => buildLiveActivity(queueTasks, activityLog), [activityLog, queueTasks]);
    const operationalExceptionItems = useMemo(
        () => buildOperationalExceptionItems(queueTasks, presenceIndex),
        [presenceIndex, queueTasks],
    );
    const runtimeExceptionItems = useMemo(
        () =>
            buildRuntimeExceptionItems(exceptionRecords).map<ExceptionItem>((item) => {
                const linkedTask =
                    (item.taskId ? queueTasks.find((task) => task.id === item.taskId) : undefined)
                    || (item.reportId ? queueTasks.find((task) => task.reports.some((report) => report.id === item.reportId)) : undefined);
                if (!linkedTask) return item;

                return {
                    ...item,
                    saleId: item.saleId || linkedTask.saleId,
                    employeeId: item.employeeId ?? linkedTask.employeeId,
                    employeeName: item.employeeName ?? linkedTask.assigneeName ?? linkedTask.ownerName,
                    taskRole: item.taskRole || linkedTask.role,
                    taskStatus: item.taskStatus || linkedTask.status,
                };
            }),
        [exceptionRecords, queueTasks],
    );
    const cashExceptionItems = useMemo(
        () =>
            buildCashExceptionItems({
                cashDrawers,
                cashDrawerActivities,
                sales,
                crateLoans,
                crateTypes,
                activityLog,
            }),
        [activityLog, cashDrawerActivities, cashDrawers, crateLoans, crateTypes, sales],
    );
    const isAdminOrCashier = currentRole === 'Admin' || currentRole === 'Cajero';
    const exceptionQueue = useMemo(
        () =>
            dedupeExceptionItems([
                ...runtimeExceptionItems,
                ...(isAdminOrCashier ? [...operationalExceptionItems, ...cashExceptionItems] : operationalExceptionItems),
            ])
                .sort(compareExceptionItems)
                .slice(0, 8),
        [cashExceptionItems, isAdminOrCashier, operationalExceptionItems, runtimeExceptionItems],
    );
    const cashPulse = useMemo(() => {
        const openDrawers = cashDrawers.filter((drawer) => drawer.status === 'Abierta');
        const cashPendingSales = sales.filter(
            (sale) => sale.paymentMethod === 'Efectivo' && sale.paymentStatus !== 'Pagado' && sale.status !== 'Cancelado',
        );
        const overdueDebtCount = new Set(
            sales
                .filter((sale) => sale.status === 'Completado' && sale.paymentStatus === 'En Deuda')
                .filter((sale) => Math.max(1, Math.floor((Date.now() - new Date(sale.timestamp).getTime()) / 86400000)) >= 3)
                .map((sale) => sale.customer),
        ).size;

        return {
            openDrawers: openDrawers.length,
            exposedCash: openDrawers.reduce((sum, drawer) => sum + Math.max(0, drawer.balance), 0),
            pendingCashSales: cashPendingSales.length,
            pendingCashAmount: cashPendingSales.reduce((sum, sale) => sum + sale.price, 0),
            overdueDebtCount,
            overdueCrateCount: crateLoans.filter((loan) => loan.status !== 'Devuelto' && new Date(loan.dueDate) < new Date()).length,
        } satisfies CashPulse;
    }, [cashDrawers, crateLoans, sales]);
    const compactLiveActivity = useMemo(() => liveActivity.slice(0, 3), [liveActivity]);
    const responsiblePresenceSummary = useMemo(() => {
        const names = queueTasks.reduce<string[]>((accumulator, task) => {
            const candidate = task.assigneeName || task.ownerName;
            if (typeof candidate !== 'string' || !candidate.length || accumulator.includes(candidate)) return accumulator;
            accumulator.push(candidate);
            return accumulator;
        }, []);
        return {
            total: names.length,
            withSignal: names.filter((name) => Boolean(getPresenceSignal(presenceIndex, name))).length,
        };
    }, [presenceIndex, queueTasks]);

    const secondaryActionItems = useMemo(
        () => actionItems.filter((item) => item.type !== 'PACK_ORDER' && item.type !== 'ASSIGN_DELIVERY'),
        [actionItems],
    );
    const assigneeOptionsByExceptionId = useMemo(
        () =>
            exceptionQueue.reduce<Record<string, AssigneeOption[]>>((accumulator, item) => {
                accumulator[item.id] = item.taskId ? buildAssigneeOptions(item, employees, staffPresenceRoster) : [];
                return accumulator;
            }, {}),
        [employees, exceptionQueue, staffPresenceRoster],
    );
    const assignmentTaskIds = useMemo(
        () => new Set(queueTasks.filter((task) => task.source === 'assignment').map((task) => task.id)),
        [queueTasks],
    );
    const exceptionRecordByItemId = useMemo(
        () =>
            exceptionQueue.reduce<Record<string, OperationalException | null>>((accumulator, item) => {
                accumulator[item.id] = findOperationalExceptionRecord(item, exceptionRecords);
                return accumulator;
            }, {}),
        [exceptionQueue, exceptionRecords],
    );

    const handleTaskOpen = (task: QueueTask) => {
        setCurrentView(task.targetView);
    };

    const handleAction = (item: ActionItem) => {
        setCurrentView(item.cta.targetView);
    };

    const handleExceptionOpen = (item: ExceptionItem) => {
        setCurrentView(item.targetView);
    };

    const handleExceptionFollowUp = async (item: ExceptionItem) => {
        if (!item.taskId || !assignmentTaskIds.has(item.taskId)) return;
        const exceptionRecord = exceptionRecordByItemId[item.id] || buildExceptionStub(item);

        setPendingAction({ itemId: item.id, kind: 'follow_up' });
        try {
            await followUpException(exceptionRecord, getFollowUpPayload(item));
        } finally {
            setPendingAction((current) => (current?.itemId === item.id && current.kind === 'follow_up' ? null : current));
        }
    };

    const handleExceptionResolve = async (item: ExceptionItem) => {
        const exceptionRecord = exceptionRecordByItemId[item.id] || buildExceptionStub(item);
        const resolution = getResolutionPayload(item);
        setPendingAction({ itemId: item.id, kind: 'resolve' });
        try {
            await resolveException(exceptionRecord, resolution);
        } finally {
            setPendingAction((current) => (current?.itemId === item.id && current.kind === 'resolve' ? null : current));
        }
    };

    const handleExceptionReassignStart = (item: ExceptionItem) => {
        const options = assigneeOptionsByExceptionId[item.id] || [];
        const fallbackAssignee =
            options.find((option) => option.employeeId !== item.employeeId)
            || options[0];

        setActiveReassignId(item.id);
        setSelectedAssignees((current) => ({
            ...current,
            [item.id]: current[item.id] || fallbackAssignee?.employeeId || '',
        }));
    };

    const handleExceptionReassignCancel = () => {
        setActiveReassignId(null);
    };

    const handleExceptionReassignConfirm = async (item: ExceptionItem) => {
        if (!item.taskId) return;
        const selectedEmployeeId = selectedAssignees[item.id];
        const assignee = (assigneeOptionsByExceptionId[item.id] || []).find((option) => option.employeeId === selectedEmployeeId);
        if (!assignee) return;

        setPendingAction({ itemId: item.id, kind: 'reassign' });
        try {
            const exceptionRecord = exceptionRecordByItemId[item.id] || buildExceptionStub(item);
            await reassignTask(item.taskId, {
                employeeId: assignee.employeeId,
                employeeName: assignee.name,
                reason: 'Reasignada desde ActionCenter',
            }, exceptionRecord);
            setActiveReassignId((current) => (current === item.id ? null : current));
        } finally {
            setPendingAction((current) => (current?.itemId === item.id && current.kind === 'reassign' ? null : current));
        }
    };

    if (queueTasks.length === 0 && secondaryActionItems.length === 0 && exceptionQueue.length === 0) {
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
                    Excepciones {exceptionQueue.length}
                </span>
                <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100">
                    Caja {cashExceptionItems.filter((item) => item.scope === 'Caja').length}
                </span>
                <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">
                    Cobro {cashExceptionItems.filter((item) => item.scope === 'Cobro' || item.scope === 'Credito').length}
                </span>
                <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-100">
                    Foco SLA {attentionItems.length}
                </span>
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
                {responsiblePresenceSummary.total > 0 && (
                    <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">
                        Con senal {responsiblePresenceSummary.withSignal}/{responsiblePresenceSummary.total}
                    </span>
                )}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Inbox</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Bandeja de excepciones</h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                            {exceptionQueue.length} activas
                        </span>
                    </div>

                    <div className="mt-4 space-y-3">
                        {exceptionQueue.length > 0 ? (
                            exceptionQueue.map((item) => (
                                <ExceptionRow
                                    key={item.id}
                                    item={item}
                                    onOpen={handleExceptionOpen}
                                    onFollowUp={handleExceptionFollowUp}
                                    onResolve={handleExceptionResolve}
                                    onStartReassign={handleExceptionReassignStart}
                                    onCancelReassign={handleExceptionReassignCancel}
                                    onConfirmReassign={handleExceptionReassignConfirm}
                                    onSelectAssignee={(itemId, employeeId) =>
                                        setSelectedAssignees((current) => ({ ...current, [itemId]: employeeId }))
                                    }
                                    assigneeOptions={assigneeOptionsByExceptionId[item.id] || []}
                                    selectedAssigneeId={selectedAssignees[item.id]}
                                    isReassigning={activeReassignId === item.id}
                                    isFollowingUp={pendingAction?.itemId === item.id && pendingAction.kind === 'follow_up'}
                                    isResolving={pendingAction?.itemId === item.id && pendingAction.kind === 'resolve'}
                                    isSubmittingReassign={pendingAction?.itemId === item.id && pendingAction.kind === 'reassign'}
                                    canFollowUp={Boolean(item.taskId && assignmentTaskIds.has(item.taskId))}
                                    canResolve={Boolean(item.taskId || item.reportId || exceptionRecordByItemId[item.id])}
                                    canReassign={Boolean(item.taskId && (assigneeOptionsByExceptionId[item.id] || []).length > 0)}
                                />
                            ))
                        ) : (
                            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
                                <p className="text-sm font-semibold text-white">Sin excepciones activas.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Caja</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Caja y cobro</h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                            {cashExceptionItems.length} foco
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Abiertas</p>
                            <p className="mt-2 text-xl font-black text-white">{cashPulse.openDrawers}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Expuesto</p>
                            <p className="mt-2 text-xl font-black text-white">{formatCurrencyCompact(cashPulse.exposedCash)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Cobros</p>
                            <p className="mt-2 text-xl font-black text-white">{cashPulse.pendingCashSales}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatCurrencyCompact(cashPulse.pendingCashAmount)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Vencidos</p>
                            <p className="mt-2 text-xl font-black text-white">{cashPulse.overdueDebtCount + cashPulse.overdueCrateCount}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                {cashPulse.overdueDebtCount} cobro / {cashPulse.overdueCrateCount} caja
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        {cashExceptionItems.length > 0 ? (
                            cashExceptionItems.slice(0, 4).map((item) => (
                                <div key={item.id} className={`rounded-2xl border px-4 py-3 ${item.tone}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${exceptionScopeToneMap[item.scope]}`}>
                                                {item.scope}
                                            </span>
                                            <p className="mt-2 text-sm font-semibold text-current">{item.title}</p>
                                            <p className="mt-1 text-sm text-current/90">{item.detail}</p>
                                            {item.meta && <p className="mt-2 text-[11px] font-semibold text-current/80">{item.meta}</p>}
                                        </div>
                                        <div className="text-right">
                                            <span className="rounded-full border border-current/15 bg-black/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-current">
                                                {item.label}
                                            </span>
                                            <button
                                                onClick={() => handleExceptionOpen(item)}
                                                className="mt-3 inline-flex items-center justify-center rounded-2xl border border-current/15 bg-black/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-current transition hover:bg-black/20"
                                            >
                                                {item.ctaText}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
                                <p className="text-sm font-semibold text-white">Sin alertas de caja.</p>
                            </div>
                        )}
                    </div>

                    {compactLiveActivity.length > 0 && (
                        <div className="mt-5 border-t border-white/10 pt-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Realtime</p>
                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                    {compactLiveActivity.length}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {compactLiveActivity.map((item) => (
                                    <div key={item.id} className={`rounded-2xl border px-4 py-3 ${item.tone}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <span className="rounded-full border border-current/15 bg-black/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-current">
                                                    {item.pill}
                                                </span>
                                                <p className="mt-2 text-sm font-semibold text-current">{item.summary}</p>
                                                {item.meta && <p className="mt-2 text-[11px] font-semibold text-current/80">{item.meta}</p>}
                                            </div>
                                            <i className={`fa-solid ${item.icon} mt-1 text-xs opacity-80`}></i>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
                <QueueLane title="Pendientes" count={laneTasks.assigned.length}>
                    {laneTasks.assigned.map((task) => <QueueTaskCard key={task.id} task={task} presence={getPresenceSignal(presenceIndex, task.assigneeName, task.ownerName)} onOpen={handleTaskOpen} />)}
                </QueueLane>
                <QueueLane title="Acusadas" count={laneTasks.acknowledged.length}>
                    {laneTasks.acknowledged.map((task) => <QueueTaskCard key={task.id} task={task} presence={getPresenceSignal(presenceIndex, task.assigneeName, task.ownerName)} onOpen={handleTaskOpen} />)}
                </QueueLane>
                <QueueLane title="En curso" count={laneTasks.inProgress.length}>
                    {laneTasks.inProgress.map((task) => <QueueTaskCard key={task.id} task={task} presence={getPresenceSignal(presenceIndex, task.assigneeName, task.ownerName)} onOpen={handleTaskOpen} />)}
                </QueueLane>
                <QueueLane title="Bloqueadas" count={laneTasks.blocked.length}>
                    {laneTasks.blocked.map((task) => <QueueTaskCard key={task.id} task={task} presence={getPresenceSignal(presenceIndex, task.assigneeName, task.ownerName)} onOpen={handleTaskOpen} />)}
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
