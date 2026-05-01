
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
        <div className="glass-panel-dark overflow-hidden rounded-[1.6rem] px-4 py-3">
            <div className="flex items-center gap-4">
                <div className="flex flex-shrink-0 items-center border-r border-white/10 pr-4">
                    <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_14px_rgba(163,230,53,0.8)]"></span>
                </div>
                <div className="min-w-0 overflow-hidden">
                    <div className="flex items-center gap-6 whitespace-nowrap animate-marquee">
                        {[...recentActivities, ...recentActivities].map((activity, index) => (
                            <div key={`${activity.id}-${index}`} className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                <span className="text-base">{IconMap[activity.type] || <SaleIcon />}</span>
                                <p className="text-xs font-semibold text-slate-200">
                                    {activity.description}
                                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                                        {new Date(activity.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute:'2-digit' })}
                                    </span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatusBar;
