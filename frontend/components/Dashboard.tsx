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

type DashboardTask = {
    saleId?: string;
    source: TaskSource;
    stage: OperationalTaskStage;
    status: OperationalTaskStatus;
    title: string;
    customerName?: string;
    assigneeName?: string;
    ownerName?: string;
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
        saleId,
        source: 'assignment',
        stage: inferTaskStage(stageSignals, sale),
        status,
        title,
        customerName,
        assigneeName,
        ownerName,
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
        saleId: sale.id,
        source: 'fallback',
        stage,
        status,
        title: sale.customer,
        customerName: sale.customer,
        assigneeName: undefined,
        ownerName: undefined,
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
    const { sales, inventory, productGroups, theme } = data;
    const taskAssignments = ((data as BusinessData & { taskAssignments?: unknown }).taskAssignments ?? []) as unknown[];
    const isDark = theme === 'dark';
    const [insights, setInsights] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

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
        const operationalTasks = [...normalizedTasks, ...fallbackTasks];

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
            salesByDay,
            salesCompositionData,
            top5Products,
            top5Customers,
            unidadesActivas,
            ventasRegistradas: todaySales.length,
        };
    }, [inventory, productGroups, sales, taskAssignments]);

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

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
                    <div className="mb-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Pulso operativo</p>
                        <h2 className="mt-2 text-xl font-black tracking-tight text-white">Escalacion y acuses</h2>
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
                </div>

                <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Reportes</p>
                            <h2 className="mt-2 text-xl font-black tracking-tight text-white">Actividad reciente</h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                            {dashboardData.recentReports.length}
                        </span>
                    </div>

                    {dashboardData.recentReports.length > 0 ? (
                        <div className="space-y-3">
                            {dashboardData.recentReports.map((report) => (
                                <div key={`${report.id}_${report.createdAt?.getTime() || 0}`} className={`rounded-2xl border px-4 py-3 ${reportToneMap[report.kind]}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-current">{report.summary}</p>
                                            {report.detail && <p className="mt-1 text-xs leading-5 text-slate-300">{report.detail}</p>}
                                            <p className="mt-2 text-[11px] font-semibold text-slate-400">
                                                {[report.customerName || report.taskTitle, report.ownerName, report.createdAt?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' / ')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                                                {stageLabelMap[report.stage]}
                                            </span>
                                            <i className={`fa-solid ${reportIconMap[report.kind]} text-xs opacity-80`}></i>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
                            <p className="text-sm font-semibold text-white">Sin reportes recientes.</p>
                        </div>
                    )}
                </div>
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
