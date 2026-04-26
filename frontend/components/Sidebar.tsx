
import React, { useState, useMemo } from 'react';
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
        title: 'Catálogos',
        items: [
            { id: 'inventory', label: 'Inventario', icon: <InventoryIcon /> },
            { id: 'planogram', label: 'Planograma', icon: <PlanogramIcon /> },
            { id: 'customers', label: 'Clientes', icon: <CustomersIcon /> },
            { id: 'suppliers', label: 'Proveedores', icon: <SuppliersIcon /> },
        ]
    },
    {
        title: 'Análisis',
        items: [
            { id: 'finances', label: 'Finanzas', icon: <FinanceIcon /> },
            { id: 'salesLog', label: 'Ventas', icon: <SalesLogIcon /> },
            { id: 'history', label: 'Historial', icon: <HistoryIcon /> },
        ]
    },
    {
        title: 'Sistema',
        items: [
            { id: 'ripening', label: 'Maduración', icon: <RipeningIcon /> },
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


const SidebarContent: React.FC<Pick<SidebarProps, 'currentView' | 'setCurrentView' | 'theme' | 'toggleTheme' | 'onClose' | 'currentRole' | 'isCollapsed' | 'toggleCollapse'>> = ({ currentView, setCurrentView, theme, toggleTheme, onClose, currentRole, isCollapsed, toggleCollapse }) => {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'Operaciones': true,
        'Catálogos': true,
        'Empaque': true,
        'Ruta': true,
        'Análisis': true,
        'Sistema': true
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
        if (isCollapsed) return; // Don't toggle when collapsed
        setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    const handleViewChange = (view: View) => {
        setCurrentView(view);
        if (window.innerWidth < 768) { // Close on mobile selection
            onClose();
        }
    }

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-gray-800 shadow-md flex flex-col h-full transition-all duration-300 ease-in-out`}>
            {/* Header */}
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 border-b border-gray-200 dark:border-gray-700 px-4 transition-all duration-300`}>
                {isCollapsed ? (
                     <span className="text-3xl" style={{color: '#f59e0b'}}>🥧</span>
                ) : (
                    <h1 className="text-3xl font-bold text-green-700 dark:text-green-500 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                        <span className="text-3xl" style={{color: '#f59e0b'}}>🥧</span>
                        Fideo
                    </h1>
                )}
                <button onClick={onClose} className="md:hidden p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <XMarkIcon />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden">
                {navConfig.map((section) => (
                    <div key={section.title} className="mb-4">
                        {!isCollapsed ? (
                            <button
                                onClick={() => toggleSection(section.title)}
                                className="flex items-center justify-between w-full p-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mb-1"
                            >
                                <span>{section.title}</span>
                                {openSections[section.title] ? <ChevronDownIcon /> : <ChevronRightIcon />}
                            </button>
                        ) : (
                            <div className="border-b border-gray-200 dark:border-gray-700 my-2 mx-auto w-8" title={section.title}></div>
                        )}
                        
                        {/* Show items if section is open OR if sidebar is collapsed (always show items in collapsed mode) */}
                        {(openSections[section.title] || isCollapsed) && (
                            <ul className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : 'mt-1'}`}>
                            {section.items.map((item) => (
                                <li key={item.id} className="w-full">
                                <button
                                    onClick={() => handleViewChange(item.id)}
                                    title={isCollapsed ? item.label : ''}
                                    className={`flex items-center w-full p-3 rounded-lg transition-colors duration-200 group relative ${
                                    currentView === item.id
                                        ? 'bg-green-600 text-white shadow-md'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100'
                                    } ${isCollapsed ? 'justify-center' : 'text-left'}`}
                                >
                                    <span className={`text-center text-xl ${isCollapsed ? '' : 'mr-3 w-6'}`}>{item.icon}</span>
                                    {!isCollapsed && <span className="font-medium text-sm truncate">{item.label}</span>}
                                    
                                    {/* Tooltip for collapsed mode */}
                                    {isCollapsed && (
                                        <div className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-200">
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

            {/* Footer & Toggle */}
            <div className="border-t border-gray-200 dark:border-gray-700">
                <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
                    <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Toggle theme" title="Cambiar tema">
                        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    </button>
                    
                    <button 
                        onClick={toggleCollapse} 
                        className="hidden md:flex p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
                    >
                        {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                    </button>
                </div>
                {!isCollapsed && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center pb-2">v6.4</p>
                )}
            </div>
        </aside>
    );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
  return (
    <>
      {/* Mobile Sidebar (Overlay) */}
      <div className={`fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity ${props.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={props.onClose}></div>
      <div className={`fixed inset-y-0 left-0 transform ${props.isOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden transition-transform duration-300 ease-in-out z-40`}>
        <SidebarContent {...props} isCollapsed={false} toggleCollapse={() => {}} />
      </div>
      
      {/* Desktop/Tablet Sidebar (Static/Collapsed) */}
      <div className="hidden md:flex md:flex-shrink-0 h-full">
         <SidebarContent {...props} />
      </div>
    </>
  );
};

export default Sidebar;
