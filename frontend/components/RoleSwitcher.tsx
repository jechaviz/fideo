import React from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { UserRole } from '../types';

const ROLES: UserRole[] = ['Admin', 'Empacador', 'Repartidor', 'Cajero', 'Cliente', 'Proveedor'];

const RoleSwitcher: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { currentRole, setCurrentRole, customers, suppliers, currentCustomerId, currentSupplierId } = data;

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentRole(e.target.value as UserRole);
    };

    const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentRole(currentRole, e.target.value);
    };

    return (
        <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-inner">
            <div className="flex items-center gap-2">
                 <label htmlFor="role-select" className="text-sm font-bold text-gray-600 dark:text-gray-300">
                    <i className="fa-solid fa-user-shield mr-2"></i>
                    Viendo como:
                </label>
                <select
                    id="role-select"
                    value={currentRole}
                    onChange={handleRoleChange}
                    className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-green-500"
                >
                    {ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>
            </div>

            {currentRole === 'Cliente' && (
                <div className="flex items-center gap-2">
                     <label htmlFor="customer-select" className="text-sm font-bold text-gray-600 dark:text-gray-300">
                        Cliente:
                    </label>
                    <select
                        id="customer-select"
                        value={currentCustomerId || ''}
                        onChange={handleEntityChange}
                        className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-green-500"
                    >
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {currentRole === 'Proveedor' && (
                 <div className="flex items-center gap-2">
                     <label htmlFor="supplier-select" className="text-sm font-bold text-gray-600 dark:text-gray-300">
                        Proveedor:
                    </label>
                    <select
                        id="supplier-select"
                        value={currentSupplierId || ''}
                        onChange={handleEntityChange}
                        className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-green-500"
                    >
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};

export default RoleSwitcher;
