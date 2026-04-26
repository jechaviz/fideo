import React, { useState, useMemo, useEffect } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
// FIX: Imported the 'Message' type to resolve the "Cannot find name 'Message'" error.
import { Sale, Employee, PaymentStatus, PaymentMethod, Customer, CrateLoan, Message, AssignmentInterpretation, InterpretationType } from '../types';

interface DeliveryModalProps {
    sale: Sale;
    employees: Employee[];
    isOpen: boolean;
    onClose: () => void;
    onAssign: (saleId: string, employeeId: string) => void;
}

const AssignDeliveryModal: React.FC<DeliveryModalProps> = ({ sale, employees, isOpen, onClose, onAssign }) => {
    const [selectedEmployee, setSelectedEmployee] = useState<string>(employees[0]?.id || '');

    useEffect(() => {
        if (employees.length > 0) {
            setSelectedEmployee(employees[0].id);
        }
    }, [employees]);
    
    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedEmployee) {
            onAssign(sale.id, selectedEmployee);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Asignar Entrega</h2>
                <p className="mb-4 dark:text-gray-300">Asignar el pedido de <span className="font-semibold">{sale.customer}</span> a un repartidor.</p>
                <div>
                    <label htmlFor="employee" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Repartidor</label>
                    <select
                        id="employee"
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    >
                        {employees.filter(e => e.role === 'Repartidor').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Confirmar Asignación</button>
                </div>
            </div>
        </div>
    );
};

interface CompleteModalProps {
    sale: Sale;
    isOpen: boolean;
    onClose: () => void;
    onComplete: (saleId: string, paymentStatus: PaymentStatus, paymentMethod: PaymentMethod, paymentNotes?: string) => void;
}

const CompleteDeliveryModal: React.FC<CompleteModalProps> = ({ sale, isOpen, onClose, onComplete }) => {
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pagado');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
    const [paymentNotes, setPaymentNotes] = useState('');
    
    if (!isOpen) return null;

    const handleSubmit = () => {
        onComplete(sale.id, paymentStatus, paymentMethod, paymentNotes);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Confirmar Entrega</h2>
                <p className="mb-4 dark:text-gray-300">Registrar el resultado de la entrega para <span className="font-semibold">{sale.customer}</span>.</p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Resultado</label>
                        <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                            <option value="Pagado">Pagado</option>
                            <option value="En Deuda">En Deuda (Crédito)</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Método de Pago</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" disabled={paymentStatus === 'En Deuda'}>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas</label>
                         <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2} placeholder={paymentStatus === 'En Deuda' ? "Ej: Paga el lunes" : "Opcional"} className="mt-1 block w-full p-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
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

const DeliveryCard: React.FC<{
    sale: Sale;
    customerDetails?: Customer;
    crateLoans: CrateLoan[];
    employeeName?: string;
    onPack: (saleId: string) => void;
    onAssignClick: (sale: Sale) => void;
    onCompleteClick: (sale: Sale) => void;
}> = ({ sale, customerDetails, crateLoans, employeeName, onPack, onAssignClick, onCompleteClick }) => {
    const location = sale.locationQuery || sale.destination;
    const mapUrl = location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;

    const pendingCrates = useMemo(() => {
        // FIX: The CrateLoan type uses `status` property instead of `returned`. A pending crate to be picked up has a status of 'Prestado'.
        return crateLoans.filter(l => l.customer === sale.customer && l.status === 'Prestado');
    }, [crateLoans, sale.customer]);

    return (
        <div className="bg-white dark:bg-gray-700/50 p-4 rounded-lg shadow-sm flex flex-col justify-between h-full border dark:border-gray-600">
            <div>
                <div className="flex justify-between items-start">
                    <p className="font-bold dark:text-gray-100">{sale.customer}</p>
                    <span className="text-xs font-mono bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{new Date(sale.timestamp).toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <p className="text-sm dark:text-gray-300">{sale.quantity} x {sale.productGroupName} {sale.varietyName} {sale.quality}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{sale.destination}</p>
                {employeeName && <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">Repartidor: {employeeName}</p>}
                {customerDetails?.deliveryNotes && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-gray-800 rounded-md border-l-4 border-blue-400">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Notas de Entrega:</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200 italic">{customerDetails.deliveryNotes}</p>
                    </div>
                )}
                 {pendingCrates.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-md border-l-4 border-yellow-500">
                        <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300">
                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                            Recoger {pendingCrates.reduce((sum, l) => sum + l.quantity, 0)} caja(s) pendiente(s).
                        </p>
                    </div>
                )}
            </div>
            
            <div className="mt-3 w-full flex gap-2">
                {sale.status === 'Pendiente de Empaque' && (
                    <button onClick={() => onPack(sale.id)} className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 transition-colors">
                        Marcar Empacado
                    </button>
                )}
                {sale.status === 'Listo para Entrega' && (
                    <button onClick={() => onAssignClick(sale)} className="flex-1 bg-yellow-500 text-white font-bold py-2 rounded-lg hover:bg-yellow-600 transition-colors">
                        Asignar Repartidor
                    </button>
                )}
                 {sale.status === 'En Ruta' && (
                    <button onClick={() => onCompleteClick(sale)} className="flex-1 bg-blue-500 text-white font-bold py-2 rounded-lg hover:bg-blue-600 transition-colors">
                        Completar Entrega
                    </button>
                )}
                {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="px-4 bg-gray-600 text-white font-bold py-2 rounded-lg hover:bg-gray-700 transition-colors text-center">
                        <i className="fa-solid fa-map-location-dot"></i>
                    </a>
                )}
            </div>
        </div>
    );
};

