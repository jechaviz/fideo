
import React from 'react';

const SettingsField: React.FC<{ label: string, description: string, id: string, value?: string }> = ({ label, description, id, value }) => (
    <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
            <label htmlFor={id}>{label}</label>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{description}</p>
        </dt>
        <dd className="mt-1 flex text-sm text-gray-900 dark:text-gray-200 sm:col-span-2 sm:mt-0">
            <input
                type="text"
                name={id}
                id={id}
                className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:border-green-500 focus:ring-green-500 bg-white dark:bg-gray-700 dark:border-gray-600"
                defaultValue={value || ''}
                placeholder="No configurado"
            />
            <button type="button" className="ml-3 rounded-md bg-white dark:bg-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500">
                Guardar
            </button>
        </dd>
    </div>
);


const Settings: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Configuración Técnica</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Administra las integraciones y claves de API de servicios externos.</p>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
        <div className="p-6">
            <h2 className="text-lg font-semibold leading-7 text-gray-900 dark:text-gray-200">Proveedores de API</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">Claves para los servicios que potencian la aplicación.</p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-6">
            <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                <SettingsField 
                    id="twilio-key" 
                    label="API Key de Twilio / WATI" 
                    description="Para la integración con WhatsApp Business."
                    value="w***************"
                />
                <SettingsField 
                    id="google-ai-key" 
                    label="API Key de Google AI" 
                    description="Para la inteligencia artificial y el procesamiento de lenguaje."
                    value="g***************"
                />
                 <SettingsField 
                    id="elevenlabs-key" 
                    label="API Key de ElevenLabs" 
                    description="Para la generación de voz personalizada."
                />
            </dl>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md mt-8">
        <div className="p-6">
            <h2 className="text-lg font-semibold leading-7 text-gray-900 dark:text-gray-200">Control de Gastos</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">Configura notificaciones y límites para los servicios de pago.</p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-6">
            <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Notificaciones de saldo bajo
                    </dt>
                    <dd className="mt-1 flex text-sm text-gray-900 dark:text-gray-200 sm:col-span-2 sm:mt-0">
                         <div className="flex h-6 items-center">
                            <input id="notifications" name="notifications" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600 dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div className="ml-3 text-sm leading-6">
                            <label htmlFor="notifications" className="font-medium text-gray-900 dark:text-gray-200">Activar</label>
                            <p className="text-gray-500 dark:text-gray-400">Recibir un email cuando el saldo de un servicio esté por agotarse.</p>
                        </div>
                    </dd>
                </div>
                 <SettingsField 
                    id="budget-limit" 
                    label="Límite de Gasto Mensual" 
                    description="Establece un presupuesto máximo para todos los servicios."
                    value="500"
                />
            </dl>
        </div>
      </div>

    </div>
  );
};

export default Settings;