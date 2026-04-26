
import React from 'react';
import { Sale } from '../types';

interface TicketModalProps {
    sale: Sale;
    onClose: () => void;
}

const BUSINESS_INFO = {
    name: 'FIDEO | Frutas y Legumbres',
    address: 'Bodega 123, Nave G, Central de Abastos',
    phone: '55-1234-5678'
};

const PAYMENT_INFO = {
    bank: 'BBVA',
    accountHolder: 'Fideo S.A. de C.V.',
    accountNumber: '012 345 6789',
    clabe: '012345678901234567',
    referenceConcept: 'Pago Pedido'
};

const TicketModal: React.FC<TicketModalProps> = ({ sale, onClose }) => {

    const ticketText = `
*${BUSINESS_INFO.name}*
${BUSINESS_INFO.address}
Tel: ${BUSINESS_INFO.phone}

--- TICKET DE VENTA ---
*Cliente:* ${sale.customer}
*Fecha:* ${new Date(sale.timestamp).toLocaleString('es-MX')}
*ID Venta:* ${sale.id.substring(2, 8)}

*Descripción:*
${sale.quantity} ${sale.unit} de ${sale.productGroupName} ${sale.varietyName}
(${sale.size} / ${sale.quality} / ${sale.state})

*TOTAL: ${sale.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}*

--- OPCIONES DE PAGO ---
*Transferencia Bancaria:*
- Banco: ${PAYMENT_INFO.bank}
- Beneficiario: ${PAYMENT_INFO.accountHolder}
- Cuenta: ${PAYMENT_INFO.accountNumber}
- CLABE: ${PAYMENT_INFO.clabe}
- Concepto: ${PAYMENT_INFO.referenceConcept} ${sale.customer}

*Pago en Efectivo:*
- Directamente en bodega.

¡Gracias por su compra!
    `.trim();

    const handleCopy = () => {
        navigator.clipboard.writeText(ticketText);
        alert('Ticket copiado al portapapeles!');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 className="text-xl font-bold mb-4 dark:text-gray-100 text-center">Ticket de Venta</h2>
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md whitespace-pre-wrap font-mono text-xs text-gray-800 dark:text-gray-200 max-h-96 overflow-y-auto">
                        {ticketText}
                    </div>
                </div>
                 <div className="px-6 py-4 bg-gray-100 dark:bg-gray-700/50 flex justify-between items-center rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cerrar</button>
                    <button onClick={handleCopy} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 flex items-center gap-2">
                        <i className="fa-solid fa-copy"></i>
                        Copiar para WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TicketModal;
