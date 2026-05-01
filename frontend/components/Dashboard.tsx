import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Line, ComposedChart } from 'recharts';
import { SparklesIcon } from './icons/Icons';

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

type StaffPresenceState = 'active' | 'recent' | 'inactive';

type StaffPresenceItem = {
    id: string;
    name: string;
    roleLabel: string;
    state: StaffPresenceState;
    stateLabel: string;
    stateTone: string;
    dotTone: string;
    lastSeenLabel: string;
    taskCount: number;
    exceptionCount: number;
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

type DashboardTask = {
    id: string;
    saleId?: string;
    source: TaskSource;
    stage: OperationalTaskStage;
    status: OperationalTaskStatus;
    title: string;
    customerName?: string;
    assigneeName?: string;
    ownerName?: string;
    blockedReason?: string;
    timestamp: Date;
    createdAt?: Date;
    updatedAt?: Date;
    acknowledgedAt?: Date;
    blockedAt?: Date;
    reports: TaskReport[];
    signals: TaskSignal[];
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

const stageLabelMap: Record<OperationalTaskStage, string> = {
    packing: 'Empaque',
    assignment: 'Asignacion',
    route: 'Ruta',
    other: 'Operacion',
};

const roleLabelMap: Record<string, string> = {
    Admin: 'Admin',
    Cajero: 'Caja',
    Empacador: 'Empaque',
    Repartidor: 'Ruta',
    Cliente: 'Cliente',
    Proveedor: 'Proveedor',
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

const buildStaffPresenceRoster = (
    employees: BusinessData['employees'],
    tasks: DashboardTask[],
    presenceIndex: Map<string, PresenceEntry>,
) => {
    const displayNameByKey = new Map<string, string>();
    const roleByKey = new Map<string, string>();

    const register = (name: string | null | undefined, role?: string) => {
        const key = normalizeNameKey(name);
        if (!key || !name) return;
        if (!displayNameByKey.has(key)) displayNameByKey.set(key, name.trim());
        if (role && !roleByKey.has(key)) roleByKey.set(key, roleLabelMap[role] || role);
    };

    employees.forEach((employee) => register(employee.name, employee.role));
    tasks.forEach((task) => {
        register(task.assigneeName);
        register(task.ownerName);
        task.reports.forEach((report) => register(report.authorName));
    });

    const taskStatsByKey = new Map<string, { taskCount: number; exceptionCount: number }>();
    tasks.forEach((task) => {
        const key = normalizeNameKey(task.assigneeName || task.ownerName);
        if (!key) return;

        const hasException =
            task.status === 'blocked' ||
            task.signals.some((signal) => signal.id === 'no_ack' || signal.id === 'escalation') ||
            task.reports.some((report) => report.kind === 'blocker' || report.kind === 'escalation');

        const current = taskStatsByKey.get(key) || { taskCount: 0, exceptionCount: 0 };
        current.taskCount += 1;
        if (hasException) current.exceptionCount += 1;
        taskStatsByKey.set(key, current);
    });

    const stateRank: Record<StaffPresenceState, number> = {
        active: 0,
        recent: 1,
        inactive: 2,
    };

    return Array.from(displayNameByKey.entries())
        .map(([key, name]) => {
            const presence = getPresenceSignal(presenceIndex, name);
            const ageMinutes = getAgeMinutes(presence?.lastSeenAt);
            const taskStats = taskStatsByKey.get(key) || { taskCount: 0, exceptionCount: 0 };

            let state: StaffPresenceState = 'inactive';
            if (typeof ageMinutes === 'number' && ageMinutes <= 20) state = 'active';
            else if (typeof ageMinutes === 'number' && ageMinutes <= 120) state = 'recent';

            const stateLabel = state === 'active' ? 'Activo' : state === 'recent' ? 'Reciente' : 'Sin senal';
            const stateTone =
                state === 'active'
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                    : state === 'recent'
                      ? 'border-sky-400/20 bg-sky-400/10 text-sky-100'
                      : 'border-white/10 bg-white/[0.04] text-slate-300';
            const dotTone = state === 'active' ? 'bg-emerald-300' : state === 'recent' ? 'bg-sky-300' : 'bg-slate-500';

            return {
                id: key,
                name,
                roleLabel: roleByKey.get(key) || 'Staff',
                state,
                stateLabel,
                stateTone,
                dotTone,
                lastSeenLabel: presence?.label || 'Sin senal',
                taskCount: taskStats.taskCount,
                exceptionCount: taskStats.exceptionCount,
            } satisfies StaffPresenceItem;
        })
        .sort((left, right) => {
            if (stateRank[left.state] !== stateRank[right.state]) return stateRank[left.state] - stateRank[right.state];
            if (right.exceptionCount !== left.exceptionCount) return right.exceptionCount - left.exceptionCount;
            if (right.taskCount !== left.taskCount) return right.taskCount - left.taskCount;
            return left.name.localeCompare(right.name, 'es-MX');
        });
};

const attachExternalReportsToTask = (task: DashboardTask, externalReports: ExternalTaskReportIndex): DashboardTask => {
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

const buildAttentionItems = (tasks: DashboardTask[]) =>
    tasks
        .map((task) => {
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

const buildLiveActivity = (tasks: DashboardTask[], activityLog: BusinessData['activityLog']) => {
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

const buildDashboardTask = (input: unknown, sales: Sale[]): DashboardTask | null => {
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

    const status =
        normalizeTaskStatus(readString(sources, ['status', 'state'])) ||
        (sale ? saleStatusToTaskStatusMap[sale.status] : undefined) ||
        'assigned';

    if (status === 'done') return null;

    const title =
        readString(sources, ['title', 'label', 'name']) ||
        (sale ? `${sale.customer}` : 'Tarea operativa');
    const customerName = readString(sources, ['customerName', 'customer', 'clientName']) || sale?.customer;
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
        id: readString(sources, ['id']) || `task_dashboard_${saleId || timestamp.getTime()}`,
        saleId,
        source: 'assignment',
        stage: inferTaskStage(stageSignals, sale),
        status,
        title,
        customerName,
        assigneeName,
        ownerName,
        blockedReason,
        timestamp,
        createdAt,
        updatedAt,
        acknowledgedAt,
        blockedAt,
        reports,
        signals,
    };
};

const buildDashboardTaskFromSale = (sale: Sale): DashboardTask | null => {
    const stage = saleStatusToStageMap[sale.status];
    const status = saleStatusToTaskStatusMap[sale.status];
    if (!stage || !status || status === 'done') return null;
    return {
        id: `sale_fallback_${sale.id}_${stage}`,
        saleId: sale.id,
        source: 'fallback',
        stage,
        status,
        title: sale.customer,
        customerName: sale.customer,
        assigneeName: undefined,
        ownerName: undefined,
        blockedReason: undefined,
        timestamp: sale.timestamp,
        createdAt: sale.timestamp,
        updatedAt: sale.timestamp,
        acknowledgedAt: stage === 'route' ? sale.timestamp : undefined,
        blockedAt: undefined,
        reports: [],
        signals: [],
    };
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

const KpiCard: React.FC<{ title: string; value: string; subtext?: string; icon: string; accent: string }> = ({ title, value, subtext, icon, accent }) => (
    <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{title}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
                {subtext && <p className="mt-2 text-sm text-slate-400">{subtext}</p>}
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${accent}`}>
                <i className={`fa-solid ${icon} text-lg`}></i>
            </div>
        </div>
    </div>
);

const ChartContainer: React.FC<{ title: string; eyebrow: string; children: React.ReactNode }> = ({ title, eyebrow, children }) => (
    <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
        <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-white">{title}</h2>
        </div>
        <div className="h-72">
            {children}
        </div>
    </div>
);

const InteligenciaFideo: React.FC<{ insights: string; isLoading: boolean }> = ({ insights, isLoading }) => {
    return (
        <div className="rounded-[2rem] border border-brand-400/20 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.18),transparent_45%),rgba(15,23,42,0.88)] p-5 shadow-glow">
            <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400 text-slate-950">
                    <SparklesIcon />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-200/70">Motor Fideo</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-white">Inteligencia comercial</h2>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center text-slate-300">
                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3">
                        <div className="h-5 w-5 rounded-full border-2 border-brand-200 border-t-transparent animate-spin"></div>
                        <span className="text-sm font-semibold">Analizando actividad...</span>
                    </div>
                </div>
            ) : insights ? (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-200 prose-headings:text-white prose-strong:text-white prose-li:text-slate-200" dangerouslySetInnerHTML={{ __html: insights.replace(/\* (.*)/g, '<li class="ml-4">$1</li>') }} />
            ) : (
                <div className="flex h-64 flex-col items-center justify-center text-center text-slate-300">
                    <p className="max-w-xs text-base font-semibold text-white">Activa la lectura diaria para detectar oportunidades de venta, margen e inventario.</p>
                    <p className="mt-3 max-w-sm text-sm text-slate-400">Fideo sintetiza lo mas importante del dia con foco en decisiones rapidas.</p>
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { sales, inventory, productGroups, theme, taskReports, activities, activityLog, employees } = data;
    const taskAssignments = ((data as BusinessData & { taskAssignments?: unknown }).taskAssignments ?? []) as unknown[];
    const isDark = theme === 'dark';
    const [insights, setInsights] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const externalTaskReports = useMemo(() => buildExternalTaskReportIndex(taskReports), [taskReports]);
    const presenceIndex = useMemo(() => buildPresenceIndex(activities, activityLog, taskReports), [activities, activityLog, taskReports]);

    const generateInsights = async () => {
        setIsLoading(true);
        setInsights('');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todaySales = sales.filter((s) => new Date(s.timestamp) >= today);

            const profitByCustomer = todaySales.reduce((acc, sale) => {
                acc[sale.customer] = (acc[sale.customer] || 0) + (sale.price - sale.cogs);
                return acc;
            }, {} as Record<string, number>);
            const topCustomers = Object.entries(profitByCustomer).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

            const profitByProduct = todaySales.reduce((acc, sale) => {
                const productName = `${sale.varietyName} ${sale.size}`;
                acc[productName] = (acc[productName] || 0) + (sale.price - sale.cogs);
                return acc;
            }, {} as Record<string, number>);
            const topProducts = Object.entries(profitByProduct).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

            const dailyStats = {
                ventas: todaySales.reduce((sum, s) => sum + s.price, 0),
                ganancia: todaySales.reduce((sum, s) => sum + (s.price - s.cogs), 0),
                margen: 0,
                topCustomers,
                topProducts,
            };
            dailyStats.margen = dailyStats.ventas > 0 ? (dailyStats.ganancia / dailyStats.ventas) * 100 : 0;

            const inventorySummary = inventory.slice(0, 5).map((item) => {
                const varietyInfo = productGroups.flatMap((pg) => pg.varieties).find((v) => v.id === item.varietyId);
                return {
                    name: `${varietyInfo?.name || item.varietyId} ${item.size}`,
                    quantity: item.quantity,
                    daysOnHand: 10,
                };
            });

            const { generateBusinessInsights } = await import('../services/geminiService');
            const result = await generateBusinessInsights(dailyStats, inventorySummary);
            setInsights(result);
        } catch {
            setInsights('Error al generar insights. Revisa la conexion con la API.');
        } finally {
            setIsLoading(false);
        }
    };

    const dashboardData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySales = sales.filter((s) => new Date(s.timestamp) >= today);
        const normalizedTasks = Array.isArray(taskAssignments)
            ? taskAssignments
                  .map((task) => buildDashboardTask(task, sales))
                  .filter((task): task is DashboardTask => Boolean(task))
            : [];
        const coveredStages = new Set(
            normalizedTasks
                .filter((task) => task.saleId)
                .map((task) => `${task.saleId}:${task.stage}`),
        );
        const fallbackTasks = sales
            .map((sale) => buildDashboardTaskFromSale(sale))
            .filter((task): task is DashboardTask => Boolean(task))
            .filter((task) => !task.saleId || !coveredStages.has(`${task.saleId}:${task.stage}`));
        const operationalTasks = [...normalizedTasks, ...fallbackTasks].map((task) => attachExternalReportsToTask(task, externalTaskReports));

        const ventasHoy = todaySales.reduce((sum, s) => sum + s.price, 0);
        const profitHoy = todaySales.reduce((sum, s) => sum + (s.price - s.cogs), 0);
        const margenBrutoHoy = ventasHoy > 0 ? (profitHoy / ventasHoy) * 100 : 0;
        const ticketPromedio = todaySales.length > 0 ? ventasHoy / todaySales.length : 0;
        const taskSignals = operationalTasks.reduce(
            (accumulator, task) => {
                accumulator.open += 1;
                accumulator[task.status] += 1;
                accumulator.byStage[task.stage] += 1;
                return accumulator;
            },
            {
                open: 0,
                assigned: 0,
                acknowledged: 0,
                in_progress: 0,
                blocked: 0,
                done: 0,
                byStage: { packing: 0, assignment: 0, route: 0, other: 0 } as Record<OperationalTaskStage, number>,
            } as {
                open: number;
                assigned: number;
                acknowledged: number;
                in_progress: number;
                blocked: number;
                done: number;
                byStage: Record<OperationalTaskStage, number>;
            },
        );
        const operationalIndicators = operationalTasks.reduce(
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
        );
        const recentReports = operationalTasks
            .flatMap((task) =>
                task.reports.map((report) => ({
                    ...report,
                    taskTitle: task.title,
                    customerName: task.customerName,
                    ownerName: task.ownerName || task.assigneeName,
                    stage: task.stage,
                })),
            )
            .sort((left, right) => (right.createdAt?.getTime() || 0) - (left.createdAt?.getTime() || 0))
            .slice(0, 6);
        const attentionItems = buildAttentionItems(operationalTasks);
        const liveActivity = buildLiveActivity(operationalTasks, activityLog);
        const staffPresence = buildStaffPresenceRoster(employees, operationalTasks, presenceIndex);
        const presenceSummary = {
            total: staffPresence.length,
            withSignal: staffPresence.filter((item) => item.state !== 'inactive').length,
            active: staffPresence.filter((item) => item.state === 'active').length,
            inactive: staffPresence.filter((item) => item.state === 'inactive').length,
        };

        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 6);
        last7Days.setHours(0, 0, 0, 0);
        const recentSales = sales.filter((s) => new Date(s.timestamp) >= last7Days);
        const salesByDay = Array(7).fill(0).map((_, i) => {
            const d = new Date(last7Days);
            d.setDate(d.getDate() + i);
            return { name: d.toLocaleDateString('es-MX', { weekday: 'short' }), ventas: 0, ganancia: 0 };
        });
        recentSales.forEach((s) => {
            const dayIndex = Math.floor((new Date(s.timestamp).getTime() - last7Days.getTime()) / (1000 * 3600 * 24));
            if (dayIndex >= 0 && dayIndex < 7) {
                salesByDay[dayIndex].ventas += s.price;
                salesByDay[dayIndex].ganancia += (s.price - s.cogs);
            }
        });

        const salesByCategory = todaySales.reduce((acc, sale) => {
            const category = productGroups.find((pg) => pg.id === sale.productGroupId)?.category || 'Otro';
            acc[category] = (acc[category] || 0) + sale.price;
            return acc;
        }, {} as Record<string, number>);
        const salesCompositionData = Object.entries(salesByCategory).map(([name, value]) => ({ name, value }));

        const profitByProduct = todaySales.reduce((acc, sale) => {
            const productName = `${sale.varietyName} ${sale.size}`;
            acc[productName] = (acc[productName] || 0) + (sale.price - sale.cogs);
            return acc;
        }, {} as Record<string, number>);
        const top5Products = Object.entries(profitByProduct).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 5).map(([name, profit]) => ({ name, profit }));

        const profitByCustomer = todaySales.reduce((acc, sale) => {
            acc[sale.customer] = (acc[sale.customer] || 0) + (sale.price - sale.cogs);
            return acc;
        }, {} as Record<string, number>);
        const top5Customers = Object.entries(profitByCustomer).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 5).map(([name, profit]) => ({ name, profit }));

        const unidadesActivas = inventory.reduce((sum, batch) => sum + batch.quantity, 0);

        return {
            ventasHoy,
            margenBrutoHoy,
            ticketPromedio,
            taskSignals,
            operationalIndicators,
            recentReports,
            attentionItems,
            liveActivity,
            staffPresence,
            presenceSummary,
            salesByDay,
            salesCompositionData,
            top5Products,
            top5Customers,
            unidadesActivas,
            ventasRegistradas: todaySales.length,
        };
    }, [activityLog, employees, externalTaskReports, inventory, presenceIndex, productGroups, sales, taskAssignments]);

    const PIE_COLORS = ['#a3e635', '#38bdf8', '#f59e0b', '#22c55e', '#fb7185'];
    const axisColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.16)';
    const tooltipStyle = {
        backgroundColor: isDark ? 'rgba(2, 6, 23, 0.95)' : '#ffffff',
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(148,163,184,0.2)',
        borderRadius: '18px',
        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)',
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.16),transparent_35%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Control diario</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">La operacion del dia en una sola lectura.</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Ventas, inventario y cola operativa en el mismo primer pantallazo.</p>
                    </div>

                    <div className="flex flex-col gap-3 lg:min-w-[360px]">
                        <button onClick={generateInsights} disabled={isLoading} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-400 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-70">
                            {isLoading ? <div className="h-5 w-5 rounded-full border-2 border-slate-900 border-t-transparent animate-spin"></div> : <SparklesIcon />}
                            <span>{isLoading ? 'Analizando...' : 'Analizar ahora'}</span>
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Pendientes</p>
                                <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.assigned}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Acuses</p>
                                <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.acknowledged}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Bloqueos</p>
                                <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.blocked}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">En curso</p>
                                <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.in_progress}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                        Reportes {dashboardData.operationalIndicators.reported}
                    </span>
                    <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100">
                        Escaladas {dashboardData.operationalIndicators.escalated}
                    </span>
                    <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">
                        Sin acuse {dashboardData.operationalIndicators.noAck}
                    </span>
                    <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-100">
                        Bloqueos c/owner {dashboardData.operationalIndicators.blockedOwned}
                    </span>
                    {dashboardData.presenceSummary.total > 0 && (
                        <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">
                            Con senal {dashboardData.presenceSummary.withSignal}/{dashboardData.presenceSummary.total}
                        </span>
                    )}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="Ventas de hoy" value={dashboardData.ventasHoy.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} subtext="Facturacion registrada en el dia." icon="fa-sack-dollar" accent="border-brand-400/40 bg-brand-400/10 text-brand-200" />
                <KpiCard title="Margen bruto" value={`${dashboardData.margenBrutoHoy.toFixed(1)}%`} subtext="Rentabilidad promedio del dia." icon="fa-percent" accent="border-sky-400/40 bg-sky-400/10 text-sky-200" />
                <KpiCard title="Ticket promedio" value={dashboardData.ticketPromedio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} subtext="Valor por salida comercial." icon="fa-file-invoice-dollar" accent="border-amber-400/40 bg-amber-400/10 text-amber-200" />
                <KpiCard title="Tareas abiertas" value={dashboardData.taskSignals.open.toString()} subtext="Empaque, asignacion y ruta sin cerrar." icon="fa-box-check" accent="border-violet-400/40 bg-violet-400/10 text-violet-200" />
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="glass-panel-dark rounded-[1.6rem] border border-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Empaque</p>
                    <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.byStage.packing}</p>
                </div>
                <div className="glass-panel-dark rounded-[1.6rem] border border-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Asignacion</p>
                    <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.byStage.assignment}</p>
                </div>
                <div className="glass-panel-dark rounded-[1.6rem] border border-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Ruta</p>
                    <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.byStage.route}</p>
                </div>
                <div className="glass-panel-dark rounded-[1.6rem] border border-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Ventas hoy</p>
                    <p className="mt-2 text-2xl font-black text-white">{dashboardData.ventasRegistradas}</p>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Atencion</p>
                            <h2 className="mt-2 text-xl font-black tracking-tight text-white">Inmediata</h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                            {dashboardData.attentionItems.length}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100">Sin acuse</p>
                            <p className="mt-2 text-2xl font-black text-white">{dashboardData.operationalIndicators.noAck}</p>
                        </div>
                        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-100">Escaladas</p>
                            <p className="mt-2 text-2xl font-black text-white">{dashboardData.operationalIndicators.escalated}</p>
                        </div>
                        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-100">Bloqueos c/owner</p>
                            <p className="mt-2 text-2xl font-black text-white">{dashboardData.operationalIndicators.blockedOwned}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Reportes</p>
                            <p className="mt-2 text-2xl font-black text-white">{dashboardData.operationalIndicators.reported}</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        {dashboardData.attentionItems.length > 0 ? (
                            dashboardData.attentionItems.map((item) => (
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
                                <p className="text-sm font-semibold text-white">Sin excepciones vivas.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Staff</p>
                            <h2 className="mt-2 text-xl font-black tracking-tight text-white">Presencia</h2>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">
                                Activos {dashboardData.presenceSummary.active}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                                Sin senal {dashboardData.presenceSummary.inactive}
                            </span>
                        </div>
                    </div>

                    {dashboardData.staffPresence.length > 0 ? (
                        <div className="space-y-3">
                            {dashboardData.staffPresence.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2.5 w-2.5 rounded-full ${item.dotTone}`}></span>
                                                <p className="text-sm font-black text-white">{item.name}</p>
                                            </div>
                                            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{item.roleLabel}</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${item.stateTone}`}>
                                                    {item.stateLabel}
                                                </span>
                                                {item.taskCount > 0 && (
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                                                        {item.taskCount} tarea{item.taskCount === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                                {item.exceptionCount > 0 && (
                                                    <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100">
                                                        {item.exceptionCount} alerta{item.exceptionCount === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                                            {item.lastSeenLabel}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
                            <p className="text-sm font-semibold text-white">Sin staff visible.</p>
                        </div>
                    )}
                </div>
            </section>

            <section className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Realtime</p>
                        <h2 className="mt-2 text-xl font-black tracking-tight text-white">Actividad</h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                        {dashboardData.liveActivity.length}
                    </span>
                </div>

                {dashboardData.liveActivity.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {dashboardData.liveActivity.map((item) => (
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
                ) : (
                    <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
                        <p className="text-sm font-semibold text-white">Sin actividad operativa reciente.</p>
                    </div>
                )}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <ChartContainer title="Ventas y ganancia" eyebrow="Ultimos 7 dias">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <ComposedChart data={dashboardData.salesByDay}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                <XAxis dataKey="name" stroke={axisColor} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" stroke={axisColor} tick={{ fontSize: 10 }} tickFormatter={(val) => `$${Number(val) / 1000}k`} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), name]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar yAxisId="left" dataKey="ventas" name="Ventas" fill="#a3e635" radius={[10, 10, 0, 0]} />
                                <Line yAxisId="left" type="monotone" dataKey="ganancia" name="Ganancia" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3, fill: '#38bdf8' }} activeDot={{ r: 5 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
                <ChartContainer title="Composicion de ventas" eyebrow="Mix de categorias">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <PieChart>
                            <Pie data={dashboardData.salesCompositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={94} paddingAngle={5}>
                                {dashboardData.salesCompositionData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <ChartContainer title="Productos mas rentables" eyebrow="Top 5 de hoy">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={dashboardData.top5Products} layout="vertical" margin={{ left: 16 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke={axisColor} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} />
                            <Bar dataKey="profit" name="Ganancia" fill="#38bdf8" radius={[0, 10, 10, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title="Clientes mas rentables" eyebrow="Top 5 de hoy">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={dashboardData.top5Customers} layout="vertical" margin={{ left: 16 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke={axisColor} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} />
                            <Bar dataKey="profit" name="Ganancia" fill="#f59e0b" radius={[0, 10, 10, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <InteligenciaFideo insights={insights} isLoading={isLoading} />
            </section>
        </div>
    );
};

export default Dashboard;
