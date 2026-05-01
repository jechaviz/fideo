import React, { useEffect, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { InterpretationType, Message, ParsedMessage } from '../types';
import { BotIcon, CheckCircleIcon, UserIcon } from './icons/Icons';

const surfaceClass = 'glass-panel-dark rounded-[1.8rem] border border-white/10';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500';
const editableInterpretationTypes = Object.values(InterpretationType);

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const clampCertainty = (value: number) => Math.min(1, Math.max(0, value));

const SystemNotificationCard: React.FC<{ message: Message }> = ({ message }) => (
    <div className="rounded-[1.6rem] border border-amber-400/20 bg-amber-400/10 p-5">
        <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/20 text-amber-100">
                <i className="fa-solid fa-triangle-exclamation" />
            </div>
            <div>
                <p className="font-semibold text-amber-100">{message.sender}</p>
                <p className="mt-1 text-sm text-amber-200">{message.text}</p>
            </div>
        </div>
    </div>
);

const ApprovedMessageCard: React.FC<{
    message: Message;
    onRevert: () => void;
    remoteEnabled: boolean;
}> = ({ message, onRevert, remoteEnabled }) => (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
        <div className="flex items-start gap-4">
            <UserIcon />
            <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold text-white">{message.sender}</p>
                    {message.undoState?.approval && (
                        <button
                            onClick={onRevert}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
                        >
                            Revertir
                        </button>
                    )}
                </div>
                <p className="mt-1 text-sm text-slate-300">{message.text}</p>
                {message.interpretation && (
                    <div className="mt-4 rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
                        <div className="flex items-center gap-2 text-emerald-200">
                            <CheckCircleIcon />
                            <h4 className="text-sm font-black uppercase tracking-[0.24em]">Accion aprobada</h4>
                        </div>
                        <p className="mt-2 text-sm italic text-slate-200">"{message.interpretation.explanation}"</p>
                        <p className="mt-3 text-xs text-emerald-100/80">
                            {remoteEnabled
                                ? 'Puedes revertir la aprobacion y el snapshot se vuelve a sincronizar.'
                                : 'Puedes revertir la aprobacion; quedara guardada en este navegador.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    </div>
);

const InterpretationCard: React.FC<{
    message: Message;
    interpretation: ParsedMessage;
    onApprove: () => void;
    onCorrect: (messageId: string, interpretation: ParsedMessage) => void;
    onRevert: (messageId: string) => void;
    remoteEnabled: boolean;
}> = ({ message, interpretation, onApprove, onCorrect, onRevert, remoteEnabled }) => {
    const dataKeyMap: Record<string, string> = {
        action: 'Accion',
        assetName: 'Activo',
        customer: 'Cliente',
        customerName: 'Cliente',
        description: 'Descripcion',
        destination: 'Destino',
        dueDate: 'Fecha limite',
        employee: 'Empleado',
        employeeName: 'Empleado',
        filterType: 'Filtro',
        filterValue: 'Valor',
        fromState: 'De',
        fromWarehouseName: 'Bodega origen',
        packaging: 'Empaque',
        price: 'Precio',
        productDescription: 'Descripcion',
        productGroup: 'Producto',
        quality: 'Calidad',
        quantity: 'Cantidad',
        size: 'Tamano',
        state: 'Estado',
        suggestedPayment: 'Abono sugerido',
        supplierName: 'Proveedor',
        targetAudience: 'Dirigido a',
        toState: 'A',
        toWarehouseName: 'Bodega destino',
        topic: 'Tema',
        unit: 'Unidad',
        variety: 'Variedad',
        view: 'Vista',
    };

    const typeLabelMap: Record<InterpretationType, string> = {
        [InterpretationType.ACTUALIZACION_INVENTARIO]: 'Actualizacion de inventario',
        [InterpretationType.ACTUALIZACION_PRECIO]: 'Actualizacion de precio',
        [InterpretationType.APLICAR_FILTRO]: 'Filtro',
        [InterpretationType.ASIGNACION_ENTREGA]: 'Asignacion de entrega',
        [InterpretationType.CAMBIO_VISTA]: 'Navegacion',
        [InterpretationType.CONSULTA]: 'Consulta',
        [InterpretationType.CREAR_OFERTA]: 'Oferta',
        [InterpretationType.DESCONOCIDO]: 'No identificado',
        [InterpretationType.LLEGADA_EMPLEADO]: 'Llegada de empleado',
        [InterpretationType.MOVIMIENTO_CALIDAD]: 'Movimiento de calidad',
        [InterpretationType.MOVIMIENTO_ESTADO]: 'Movimiento de estado',
        [InterpretationType.ORDEN_COMPRA]: 'Orden de compra',
        [InterpretationType.PRESTAMO_CAJA]: 'Prestamo de caja',
        [InterpretationType.TRANSFERENCIA_BODEGA]: 'Transferencia',
        [InterpretationType.VENTA]: 'Venta',
        [InterpretationType.VENTA_ACTIVO_FIJO]: 'Venta de activo',
    };

    const getColorsForType = (type: InterpretationType) => {
        switch (type) {
            case InterpretationType.VENTA:
                return 'border-brand-300/20 bg-brand-300/10 text-brand-100';
            case InterpretationType.ORDEN_COMPRA:
                return 'border-teal-400/20 bg-teal-400/10 text-teal-100';
            case InterpretationType.VENTA_ACTIVO_FIJO:
                return 'border-orange-400/20 bg-orange-400/10 text-orange-100';
            case InterpretationType.ACTUALIZACION_PRECIO:
                return 'border-sky-400/20 bg-sky-400/10 text-sky-100';
            case InterpretationType.PRESTAMO_CAJA:
                return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
            case InterpretationType.LLEGADA_EMPLEADO:
                return 'border-indigo-400/20 bg-indigo-400/10 text-indigo-100';
            case InterpretationType.MOVIMIENTO_ESTADO:
                return 'border-violet-400/20 bg-violet-400/10 text-violet-100';
            case InterpretationType.MOVIMIENTO_CALIDAD:
                return 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100';
            case InterpretationType.TRANSFERENCIA_BODEGA:
                return 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100';
            case InterpretationType.ASIGNACION_ENTREGA:
                return 'border-rose-400/20 bg-rose-400/10 text-rose-100';
            case InterpretationType.CAMBIO_VISTA:
                return 'border-white/10 bg-white/5 text-slate-200';
            case InterpretationType.APLICAR_FILTRO:
                return 'border-pink-400/20 bg-pink-400/10 text-pink-100';
            case InterpretationType.CREAR_OFERTA:
                return 'border-lime-400/20 bg-lime-400/10 text-lime-100';
            case InterpretationType.CONSULTA:
                return 'border-slate-400/20 bg-slate-400/10 text-slate-100';
            default:
                return 'border-white/10 bg-white/5 text-slate-200';
        }
    };

    const [isEditing, setIsEditing] = useState(false);
    const [draftType, setDraftType] = useState<InterpretationType>(interpretation.type);
    const [draftExplanation, setDraftExplanation] = useState(interpretation.explanation);
    const [draftCertainty, setDraftCertainty] = useState(String(interpretation.certainty));
    const [draftData, setDraftData] = useState(formatJson(interpretation.data || {}));
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (isEditing) return;
        setDraftType(interpretation.type);
        setDraftExplanation(interpretation.explanation);
        setDraftCertainty(String(interpretation.certainty));
        setDraftData(formatJson(interpretation.data || {}));
        setFormError(null);
    }, [interpretation, isEditing]);

    const renderData = () => {
        if (!interpretation.data || Object.keys(interpretation.data).length === 0) {
            return <p className="text-sm text-slate-400">Sin detalles adicionales.</p>;
        }

        return Object.entries(interpretation.data)
            .map(([key, value]) => {
                if (!value) return null;
                const displayValue =
                    key === 'dueDate' && typeof value === 'string'
                        ? new Date(value).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                          })
                        : String(value);

                return (
                    <div key={key} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                            {dataKeyMap[key] || key}
                        </p>
                        <p className="mt-1 text-sm text-slate-200">{displayValue}</p>
                    </div>
                );
            })
            .filter(Boolean);
    };

    const isUnknown = interpretation.type === InterpretationType.DESCONOCIDO;
    const typeLabel = typeLabelMap[interpretation.type];
    const colorClass = getColorsForType(interpretation.type);
    const hasCorrectionUndo = Boolean(message.undoState?.correction);
    const correctionHint = remoteEnabled
        ? 'Se guarda en este workspace y se sincroniza con PocketBase.'
        : 'No hay backend activo: la correccion se conserva en este navegador.';

    const handleOpenEditor = () => {
        setDraftType(interpretation.type);
        setDraftExplanation(interpretation.explanation);
        setDraftCertainty(String(interpretation.certainty));
        setDraftData(formatJson(interpretation.data || {}));
        setFormError(null);
        setIsEditing(true);
    };

    const handleSaveCorrection = () => {
        const trimmedExplanation = draftExplanation.trim();
        if (!trimmedExplanation) {
            setFormError('Agrega una explicacion corta para la correccion.');
            return;
        }

        let parsedData: Record<string, unknown>;
        try {
            const candidate = JSON.parse(draftData);
            if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
                setFormError('El bloque de datos debe ser un objeto JSON valido.');
                return;
            }
            parsedData = candidate as Record<string, unknown>;
        } catch {
            setFormError('Revisa el JSON de datos antes de guardar.');
            return;
        }

        const certaintyValue = Number(draftCertainty);
        const nextInterpretation: ParsedMessage = {
            ...interpretation,
            type: draftType,
            explanation: trimmedExplanation,
            certainty: Number.isFinite(certaintyValue) ? clampCertainty(certaintyValue) : interpretation.certainty,
            data: parsedData,
            originalMessage: interpretation.originalMessage || message.text,
            sender: interpretation.sender || message.sender,
        } as ParsedMessage;

        onCorrect(message.id, nextInterpretation);
        setFormError(null);
        setIsEditing(false);
    };

    return (
        <div className={`mt-4 rounded-[1.4rem] border p-4 ${colorClass}`}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${colorClass}`}>
                        {typeLabel}
                    </span>
                    <p className="mt-3 text-sm italic text-slate-200">"{interpretation.explanation}"</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {!isUnknown && !isEditing && (
                        <button
                            onClick={onApprove}
                            className="rounded-full bg-brand-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                        >
                            Aprobar
                        </button>
                    )}
                    {hasCorrectionUndo && !isEditing && (
                        <button
                            onClick={() => onRevert(message.id)}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
                        >
                            Revertir
                        </button>
                    )}
                    <button
                        onClick={isEditing ? () => setIsEditing(false) : handleOpenEditor}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                    >
                        {isEditing ? 'Cerrar' : 'Corregir'}
                    </button>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {!isUnknown ? renderData() : <p className="text-sm text-slate-300">La IA no pudo determinar una accion clara a partir de este mensaje.</p>}
            </div>

            {hasCorrectionUndo && !isEditing && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-300">
                    Esta interpretacion fue corregida. Puedes revertirla para volver al estado anterior y seguir editando.
                </div>
            )}

            {isEditing && (
                <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-slate-950/40 p-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">
                        <div className="space-y-4">
                            <div>
                                <p className={labelClass}>Mensaje original</p>
                                <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-200">
                                    {message.text}
                                </p>
                            </div>

                            <div>
                                <label className={labelClass} htmlFor={`interpretation-explanation-${message.id}`}>
                                    Explicacion
                                </label>
                                <textarea
                                    id={`interpretation-explanation-${message.id}`}
                                    value={draftExplanation}
                                    onChange={(event) => setDraftExplanation(event.target.value)}
                                    rows={3}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-300/40 focus:bg-white/[0.06]"
                                />
                            </div>

                            <div>
                                <label className={labelClass} htmlFor={`interpretation-data-${message.id}`}>
                                    Datos JSON
                                </label>
                                <textarea
                                    id={`interpretation-data-${message.id}`}
                                    value={draftData}
                                    onChange={(event) => setDraftData(event.target.value)}
                                    rows={12}
                                    spellCheck={false}
                                    className="mt-2 min-h-[250px] w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-brand-300/40"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className={labelClass} htmlFor={`interpretation-type-${message.id}`}>
                                    Tipo
                                </label>
                                <select
                                    id={`interpretation-type-${message.id}`}
                                    value={draftType}
                                    onChange={(event) => setDraftType(event.target.value as InterpretationType)}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-300/40 focus:bg-white/[0.06]"
                                >
                                    {editableInterpretationTypes.map((type) => (
                                        <option key={type} value={type} className="bg-slate-950 text-slate-100">
                                            {typeLabelMap[type] || type}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={labelClass} htmlFor={`interpretation-certainty-${message.id}`}>
                                    Certeza
                                </label>
                                <input
                                    id={`interpretation-certainty-${message.id}`}
                                    type="number"
                                    min={0}
                                    max={1}
                                    step="0.01"
                                    value={draftCertainty}
                                    onChange={(event) => setDraftCertainty(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-300/40 focus:bg-white/[0.06]"
                                />
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-300">
                                {correctionHint}
                            </div>

                            {formError && (
                                <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-100">
                                    {formError}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={handleSaveCorrection}
                                    className="rounded-full bg-brand-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                                >
                                    Guardar correccion
                                </button>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MessageCard: React.FC<{
    message: Message;
    onApprove: (messageId: string) => void;
    onCorrect: (messageId: string, interpretation: ParsedMessage) => void;
    onRevert: (messageId: string) => void;
    remoteEnabled: boolean;
}> = ({ message, onApprove, onCorrect, onRevert, remoteEnabled }) => {
    const renderInterpretation = () => {
        switch (message.status) {
            case 'pending':
            case 'interpreting':
                return (
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                        <div className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                        <span>Interpretando...</span>
                    </div>
                );
            case 'interpreted':
                return message.interpretation ? (
                    <InterpretationCard
                        message={message}
                        interpretation={message.interpretation}
                        onApprove={() => onApprove(message.id)}
                        onCorrect={onCorrect}
                        onRevert={onRevert}
                        remoteEnabled={remoteEnabled}
                    />
                ) : null;
            default:
                return null;
        }
    };

    if (message.isSystemNotification) return <SystemNotificationCard message={message} />;
    if (message.status === 'approved') return <ApprovedMessageCard message={message} onRevert={() => onRevert(message.id)} remoteEnabled={remoteEnabled} />;

    return (
        <div className={`${surfaceClass} p-5`}>
            <div className="flex items-start gap-4">
                <UserIcon />
                <div className="flex-1">
                    <p className="font-semibold text-white">{message.sender}</p>
                    <p className="mt-1 text-sm text-slate-300">{message.text}</p>
                </div>
            </div>

            {(message.status === 'interpreting' || message.status === 'interpreted') && (
                <div className="mt-4 flex items-start gap-4 pl-12">
                    <BotIcon />
                    <div className="flex-1">{renderInterpretation()}</div>
                </div>
            )}
        </div>
    );
};

const MessageFeed: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { approveInterpretation, authEnabled, correctInterpretation, interpretPendingMessage, messages, revertInterpretation } = data;

    useEffect(() => {
        const processNextMessage = async () => {
            const messageToProcess = messages.find((message) => message.status === 'pending');
            if (!messageToProcess) return;

            await interpretPendingMessage(messageToProcess.id);
        };

        void processNextMessage();
    }, [interpretPendingMessage, messages]);

    const pendingCount = messages.filter((message) => message.status === 'pending' || message.status === 'interpreting').length;
    const approvedCount = messages.filter((message) => message.status === 'approved').length;

    return (
        <div className="space-y-6">
            <section className="rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_34%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Conversaciones</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                            Bandeja comercial con lectura y aprobacion en tiempo real.
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            Supervisa mensajes entrantes, valida la interpretacion de IA y transforma texto en acciones operativas.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[560px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Mensajes</p>
                            <p className="mt-2 text-3xl font-black text-white">{messages.length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Pendientes</p>
                            <p className="mt-2 text-3xl font-black text-white">{pendingCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className={labelClass}>Aprobados</p>
                            <p className="mt-2 text-3xl font-black text-white">{approvedCount}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                {messages.map((message) => (
                    <MessageCard
                        key={message.id}
                        message={message}
                        onApprove={approveInterpretation}
                        onCorrect={correctInterpretation}
                        onRevert={revertInterpretation}
                        remoteEnabled={authEnabled}
                    />
                ))}
            </section>
        </div>
    );
};

export default MessageFeed;
