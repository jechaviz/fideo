
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import StatusBar from '../components/StatusBar';
import VoiceControl from '../components/VoiceControl';
import RoleSwitcher, { ShellSignalBadge, useShellStatusSummaries } from '../components/RoleSwitcher';
import { BusinessData } from '../hooks/useBusinessData';
import { OneSignalPushController } from '../hooks/useOneSignalPush';
import { Bars3Icon } from '../components/icons/Icons';
import { UserRole } from '../types';

const Dashboard = lazy(() => import('../components/Dashboard'));
const MessageFeed = lazy(() => import('../components/MessageFeed'));
const Inventory = lazy(() => import('../components/Inventory'));
const AITraining = lazy(() => import('../components/AITraining'));
const SalesHistory = lazy(() => import('../components/SalesLog'));
const Customers = lazy(() => import('../components/Customers'));
const Settings = lazy(() => import('../components/Settings'));
const History = lazy(() => import('../components/History'));
const Deliveries = lazy(() => import('../components/Deliveries'));
const Assets = lazy(() => import('../components/Assets'));
const Finances = lazy(() => import('../components/Finances'));
const Promotions = lazy(() => import('../components/Promotions'));
const RipeningRules = lazy(() => import('../components/RipeningRules'));
const Suppliers = lazy(() => import('../components/Suppliers'));
const PackerView = lazy(() => import('../views/PackerView'));
const DelivererView = lazy(() => import('../views/DelivererView'));
const ActionCenter = lazy(() => import('../components/ActionCenter'));
const Planogram = lazy(() => import('../components/Planogram'));

const ROLE_META: Record<UserRole, string> = {
    Admin: 'Admin',
    Cajero: 'Caja',
    Empacador: 'Empaque',
    Repartidor: 'Ruta',
    Cliente: 'Cliente',
    Proveedor: 'Proveedor',
};

const VIEW_TITLES: Partial<Record<BusinessData['currentView'], string>> = {
    dashboard: 'Centro Comercial',
    actions: 'Acciones',
    inventory: 'Inventario',
    customers: 'Clientes',
    deliveries: 'Entregas',
    finances: 'Finanzas',
    messages: 'Mensajes',
    suppliers: 'Proveedores',
    planogram: 'Planograma',
    ripening: 'Maduracion',
    history: 'Historial',
    assets: 'Activos',
    training: 'IA',
};

const ViewLoadingState: React.FC = () => (
    <div className="flex min-h-[360px] items-center justify-center rounded-[1.8rem] border border-white/10 bg-white/[0.03] px-6 py-12">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-transparent" />
            Cargando vista...
        </div>
    </div>
);

