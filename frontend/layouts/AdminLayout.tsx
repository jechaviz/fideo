
import React, { Suspense, lazy, useEffect, useState } from 'react';
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
        <div className="relative flex h-screen overflow-hidden bg-slate-950 text-slate-100">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.16),transparent_24%),radial-gradient(circle_at_left,rgba(56,189,248,0.12),transparent_20%)]" />
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
                <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/72 backdrop-blur-2xl">
                    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 md:px-6 lg:px-8">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10">
                                    <Bars3Icon />
                                </button>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="truncate text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                                            {VIEW_TITLES[currentView] || 'Fideo'}
                                        </h1>
                                        <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-brand-200">
                                            <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_16px_rgba(163,230,53,0.7)]" />
                                            {ROLE_META[currentRole]}
                                        </span>
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
                                        {realtimeSummary && <ShellSignalBadge signal={realtimeSummary.signal} />}
                                        {runtimeSummary.signals.map((signal) => (
                                            <ShellSignalBadge key={signal.id} signal={signal} />
                                        ))}
                                        {taskSummary?.signals.map((signal) => (
                                            <ShellSignalBadge key={signal.id} signal={signal} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
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
                        <div className="hidden overflow-hidden xl:block">
                             <StatusBar activities={data.activityLog} taskSummary={taskSummary} realtimeSummary={realtimeSummary} />
                        </div>
                    </div>
                </header>
                <div className="flex-grow overflow-y-auto scroll-smooth">
                    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
                        <div className="mb-6 xl:hidden">
                            <StatusBar activities={data.activityLog} taskSummary={taskSummary} realtimeSummary={realtimeSummary} />
                        </div>
                        <div className="glass-panel-dark rounded-[2rem] p-4 md:p-5 lg:p-6">
                            <Suspense fallback={<ViewLoadingState />}>{renderRoleSpecificView()}</Suspense>
                        </div>
                    </div>
                </div>
            </main>
            <VoiceControl addMessage={data.addMessage} />
        </div>
    );
};

export default AdminLayout;
