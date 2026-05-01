import React, { useState, useMemo, useEffect } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale, Employee, PaymentStatus, PaymentMethod, Customer, CrateLoan, AssignmentInterpretation, InterpretationType } from '../types';
import { findCustomerForSale, loanBelongsToCustomer } from '../utils/customerIdentity';

const panelClass = 'glass-panel-dark rounded-[2rem] border border-white/10';
const fieldClass = 'mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20';
const secondaryButtonClass = 'rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

interface DeliveryModalProps {
    sale: Sale;
    employees: Employee[];
    isOpen: boolean;
    onClose: () => void;
    onAssign: (saleId: string, employeeId: string) => void;
}

const AssignDeliveryModal: React.FC<DeliveryModalProps> = ({ sale, employees, isOpen, onClose, onAssign }) => {
    const drivers = useMemo(() => employees.filter((employee) => employee.role === 'Repartidor'), [employees]);
    const [selectedEmployee, setSelectedEmployee] = useState<string>(drivers[0]?.id || '');

    useEffect(() => {
        setSelectedEmployee(drivers[0]?.id || '');
    }, [drivers]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedEmployee) {
            onAssign(sale.id, selectedEmployee);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${panelClass} w-full max-w-md p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Asignacion</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Asignar entrega</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Enruta el pedido de <span className="font-bold text-white">{sale.customer}</span> con el repartidor disponible.
                    </p>
                </div>

                <div>
                    <label htmlFor="employee" className={labelClass}>Repartidor</label>
                    <select id="employee" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={fieldClass}>
                        {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                                {driver.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className={secondaryButtonClass}>Cancelar</button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedEmployee}
                        className="rounded-2xl bg-brand-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Confirmar asignacion
                    </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className={`${panelClass} w-full max-w-md p-6 md:p-7`}>
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Cierre de ruta</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Confirmar entrega</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Registra el resultado operativo y de cobro para <span className="font-bold text-white">{sale.customer}</span>.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Resultado</label>
                        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)} className={fieldClass}>
                            <option value="Pagado">Pagado</option>
                            <option value="En Deuda">En deuda (credito)</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Metodo de pago</label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                            className={fieldClass}
                            disabled={paymentStatus === 'En Deuda'}
                        >
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Notas</label>
                        <textarea
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            rows={3}
                            placeholder={paymentStatus === 'En Deuda' ? 'Ej. paga el lunes' : 'Opcional'}
                            className={`${fieldClass} resize-none`}
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className={secondaryButtonClass}>Cancelar</button>
                    <button onClick={handleSubmit} className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300">
                        Finalizar entrega
                    </button>
                </div>
            </div>
        </div>
    );
};

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

    const pendingCrates = useMemo(
        () => (customerDetails ? crateLoans.filter((loan) => loanBelongsToCustomer(loan, customerDetails) && loan.status === 'Prestado') : []),
        [crateLoans, customerDetails],
    );

    const statusTone =
        sale.status === 'Pendiente de Empaque'
            ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
            : sale.status === 'Listo para Entrega'
              ? 'border-brand-400/20 bg-brand-400/10 text-brand-200'
              : 'border-sky-400/20 bg-sky-400/10 text-sky-200';

    return (
        <div className="flex h-full flex-col justify-between rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/15 hover:bg-white/[0.06]">
            <div>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-lg font-black tracking-tight text-white">{sale.customer}</p>
                        <p className="mt-1 text-sm text-slate-300">
                            {sale.quantity} x {sale.productGroupName} {sale.varietyName} {sale.quality}
                        </p>
                    </div>
                    <div className="text-right">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${statusTone}`}>
                            {sale.status}
                        </span>
                        <p className="mt-2 text-xs font-mono text-slate-500">
                            {new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/60 p-4">
                    <p className={labelClass}>Destino</p>
                    <p className="mt-2 text-sm text-slate-200">{sale.destination}</p>
                    {employeeName && <p className="mt-3 text-sm font-semibold text-slate-300">Repartidor: {employeeName}</p>}
                </div>

                {customerDetails?.deliveryNotes && (
                    <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-200">Notas de entrega</p>
                        <p className="mt-2 text-sm italic text-sky-50">{customerDetails.deliveryNotes}</p>
                    </div>
                )}

                {pendingCrates.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                        <p className="text-sm font-bold text-amber-100">
                            Recoger {pendingCrates.reduce((sum, loan) => sum + loan.quantity, 0)} caja(s) pendientes.
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
                {sale.status === 'Pendiente de Empaque' && (
                    <button
                        onClick={() => onPack(sale.id)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-brand-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                    >
                        Marcar empacado
                    </button>
                )}
                {sale.status === 'Listo para Entrega' && (
                    <button
                        onClick={() => onAssignClick(sale)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300"
                    >
                        Asignar repartidor
                    </button>
                )}
                {sale.status === 'En Ruta' && (
                    <button
                        onClick={() => onCompleteClick(sale)}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300"
                    >
                        Completar entrega
                    </button>
                )}
                {mapUrl && (
                    <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                        title="Abrir mapa"
                    >
                        <i className="fa-solid fa-map-location-dot"></i>
                    </a>
                )}
            </div>
        </div>
    );
};

const PrepColumn: React.FC<{ title: string; eyebrow: string; sales: Sale[]; accent: string; children: React.ReactNode }> = ({ title, eyebrow, sales, accent, children }) => (
    <div className={`${panelClass} flex h-full flex-col p-5`}>
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
                {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p> : null}
                <h2 className={`mt-2 text-2xl font-black tracking-tight ${accent}`}>{title}</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm font-black text-white">{sales.length}</span>
        </div>

        <div className="flex-grow space-y-4 overflow-y-auto pr-1">
            {sales.length > 0 ? children : <p className="py-10 text-center text-sm text-slate-500">No hay pedidos en esta etapa.</p>}
        </div>
    </div>
);

const Deliveries: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { sales, employees, customers, crateLoans, completeSale, markOrderAsPacked, approveInterpretation } = data;
    const [assignModal, setAssignModal] = useState<Sale | null>(null);
    const [completeModal, setCompleteModal] = useState<Sale | null>(null);

    const pendingPacking = useMemo(() => sales.filter((sale) => sale.status === 'Pendiente de Empaque').sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()), [sales]);
    const readyForDelivery = useMemo(() => sales.filter((sale) => sale.status === 'Listo para Entrega').sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()), [sales]);

    const routesByDriver = useMemo(() => {
        const inRoute = sales.filter((sale) => sale.status === 'En Ruta');
        const drivers = employees.filter((employee) => employee.role === 'Repartidor');

        return drivers
            .map((driver) => ({
                driver,
                deliveries: inRoute.filter((sale) => sale.assignedEmployeeId === driver.id),
            }))
            .filter((route) => route.deliveries.length > 0);
    }, [sales, employees]);

    const handleAssign = (saleId: string, employeeId: string) => {
        const sale = sales.find((item) => item.id === saleId);
        const employee = employees.find((item) => item.id === employeeId);
        if (!sale || !employee) return;

        const interpretation: AssignmentInterpretation = {
            type: InterpretationType.ASIGNACION_ENTREGA,
            certainty: 1.0,
            explanation: 'Asignacion manual desde la vista de Entregas.',
            originalMessage: `Asignar ${employee.name} a ${sale.customer}`,
            sender: 'Admin',
            data: { employeeName: employee.name, customerName: sale.customer },
        };
        const messageId = data.addInterpretedMessage(interpretation);
        void approveInterpretation(messageId);
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">Entregas</h1>
                    </div>

                    <div className="grid grid-cols-3 gap-3 lg:min-w-[420px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Por empacar</p>
                            <p className="mt-2 text-2xl font-black text-white">{pendingPacking.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Listas</p>
                            <p className="mt-2 text-2xl font-black text-white">{readyForDelivery.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Rutas activas</p>
                            <p className="mt-2 text-2xl font-black text-white">{routesByDriver.length}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <PrepColumn title="Por empacar" eyebrow="" sales={pendingPacking} accent="text-amber-200">
                    {pendingPacking.map((sale) => {
                        const customerDetails = findCustomerForSale(customers, sale);
                        return (
                            <DeliveryCard
                                key={sale.id}
                                sale={sale}
                                customerDetails={customerDetails}
                                crateLoans={crateLoans}
                                onPack={markOrderAsPacked}
                                onAssignClick={() => undefined}
                                onCompleteClick={() => undefined}
                            />
                        );
                    })}
                </PrepColumn>

                <PrepColumn title="Listos" eyebrow="" sales={readyForDelivery} accent="text-brand-200">
                    {readyForDelivery.map((sale) => {
                        const customerDetails = findCustomerForSale(customers, sale);
                        return (
                            <DeliveryCard
                                key={sale.id}
                                sale={sale}
                                customerDetails={customerDetails}
                                crateLoans={crateLoans}
                                onPack={() => undefined}
                                onAssignClick={setAssignModal}
                                onCompleteClick={() => undefined}
                            />
                        );
                    })}
                </PrepColumn>
            </section>

            <section className={`${panelClass} p-6 md:p-7`}>
                <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Rutas activas</h2>
                    </div>
                    <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_14px_rgba(163,230,53,0.75)]"></span>
                        En curso
                    </div>
                </div>

                {routesByDriver.length > 0 ? (
                    <div className="space-y-6">
                        {routesByDriver.map(({ driver, deliveries }) => (
                            <div key={driver.id} className="rounded-[1.9rem] border border-white/10 bg-white/[0.03] p-5">
                                <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200">
                                            <i className="fa-solid fa-truck"></i>
                                        </div>
                                        <div>
                                            <p className={labelClass}>Repartidor</p>
                                            <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{driver.name}</h3>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-100">
                                        {deliveries.length} entregas
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {deliveries.map((sale) => {
                                        const customerDetails = findCustomerForSale(customers, sale);
                                        return (
                                            <DeliveryCard
                                                key={sale.id}
                                                sale={sale}
                                                customerDetails={customerDetails}
                                                crateLoans={crateLoans}
                                                employeeName={employees.find((employee) => employee.id === sale.assignedEmployeeId)?.name}
                                                onPack={() => undefined}
                                                onAssignClick={() => undefined}
                                                onCompleteClick={setCompleteModal}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                        <p className="text-xl font-bold text-white">No hay repartidores en ruta.</p>
                        <p className="mt-2 text-sm text-slate-400">Las entregas activas apareceran aqui en cuanto salgan del muelle.</p>
                    </div>
                )}
            </section>

            {assignModal && <AssignDeliveryModal sale={assignModal} employees={employees} isOpen={!!assignModal} onClose={() => setAssignModal(null)} onAssign={handleAssign} />}
            {completeModal && <CompleteDeliveryModal sale={completeModal} isOpen={!!completeModal} onClose={() => setCompleteModal(null)} onComplete={completeSale} />}
        </div>
    );
};

export default Deliveries;
