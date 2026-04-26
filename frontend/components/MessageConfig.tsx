
import React, { useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { MessageTemplate, MessageTemplateType } from '../types';
import { CheckIcon } from './icons/Icons';

const TemplateEditor: React.FC<{ template: MessageTemplate, onSave: (id: string, updates: Partial<MessageTemplate>) => void }> = ({ template, onSave }) => {
    const [content, setContent] = useState(template.content);
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = () => {
        onSave(template.id, { content });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const insertVariable = (variable: string) => {
        setContent(prev => prev + ' ' + variable);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{template.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Configura el texto base para este tipo de mensaje.</p>
                </div>
                <button 
                    onClick={handleSave}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${isSaved ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                    {isSaved ? <><CheckIcon /> Guardado</> : 'Guardar Cambios'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="mb-2 flex flex-wrap gap-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase self-center mr-2">Variables:</span>
                        {template.variables.map(v => (
                            <button 
                                key={v}
                                onClick={() => insertVariable(v)}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-mono"
                                title="Click para insertar"
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <textarea 
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        className="w-full h-40 p-3 border rounded-lg font-mono text-sm bg-gray-50 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                
                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Vista Previa (Ejemplo)</label>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {content
                            .replace('{nombre_cliente}', 'Juan Pérez')
                            .replace('{total}', '$1,500.00')
                            .replace('{total_deuda}', '$5,200.00')
                            .replace('{producto}', 'Manzana Golden')
                            .replace('{precio}', '$650.00')
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

const MessageConfig: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { messageTemplates, updateMessageTemplate } = data;
    const [activeType, setActiveType] = useState<MessageTemplateType>('ticket');

    const filteredTemplates = messageTemplates.filter(t => t.type === activeType);

    return (
        <div className="space-y-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
                <button onClick={() => setActiveType('ticket')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeType === 'ticket' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}>Tickets</button>
                <button onClick={() => setActiveType('payment_reminder')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeType === 'payment_reminder' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}>Cobranza</button>
                <button onClick={() => setActiveType('promotion')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeType === 'promotion' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}>Promociones</button>
            </div>

            <div>
                {filteredTemplates.map(template => (
                    <TemplateEditor 
                        key={template.id} 
                        template={template} 
                        onSave={updateMessageTemplate} 
                    />
                ))}
                {filteredTemplates.length === 0 && <p className="text-gray-500">No hay plantillas configuradas para esta categoría.</p>}
            </div>
        </div>
    );
};

export default MessageConfig;
