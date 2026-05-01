import React from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { ActionItem } from '../types';

const ActionItemCard: React.FC<{ item: ActionItem; onAction: (item: ActionItem) => void }> = ({ item, onAction }) => {
    const iconMap: Record<ActionItem['type'], string> = {
        PACK_ORDER: 'fa-box-check',
        ASSIGN_DELIVERY: 'fa-truck',
        CONFIRM_PURCHASE_ORDER: 'fa-dolly',
        FOLLOW_UP_CRATE: 'fa-box-open',
        SMART_MOVE: 'fa-people-carry-box',
    };

    const colorMap: Record<ActionItem['type'], string> = {
        PACK_ORDER: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
        ASSIGN_DELIVERY: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
        CONFIRM_PURCHASE_ORDER: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
        FOLLOW_UP_CRATE: 'border-orange-400/40 bg-orange-400/10 text-orange-200',
        SMART_MOVE: 'border-teal-400/40 bg-teal-400/10 text-teal-200',
    };

    return (
        <div className="glass-panel-dark flex h-full flex-col justify-between rounded-[1.8rem] border border-white/10 p-5">
            <div>
                <div className="mb-4 flex items-start gap-3">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border ${colorMap[item.type]}`}>
                        <i className={`fa-solid ${iconMap[item.type]} text-base`}></i>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{item.type.replaceAll('_', ' ')}</p>
                        <p className="mt-2 text-lg font-black tracking-tight text-white">{item.title}</p>
                        <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                    </div>
                </div>
            </div>
            <button
                onClick={() => onAction(item)}
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-brand-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300"
            >
                {item.cta.text}
            </button>
        </div>
    );
};

const ActionCenter: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { actionItems, setCurrentView } = data;

    const handleAction = (item: ActionItem) => {
        setCurrentView(item.cta.targetView);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Cola prioritaria</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Centro de Acciones</h1>
                    <p className="mt-3 max-w-2xl text-sm text-slate-400">Las siguientes tareas mueven caja, inventario y entregas sin perder ritmo operativo.</p>
                </div>
                <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_14px_rgba(163,230,53,0.75)]"></span>
                    {actionItems.length} abiertas
                </div>
            </div>

            {actionItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {actionItems.map((item) => (
                        <ActionItemCard key={item.id} item={item} onAction={handleAction} />
                    ))}
                </div>
            ) : (
                <div className="glass-panel-dark rounded-[2rem] py-14 text-center">
                    <div className="mb-4 text-5xl text-brand-300">
                        <i className="fa-solid fa-check-double"></i>
                    </div>
                    <h2 className="text-xl font-black text-white">Todo en orden</h2>
                    <p className="mt-2 text-slate-400">No hay acciones pendientes en este momento.</p>
                </div>
            )}
        </div>
    );
};

export default ActionCenter;
