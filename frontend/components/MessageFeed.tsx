import React, { useEffect } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { ParsedMessage, InterpretationType, Message } from '../types';
import { interpretMessage } from '../services/geminiService';
import { BotIcon, UserIcon, CheckCircleIcon } from './icons/Icons';

const SystemNotificationCard: React.FC<{ message: Message }> = ({ message }) => {
    return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-xl shadow-md border-l-4 border-yellow-500">
            <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                </div>
                <div className="flex-1">
                    <p className="font-bold text-yellow-800 dark:text-yellow-200">{message.sender}</p>
                    <p className="text-yellow-700 dark:text-yellow-300">{message.text}</p>
                </div>
            </div>
        </div>
    );
};

const ApprovedMessageCard: React.FC<{ message: Message }> = ({ message }) => {
    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl shadow-sm">
             <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <UserIcon/>
                </div>
                <div className="flex-1">
                    <p className="font-bold text-gray-800 dark:text-gray-100">{message.sender}</p>
                    <p className="text-gray-700 dark:text-gray-300">{message.text}</p>
                     {message.interpretation && (
                         <div className="mt-4 p-4 bg-green-50 dark:bg-gray-800 rounded-lg border-l-4 border-green-500 shadow-sm opacity-80">
                             <div className="flex items-center gap-2">
                                <CheckCircleIcon />
                                <h4 className="font-semibold text-green-800 dark:text-green-300">Acción Aprobada</h4>
                             </div>
                             <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic pl-7">"{message.interpretation.explanation}"</p>
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const InterpretationCard: React.FC<{
    interpretation: ParsedMessage;
    onApprove: () => void;
}> = ({ interpretation, onApprove }) => {
    
    const dataKeyMap: { [key: string]: string } = {
        productGroup: 'Producto',
        variety: 'Variedad',
        size: 'Tamaño',
        quality: 'Calidad',
        state: 'Estado',
        fromState: 'De',
        toState: 'A',
        fromWarehouseName: 'Bodega Origen',
        toWarehouseName: 'Bodega Destino',
        quantity: 'Cantidad',
        unit: 'Unidad',
        customer: 'Cliente',
        customerName: 'Cliente',
        destination: 'Destino',
        employee: 'Empleado',
        employeeName: 'Empleado',
        price: 'Precio',
        action: 'Acción',
        topic: 'Tema',
        view: 'Vista',
        filterType: 'Tipo de Filtro',
        filterValue: 'Valor',
        productDescription: 'Descripción',
        targetAudience: 'Dirigido a',
        supplierName: 'Proveedor',
        packaging: 'Empaque',
        suggestedPayment: 'Abono Sugerido',
        assetName: 'Activo',
        description: 'Descripción',
        dueDate: 'Fecha Límite',
    };

    const typeLabelMap: { [key in InterpretationType]: string } = {
        [InterpretationType.VENTA]: "Venta",
        [InterpretationType.ORDEN_COMPRA]: "Orden de Compra",
        [InterpretationType.VENTA_ACTIVO_FIJO]: "Venta de Activo",
        [InterpretationType.ACTUALIZACION_PRECIO]: "Actualización de Precio",
        [InterpretationType.PRESTAMO_CAJA]: "Préstamo de Caja",
        [InterpretationType.LLEGADA_EMPLEADO]: "Llegada de Empleado",
        [InterpretationType.ACTUALIZACION_INVENTARIO]: "Actualización de Inventario",
        [InterpretationType.MOVIMIENTO_ESTADO]: "Movimiento de Estado",
        [InterpretationType.MOVIMIENTO_CALIDAD]: "Movimiento de Calidad",
        [InterpretationType.TRANSFERENCIA_BODEGA]: "Transferencia de Bodega",
        [InterpretationType.ASIGNACION_ENTREGA]: "Asignación de Entrega",
        [InterpretationType.CAMBIO_VISTA]: "Navegación",
        [InterpretationType.APLICAR_FILTRO]: "Aplicar Filtro",
        [InterpretationType.CREAR_OFERTA]: "Crear Oferta",
        [InterpretationType.CONSULTA]: "Consulta",
        [InterpretationType.DESCONOCIDO]: "Desconocido",
    };

    const renderData = () => {
        if (!interpretation.data || Object.keys(interpretation.data).length === 0) return <p className="text-xs text-gray-500 dark:text-gray-400">Sin detalles adicionales.</p>;
        return Object.entries(interpretation.data).map(([key, value]) => {
            if (!value) return null;
            let displayValue = String(value);
            if (key === 'dueDate' && typeof value === 'string') {
                displayValue = new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
            }
            return (
                <div key={key} className={`text-xs ${key === 'suggestedPayment' ? 'bg-yellow-100 dark:bg-yellow-900/50 p-1 rounded-md' : ''}`}>
                    <span className="font-semibold capitalize text-gray-500 dark:text-gray-400">{dataKeyMap[key] || key}: </span>
                    <span className="text-gray-700 dark:text-gray-300">{displayValue}</span>
                </div>
            )
        }).filter(Boolean);
    };

    const getColorsForType = (type: InterpretationType) => {
        switch(type) {
            case InterpretationType.VENTA: return { bg: 'bg-green-100 dark:bg-green-900', border: 'border-green-500', text: 'text-green-800 dark:text-green-300' };
            case InterpretationType.ORDEN_COMPRA: return { bg: 'bg-teal-100 dark:bg-teal-900', border: 'border-teal-500', text: 'text-teal-800 dark:text-teal-300' };
            case InterpretationType.VENTA_ACTIVO_FIJO: return { bg: 'bg-orange-100 dark:bg-orange-900', border: 'border-orange-500', text: 'text-orange-800 dark:text-orange-300' };
            case InterpretationType.ACTUALIZACION_PRECIO: return { bg: 'bg-blue-100 dark:bg-blue-900', border: 'border-blue-500', text: 'text-blue-800 dark:text-blue-300' };
            case InterpretationType.PRESTAMO_CAJA: return { bg: 'bg-yellow-100 dark:bg-yellow-900', border: 'border-yellow-500', text: 'text-yellow-800 dark:text-yellow-300' };
            case InterpretationType.LLEGADA_EMPLEADO: return { bg: 'bg-indigo-100 dark:bg-indigo-900', border: 'border-indigo-500', text: 'text-indigo-800 dark:text-indigo-300' };
            case InterpretationType.MOVIMIENTO_ESTADO: return { bg: 'bg-purple-100 dark:bg-purple-900', border: 'border-purple-500', text: 'text-purple-800 dark:text-purple-300' };
            case InterpretationType.MOVIMIENTO_CALIDAD: return { bg: 'bg-orange-100 dark:bg-orange-900', border: 'border-orange-500', text: 'text-orange-800 dark:text-orange-300' };
            case InterpretationType.TRANSFERENCIA_BODEGA: return { bg: 'bg-cyan-100 dark:bg-cyan-900', border: 'border-cyan-500', text: 'text-cyan-800 dark:text-cyan-300' };
            case InterpretationType.ASIGNACION_ENTREGA: return { bg: 'bg-sky-100 dark:bg-sky-900', border: 'border-sky-500', text: 'text-sky-800 dark:text-sky-300' };
            case InterpretationType.CAMBIO_VISTA: return { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900', border: 'border-fuchsia-500', text: 'text-fuchsia-800 dark:text-fuchsia-300' };
            case InterpretationType.APLICAR_FILTRO: return { bg: 'bg-rose-100 dark:bg-rose-900', border: 'border-rose-500', text: 'text-rose-800 dark:text-rose-300' };
            case InterpretationType.CREAR_OFERTA: return { bg: 'bg-lime-100 dark:bg-lime-900', border: 'border-lime-500', text: 'text-lime-800 dark:text-lime-300' };
            case InterpretationType.CONSULTA: return { bg: 'bg-pink-100 dark:bg-pink-900', border: 'border-pink-500', text: 'text-pink-800 dark:text-pink-300' };
            default: return { bg: 'bg-gray-100 dark:bg-gray-700', border: 'border-gray-400', text: 'text-gray-600 dark:text-gray-300' };
        }
    }
    
    const isUnknown = interpretation.type === InterpretationType.DESCONOCIDO;
    const { bg, border, text } = getColorsForType(interpretation.type);
    const typeLabel = typeLabelMap[interpretation.type];

    return (
        <div className={`mt-4 p-4 rounded-lg border-l-4 shadow-sm ${bg} ${border}`}>
            <div className="flex justify-between items-start">
                <div>
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${bg} ${text}`}>
                        {typeLabel}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 italic">"{interpretation.explanation}"</p>
                </div>
                {!isUnknown && (
                    <div className="text-right">
                         <div className="flex items-center space-x-2">
                             <button onClick={onApprove} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">Aprobar</button>
                             <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors">Corregir</button>
                         </div>
                    </div>
                )}
            </div>
             <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-1">
                {!isUnknown ? (
                    renderData()
                ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">La IA no pudo determinar una acción a partir de este mensaje.</p>
                )}
            </div>
        </div>
    );
};


const MessageCard: React.FC<{
    message: Message;
    onApprove: (messageId: string) => void;
}> = ({ message, onApprove }) => {
    
    const renderInterpretation = () => {
        switch(message.status) {
            case 'pending':
            case 'interpreting':
                 return (
                    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Interpretando...</span>
                    </div>
                );
            case 'interpreted':
                if (message.interpretation) {
                    return <InterpretationCard interpretation={message.interpretation} onApprove={() => onApprove(message.id)} />;
                }
                return null;
            case 'approved':
                return null; // Handled by ApprovedMessageCard
            default:
                return null;
        }
    };
    
    if (message.isSystemNotification) {
        return <SystemNotificationCard message={message} />;
    }
    
    if (message.status === 'approved') {
        return <ApprovedMessageCard message={message} />;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
            <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <UserIcon/>
                </div>
                <div className="flex-1">
                    <p className="font-bold text-gray-800 dark:text-gray-100">{message.sender}</p>
                    <p className="text-gray-700 dark:text-gray-300">{message.text}</p>
                </div>
            </div>
            {(message.status === 'interpreting' || message.status === 'interpreted') && (
                 <div className="mt-4 pl-12 flex items-start space-x-4">
                      <div className="flex-shrink-0">
                         <BotIcon />
                     </div>
                     <div className="flex-1">
                        {renderInterpretation()}
                     </div>
                 </div>
            )}
        </div>
    );
};

const MessageFeed: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { messages, approveInterpretation, setInterpretationForMessage, markMessageAsInterpreting, systemPrompt } = data;

    useEffect(() => {
        const processNextMessage = async () => {
            const messageToProcess = messages.find(msg => msg.status === 'pending');
            if (!messageToProcess) {
                return;
            }

            markMessageAsInterpreting(messageToProcess.id);
            const result = await interpretMessage(messageToProcess.text, messageToProcess.sender, systemPrompt);
            setInterpretationForMessage(messageToProcess.id, result);
        };

        processNextMessage();
    }, [messages, systemPrompt, setInterpretationForMessage, markMessageAsInterpreting]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Bandeja de Entrada de Mensajes</h1>
            <div className="space-y-6">
                {messages.map((msg) => (
                    <MessageCard 
                        key={msg.id}
                        message={msg}
                        onApprove={approveInterpretation}
                    />
                ))}
            </div>
        </div>
    );
};

export default MessageFeed;