const PrepColumn: React.FC<{ title: string; sales: Sale[]; color: string; children: React.ReactNode }> = ({ title, sales, color, children }) => (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow-inner w-full flex flex-col">
        <h2 className={`text-xl font-bold ${color} mb-4 pb-2 border-b-2 dark:border-gray-700 flex justify-between items-center`}>
            {title}
            <span className={`text-sm font-semibold bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full`}>{sales.length}</span>
        </h2>
        <div className="space-y-4 overflow-y-auto max-h-[60vh] p-1 flex-grow">
            {sales.length > 0 ? children : <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay pedidos en esta etapa.</p>}
        </div>
    </div>
);


const Deliveries: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { sales, employees, customers, crateLoans, completeSale, markOrderAsPacked, approveInterpretation } = data;
    const [assignModal, setAssignModal] = useState<Sale | null>(null);
    const [completeModal, setCompleteModal] = useState<Sale | null>(null);

    const pendingPacking = useMemo(() => sales.filter(s => s.status === 'Pendiente de Empaque').sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()), [sales]);
    const readyForDelivery = useMemo(() => sales.filter(s => s.status === 'Listo para Entrega').sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()), [sales]);
    
    const routesByDriver = useMemo(() => {
        const inRoute = sales.filter(s => s.status === 'En Ruta');
        const drivers = employees.filter(e => e.role === 'Repartidor');
        
        return drivers.map(driver => ({
            driver,
            deliveries: inRoute.filter(s => s.assignedEmployeeId === driver.id)
        })).filter(route => route.deliveries.length > 0);

    }, [sales, employees]);


    const handleAssign = (saleId: string, employeeId: string) => {
        const sale = sales.find(s => s.id === saleId);
        const employee = employees.find(e => e.id === employeeId);
        if (!sale || !employee) return;
        
        const interpretation: AssignmentInterpretation = {
            type: InterpretationType.ASIGNACION_ENTREGA,
            certainty: 1.0,
            explanation: `Asignación manual desde la vista de Entregas.`,
            originalMessage: `Asignar ${employee.name} a ${sale.customer}`,
            data: { employeeName: employee.name, customerName: sale.customer }
        };
        const tempMessage: Message = { id: `msg_manual_${Date.now()}`, sender: 'Admin', text: interpretation.originalMessage, timestamp: new Date(), status: 'interpreted', interpretation };
        
        data.addMessage(tempMessage.text, tempMessage.sender);
        data.setInterpretationForMessage(tempMessage.id, interpretation);
        approveInterpretation(tempMessage.id);
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Centro de Despacho</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <PrepColumn title="Por Empacar" sales={pendingPacking} color="text-yellow-600 dark:text-yellow-400">
                    {pendingPacking.map(sale => {
                        const customerDetails = customers.find(c => c.name === sale.customer);
                        return <DeliveryCard key={sale.id} sale={sale} customerDetails={customerDetails} crateLoans={crateLoans} onPack={markOrderAsPacked} onAssignClick={() => {}} onCompleteClick={() => {}} />
                    })}
                </PrepColumn>

                <PrepColumn title="Listos para Ruta" sales={readyForDelivery} color="text-green-600 dark:text-green-400">
                     {readyForDelivery.map(sale => {
                        const customerDetails = customers.find(c => c.name === sale.customer);
                        return <DeliveryCard key={sale.id} sale={sale} customerDetails={customerDetails} crateLoans={crateLoans} onPack={()=>{}} onAssignClick={setAssignModal} onCompleteClick={() => {}} />
                    })}
                </PrepColumn>
            </div>

            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Rutas Activas</h2>
                {routesByDriver.length > 0 ? (
                    <div className="space-y-6">
                        {routesByDriver.map(({ driver, deliveries }) => (
                            <div key={driver.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow-inner">
                                <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b-2 dark:border-gray-700 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-truck"></i>
                                        <span>{driver.name}</span>
                                    </div>
                                    <span className={`text-sm font-semibold bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full`}>{deliveries.length} entregas</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                     {deliveries.map(sale => {
                                        const customerDetails = customers.find(c => c.name === sale.customer);
                                        return (<DeliveryCard 
                                            key={sale.id}
                                            sale={sale}
                                            customerDetails={customerDetails}
                                            crateLoans={crateLoans}
                                            employeeName={employees.find(e => e.id === sale.assignedEmployeeId)?.name}
                                            onPack={()=>{}} 
                                            onAssignClick={()=>{}} 
                                            onCompleteClick={setCompleteModal}
                                        />
                                    )})}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-gray-100 dark:bg-gray-800 rounded-xl">
                        <p className="text-gray-500 dark:text-gray-400">No hay repartidores en ruta.</p>
                    </div>
                )}
            </div>

            {assignModal && <AssignDeliveryModal sale={assignModal} employees={employees} isOpen={!!assignModal} onClose={() => setAssignModal(null)} onAssign={handleAssign} />}
            {completeModal && <CompleteDeliveryModal sale={completeModal} isOpen={!!completeModal} onClose={() => setCompleteModal(null)} onComplete={completeSale} />}
        </div>
    );
};

export default Deliveries;