import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale } from '../types';

type TaskStatus = 'assigned' | 'acknowledged' | 'in_progress' | 'blocked' | 'done';
type TaskReportMode = 'note' | 'blocked' | 'completed';
type TaskReportPayload = {
    kind: TaskReportMode;
    summary: string;
    taskId: string;
    saleId: string;
    taskKind: string;
    taskTitle: string;
    role: string;
    statusBefore: TaskStatus;
    createdAt: string;
    reporter?: {
        employeeId?: string | null;
        name?: string | null;
    };
};

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
    completeTask?: (taskId: string) => void;
    submitTaskReport?: (taskId: string, report: TaskReportPayload) => void | Promise<void>;
}

const surfaceClass = 'glass-panel-dark rounded-[1.6rem] border border-white/10';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';
const fieldClass =
    'mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-400/40 focus:ring-2 focus:ring-brand-400/20';
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
        label: 'En mesa',
        tone: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    },
    blocked: {
        label: 'Bloqueada',
        tone: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    },
    done: {
        label: 'Lista',
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

const reportMeta: Record<
    TaskReportMode,
    {
        badge: string;
        title: string;
        label: string;
        placeholder: string;
        submitLabel: string;
        icon: string;
        accent: string;
        activeTone: string;
    }
> = {
    note: {
        badge: 'Nota',
        title: 'Registrar nota operativa',
        label: 'Nota breve',
        placeholder: 'Ej. pedido revisado, etiquetado o listo para pesado',
        submitLabel: 'Guardar nota',
        icon: 'fa-note-sticky',
        accent: 'bg-brand-400 text-slate-950 hover:bg-brand-300',
        activeTone: 'border-brand-400/40 bg-brand-400/10 text-brand-100',
    },
    blocked: {
        badge: 'Bloqueo',
        title: 'Reportar bloqueo',
        label: 'Motivo',
        placeholder: 'Ej. falta producto o empaque',
        submitLabel: 'Guardar bloqueo',
        icon: 'fa-hand',
        accent: 'bg-rose-400 text-slate-950 hover:bg-rose-300',
        activeTone: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
    },
    completed: {
        badge: 'Cierre',
        title: 'Cerrar empaque',
        label: 'Cierre breve',
        placeholder: 'Ej. pedido armado, revisado y listo para entrega',
        submitLabel: 'Cerrar tarea',
        icon: 'fa-box-check',
        accent: 'bg-emerald-400 text-slate-950 hover:bg-emerald-300',
        activeTone: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
    },
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() || '';

const isPackerTask = (task: TaskAssignment) => normalize(task.role) === 'empacador';

const formatTaskTime = (sale?: Sale) =>
    sale ? new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--:--';

const buildSaleSummary = (sale?: Sale) =>
    sale ? `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} (${sale.size})` : null;

const getDefaultReportSummary = (mode: TaskReportMode, task: TaskAssignment) => {
    if (mode === 'blocked') return task.blockReason || '';
    if (mode === 'completed') return 'Pedido empacado y listo para entrega.';
    return '';
};

const buildTaskReportPayload = (
    task: TaskAssignment,
    mode: TaskReportMode,
    summary: string,
    authProfile?: TaskViewBridge['authProfile'],
): TaskReportPayload => ({
    kind: mode,
    summary: summary.trim(),
    taskId: task.id,
    saleId: task.saleId,
    taskKind: task.kind,
    taskTitle: task.title,
    role: task.role,
    statusBefore: task.status,
    createdAt: new Date().toISOString(),
    reporter: {
        employeeId: authProfile?.employeeId ?? task.employeeId ?? null,
        name: authProfile?.name ?? null,
    },
});

const SectionHeader: React.FC<{ title: string; count: number }> = ({ title, count }) => (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
            <p className={labelClass}>Tareas</p>
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
    task: TaskAssignment | null;
    sale?: Sale;
    mode: TaskReportMode;
    summary: string;
    canNote: boolean;
    canBlock: boolean;
    canComplete: boolean;
    isSubmitting: boolean;
    error: string | null;
    onModeChange: (value: TaskReportMode) => void;
    onSummaryChange: (value: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}> = ({
    task,
    sale,
    mode,
    summary,
    canNote,
    canBlock,
    canComplete,
    isSubmitting,
    error,
    onModeChange,
    onSummaryChange,
    onClose,
    onConfirm,
}) => {
    if (!task) return null;

    const meta = reportMeta[mode];
    const modeOptions: Array<{ mode: TaskReportMode; enabled: boolean; label: string }> = [
        { mode: 'note', enabled: canNote, label: 'Nota' },
        { mode: 'blocked', enabled: canBlock, label: 'Bloqueo' },
        { mode: 'completed', enabled: canComplete, label: 'Cierre' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${surfaceClass} w-full max-w-lg p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-200">{meta.badge}</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{meta.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Reporta un movimiento corto y estructurado para{' '}
                        <span className="font-bold text-white">{sale?.customer || task.title}</span>.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {modeOptions.map((option) => {
                        const optionMeta = reportMeta[option.mode];
                        const isActive = option.mode === mode;
                        return (
                            <button
                                key={option.mode}
                                type="button"
                                onClick={() => onModeChange(option.mode)}
                                disabled={!option.enabled || isSubmitting}
                                className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition ${
                                    isActive
                                        ? optionMeta.activeTone
                                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white'
                                } disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                                <i className={`fa-solid ${optionMeta.icon} text-xs`}></i>
                                <span>{option.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-2xl border border-white/8 bg-slate-950/60 p-4">
                    <div>
                        <p className={labelClass}>Pedido</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">{task.saleId}</p>
                    </div>
                    <div>
                        <p className={labelClass}>Estado</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">{statusMeta[task.status].label}</p>
                    </div>
                    <div>
                        <p className={labelClass}>Hora</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">{formatTaskTime(sale)}</p>
                    </div>
                </div>

                <div className="mt-5">
                    <label className={labelClass}>{meta.label}</label>
                    <textarea
                        value={summary}
                        onChange={(event) => onSummaryChange(event.target.value)}
                        rows={3}
                        placeholder={meta.placeholder}
                        className={`${fieldClass} resize-none`}
                    />
                </div>

                {error ? (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                        {error}
                    </div>
                ) : null}

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className={secondaryButtonClass} disabled={isSubmitting}>
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!summary.trim() || isSubmitting}
                        className={`rounded-2xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${meta.accent}`}
                    >
                        {isSubmitting ? 'Guardando...' : meta.submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PackerTaskCard: React.FC<{
    sale?: Sale;
    task: TaskAssignment;
    onAcknowledge?: (taskId: string) => void;
    onStart?: (taskId: string) => void;
    canReportNote: boolean;
    canReportBlock: boolean;
    canReportComplete: boolean;
    onReport: (task: TaskAssignment, mode: TaskReportMode, sale?: Sale) => void;
}> = ({ sale, task, onAcknowledge, onStart, canReportNote, canReportBlock, canReportComplete, onReport }) => {
    const saleSummary = buildSaleSummary(sale);

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

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/8 bg-slate-950/60 p-4">
                    <div>
                        <p className={labelClass}>Pedido</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">{task.saleId}</p>
                    </div>
                    <div>
                        <p className={labelClass}>Hora</p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">{formatTaskTime(sale)}</p>
                    </div>
                </div>

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
                        Tomar
                    </button>
                ) : null}

                {task.status === 'acknowledged' && onStart ? (
                    <button
                        onClick={() => onStart(task.id)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300"
                    >
                        Iniciar
                    </button>
                ) : null}

                {task.status === 'in_progress' && canReportComplete ? (
                    <button
                        onClick={() => onReport(task, 'completed', sale)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cerrar empaque
                    </button>
                ) : null}

                {canReportNote ? (
                    <button onClick={() => onReport(task, 'note', sale)} className={secondaryButtonClass}>
                        Nota
                    </button>
                ) : null}

                {canReportBlock ? (
                    <button onClick={() => onReport(task, 'blocked', sale)} className={secondaryButtonClass}>
                        {task.status === 'blocked' ? 'Actualizar bloqueo' : 'Bloquear'}
                    </button>
                ) : null}
            </div>
        </div>
    );
};

const PackerView: React.FC<{ data: BusinessData }> = ({ data }) => {
    const taskData = data as BusinessData & TaskViewBridge;
    const { sales, markOrderAsPacked } = data;
    const { acknowledgeTask, authProfile, blockTask, completeTask, startTask, submitTaskReport, taskAssignments = [] } = taskData;

    const [reportTask, setReportTask] = useState<TaskAssignment | null>(null);
    const [reportMode, setReportMode] = useState<TaskReportMode>('note');
    const [reportSummary, setReportSummary] = useState('');
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const currentEmployeeId = authProfile?.employeeId || null;
    const canSubmitNotes = Boolean(submitTaskReport);

    const salesById = useMemo(() => new Map(sales.map((sale) => [sale.id, sale])), [sales]);

    const visibleTasks = useMemo(() => {
        return taskAssignments
            .filter((task) => {
                if (!isPackerTask(task) || task.status === 'done') return false;
                if (currentEmployeeId && task.employeeId && task.employeeId !== currentEmployeeId) return false;

                const sale = salesById.get(task.saleId);
                if (!sale) return true;
                if (task.status === 'blocked') return sale.status !== 'Completado' && sale.status !== 'Cancelado';
                return sale.status === 'Pendiente de Empaque';
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

    const queuedTasks = useMemo(
        () => visibleTasks.filter((task) => task.status === 'assigned' || task.status === 'acknowledged'),
        [visibleTasks],
    );
    const activeTasks = useMemo(
        () => visibleTasks.filter((task) => task.status === 'in_progress'),
        [visibleTasks],
    );
    const blockedTasks = useMemo(
        () => visibleTasks.filter((task) => task.status === 'blocked'),
        [visibleTasks],
    );

    const handleReportOpen = (task: TaskAssignment, mode: TaskReportMode) => {
        setReportTask(task);
        setReportMode(mode);
        setReportSummary(getDefaultReportSummary(mode, task));
        setReportError(null);
    };

    const handleReportClose = () => {
        setReportTask(null);
        setReportMode('note');
        setReportSummary('');
        setReportError(null);
    };

    const handleReportModeChange = (mode: TaskReportMode) => {
        if (!reportTask) return;
        if (mode === 'note' && !canSubmitNotes) return;
        if (mode === 'blocked' && !blockTask) return;
        if (mode === 'completed' && reportTask.status !== 'in_progress') return;

        setReportMode(mode);
        setReportSummary(getDefaultReportSummary(mode, reportTask));
        setReportError(null);
    };

    const handleConfirmReport = async () => {
        if (!reportTask) return;

        const summary = reportSummary.trim();
        if (!summary) return;

        const sale = salesById.get(reportTask.saleId);
        const canCompleteTask = reportMode === 'completed' && reportTask.status === 'in_progress' && Boolean(sale);
        const canBlockTask = reportMode === 'blocked' && Boolean(blockTask);
        const canSaveNote = reportMode === 'note' && canSubmitNotes;

        if (!canCompleteTask && !canBlockTask && !canSaveNote) return;

        setIsSubmittingReport(true);
        setReportError(null);

        try {
            if (submitTaskReport) {
                await Promise.resolve(
                    submitTaskReport(
                        reportTask.id,
                        buildTaskReportPayload(reportTask, reportMode, summary, authProfile),
                    ),
                );
            }

            if (reportMode === 'blocked' && blockTask) {
                blockTask(reportTask.id, summary);
            }

            if (reportMode === 'completed' && sale) {
                markOrderAsPacked(sale.id);
                completeTask?.(reportTask.id);
            }

            handleReportClose();
        } catch (error) {
            setReportError(error instanceof Error ? error.message : 'No se pudo guardar el reporte.');
        } finally {
            setIsSubmittingReport(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_30%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Empaque</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Mesa de tareas</h1>
                        <p className="mt-4 text-sm leading-6 text-slate-300">
                            {currentEmployeeId ? 'Tu cola activa de empaque.' : 'Cola operativa de empaque.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[540px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Por tomar</p>
                            <p className="mt-2 text-3xl font-black text-white">{queuedTasks.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>En mesa</p>
                            <p className="mt-2 text-3xl font-black text-white">{activeTasks.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Bloqueadas</p>
                            <p className="mt-2 text-3xl font-black text-white">{blockedTasks.length}</p>
                        </div>
                    </div>
                </div>
            </section>

            {visibleTasks.length > 0 ? (
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1.15fr_0.8fr]">
                    <div className={`${surfaceClass} p-5`}>
                        <SectionHeader title="Cola" count={queuedTasks.length} />
                        <div className="space-y-4">
                            {queuedTasks.length > 0 ? (
                                queuedTasks.map((task) => (
                                    <PackerTaskCard
                                        key={task.id}
                                        task={task}
                                        sale={salesById.get(task.saleId)}
                                        onAcknowledge={acknowledgeTask}
                                        onStart={startTask}
                                        canReportNote={canSubmitNotes}
                                        canReportBlock={Boolean(blockTask)}
                                        canReportComplete={false}
                                        onReport={handleReportOpen}
                                    />
                                ))
                            ) : (
                                <EmptySection title="No hay tareas pendientes." />
                            )}
                        </div>
                    </div>

                    <div className={`${surfaceClass} p-5`}>
                        <SectionHeader title="En mesa" count={activeTasks.length} />
                        <div className="space-y-4">
                            {activeTasks.length > 0 ? (
                                activeTasks.map((task) => (
                                    <PackerTaskCard
                                        key={task.id}
                                        task={task}
                                        sale={salesById.get(task.saleId)}
                                        onAcknowledge={acknowledgeTask}
                                        onStart={startTask}
                                        canReportNote={canSubmitNotes}
                                        canReportBlock={Boolean(blockTask)}
                                        canReportComplete={Boolean(salesById.get(task.saleId))}
                                        onReport={handleReportOpen}
                                    />
                                ))
                            ) : (
                                <EmptySection title="Nada en proceso." />
                            )}
                        </div>
                    </div>

                    <div className={`${surfaceClass} p-5`}>
                        <SectionHeader title="Bloqueos" count={blockedTasks.length} />
                        <div className="space-y-4">
                            {blockedTasks.length > 0 ? (
                                blockedTasks.map((task) => (
                                    <PackerTaskCard
                                        key={task.id}
                                        task={task}
                                        sale={salesById.get(task.saleId)}
                                        onAcknowledge={acknowledgeTask}
                                        onStart={startTask}
                                        canReportNote={canSubmitNotes}
                                        canReportBlock={Boolean(blockTask)}
                                        canReportComplete={false}
                                        onReport={handleReportOpen}
                                    />
                                ))
                            ) : (
                                <EmptySection title="Sin bloqueos activos." />
                            )}
                        </div>
                    </div>
                </section>
            ) : (
                <section className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                    <p className="text-xl font-bold text-white">Todo despejado.</p>
                    <p className="mt-2 text-sm text-slate-400">No hay tareas activas de empaque en este momento.</p>
                </section>
            )}

            <TaskReportModal
                task={reportTask}
                sale={reportTask ? salesById.get(reportTask.saleId) : undefined}
                mode={reportMode}
                summary={reportSummary}
                canNote={canSubmitNotes}
                canBlock={Boolean(blockTask)}
                canComplete={Boolean(reportTask && reportTask.status === 'in_progress' && salesById.get(reportTask.saleId))}
                isSubmitting={isSubmittingReport}
                error={reportError}
                onModeChange={handleReportModeChange}
                onSummaryChange={setReportSummary}
                onClose={handleReportClose}
                onConfirm={handleConfirmReport}
            />
        </div>
    );
};

export default PackerView;
