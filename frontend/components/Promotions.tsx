import React, { useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { SparklesIcon } from './icons/Icons';

const surfaceClass = 'glass-panel-dark rounded-[1.8rem] border border-white/10';
const inputClass = 'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-300/50 focus:outline-none';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';

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
            const { generateOfferMessage } = await import('../services/geminiService');
            const message = await generateOfferMessage(offerIdea);
            setGeneratedMessage(message);
        } catch (error) {
            console.error(error);
            setGeneratedMessage('Error al generar el mensaje. Intentalo de nuevo.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCustomerToggle = (customerId: string) => {
        setSelectedCustomerIds((current) =>
            current.includes(customerId)
                ? current.filter((id) => id !== customerId)
                : [...current, customerId],
        );
    };

    const handleSelectAll = () => {
        if (selectedCustomerIds.length === customers.length) {
            setSelectedCustomerIds([]);
        } else {
            setSelectedCustomerIds(customers.map((customer) => customer.id));
        }
    };

    const handleSend = () => {
        if (!generatedMessage || selectedCustomerIds.length === 0) return;
        sendPromotion(generatedMessage, selectedCustomerIds);
        setStatus('sent');
        setOfferIdea('');
        setGeneratedMessage('');
        setSelectedCustomerIds([]);
        setTimeout(() => setStatus('idle'), 3000);
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Activacion comercial</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                            Crea promociones con tono premium y salida inmediata.
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Diseña la oferta, deja que IA construya el mensaje y elige exactamente a quien quieres activar.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[560px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Clientes</p>
                            <p className="mt-2 text-3xl font-black text-white">{customers.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Seleccionados</p>
                            <p className="mt-2 text-3xl font-black text-white">{selectedCustomerIds.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Estado</p>
                            <p className="mt-2 text-lg font-black text-white">{status === 'sent' ? 'Enviado' : 'Listo'}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className={`${surfaceClass} p-6`}>
                    <div>
                        <p className={labelClass}>Paso 1</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Idea base de la oferta</h2>
                        <p className="mt-2 text-sm text-slate-400">Escribe el angulo comercial: producto, precio, urgencia o beneficio.</p>
                    </div>

                    <textarea
                        id="offer-idea"
                        rows={4}
                        value={offerIdea}
                        onChange={(event) => setOfferIdea(event.target.value)}
                        placeholder="Ej. Aguacate Hass de primera a 750 la caja para clientes de recompra rapida."
                        className={`${inputClass} mt-5`}
                    />

                    <div className="mt-6 flex flex-col gap-4">
                        <button
                            onClick={handleGenerateMessage}
                            disabled={isGenerating || !offerIdea}
                            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-400 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="h-5 w-5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <SparklesIcon />
                                    Generar mensaje con IA
                                </>
                            )}
                        </button>

                        <div>
                            <p className={labelClass}>Paso 2</p>
                            <h3 className="mt-2 text-xl font-black tracking-tight text-white">Mensaje editable</h3>
                            <p className="mt-2 text-sm text-slate-400">Ajusta el copy antes de enviarlo. Puedes hacerlo mas directo, mas urgente o mas selectivo.</p>
                        </div>

                        <textarea
                            id="generated-message"
                            rows={8}
                            value={generatedMessage}
                            onChange={(event) => setGeneratedMessage(event.target.value)}
                            placeholder="Aqui aparecera el mensaje generado..."
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className={`${surfaceClass} p-6`}>
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className={labelClass}>Paso 3</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Destinatarios</h2>
                        </div>
                        <button
                            onClick={handleSelectAll}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                            {selectedCustomerIds.length === customers.length ? 'Limpiar' : 'Seleccionar todos'}
                        </button>
                    </div>

                    <div className="mt-5 space-y-2">
                        {customers.map((customer) => (
                            <label
                                key={customer.id}
                                className={`flex cursor-pointer items-center justify-between gap-3 rounded-[1.2rem] border px-4 py-3 transition ${
                                    selectedCustomerIds.includes(customer.id)
                                        ? 'border-brand-300/30 bg-brand-300/10'
                                        : 'border-white/10 bg-white/5 hover:bg-white/[0.08]'
                                }`}
                            >
                                <div>
                                    <p className="text-sm font-semibold text-white">{customer.name}</p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {customer.contacts.find((contact) => contact.isPrimary)?.name || 'Sin contacto principal'}
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={selectedCustomerIds.includes(customer.id)}
                                    onChange={() => handleCustomerToggle(customer.id)}
                                    className="h-4 w-4 rounded border-white/20 bg-slate-900 text-brand-400 focus:ring-brand-300"
                                />
                            </label>
                        ))}
                    </div>

                    <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                        <p className={labelClass}>Salida</p>
                        <p className="mt-2 text-sm text-slate-300">
                            El mensaje se enviara a <span className="font-black text-white">{selectedCustomerIds.length}</span> cliente(s).
                        </p>
                        <button
                            onClick={handleSend}
                            disabled={!generatedMessage || selectedCustomerIds.length === 0}
                            className="mt-4 w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Enviar promocion
                        </button>
                        {status === 'sent' && (
                            <p className="mt-3 text-center text-sm font-semibold text-brand-200">Promocion enviada con exito.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Promotions;
