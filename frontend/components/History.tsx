
import React, { useState, useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { ActivityLog } from '../types';
import { SaleIcon, PriceIcon, StateChangeIcon, CrateLoanIcon, EmployeeIcon, WarehouseTransferIcon, AssignmentIcon, CheckCircleIcon, AdjustmentIcon, ProductCrudIcon, ExpenseIcon, NavigateIcon, FilterIcon, MermaIcon, WarehouseIcon, FinanceIcon, OfferIcon, TagIcon, RipeningIcon, SupplierCrudIcon, PurchaseOrderIcon, PaymentIcon, AssetSaleIcon, CashIcon } from './icons/Icons';

const IconMap: Record<string, React.ReactNode> = {
    VENTA: <SaleIcon />,
    ACTUALIZACION_PRECIO: <PriceIcon />,
    MOVIMIENTO_ESTADO: <StateChangeIcon />,
    MOVIMIENTO_CALIDAD: <TagIcon />,
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
    TICKET_ENVIADO: <i className="fa-solid fa-receipt text-sky-600 dark:text-sky-400"></i>,
    PAGO_REGISTRADO: <FinanceIcon />,
    PAYMENT_CRUD: <PaymentIcon />,
    OFERTA_ENVIADA: <OfferIcon />,
    REGLA_MADURacion_CRUD: <RipeningIcon />,
    PROVEEDOR_CRUD: <SupplierCrudIcon />,
    ORDEN_COMPRA_CRUD: <PurchaseOrderIcon />,
    VENTA_ACTIVO_CRUD: <AssetSaleIcon />,
    CREDIT_REJECTED: <i className="fa-solid fa-hand-holding-dollar text-red-600 dark:text-red-400"></i>,
    CREDIT_LIMIT_EXCEEDED: <i className="fa-solid fa-triangle-exclamation text-yellow-600 dark:text-yellow-400"></i>,
    CAJA_OPERACION: <CashIcon />,
};

const ActivityCard: React.FC<{ log: ActivityLog }> = ({ log }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex items-start space-x-4 transition-shadow hover:shadow-md">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                {IconMap[log.type] || <SaleIcon />}
            </div>
            <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{log.description}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(log.timestamp).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</p>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-2 flex flex-wrap gap-2">
                    {Object.entries(log.details).map(([key, value]) => (
                        <span key={key} className="inline-block bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600">
                            <span className="font-medium capitalize text-gray-500 dark:text-gray-400">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> {value}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};


const History: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { activityLog } = data;
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const filteredLogs = useMemo(() => {
        return activityLog
            .filter(log => new Date(log.timestamp).toISOString().split('T')[0] === selectedDate)
            .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [activityLog, selectedDate]);
    
    return (
        <div>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Historial del Día</h1>
              <input 
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              />
            </div>
            
            {filteredLogs.length > 0 ? (
                <div className="space-y-4">
                    {filteredLogs.map(log => <ActivityCard key={log.id} log={log} />)}
                </div>
            ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Sin actividad</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">No hay registros para la fecha seleccionada.</p>
                </div>
            )}
        </div>
    );
};

export default History;
