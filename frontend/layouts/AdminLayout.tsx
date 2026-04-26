
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Dashboard from '../components/Dashboard';
import MessageFeed from '../components/MessageFeed';
import Inventory from '../components/Inventory';
import AITraining from '../components/AITraining';
import SalesHistory from '../components/SalesLog';
import Customers from '../components/Customers';
import Settings from '../components/Settings';
import History from '../components/History';
import Deliveries from '../components/Deliveries';
import Assets from '../components/Assets';
import Finances from '../components/Finances';
import Promotions from '../components/Promotions';
import RipeningRules from '../components/RipeningRules';
import Suppliers from '../components/Suppliers';
import StatusBar from '../components/StatusBar';
import VoiceControl from '../components/VoiceControl';
import RoleSwitcher from '../components/RoleSwitcher';
import PackerView from '../views/PackerView';
import DelivererView from '../views/DelivererView';
import ActionCenter from '../components/ActionCenter';
import Planogram from '../components/Planogram';
import { BusinessData } from '../hooks/useBusinessData';
import { Bars3Icon } from '../components/icons/Icons';

const AdminLayout: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { currentView, setCurrentView, theme, toggleTheme, currentRole } = data;
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile toggle
    
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
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
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
            />
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <header className="p-2 border-b dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                    <div className="flex justify-between items-center gap-4">
                        {/* Hamburger only visible on mobile (< md) */}
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            <Bars3Icon />
                        </button>
                        <div className="flex-grow hidden sm:block overflow-hidden">
                             <StatusBar activities={data.activityLog} />
                        </div>
                        <div className="flex-shrink-0">
                            <RoleSwitcher data={data} />
                        </div>
                    </div>
                </header>
                <div className="flex-grow overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
                    <div className="max-w-7xl mx-auto w-full">
                        {renderRoleSpecificView()}
                    </div>
                </div>
            </main>
            <VoiceControl addMessage={data.addMessage} />
        </div>
    );
};

export default AdminLayout;