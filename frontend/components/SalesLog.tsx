
import React, { useState, useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale, SaleStatus, PaymentStatus } from '../types';
import TicketModal from './TicketModal';

const getStatusColor = (status: SaleStatus) => {
    switch(status) {
        case 'Pendiente de Empaque':
        case 'Listo para Entrega':
            return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700';
        case 'En Ruta': return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
        case 'Completado': return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
        case 'Cancelado': return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
    }
};

const getPaymentStatusColor = (status: PaymentStatus) => {
    switch(status) {
        case 'Pendiente': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        case 'Pagado': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'En Deuda': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    }
};


const SalesHistory: React.FC<{ data: BusinessData }> = ({ data }) => {
  const { sales, employees, saleStatusFilter, setSaleStatusFilter, paymentStatusFilter, setPaymentStatusFilter } = data;
  const [ticketModalSale, setTicketModalSale] = useState<Sale | null>(null);
  
  const getEmployeeName = (id?: string) => id ? employees.find(e => e.id === id)?.name || 'N/A' : 'N/A';

  const filteredSales = useMemo(() => {
    return sales
        .filter(s => saleStatusFilter === 'all' || s.status === saleStatusFilter)
        .filter(s => paymentStatusFilter === 'all' || s.paymentStatus === paymentStatusFilter)
        .sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [sales, saleStatusFilter, paymentStatusFilter]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Registro de Ventas</h1>
      
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md flex flex-wrap items-center gap-4">
        <span className='font-semibold text-gray-600 dark:text-gray-300'>Filtros:</span>
        <div>
            <label htmlFor="saleStatus" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Estado:</label>
            <select id="saleStatus" value={saleStatusFilter} onChange={e => setSaleStatusFilter(e.target.value as SaleStatus | 'all')} className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                <option value="all">Todos</option>
                <option value="Pendiente de Empaque">Pendiente de Empaque</option>
                <option value="Listo para Entrega">Listo para Entrega</option>
                <option value="En Ruta">En Ruta</option>
                <option value="Completado">Completado</option>
                <option value="Cancelado">Cancelado</option>
            </select>
        </div>
        <div>
            <label htmlFor="paymentStatus" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Pago:</label>
            <select id="paymentStatus" value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value as PaymentStatus | 'all')} className="p-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                <option value="all">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Pagado">Pagado</option>
                <option value="En Deuda">En Deuda</option>
            </select>
        </div>
      </div>

      {filteredSales.length > 0 ? (
        <div className="space-y-4">
          {filteredSales.map(sale => (
            <div key={sale.id} className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border-l-4 ${getStatusColor(sale.status)}`}>
                <div className="flex flex-wrap justify-between items-start gap-4">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{sale.customer}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            <span className="font-semibold">{sale.quantity} {sale.unit}</span> de {sale.productGroupName} {sale.varietyName} ({sale.quality} / {sale.state})
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">Destino: {sale.destination}</p>
                        <p className="text-md font-bold text-green-700 dark:text-green-400 mt-2">{sale.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
                    </div>
                    <div className='text-right'>
                        <span className={`text-xs font-bold py-1 px-3 rounded-full ${getStatusColor(sale.status)}`}>{sale.status}</span>
                        <div className="mt-2">
                             <span className={`text-xs font-bold py-1 px-3 rounded-full ${getPaymentStatusColor(sale.paymentStatus)}`}>{sale.paymentStatus}</span>
                        </div>
                         <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Repartidor: {getEmployeeName(sale.assignedEmployeeId)}</p>
                    </div>
                </div>
                 <div className="mt-4 pt-3 border-t border-dashed dark:border-gray-700 flex justify-between items-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {sale.id} - {sale.timestamp.toLocaleString('es-MX')}</p>
                    <button onClick={() => setTicketModalSale(sale)} className="px-3 py-1 text-xs font-semibold bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">
                        <i className="fa-solid fa-receipt mr-1"></i>
                        Ver Ticket
                    </button>
                 </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Sin Resultados</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">No se encontraron ventas con los filtros actuales.</p>
        </div>
      )}
      {ticketModalSale && <TicketModal sale={ticketModalSale} onClose={() => setTicketModalSale(null)} />}
    </div>
  );
};

export default SalesHistory;
