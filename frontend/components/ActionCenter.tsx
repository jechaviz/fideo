
import React from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { ActionItem } from '../types';

const ActionItemCard: React.FC<{ item: ActionItem, onAction: (item: ActionItem) => void }> = ({ item, onAction }) => {
    const iconMap: Record<ActionItem['type'], string> = {
        'PACK_ORDER': 'fa-box-check',
        'ASSIGN_DELIVERY': 'fa-truck',
        'CONFIRM_PURCHASE_ORDER': 'fa-dolly',
        'FOLLOW_UP_CRATE': 'fa-box-open',
        'SMART_MOVE': 'fa-people-carry-box'
    };

    const colorMap: Record<ActionItem['type'], string> = {
        'PACK_ORDER': 'border-blue-500 bg-blue-50 dark:bg-blue-900/50',
        'ASSIGN_DELIVERY': 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/50',
        'CONFIRM_PURCHASE_ORDER': 'border-purple-500 bg-purple-50 dark:bg-purple-900/50',
        'FOLLOW_UP_CRATE': 'border-orange-500 bg-orange-50 dark:bg-orange-900/50',
        'SMART_MOVE': 'border-teal-500 bg-teal-50 dark:bg-teal-900/50'
    };

    return (
        <div className={`p-4 rounded-xl shadow-md border-l-4 flex flex-col justify-between ${colorMap[item.type]}`}>
            <div>
                <div className="flex items-start gap-3">
                    <i className={`fa-solid ${iconMap[item.type]} mt-1 text-gray-600 dark:text-gray-300`}></i>
                    <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{item.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                    </div>
                </div>
            </div>
            <button
                onClick={() => onAction(item)}
                className="mt-4 w-full text-white font-bold py-2 px-4 rounded-lg transition-colors bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500"
            >
                {item.cta.text}
            </button>
        </div>
    );
};

const ActionCenter: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { actionItems, setCurrentView } = data;

    const handleAction = (item: ActionItem) => {
        setCurrentView(item.cta.targetView);
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Centro de Acciones</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Tus tareas prioritarias para mantener el negocio en movimiento.</p>

            {actionItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {actionItems.map(item => (
                        <ActionItemCard key={item.id} item={item} onAction={handleAction} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                    <div className="text-5xl text-green-500 mb-4">
                        <i className="fa-solid fa-check-double"></i>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">¡Todo en orden!</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">No hay acciones pendientes en este momento.</p>
                </div>
            )}
        </div>
    );
};

export default ActionCenter;
