import React, { useEffect, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { OneSignalPushController } from '../hooks/useOneSignalPush';
import { isPortalOnlyProfile } from '../services/pocketbase/auth';
import { TaskAssignment, TaskReport, UserRole } from '../types';
import { resolveCurrentEmployee } from '../utils/taskAssignments';
import PushToggle from './PushToggle';

const ROLES: UserRole[] = ['Admin', 'Empacador', 'Repartidor', 'Cajero', 'Cliente', 'Proveedor'];
const INTERNAL_TASK_ROLES = new Set<UserRole>(['Admin', 'Empacador', 'Repartidor', 'Cajero']);
const ROLE_META: Record<UserRole, string> = {
    Admin: 'Admin',
    Cajero: 'Caja',
    Empacador: 'Empaque',
    Repartidor: 'Ruta',
    Cliente: 'Cliente',
    Proveedor: 'Proveedor',
};

export interface ShellIdentity {
    primaryLabel: string;
    secondaryLabel: string | null;
    shortLabel: string;
    roleLabel: string;
    employeeId: string | null;
    employeeName: string | null;
}

export interface ShellTaskSummary {
    label: string;
    pendingCount: number;
    blockedCount: number;
    pendingAckCount: number;
    escalatedCount: number;
    tone: ShellSignalTone;
    tooltip: string;
    signals: ShellStatusSignal[];
}

export type ShellSignalTone = 'live' | 'pending' | 'blocked' | 'alert' | 'warning' | 'offline' | 'muted';

export interface ShellStatusSignal {
    id: string;
    label: string;
    shortLabel: string;
    tone: ShellSignalTone;
    tooltip: string;
}

export interface ShellRealtimeSummary {
    label: string;
    detail: string | null;
    tone: ShellSignalTone;
    tooltip: string;
    signal: ShellStatusSignal;
}

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const pluralize = (count: number, singular: string, plural = `${singular}s`) => (count === 1 ? singular : plural);

const isInternalTaskRole = (role: UserRole): boolean => INTERNAL_TASK_ROLES.has(role);

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const readValue = (sources: Array<Record<string, unknown> | null>, keys: string[]) => {
    for (const source of sources) {
        if (!source) continue;
        for (const key of keys) {
            const value = source[key];
            if (value !== undefined && value !== null) return value;
        }
    }
    return undefined;
};

const readString = (sources: Array<Record<string, unknown> | null>, keys: string[]) => {
    const value = readValue(sources, keys);
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const readBoolean = (sources: Array<Record<string, unknown> | null>, keys: string[]) => {
    const value = readValue(sources, keys);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
        if (['false', '0', 'no'].includes(normalized)) return false;
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

const readDate = (sources: Array<Record<string, unknown> | null>, keys: string[]) => {
    const value = readValue(sources, keys);
    return toDate(value);
};

const formatAgeCompact = (timestamp?: Date) => {
    if (!timestamp) return undefined;
    const elapsedMinutes = Math.max(1, Math.floor((Date.now() - timestamp.getTime()) / 60000));
    if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h`;
    return `${Math.floor(elapsedHours / 24)}d`;
};

const PRESENCE_STALE_AFTER_MS = 3 * 60 * 1000;

const shellSignalToneClasses: Record<ShellSignalTone, string> = {
    live: 'border-brand-400/20 bg-brand-400/10 text-brand-100',
    pending: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
    blocked: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
    alert: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    warning: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    offline: 'border-slate-400/20 bg-slate-500/10 text-slate-200',
    muted: 'border-white/10 bg-white/5 text-slate-200',
};

const shellSignalDotClasses: Record<ShellSignalTone, string> = {
    live: 'bg-brand-300 shadow-[0_0_10px_rgba(163,230,53,0.75)]',
    pending: 'bg-sky-300',
    blocked: 'bg-rose-300',
    alert: 'bg-amber-300',
    warning: 'bg-amber-300',
    offline: 'bg-slate-300',
    muted: 'bg-slate-400',
};

const useOnlineState = () => {
    const [isOnline, setIsOnline] = useState(() => (typeof window === 'undefined' ? true : window.navigator.onLine));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

const buildScopedTaskReports = (data: BusinessData, scopedTasks: TaskAssignment[], shellIdentity: ShellIdentity | null) => {
    const scopedTaskIds = new Set(scopedTasks.map((task) => task.id));
    const taskReports = Array.isArray(data.taskReports) ? data.taskReports : [];

    return taskReports.filter((report) => {
        if (scopedTaskIds.has(report.taskId)) return true;
        if (shellIdentity?.employeeId && report.employeeId === shellIdentity.employeeId) return true;
        return report.role === data.currentRole;
    });
};

const isOpenReport = (report: TaskReport) => {
    const reportRecord = asRecord(report);
    const status = readString([reportRecord], ['status']);
    return !status || status === 'open' || status === 'pending' || status === 'sent';
};

const isEscalatedReport = (report: TaskReport) => {
    const reportRecord = asRecord(report);
    const sources = [reportRecord, asRecord(reportRecord?.payload), asRecord(reportRecord?.context), asRecord(reportRecord?.metadata)];
    const escalationStatus = readString(sources, ['escalationStatus']);
    const summary = readString(sources, ['summary', 'message', 'title', 'detail', 'note']);
    return (
        escalationStatus === 'pending'
        || escalationStatus === 'sent'
        || Boolean(readBoolean(sources, ['escalated', 'isEscalated', 'needsEscalation', 'requiresAttention']))
        || Boolean(readDate(sources, ['escalatedAt', 'escalationAt', 'escalationRequestedAt']))
        || Boolean(readString(sources, ['escalationReason', 'escalationSummary', 'escalationNote']))
        || Boolean(summary && /escal/i.test(summary))
    );
};

const isEscalatedTask = (task: TaskAssignment, reports: TaskReport[]) => {
    const taskRecord = asRecord(task);
    const sources = [taskRecord, asRecord(taskRecord?.payload), asRecord(taskRecord?.context), asRecord(taskRecord?.metadata)];
    return (
        Boolean(readBoolean(sources, ['escalated', 'isEscalated', 'needsEscalation', 'requiresAttention']))
        || Boolean(readDate(sources, ['escalatedAt', 'escalationAt', 'escalationRequestedAt']))
        || Boolean(readString(sources, ['escalationReason', 'escalationSummary', 'escalationNote']))
        || reports.some((report) => isOpenReport(report) && isEscalatedReport(report))
    );
};

const buildSignal = (id: string, label: string, shortLabel: string, tone: ShellSignalTone, tooltip: string): ShellStatusSignal => ({
    id,
    label,
    shortLabel,
    tone,
    tooltip,
});

export const getShellIdentity = (data: BusinessData): ShellIdentity | null => {
    const { authProfile, workspaceLabel, currentRole } = data;
    if (!authProfile && !workspaceLabel) return null;

    const employee = resolveCurrentEmployee(data, authProfile);
    const primaryLabel = employee?.name || normalizeText(authProfile?.name) || normalizeText(workspaceLabel) || 'Fideo';
    const employeeId = employee?.id || authProfile?.employeeId || null;
    const roleLabel = ROLE_META[currentRole] || currentRole;
    const initials = primaryLabel
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((token) => token.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2);

    return {
        primaryLabel,
        secondaryLabel: [employeeId, roleLabel].filter(Boolean).join(' / ') || roleLabel,
        shortLabel: initials || roleLabel.charAt(0).toUpperCase(),
        roleLabel,
        employeeId,
        employeeName: employee?.name || primaryLabel,
    };
};

const selectTaskScope = (data: BusinessData, shellIdentity: ShellIdentity | null): TaskAssignment[] => {
    const { authProfile, canSwitchRoles, currentRole, taskAssignments } = data;
    if (!taskAssignments.length) return [];

    const shouldPreferEmployeeScope = Boolean(
        shellIdentity?.employeeId && (!canSwitchRoles || !authProfile || authProfile.role === currentRole),
    );

    if (shouldPreferEmployeeScope) {
        const employeeTasks = taskAssignments.filter((task) => task.employeeId === shellIdentity?.employeeId);
        if (employeeTasks.length) return employeeTasks;
    }

    if (!isInternalTaskRole(currentRole)) {
        return [];
    }

    const roleTasks = taskAssignments.filter((task) => task.role === currentRole);
    if (roleTasks.length) return roleTasks;

    return currentRole === 'Admin' ? taskAssignments : [];
};

export const getShellTaskSummary = (data: BusinessData, shellIdentity = getShellIdentity(data)): ShellTaskSummary | null => {
    const scopedTasks = selectTaskScope(data, shellIdentity);
    if (!scopedTasks.length) return null;

    const scopedReports = buildScopedTaskReports(data, scopedTasks, shellIdentity);
    const blockedCount = scopedTasks.filter((task) => task.status === 'blocked').length;
    const pendingTasks = scopedTasks.filter((task) => task.status !== 'done' && task.status !== 'blocked');
    const pendingCount = pendingTasks.length;
    const pendingAckTasks = pendingTasks.filter((task) => task.status === 'assigned' && !task.acknowledgedAt);
    const pendingAckCount = pendingAckTasks.length;
    const escalatedCount = scopedTasks.filter((task) =>
        isEscalatedTask(
            task,
            scopedReports.filter((report) => report.taskId === task.id),
        ),
    ).length;

    if (!blockedCount && !pendingAckCount && !escalatedCount) return null;

    const scopeLabel = shellIdentity?.employeeId ? shellIdentity.primaryLabel : ROLE_META[data.currentRole] || data.currentRole;
    const tooltipParts: string[] = [];
    const signals: ShellStatusSignal[] = [];

    if (pendingAckCount) {
        const oldestPendingAck = pendingAckTasks
            .map((task) => task.createdAt)
            .sort((left, right) => left.getTime() - right.getTime())[0];
        const age = formatAgeCompact(oldestPendingAck);
        const tooltip = `${scopeLabel}: ${pendingAckCount} sin acuse${age ? ` / mas antigua ${age}` : ''}`;
        signals.push(buildSignal('pending_ack', `${pendingAckCount} sin acuse`, `Acuse ${pendingAckCount}`, 'pending', tooltip));
        tooltipParts.push(`${pendingAckCount} sin acuse`);
    }

    if (blockedCount) tooltipParts.push(`${blockedCount} ${pluralize(blockedCount, 'bloqueada')}`);
    if (blockedCount) {
        signals.push(
            buildSignal(
                'blocked',
                `${blockedCount} ${pluralize(blockedCount, 'bloqueada')}`,
                `Bloq ${blockedCount}`,
                'blocked',
                `${scopeLabel}: ${blockedCount} ${pluralize(blockedCount, 'bloqueada')}`,
            ),
        );
    }

    if (escalatedCount) {
        tooltipParts.push(`${escalatedCount} ${pluralize(escalatedCount, 'escalada')}`);
        signals.push(
            buildSignal(
                'escalated',
                `${escalatedCount} ${pluralize(escalatedCount, 'escalada')}`,
                `Esc ${escalatedCount}`,
                'alert',
                `${scopeLabel}: ${escalatedCount} ${pluralize(escalatedCount, 'escalada')}`,
            ),
        );
    }

    if (!signals.length) return null;

    const signalOrder: Record<string, number> = {
        escalated: 0,
        blocked: 1,
        pending_ack: 2,
    };
    signals.sort((left, right) => (signalOrder[left.id] ?? 99) - (signalOrder[right.id] ?? 99));

    const leadSignal = signals[0];

    return {
        label: leadSignal.label,
        pendingCount,
        blockedCount,
        pendingAckCount,
        escalatedCount,
        tone: leadSignal.tone,
        tooltip: tooltipParts.length ? `${scopeLabel}: ${tooltipParts.join(' / ')}` : scopeLabel,
        signals,
    };
};

export const getShellRealtimeSummary = (
    data: BusinessData,
    push: OneSignalPushController | null | undefined,
    isOnline: boolean,
): ShellRealtimeSummary => {
    const pushState = push?.state;
    const pushError = normalizeText(pushState?.lastError) || normalizeText(pushState?.initError);
    const hasPush = Boolean(pushState?.configured && pushState.enabled);
    const presence = data.authProfile?.presence || null;
    const lastSeenAt = toDate(data.authProfile?.lastSeenAt);
    const presenceAge = formatAgeCompact(lastSeenAt);
    const isPresenceStale = Boolean(lastSeenAt && Date.now() - lastSeenAt.getTime() > PRESENCE_STALE_AFTER_MS);
    const presenceStatus = presence?.status || (isOnline ? 'active' : 'offline');

    let label = 'Online';
    let detail: string | null = 'workspace remoto';
    let tone: ShellSignalTone = 'live';
    let tooltip = 'Workspace remoto listo.';

    if (!data.authEnabled) {
        label = 'Local';
        detail = 'sin backend';
        tone = 'muted';
        tooltip = 'Modo local. No hay sincronizacion remota activa.';
    } else if (!isOnline) {
        label = 'Offline';
        detail = 'cola local';
        tone = 'offline';
        tooltip = 'Sin red. Los cambios siguen en local hasta reconectar.';
    } else if (presenceStatus === 'background') {
        label = 'Live';
        detail = presenceAge ? `pausa ${presenceAge}` : 'en pausa';
        tone = 'pending';
        tooltip = 'Sesion enlazada, pero esta pantalla no esta al frente.';
    } else if (presenceStatus === 'offline') {
        label = 'Offline';
        detail = presenceAge ? `ping ${presenceAge}` : 'sin ping';
        tone = 'offline';
        tooltip = 'La sesion reporto estado offline.';
    } else if (isPresenceStale) {
        label = 'Sync';
        detail = presenceAge ? `ping ${presenceAge}` : 'sin ping';
        tone = 'warning';
        tooltip = 'El heartbeat de presencia se atraso y puede requerir reconexion.';
    } else if (pushState?.syncing || pushState?.prompting) {
        label = 'Sync';
        detail = 'enlazando';
        tone = 'live';
        tooltip = 'Sincronizando workspace y push.';
    } else if (normalizeText(data.authError)) {
        label = 'Sync';
        detail = 'degradado';
        tone = 'warning';
        tooltip = data.authError || 'Hay una degradacion temporal de sincronizacion.';
    } else if (pushError) {
        label = 'Online';
        detail = 'push con error';
        tone = 'warning';
        tooltip = pushError;
    } else if (hasPush && pushState?.initialized && !pushState.supported) {
        label = 'Online';
        detail = 'push no disponible';
        tone = 'warning';
        tooltip = 'Workspace remoto listo, pero este equipo no soporta push.';
    } else if (hasPush && pushState?.optedIn) {
        label = 'Live';
        detail = presenceAge ? `push ${presenceAge}` : 'push activo';
        tone = 'live';
        tooltip = 'Realtime listo y push activo.';
    } else if (hasPush) {
        label = 'Online';
        detail = presenceAge ? `ping ${presenceAge}` : 'push apagado';
        tone = 'muted';
        tooltip = 'Workspace remoto listo. Push disponible pero apagado.';
    } else if (presenceAge) {
        detail = `ping ${presenceAge}`;
    }

    return {
        label,
        detail,
        tone,
        tooltip,
        signal: buildSignal('realtime', label, label, tone, detail ? `${tooltip} ${detail}.` : tooltip),
    };
};

export const useShellStatusSummaries = (data: BusinessData, push: OneSignalPushController | null | undefined) => {
    const isOnline = useOnlineState();
    const identity = getShellIdentity(data);
    const taskSummary = getShellTaskSummary(data, identity);
    const realtimeSummary = getShellRealtimeSummary(data, push, isOnline);

    return {
        identity,
        taskSummary,
        realtimeSummary,
    };
};

export const ShellSignalBadge: React.FC<{ signal: ShellStatusSignal; compact?: boolean; className?: string }> = ({
    signal,
    compact = false,
    className = '',
}) => (
    <span
        title={signal.tooltip}
        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${shellSignalToneClasses[signal.tone]} ${compact ? 'px-2.5 py-1 text-[11px]' : ''} ${className}`}
    >
        <span className={`h-2 w-2 rounded-full ${shellSignalDotClasses[signal.tone]}`} />
        <span className="truncate">{compact ? signal.shortLabel : signal.label}</span>
    </span>
);

const RoleSwitcher: React.FC<{
    data: BusinessData;
    push: OneSignalPushController;
    identity: ShellIdentity | null;
    taskSummary: ShellTaskSummary | null;
    realtimeSummary: ShellRealtimeSummary;
}> = ({ data, push, identity, taskSummary, realtimeSummary }) => {
    const {
        currentRole,
        setCurrentRole,
        customers,
        suppliers,
        currentCustomerId,
        currentSupplierId,
        authEnabled,
        authProfile,
        authError,
        workspaceLabel,
        signOut,
        canSwitchRoles,
    } = data;
    const selectClass =
        'min-w-[150px] rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-100 outline-none transition focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20';
    const availableRoles = canSwitchRoles ? ROLES : [currentRole];
    const portalReadOnly = isPortalOnlyProfile(authProfile);
    const shellIdentity = identity;

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentRole(e.target.value as UserRole);
    };

    const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentRole(currentRole, e.target.value);
    };

    return (
        <div className="glass-panel-dark flex flex-wrap items-center gap-3 rounded-[1.6rem] px-3 py-3">
            {authEnabled && authProfile && shellIdentity && (
                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-[11px] font-black text-brand-300 shadow-inner shadow-black/30">
                        {shellIdentity.shortLabel}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-50">{shellIdentity.primaryLabel}</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[11px] font-semibold text-slate-400">
                                {shellIdentity.secondaryLabel || workspaceLabel || 'main'}
                            </p>
                            {realtimeSummary && <ShellSignalBadge signal={realtimeSummary.signal} compact />}
                            {!realtimeSummary && taskSummary?.signals[0] && <ShellSignalBadge signal={taskSummary.signals[0]} compact />}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <select
                    id="role-select"
                    aria-label="Rol"
                    value={currentRole}
                    onChange={handleRoleChange}
                    className={selectClass}
                    disabled={!canSwitchRoles}
                >
                    {availableRoles.map((role) => (
                        <option key={role} value={role}>
                            {role}
                        </option>
                    ))}
                </select>
            </div>

            {currentRole === 'Cliente' && (
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        id="customer-select"
                        aria-label="Cliente"
                        value={currentCustomerId || ''}
                        onChange={handleEntityChange}
                        className={selectClass}
                        disabled={!canSwitchRoles && Boolean(authProfile?.customerId)}
                    >
                        {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {currentRole === 'Proveedor' && (
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        id="supplier-select"
                        aria-label="Proveedor"
                        value={currentSupplierId || ''}
                        onChange={handleEntityChange}
                        className={selectClass}
                        disabled={!canSwitchRoles && Boolean(authProfile?.supplierId)}
                    >
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {authEnabled && authError && (
                <div className="max-w-[280px] rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                    {authError}
                </div>
            )}

            {portalReadOnly && (
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100">
                    Solo lectura
                </div>
            )}

            {authEnabled && authProfile && <PushToggle push={push} />}

            {authEnabled && signOut && (
                <button
                    onClick={signOut}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                    <i className="fa-solid fa-right-from-bracket text-brand-300"></i>
                    Salir
                </button>
            )}
        </div>
    );
};

export default RoleSwitcher;
