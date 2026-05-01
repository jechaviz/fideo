import React, { useState, useMemo } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale, Customer, CrateLoan, PaymentStatus, PaymentMethod } from '../types';
import { findCustomerForSale, loanBelongsToCustomer } from '../utils/customerIdentity';

const CompleteDeliveryModal: React.FC<{
    sale: Sale;
    isOpen: boolean;
    onClose: () => void;
    onComplete: (saleId: string, paymentStatus: PaymentStatus, paymentMethod: PaymentMethod, paymentNotes?: string) => void;
}> = ({ sale, isOpen, onClose, onComplete }) => {
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pagado');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
    const [paymentNotes, setPaymentNotes] = useState('');
    
    if (!isOpen) return null;

    const handleSubmit = () => {
        onComplete(sale.id, paymentStatus, paymentMethod, paymentNotes);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Confirmar Entrega</h2>
                <p className="mb-4 dark:text-gray-300">Registrar el resultado de la entrega para <span className="font-semibold">{sale.customer}</span>.</p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Resultado</label>
                        <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                            <option value="Pagado">Pagado</option>
                            <option value="En Deuda">En Deuda (Crédito)</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Método de Pago</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" disabled={paymentStatus === 'En Deuda'}>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas</label>
                         <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2} placeholder={paymentStatus === 'En Deuda' ? "Ej: Paga el lunes" : "Opcional"} className="mt-1 block w-full p-2 text-base border-gray-300 rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Finalizar Entrega</button>
                </div>
            </div>
        </div>
    );
}

const DelivererCard: React.FC<{
    sale: Sale;
    customerDetails?: Customer;
    crateLoans: CrateLoan[];
    onCompleteClick: (sale: Sale) => void;
}> = ({ sale, customerDetails, crateLoans, onCompleteClick }) => {
    const location = sale.locationQuery || sale.destination;
    const mapUrl = location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;

    const pendingCrates = useMemo(() => {
        return customerDetails ? crateLoans.filter((loan) => loanBelongsToCustomer(loan, customerDetails) && loan.status === 'Prestado') : [];
    }, [crateLoans, customerDetails]);

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border-l-4 border-blue-500 flex flex-col justify-between h-full">
            <div>
                <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{sale.customer}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{sale.quantity}x {sale.productGroupName} {sale.varietyName} ({sale.size})</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-400 mt-1">{sale.destination}</p>
                 {customerDetails?.deliveryNotes && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-gray-700/50 rounded-md border-l-4 border-blue-400">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Notas:</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200 italic">{customerDetails.deliveryNotes}</p>
                    </div>
                )}
                 {pendingCrates.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-md border-l-4 border-yellow-500">
                        <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">
                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                            Recoger {pendingCrates.reduce((sum, l) => sum + l.quantity, 0)} caja(s)
                        </p>
                    </div>
                )}
            </div>
            <div className="mt-4 w-full flex gap-2">
                <button onClick={() => onCompleteClick(sale)} className="flex-grow bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                    Completar
                </button>
                {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="px-4 bg-gray-600 text-white font-bold py-2 rounded-lg hover:bg-gray-700 transition-colors">
                        <i className="fa-solid fa-map-location-dot"></i>
                    </a>
                )}
            </div>
        </div>
    );
};

const DelivererView: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { sales, customers, crateLoans, completeSale } = data;
    const [completeModal, setCompleteModal] = useState<Sale | null>(null);
    
    // Hard-coding to 'Empleado Luis' (ID 'e2') for demonstration
    const currentDriverId = 'e2';
    const inRouteDeliveries = sales.filter(s => s.status === 'En Ruta' && s.assignedEmployeeId === currentDriverId);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Mis Entregas en Ruta</h1>
            {inRouteDeliveries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {inRouteDeliveries.map(sale => {
                        const customerDetails = findCustomerForSale(customers, sale);
                        return (
                            <DelivererCard
                                key={sale.id}
                                sale={sale}
                                customerDetails={customerDetails}
                                crateLoans={crateLoans}
                                onCompleteClick={setCompleteModal}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Ruta Despejada</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">No tienes entregas asignadas en este momento.</p>
                </div>
            )}
            {completeModal && <CompleteDeliveryModal sale={completeModal} isOpen={!!completeModal} onClose={() => setCompleteModal(null)} onComplete={completeSale} />}
        </div>
    );
};

export default DelivererView;
