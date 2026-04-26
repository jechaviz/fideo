import React from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import RoleSwitcher from '../components/RoleSwitcher';
import CustomerView from '../views/CustomerView';
import SupplierView from '../views/SupplierView';

const PortalLayout: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { currentRole } = data;

    const renderPortalView = () => {
        switch (currentRole) {
            case 'Cliente': return <CustomerView data={data} />;
            case 'Proveedor': return <SupplierView data={data} />;
            default: return <div>Portal no disponible</div>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow-md">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-green-700 dark:text-green-500">
                        Fideo
                    </h1>
                    <RoleSwitcher data={data} />
                </div>
            </header>
            <main>
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    {renderPortalView()}
                </div>
            </main>
        </div>
    );
};

export default PortalLayout;