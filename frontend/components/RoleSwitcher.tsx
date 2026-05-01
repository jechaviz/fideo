import React from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { OneSignalPushController } from '../hooks/useOneSignalPush';
import { isPortalOnlyProfile } from '../services/pocketbase/auth';
import { TaskAssignment, UserRole } from '../types';
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
    tone: 'pending' | 'blocked';
    tooltip: string;
}

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const pluralize = (count: number, singular: string, plural = `${singular}s`) => (count === 1 ? singular : plural);

const isInternalTaskRole = (role: UserRole): boolean => INTERNAL_TASK_ROLES.has(role);

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

    const blockedCount = scopedTasks.filter((task) => task.status === 'blocked').length;
    const pendingTasks = scopedTasks.filter((task) => task.status !== 'done' && task.status !== 'blocked');
    const pendingCount = pendingTasks.length;
    const pendingAckCount = pendingTasks.filter((task) => task.status === 'assigned').length;

    if (!blockedCount && !pendingCount) return null;

    const label =
        blockedCount > 0
            ? `${blockedCount} ${pluralize(blockedCount, 'bloqueada')}`
            : pendingAckCount > 0
              ? `${pendingAckCount} sin acuse`
              : `${pendingCount} ${pluralize(pendingCount, 'pendiente')}`;

    const scopeLabel = shellIdentity?.employeeId ? shellIdentity.primaryLabel : ROLE_META[data.currentRole] || data.currentRole;
    const tooltipParts: string[] = [];
    if (blockedCount) tooltipParts.push(`${blockedCount} ${pluralize(blockedCount, 'bloqueada')}`);
    if (pendingCount) tooltipParts.push(`${pendingCount} ${pluralize(pendingCount, 'pendiente')}`);
    if (pendingAckCount) tooltipParts.push(`${pendingAckCount} sin acuse`);

    return {
        label,
        pendingCount,
        blockedCount,
        pendingAckCount,
        tone: blockedCount > 0 ? 'blocked' : 'pending',
        tooltip: tooltipParts.length ? `${scopeLabel}: ${tooltipParts.join(' / ')}` : scopeLabel,
    };
};

const RoleSwitcher: React.FC<{ data: BusinessData; push: OneSignalPushController }> = ({ data, push }) => {
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
    const shellIdentity = getShellIdentity(data);

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
                        <p className="truncate text-[11px] font-semibold text-slate-400">
                            {shellIdentity.secondaryLabel || workspaceLabel || 'main'}
                        </p>
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
