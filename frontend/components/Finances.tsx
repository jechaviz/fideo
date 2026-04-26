
import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale, CashDrawer, CashDrawerActivity } from '../types';

const getDebtAgeColor = (days: number) => {
    if (days > 60) return 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300';
    if (days > 30) return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    return 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300';
};

interface CustomerDebtInfo {
    name: string;
    monetaryDebt: number;
    lentCratesValue: number;
    totalBalance: number;
    debtSales: (Sale & { ageDays: number })[];
}

const CashDrawerManager: React.FC<{
    drawer: CashDrawer;
    activities: CashDrawerActivity[];
    onOpen: (id: string, balance: number) => void;
    onClose: (id: string, counted: number, notes?: string) => void;
}> = ({ drawer, activities, onOpen, onClose }) => {
    const [openModal, setOpenModal] = useState(false);
    const [closeModal, setCloseModal] = useState(false);
    const [initialBalance, setInitialBalance] = useState('');
    const [countedAmount, setCountedAmount] = useState('');
    const [closeNotes, setCloseNotes] = useState('');

    const expectedBalance = drawer.balance;
    const difference = parseFloat(countedAmount) - expectedBalance;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{drawer.name}</h2>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${drawer.status === 'Abierta' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{drawer.status}</span>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Saldo Actual</p>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{drawer.balance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
                </div>
                {drawer.status === 'Cerrada' 
                    ? <button onClick={() => setOpenModal(true)} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Abrir Caja</button>
                    : <button onClick={() => setCloseModal(true)} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">Cerrar Caja</button>
                }
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Movimientos Recientes</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {activities.slice(0, 20).map(act => (
                        <div key={act.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                            <div>
                                <p className="font-semibold text-sm capitalize dark:text-gray-200">{act.type.replace(/_/g, ' ').toLowerCase()}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{act.notes || new Date(act.timestamp).toLocaleString('es-MX')}</p>
                            </div>
                            <p className={`font-bold ${act.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {act.amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {openModal && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Abrir Caja</h3>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Saldo Inicial</label>
                        <input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="Ej. 5000" className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        <div className="mt-4 flex justify-end gap-2">
                            <button onClick={() => setOpenModal(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">Cancelar</button>
                            <button onClick={() => { onOpen(drawer.id, parseFloat(initialBalance) || 0); setOpenModal(false); }} className="px-4 py-2 bg-green-600 text-white rounded-md">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
            
            {closeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Corte de Caja</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Saldo Esperado:</span> <span className="font-semibold dark:text-gray-200">{expectedBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span></div>
                            <div>
                                <label className="block font-medium text-gray-700 dark:text-gray-300">Saldo Real (contado):</label>
                                <input type="number" value={countedAmount} onChange={e => setCountedAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                            <div className={`flex justify-between p-2 rounded-md ${!countedAmount ? 'bg-gray-100 dark:bg-gray-700' : difference === 0 ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                                <span className="font-bold">Diferencia:</span>
                                <span className={`font-bold ${!countedAmount ? '' : difference === 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{countedAmount ? difference.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-'}</span>
                            </div>
                             <div>
                                <label className="block font-medium text-gray-700 dark:text-gray-300">Notas:</label>
                                <textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)} rows={2} className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button onClick={() => setCloseModal(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">Cancelar</button>
                            <button onClick={() => { onClose(drawer.id, parseFloat(countedAmount) || 0, closeNotes); setCloseModal(false); }} className="px-4 py-2 bg-red-600 text-white rounded-md">Confirmar Cierre</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Finances: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { sales, customers, payments, crateLoans, crateTypes, cashDrawers, cashDrawerActivities, openCashDrawer, closeCashDrawer } = data;
    const [activeTab, setActiveTab] = useState<'debt' | 'cash'>('debt');

    const financialData = useMemo(() => {
        const debtByCustomer: Record<string, CustomerDebtInfo> = {};
        const now = new Date();
        const nowTime = now.getTime();
        
        const activeLoans = crateLoans.filter(l => l.status === 'Prestado' || l.status === 'No Devuelto');

        customers.forEach(c => {
            debtByCustomer[c.id] = { name: c.name, monetaryDebt: 0, lentCratesValue: 0, totalBalance: 0, debtSales: [] };
        });

        const completedSales = sales.filter(s => s.status === 'Completado' && s.paymentStatus === 'En Deuda');

        for (const sale of completedSales) {
            const customerId = customers.find(c => c.name === sale.customer)?.id;
            if (customerId) {
                const ageDays = Math.floor((nowTime - new Date(sale.timestamp).getTime()) / (1000 * 3600 * 24));
                debtByCustomer[customerId].debtSales.push({ ...sale, ageDays });
            }
        }
        
        Object.keys(debtByCustomer).forEach(customerId => {
            const customerSales = debtByCustomer[customerId].debtSales;
            const customerPayments = payments.filter(p => p.customerId === customerId);
            
            const totalBilled = customerSales.reduce((sum, s) => sum + s.price, 0);
            const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
            
            const customerLoans = activeLoans.filter(l => l.customer === debtByCustomer[customerId].name);
            const customerLentCratesValue = customerLoans.reduce((sum, loan) => {
                const crateType = crateTypes.find(ct => ct.id === loan.crateTypeId);
                return sum + (loan.quantity * (crateType?.cost || 50));
            }, 0);

            debtByCustomer[customerId].monetaryDebt = Math.max(0, totalBilled - totalPaid);
            debtByCustomer[customerId].lentCratesValue = customerLentCratesValue;
            debtByCustomer[customerId].totalBalance = debtByCustomer[customerId].monetaryDebt + customerLentCratesValue;
        });
        
        const customersWithDebt = Object.values(debtByCustomer)
            .filter(c => c.totalBalance > 0)
            .sort((a,b) => b.totalBalance - a.totalBalance);
        
        const totalMonetaryDebt = customersWithDebt.reduce((acc, curr) => acc + curr.monetaryDebt, 0);
        
        const totalLentAssetValue = activeLoans.reduce((sum, loan) => {
             const crateType = crateTypes.find(ct => ct.id === loan.crateTypeId);
             return sum + (loan.quantity * (crateType?.cost || 50));
        }, 0);
        
        const lentCratesByCustomer = customers.map(customer => {
            const loans = activeLoans
                .filter(l => l.customer === customer.name)
                .map(l => ({ ...l, isOverdue: new Date(l.dueDate) < now, crateTypeName: crateTypes.find(ct => ct.id === l.crateTypeId)?.name || 'N/A' }));
            return { customerName: customer.name, loans };
        }).filter(c => c.loans.length > 0);


        return { customersWithDebt, totalMonetaryDebt, totalLentAssetValue, lentCratesByCustomer };
    }, [sales, customers, payments, crateLoans, crateTypes]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Finanzas</h1>

             <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    <button onClick={() => setActiveTab('debt')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'debt' ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}>Cuentas por Cobrar</button>
                    <button onClick={() => setActiveTab('cash')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'cash' ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}>Gestión de Caja</button>
                </nav>
            </div>

            {activeTab === 'debt' && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-orange-500">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Deuda Monetaria Total</h3>
                        <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100">
                            {financialData.totalMonetaryDebt.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Suma de ventas a crédito no pagadas.
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-yellow-500">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Valor de Activos Prestados</h3>
                        <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100">
                            {financialData.totalLentAssetValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Valor estimado de cajas no devueltas.
                        </p>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-8">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Activos Prestados y Perdidos (Cajas)</h2>
                    {financialData.lentCratesByCustomer.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Detalle</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado y Vencimiento</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {financialData.lentCratesByCustomer.map(item => (
                                        <tr key={item.customerName}>
                                            <td className="px-4 py-4 font-semibold text-gray-900 dark:text-gray-100 align-top">{item.customerName}</td>
                                            <td className="px-4 py-4 align-top">
                                                {item.loans.map(loan => (
                                                    <p key={loan.id} className="text-sm text-gray-800 dark:text-gray-200">{loan.quantity} x {loan.crateTypeName}</p>
                                                ))}
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                {item.loans.map(loan => (
                                                    <div key={loan.id} className="text-sm">
                                                        {loan.status === 'No Devuelto' ? (
                                                            <span className='font-semibold text-red-600 dark:text-red-400'>No Devuelto</span>
                                                        ) : (
                                                            <span className={`font-semibold ${loan.isOverdue ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-300'}`}>
                                                                Vence: {new Date(loan.dueDate).toLocaleDateString('es-MX')} {loan.isOverdue && '(Vencido)'}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-gray-500 dark:text-gray-400">No hay cajas prestadas pendientes de devolución.</p>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Balance de Cuentas por Cobrar</h2>
                    {financialData.customersWithDebt.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Deuda Monetaria</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Valor Cajas</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Balance Total</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Detalles de Deuda</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {financialData.customersWithDebt.map(customer => (
                                        <tr key={customer.name}>
                                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.name}</div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                                <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                                                    {customer.monetaryDebt > 0 ? customer.monetaryDebt.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                                <div className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                                                    {customer.lentCratesValue > 0 ? customer.lentCratesValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                                <div className="text-sm font-bold text-red-600 dark:text-red-400">
                                                    {customer.totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 space-y-2">
                                                {customer.debtSales.map(sale => (
                                                    <div key={sale.id} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md flex justify-between items-center">
                                                        <div>
                                                            <p>
                                                                <span className="font-semibold">{sale.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
                                                                <span className="mx-2">-</span>
                                                                <span className="text-xs">{new Date(sale.timestamp).toLocaleDateString('es-MX')}</span>
                                                            </p>
                                                            {sale.paymentNotes && <p className="text-xs italic text-gray-400 dark:text-gray-500">Nota: "{sale.paymentNotes}"</p>}
                                                        </div>
                                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${getDebtAgeColor(sale.ageDays)}`}>
                                                            {sale.ageDays} día{sale.ageDays !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-gray-500 dark:text-gray-400">No hay clientes con saldos pendientes.</p>
                        </div>
                    )}
                </div>
            </>
            )}

            {activeTab === 'cash' && (
                <CashDrawerManager
                    drawer={cashDrawers[0]}
                    activities={cashDrawerActivities.filter(a => a.drawerId === cashDrawers[0].id)}
                    onOpen={openCashDrawer}
                    onClose={closeCashDrawer}
                />
            )}
        </div>
    );
};

export default Finances;
