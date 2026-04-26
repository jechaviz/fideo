
import React from 'react';
import { ActivityLog } from '../types';
import { SaleIcon, PriceIcon, StateChangeIcon, CrateLoanIcon, EmployeeIcon, WarehouseTransferIcon, AssignmentIcon, CheckCircleIcon, AdjustmentIcon, ProductCrudIcon, ExpenseIcon, NavigateIcon, FilterIcon, MermaIcon, WarehouseIcon } from './icons/Icons';

const IconMap: Record<string, React.ReactNode> = {
    VENTA: <SaleIcon />,
    ACTUALIZACION_PRECIO: <PriceIcon />,
    MOVIMIENTO_ESTADO: <StateChangeIcon />,
    PRESTAMO_CAJA: <CrateLoanIcon />,
    LLEGADA_EMPLEADO: <EmployeeIcon />,
    TRANSFERENCIA_BODEGA: <WarehouseTransferIcon />,
    ASIGNACION_ENTREGA: <AssignmentIcon />,
    COMPLETA_VENTA: <CheckCircleIcon />,
    INVENTARIO_AJUSTE: <AdjustmentIcon />,
    PRODUCTO_CRUD: <ProductCrudIcon />,
    GASTO: <ExpenseIcon />,
    NAVEGACION: <NavigateIcon />,
    FILTRO: <FilterIcon />,
    MERMA_REGISTRO: <MermaIcon />,
    BODEGA_CRUD: <WarehouseIcon />,
};


const StatusBar: React.FC<{ activities: ActivityLog[] }> = ({ activities }) => {
    const recentActivities = activities.slice(0, 5);

    if (recentActivities.length === 0) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center space-x-6 animate-marquee whitespace-nowrap">
                 {[...recentActivities, ...recentActivities].map((activity, index) => (
                    <div key={`${activity.id}-${index}`} className="inline-flex items-center space-x-2">
                        <span className="text-lg">{IconMap[activity.type] || <SaleIcon />}</span>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                           {activity.description} 
                           <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">({new Date(activity.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute:'2-digit' })})</span>
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StatusBar;
