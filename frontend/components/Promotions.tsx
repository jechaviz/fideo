import React, { useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { generateOfferMessage } from '../services/geminiService';
import { SparklesIcon } from './icons/Icons';

const Promotions: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { customers, sendPromotion } = data;
    const [offerIdea, setOfferIdea] = useState('');
    const [generatedMessage, setGeneratedMessage] = useState('');
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState<'idle' | 'sent'>('idle');

    const handleGenerateMessage = async () => {
        if (!offerIdea) return;
        setIsGenerating(true);
        try {
            const message = await generateOfferMessage(offerIdea);
            setGeneratedMessage(message);
        } catch (error) {
            console.error(error);
            setGeneratedMessage('Error al generar el mensaje. Inténtalo de nuevo.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCustomerToggle = (customerId: string) => {
        setSelectedCustomerIds(prev =>
            prev.includes(customerId)
                ? prev.filter(id => id !== customerId)
                : [...prev, customerId]
        );
    };

    const handleSelectAll = () => {
        if (selectedCustomerIds.length === customers.length) {
            setSelectedCustomerIds([]);
        } else {
            setSelectedCustomerIds(customers.map(c => c.id));
        }
    };

    const handleSend = () => {
        if (generatedMessage && selectedCustomerIds.length > 0) {
            sendPromotion(generatedMessage, selectedCustomerIds);
            setStatus('sent');
            // Reset form
            setOfferIdea('');
            setGeneratedMessage('');
            setSelectedCustomerIds([]);
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Promociones</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Panel de Creación */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
                    <div>
                        <label htmlFor="offer-idea" className="block text-lg font-semibold text-gray-700 dark:text-gray-200">1. Idea de la Oferta</label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Escribe la base de tu promoción. Sé breve y directo.</p>
                        <textarea
                            id="offer-idea"
                            rows={3}
                            value={offerIdea}
                            onChange={e => setOfferIdea(e.target.value)}
                            placeholder="Ej: Aguacate Hass de primera a $750 la caja"
                            className="w-full p-2 border rounded-md bg-gray-50 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        />
                    </div>

                    <div className="text-center">
                        <button
                            onClick={handleGenerateMessage}
                            disabled={isGenerating || !offerIdea}
                            className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2 transition-colors"
                        >
                            {isGenerating
                                ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generando...</>
                                : <><SparklesIcon /> Generar Mensaje con IA</>
                            }
                        </button>
                    </div>

                    <div>
                        <label htmlFor="generated-message" className="block text-lg font-semibold text-gray-700 dark:text-gray-200">2. Mensaje para Clientes</label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Este es el mensaje que se enviará. Puedes editarlo si lo necesitas.</p>
                        <textarea
                            id="generated-message"
                            rows={6}
                            value={generatedMessage}
                            onChange={e => setGeneratedMessage(e.target.value)}
                            placeholder="Aquí aparecerá el mensaje generado por la IA..."
                            className="w-full p-2 border rounded-md bg-white text-gray-900 dark:bg-gray-900/50 dark:border-gray-600 dark:text-gray-200"
                        />
                    </div>
                </div>

                {/* Panel de Envío */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">3. Seleccionar Destinatarios</h2>
                    <div className="my-3 py-2 border-y dark:border-gray-700">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedCustomerIds.length === customers.length}
                                onChange={handleSelectAll}
                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Seleccionar Todos</span>
                        </label>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {customers.map(customer => (
                            <label key={customer.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedCustomerIds.includes(customer.id)}
                                    onChange={() => handleCustomerToggle(customer.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-800 dark:text-gray-200">{customer.name}</span>
                            </label>
                        ))}
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={handleSend}
                            disabled={!generatedMessage || selectedCustomerIds.length === 0}
                            className="w-full px-4 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors text-lg"
                        >
                            Enviar a {selectedCustomerIds.length} cliente(s)
                        </button>
                        {status === 'sent' && (
                            <p className="text-center mt-3 text-green-600 dark:text-green-400">¡Promoción enviada con éxito!</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Promotions;