const AdminLayout: React.FC<{ data: BusinessData; push: OneSignalPushController }> = ({ data, push }) => {
    const { currentView, setCurrentView, theme, toggleTheme, currentRole } = data;
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile toggle
    const { identity: shellIdentity, taskSummary, realtimeSummary, runtimeSummary } = useShellStatusSummaries(data, push);
    const headerSignals = useMemo(
        () =>
            [
                runtimeSummary.followUpSignal,
                runtimeSummary.pushSignal?.tone !== 'live' ? runtimeSummary.pushSignal : null,
                realtimeSummary.signal.tone !== 'live' ? realtimeSummary.signal : null,
                runtimeSummary.staffSignal?.tone === 'warning' || runtimeSummary.staffSignal?.tone === 'offline'
                    ? runtimeSummary.staffSignal
                    : null,
            ].filter(
                (signal, index, array): signal is NonNullable<typeof signal> =>
                    Boolean(signal) && array.findIndex((item) => item?.id === signal?.id) === index,
            ),
        [realtimeSummary.signal, runtimeSummary.followUpSignal, runtimeSummary.pushSignal, runtimeSummary.staffSignal],
    );
    
    // Initial state logic for responsiveness
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            // Default to collapsed on tablet (768px - 1024px)
            return window.innerWidth >= 768 && window.innerWidth < 1024;
        }
        return false;
    });

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768 && window.innerWidth < 1024) {
                setIsSidebarCollapsed(true); // Auto-collapse on tablet
            } else if (window.innerWidth >= 1024) {
                setIsSidebarCollapsed(false); // Auto-expand on desktop (optional, can remain user preference)
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const renderAdminView = () => {
        switch (currentView) {
            case 'dashboard': return <Dashboard data={data} />;
            case 'actions': return <ActionCenter data={data} />;
            case 'messages': return <MessageFeed data={data} />;
            case 'deliveries': return <Deliveries data={data} />;
            case 'promotions': return <Promotions data={data} />;
            case 'ripening': return <RipeningRules data={data} />;
            case 'salesLog': return <SalesHistory data={data} />;
            case 'inventory': return <Inventory data={data} />;
            case 'planogram': return <Planogram data={data} />;
            case 'customers': return <Customers data={data} />;
            case 'suppliers': return <Suppliers data={data} />;
            case 'finances': return <Finances data={data} />;
            case 'history': return <History data={data} />;
            case 'training': return <AITraining systemPrompt={data.systemPrompt} setSystemPrompt={data.setSystemPrompt} />;
            case 'settings': return <Settings />;
            case 'assets': return <Assets data={data} />;
            default: return <Dashboard data={data} />;
        }
    };

    const renderRoleSpecificView = () => {
        switch (currentRole) {
            case 'Admin': return renderAdminView();
            case 'Cajero': return renderAdminView();
            case 'Empacador': return <PackerView data={data} />;
            case 'Repartidor': return <DelivererView data={data} />;
            default: return <div>Rol no reconocido</div>;
        }
    };

    return (
        <div className="fideo-shell relative flex h-screen overflow-hidden bg-[#030712] text-slate-100">
            <div className="fideo-ambient pointer-events-none absolute inset-0" />
            <div className="noise-overlay pointer-events-none absolute inset-0" />
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-2xl focus:bg-brand-400 focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-slate-950"
            >
                Saltar al contenido
            </a>
            <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView}
                theme={theme}
                toggleTheme={toggleTheme}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                currentRole={currentRole}
                isCollapsed={isSidebarCollapsed}
                toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                identity={shellIdentity}
                taskSummary={taskSummary}
                realtimeSummary={realtimeSummary}
            />
            <main className="relative flex-1 flex min-w-0 flex-col h-full overflow-hidden">
                <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#030712]/78 backdrop-blur-2xl">
                    <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 md:px-5 lg:px-7">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <div className="min-w-0 rounded-[1.45rem] border border-white/[0.07] bg-white/[0.035] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:px-4">
                                <div className="flex min-w-0 items-start gap-3">
                                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10">
                                    <Bars3Icon />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-brand-200">
                                                <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_16px_rgba(163,230,53,0.7)]" />
                                                {ROLE_META[currentRole]}
                                            </span>
                                            {shellIdentity && (
                                                <span
                                                    title={shellIdentity.secondaryLabel || shellIdentity.primaryLabel}
                                                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-semibold text-slate-200"
                                                >
                                                    <span className={`h-2 w-2 rounded-full ${shellIdentity.pushExternalId ? 'bg-brand-300 shadow-[0_0_10px_rgba(163,230,53,0.6)]' : 'bg-sky-300/90'}`} />
                                                    <span className="max-w-[220px] truncate">{shellIdentity.primaryLabel}</span>
                                                    {shellIdentity.employeeId && <span className="text-slate-500">{shellIdentity.employeeId}</span>}
                                                    {shellIdentity.pushExternalId && (
                                                        <span className="rounded-full border border-brand-400/20 bg-brand-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-brand-200">
                                                            Push
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                            {headerSignals.map((signal) => (
                                                <ShellSignalBadge key={signal.id} signal={signal} />
                                            ))}
                                        </div>
                                        <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-white md:text-[1.7rem]">
                                            {VIEW_TITLES[currentView] || 'Fideo'}
                                        </h1>
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0 lg:max-w-[420px] 2xl:max-w-[640px]">
                                <RoleSwitcher
                                    data={data}
                                    push={push}
                                    identity={shellIdentity}
                                    taskSummary={taskSummary}
                                    realtimeSummary={realtimeSummary}
                                    runtimeSummary={runtimeSummary}
                                />
                            </div>
                        </div>
                        <div className="hidden overflow-hidden 2xl:block">
                             <StatusBar activities={data.activityLog} taskSummary={taskSummary} realtimeSummary={realtimeSummary} />
                        </div>
                    </div>
                </header>
                <div className="flex-grow overflow-y-auto scroll-smooth">
                    <div id="main-content" className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-5 lg:px-7">
                        <Suspense fallback={<ViewLoadingState />}>{renderRoleSpecificView()}</Suspense>
                    </div>
                </div>
            </main>
            <VoiceControl addMessage={data.addMessage} />
        </div>
    );
};

export default AdminLayout;
