import React, { Suspense, lazy } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { OneSignalPushController } from '../hooks/useOneSignalPush';
import RoleSwitcher, { getShellIdentity, getShellTaskSummary } from '../components/RoleSwitcher';

const CustomerView = lazy(() => import('../views/CustomerView'));
const SupplierView = lazy(() => import('../views/SupplierView'));

const PortalLoadingState: React.FC = () => (
    <div className="flex min-h-[320px] items-center justify-center rounded-[1.8rem] border border-white/10 bg-white/[0.03] px-6 py-12">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-transparent" />
            Cargando portal...
        </div>
    </div>
);

const PortalLayout: React.FC<{ data: BusinessData; push: OneSignalPushController }> = ({ data, push }) => {
    const { currentRole } = data;
    const shellIdentity = data.authProfile ? getShellIdentity(data) : null;
    const taskSummary = getShellTaskSummary(data, shellIdentity);

    const renderPortalView = () => {
        switch (currentRole) {
            case 'Cliente': return <CustomerView data={data} />;
            case 'Proveedor': return <SupplierView data={data} />;
            default: return <div>Portal no disponible</div>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_24%),radial-gradient(circle_at_left,rgba(56,189,248,0.1),transparent_18%)]" />
            <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/72 backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Portal</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-black tracking-tight text-white">Fideo {currentRole}</h1>
                            {shellIdentity && (
                                <span
                                    title={shellIdentity.secondaryLabel || shellIdentity.primaryLabel}
                                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200"
                                >
                                    <span className="h-2 w-2 rounded-full bg-sky-300/90" />
                                    <span className="max-w-[220px] truncate">{shellIdentity.primaryLabel}</span>
                                    {shellIdentity.employeeId && <span className="text-slate-500">{shellIdentity.employeeId}</span>}
                                </span>
                            )}
                            {taskSummary && (
                                <span
                                    title={taskSummary.tooltip}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                                        taskSummary.tone === 'blocked'
                                            ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                                            : 'border-sky-400/20 bg-sky-500/10 text-sky-100'
                                    }`}
                                >
                                    <span className={`h-2 w-2 rounded-full ${taskSummary.tone === 'blocked' ? 'bg-amber-300' : 'bg-sky-300'}`} />
                                    {taskSummary.label}
                                </span>
                            )}
                        </div>
                    </div>
                    <RoleSwitcher data={data} push={push} />
                </div>
            </header>
            <main className="relative">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="glass-panel-dark rounded-[2rem] p-4 md:p-6">
                        <Suspense fallback={<PortalLoadingState />}>{renderPortalView()}</Suspense>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PortalLayout;
