import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale } from '../types';

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

const normalize = (value?: string | null) => value?.trim().toLowerCase() || '';

const isPackerTask = (task: TaskAssignment) => normalize(task.role) === 'empacador';

const formatTaskTime = (sale?: Sale) =>
    sale ? new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--:--';

const buildSaleSummary = (sale?: Sale) =>
    sale ? `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} (${sale.size})` : null;

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
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Reportar bloqueo</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Deja una nota breve para la tarea <span className="font-bold text-white">{task.title}</span>.
                    </p>
                </div>

                <div>
                    <label className={labelClass}>Motivo</label>
                    <textarea
                        value={reason}
                        onChange={(event) => onReasonChange(event.target.value)}
                        rows={3}
                        placeholder="Ej. falta producto o empaque"
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

const PackerTaskCard: React.FC<{
    sale?: Sale;
    task: TaskAssignment;
    onAcknowledge?: (taskId: string) => void;
    onStart?: (taskId: string) => void;
    onBlock?: (task: TaskAssignment) => void;
    onPack: (saleId: string) => void;
}> = ({ sale, task, onAcknowledge, onStart, onBlock, onPack }) => {
    const saleSummary = buildSaleSummary(sale);
    const canPack = Boolean(sale);

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

                {task.status === 'in_progress' ? (
                    <button
                        onClick={() => sale && onPack(sale.id)}
                        disabled={!canPack}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Marcar empacado
                    </button>
                ) : null}

                {task.status !== 'blocked' && onBlock ? (
                    <button onClick={() => onBlock(task)} className={secondaryButtonClass}>
                        Bloquear
                    </button>
                ) : null}
            </div>
        </div>
    );
};

const PackerView: React.FC<{ data: BusinessData }> = ({ data }) => {
    const taskData = data as BusinessData & TaskViewBridge;
    const { sales, markOrderAsPacked } = data;
    const { acknowledgeTask, authProfile, blockTask, startTask, taskAssignments = [] } = taskData;

    const [blockingTask, setBlockingTask] = useState<TaskAssignment | null>(null);
    const [blockReason, setBlockReason] = useState('');

    const currentEmployeeId = authProfile?.employeeId || null;

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
                                        onBlock={blockTask ? handleBlockOpen : undefined}
                                        onPack={markOrderAsPacked}
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
                                        onBlock={blockTask ? handleBlockOpen : undefined}
                                        onPack={markOrderAsPacked}
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
                                        onBlock={undefined}
                                        onPack={markOrderAsPacked}
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

export default PackerView;
