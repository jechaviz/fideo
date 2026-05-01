import React from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { OneSignalPushController } from '../hooks/useOneSignalPush';
import { isPortalOnlyProfile } from '../services/pocketbase/auth';
import { UserRole } from '../types';
import PushToggle from './PushToggle';

const ROLES: UserRole[] = ['Admin', 'Empacador', 'Repartidor', 'Cajero', 'Cliente', 'Proveedor'];

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
    const profileTag = authProfile?.name?.split(' ')[0] || authProfile?.name || workspaceLabel || 'main';

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentRole(e.target.value as UserRole);
    };

    const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentRole(currentRole, e.target.value);
    };

    return (
        <div className="glass-panel-dark flex flex-wrap items-center gap-3 rounded-[1.6rem] px-3 py-3">
            {authEnabled && authProfile && (
                <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-400 shadow-[0_0_14px_rgba(163,230,53,0.65)]"></span>
                    <p className="truncate text-xs font-black text-slate-100">{profileTag}</p>
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
