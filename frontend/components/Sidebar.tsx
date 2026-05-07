import React, { useMemo, useState } from 'react';
import { ShellSignalBadge, type ShellIdentity, type ShellRealtimeSummary, type ShellTaskSummary } from './RoleSwitcher';
import { View, UserRole } from '../types';
import {
    DashboardIcon, MessageIcon, InventoryIcon, TrainingIcon, SalesLogIcon,
    CustomersIcon, SettingsIcon, HistoryIcon, DeliveriesIcon, AssetsIcon,
    SunIcon, MoonIcon, FinanceIcon, RipeningIcon, ChevronDownIcon,
    ChevronRightIcon, SuppliersIcon, ActionCenterIcon, XMarkIcon, ChevronLeftIcon, PlanogramIcon
} from './icons/Icons';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  identity?: ShellIdentity | null;
  taskSummary?: ShellTaskSummary | null;
  realtimeSummary?: ShellRealtimeSummary | null;
}

type NavItem = { id: View; label: string; icon: React.ReactNode };
type NavSection = { title: string; items: NavItem[] };

const adminNavConfig: NavSection[] = [
    {
        title: 'Operaciones',
        items: [
            { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
            { id: 'actions', label: 'Acciones', icon: <ActionCenterIcon /> },
            { id: 'messages', label: 'Mensajes', icon: <MessageIcon /> },
            { id: 'deliveries', label: 'Entregas', icon: <DeliveriesIcon /> },
        ]
    },
    {
        title: 'Catalogos',
        items: [
            { id: 'inventory', label: 'Inventario', icon: <InventoryIcon /> },
            { id: 'planogram', label: 'Planograma', icon: <PlanogramIcon /> },
            { id: 'customers', label: 'Clientes', icon: <CustomersIcon /> },
            { id: 'suppliers', label: 'Proveedores', icon: <SuppliersIcon /> },
        ]
    },
    {
        title: 'Analisis',
        items: [
            { id: 'finances', label: 'Finanzas', icon: <FinanceIcon /> },
            { id: 'salesLog', label: 'Ventas', icon: <SalesLogIcon /> },
            { id: 'history', label: 'Historial', icon: <HistoryIcon /> },
        ]
    },
    {
        title: 'Sistema',
        items: [
            { id: 'ripening', label: 'Maduracion', icon: <RipeningIcon /> },
            { id: 'assets', label: 'Activos', icon: <AssetsIcon /> },
            { id: 'training', label: 'Entrenar IA', icon: <TrainingIcon /> },
            { id: 'settings', label: 'Ajustes', icon: <SettingsIcon /> },
        ]
    }
];

const packerNavConfig: NavSection[] = [
    {
        title: 'Empaque',
        items: [
            { id: 'deliveries', label: 'Pedidos', icon: <DeliveriesIcon /> },
        ]
    }
];

const delivererNavConfig: NavSection[] = [
    {
        title: 'Ruta',
        items: [
            { id: 'deliveries', label: 'Mis Entregas', icon: <DeliveriesIcon /> },
        ]
    }
];

const SidebarContent: React.FC<Pick<SidebarProps, 'currentView' | 'setCurrentView' | 'theme' | 'toggleTheme' | 'onClose' | 'currentRole' | 'isCollapsed' | 'toggleCollapse' | 'identity' | 'taskSummary' | 'realtimeSummary'>> = ({
    currentView,
    setCurrentView,
    theme,
    toggleTheme,
    onClose,
    currentRole,
    isCollapsed,
    toggleCollapse,
    identity,
    taskSummary,
    realtimeSummary,
}) => {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        Operaciones: true,
        Catalogos: true,
        Empaque: true,
        Ruta: true,
        Analisis: true,
        Sistema: true,
    });

    const navConfig = useMemo(() => {
        switch (currentRole) {
            case 'Empacador':
                return packerNavConfig;
            case 'Repartidor':
                return delivererNavConfig;
            default:
                return adminNavConfig;
        }
    }, [currentRole]);

    const toggleSection = (title: string) => {
        if (isCollapsed) return;
        setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
    };

    const handleViewChange = (view: View) => {
        setCurrentView(view);
        if (window.innerWidth < 768) {
            onClose();
        }
    };

    return (
        <aside className={`${isCollapsed ? 'w-[5.25rem]' : 'w-[17.5rem]'} relative flex h-full flex-col overflow-hidden border-r border-white/[0.08] bg-[#040916]/92 text-slate-200 shadow-panel backdrop-blur-2xl transition-all duration-300 ease-in-out`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,rgba(163,230,53,0.12),transparent),radial-gradient(circle_at_top,rgba(45,212,191,0.12),transparent_58%)]" />

            <div className={`relative flex min-h-[82px] items-start border-b border-white/[0.08] ${isCollapsed ? 'justify-center px-3 py-4' : 'justify-between px-4 py-4'} transition-all duration-300`}>
                <div className={`flex min-w-0 ${isCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-3'}`}>
                    <div className="fideo-soft-glow flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[1.15rem] bg-brand-400 text-slate-950">
                        <i className="fa-solid fa-apple-whole text-xl"></i>
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0">
                            <p className="truncate text-lg font-black tracking-tight text-white">Fideo</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Operacion viva</p>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="md:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
                    <XMarkIcon />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
                {navConfig.map((section) => (
                    <div key={section.title} className="mb-3.5">
                        {!isCollapsed ? (
                            <button
                                onClick={() => toggleSection(section.title)}
                                className="mb-1.5 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
                            >
                                <span>{section.title}</span>
                                {openSections[section.title] ? <ChevronDownIcon /> : <ChevronRightIcon />}
                            </button>
                        ) : (
                            <div className="mx-auto my-2.5 h-px w-8 bg-white/10" title={section.title}></div>
                        )}

                        {(openSections[section.title] || isCollapsed) && (
                            <ul className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : 'mt-1'}`}>
                                {section.items.map((item) => (
                                    <li key={item.id} className="w-full">
                                        <button
                                            onClick={() => handleViewChange(item.id)}
                                            title={isCollapsed ? item.label : ''}
                                            className={`group relative flex w-full items-center rounded-[1.15rem] px-3.5 py-2.5 transition-all duration-200 ${
                                                currentView === item.id
                                                    ? 'bg-brand-400 text-slate-950 shadow-[0_18px_42px_rgba(132,204,22,0.18)]'
                                                    : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
                                            } ${isCollapsed ? 'justify-center' : 'text-left'}`}
                                        >
                                            <span className={`text-center text-base ${isCollapsed ? '' : 'mr-3 w-5'}`}>{item.icon}</span>
                                            {!isCollapsed && (
                                                <div className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-bold">{item.label}</span>
                                                </div>
                                            )}

                                            {isCollapsed && (
                                                <div className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                                                    {item.label}
                                                </div>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
            </nav>

            <div className="relative mt-auto border-t border-white/[0.08] p-3.5">
                {!isCollapsed && (
                    <div className="mb-3 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.04] p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                            {identity ? 'Perfil' : 'Rol'}
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-sm font-black text-brand-300 shadow-inner shadow-black/40">
                                {identity?.shortLabel || currentRole.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-white">{currentRole}</p>
                                {identity?.primaryLabel && <p className="truncate text-xs font-semibold text-slate-300">{identity.primaryLabel}</p>}
                                {identity?.employeeId && <p className="truncate text-[11px] text-slate-500">{identity.employeeId}</p>}
                            </div>
                        </div>
                        {(realtimeSummary || taskSummary?.signals.length) && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {realtimeSummary && <ShellSignalBadge signal={realtimeSummary.signal} compact />}
                                {taskSummary?.signals.map((signal) => (
                                    <ShellSignalBadge key={signal.id} signal={signal} compact />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className={`flex rounded-[1.25rem] border border-white/[0.08] bg-slate-900/70 p-2.5 ${isCollapsed ? 'flex-col items-center gap-2.5' : 'items-center justify-between gap-2.5'}`}>
                    <button onClick={toggleTheme} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Toggle theme" title="Cambiar tema">
                        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    </button>

                    <button
                        onClick={toggleCollapse}
                        className="hidden h-10 items-center justify-center rounded-xl bg-white/5 px-3 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white md:flex"
                        title={isCollapsed ? 'Expandir menu' : 'Colapsar menu'}
                    >
                        {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                        {!isCollapsed && <span className="ml-2">Colapsar</span>}
                    </button>
                </div>

            </div>
        </aside>
    );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
  return (
    <>
      <div className={`fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity md:hidden ${props.isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={props.onClose}></div>
      <div className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out md:hidden ${props.isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent {...props} isCollapsed={false} toggleCollapse={() => {}} />
      </div>

      <div className="hidden h-full md:flex md:flex-shrink-0">
         <SidebarContent {...props} />
      </div>
    </>
  );
};

export default Sidebar;
