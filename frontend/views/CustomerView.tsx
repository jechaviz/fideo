import React, { useState, useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale } from '../types';

type CustomerTab = 'today_orders' | 'order_history' | 'crates' | 'prices';

const TabButton: React.FC<{name: string, tab: CustomerTab, activeTab: CustomerTab, setActiveTab: (tab: CustomerTab) => void}> = ({ name, tab, activeTab, setActiveTab }) => (
    <button onClick={() => setActiveTab(tab)} className={`whitespace-nowrap py-3 px-3 border-b-2 font-semibold text-sm transition-colors ${activeTab === tab ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}>
        {name}
    </button>
);

const OrderList: React.FC<{ sales: Sale[] }> = ({ sales }) => (
    <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
        {sales.length > 0 ? sales.map(sale => (
            <div key={sale.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex justify-between items-center">
                    <p className="font-semibold dark:text-gray-200">{sale.quantity}x {sale.varietyName} {sale.size}</p>
                    <p className="font-bold text-green-700 dark:text-green-400">{sale.price.toLocaleString('es-MX', {style:'currency', currency: 'MXN'})}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(sale.timestamp).toLocaleString('es-MX')} - {sale.status} / {sale.paymentStatus}</p>
            </div>
        )) : <p className="text-center text-gray-500 dark:text-gray-400 py-4">No hay pedidos para mostrar.</p>}
    </div>
);

const CustomerView: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { customers, sales, payments, crateLoans, crateTypes, productGroups, currentCustomerId } = data;
    const [activeTab, setActiveTab] = useState<CustomerTab>('today_orders');

    const customer = useMemo(() => {
        return customers.find(c => c.id === currentCustomerId);
    }, [customers, currentCustomerId]);

    const totalBalance = useMemo(() => {
        if (!customer) return 0;
        const debtFromSales = sales
          .filter(s => s.customer === customer.name && s.paymentStatus === 'En Deuda' && s.status === 'Completado')
          .reduce((sum, s) => sum + s.price, 0);
        const totalPayments = payments
          .filter(p => p.customerId === customer.id)
          .reduce((sum, p) => sum + p.amount, 0);
        const finalMonetaryDebt = Math.max(0, debtFromSales - totalPayments);
        const loans = crateLoans.filter(l => l.customer === customer.name && (l.status === 'Prestado' || l.status === 'No Devuelto'));
        const finalLentCratesValue = loans.reduce((sum, loan) => {
            const crateType = crateTypes.find(ct => ct.id === loan.crateTypeId);
            return sum + (loan.quantity * (crateType?.cost || 50));
        }, 0);
        return finalMonetaryDebt + finalLentCratesValue;
    }, [customer, sales, payments, crateLoans, crateTypes]);
    
    const { todaySales, historicalSales } = useMemo(() => {
        const allSales = data.sales.filter(s => s.customer === customer?.name).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return {
            todaySales: allSales.filter(s => new Date(s.timestamp) >= today),
            historicalSales: allSales.filter(s => new Date(s.timestamp) < today)
        };
    }, [data.sales, customer]);

    const customerLoans = useMemo(() => crateLoans.filter(l => l.customer === customer?.name).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()), [crateLoans, customer]);

    if (!customer) {
        return (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Cliente no encontrado</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">No se pudo cargar la información del cliente.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="p-6 border-b dark:border-gray-700">
                <div className="flex justify-between items-start">
                     <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bienvenido, {customer.name}</h2>
                     <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Balance Total</p>
                        <p className={`text-3xl font-bold ${totalBalance > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                            {totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                        </p>
                     </div>
                </div>
            </div>
            
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-2 px-4" aria-label="Tabs">
                <TabButton name="Mi Pedido de Hoy" tab="today_orders" activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton name="Historial de Pedidos" tab="order_history" activeTab={activeTab} setActiveTab={setActiveTab} />
                {customerLoans.length > 0 && <TabButton name="Mis Cajas" tab="crates" activeTab={activeTab} setActiveTab={setActiveTab} />}
                {customer.specialPrices.length > 0 && <TabButton name="Mi Lista de Precios" tab="prices" activeTab={activeTab} setActiveTab={setActiveTab} />}
              </nav>
            </div>
            
            <div className="p-6">
                {activeTab === 'today_orders' && <OrderList sales={todaySales} />}
                {activeTab === 'order_history' && <OrderList sales={historicalSales} />}
                {activeTab === 'crates' && (
                     <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                        {customerLoans.map(loan => {
                             const crateType = crateTypes.find(ct => ct.id === loan.crateTypeId);
                             const isOverdue = new Date(loan.dueDate) < new Date() && loan.status === 'Prestado';
                             return (
                                 <div key={loan.id} className={`p-3 rounded-md ${isOverdue ? 'bg-red-50 dark:bg-red-900/30' : 'bg-yellow-50 dark:bg-yellow-900/30'}`}>
                                     <span className="font-semibold text-gray-700 dark:text-gray-200">{loan.quantity} x {crateType?.name || 'Caja'}</span>
                                     <span className={`ml-3 text-sm ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                                         {loan.status} | Vence: {new Date(loan.dueDate).toLocaleDateString('es-MX')}
                                     </span>
                                 </div>
                             )
                        })}
                    </div>
                )}
                {activeTab === 'prices' && (
                     <div className="max-h-96 overflow-y-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left font-semibold text-gray-500 dark:text-gray-400">
                                <tr><th className="p-2">Producto</th><th className="p-2">Tu Precio</th></tr>
                            </thead>
                            <tbody>
                            {customer.specialPrices.map(sp => {
                                const pg = productGroups.find(g => g.varieties.some(v => v.id === sp.varietyId));
                                const variety = pg?.varieties.find(v => v.id === sp.varietyId);
                                return (
                                <tr key={`${sp.varietyId}-${sp.size}`} className="border-b dark:border-gray-700">
                                    <td className="p-2 dark:text-gray-200">{pg?.name} {variety?.name} ({sp.size})</td>
                                    <td className="p-2 font-bold text-green-700 dark:text-green-400">{sp.price.toLocaleString('es-MX', {style:'currency',currency:'MXN'})}</td>
                                </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerView;
