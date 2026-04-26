import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { FruitState, RipeningRule } from '../types';

const FRUIT_STATES: FruitState[] = ['Verde', 'Entrado', 'Maduro', 'Suave'];

const EditableDays: React.FC<{
    days: number;
    onSave: (newDays: number) => void;
}> = ({ days, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(String(days > 0 ? days : ''));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setValue(String(days > 0 ? days : ''));
    }, [days]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        const newDays = parseInt(value, 10);
        const finalDays = isNaN(newDays) || newDays < 0 ? 0 : newDays;
        
        if (finalDays !== days) {
            onSave(finalDays);
        }
    };

    if (isEditing) {
        return (
            <div className="relative w-24 h-10">
                <input 
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    className="w-full h-full text-center border-2 border-green-500 rounded-md bg-white dark:bg-gray-700 font-semibold"
                    min="0"
                />
            </div>
        );
    }
    
    return (
        <button 
            onClick={() => setIsEditing(true)} 
            className="w-24 h-10 text-center border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded-md transition-colors flex items-center justify-center font-semibold"
            title="Click para editar"
        >
            {days > 0 ? (
                <>
                {days}
                <span className="text-gray-500 dark:text-gray-400 ml-1.5 text-xs">día{days > 1 ? 's' : ''}</span>
                </>
            ) : <span className="text-gray-400">-</span>}
        </button>
    );
};


const RipeningRules: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { ripeningRules, productGroups, setRipeningRule, stateIcons } = data;

    const rulesByVariety = useMemo(() => {
        const map = new Map<string, RipeningRule[]>();
        ripeningRules.forEach(rule => {
            if (!map.has(rule.varietyId)) {
                map.set(rule.varietyId, []);
            }
            map.get(rule.varietyId)?.push(rule);
        });
        return map;
    }, [ripeningRules]);
    
    const flatVarieties = useMemo(() => 
        productGroups
            .filter(pg => !pg.archived)
            .flatMap(pg => 
                pg.varieties
                .filter(v => !v.archived)
                .map(v => ({...v, groupName: pg.name}))
            )
            .sort((a,b) => `${a.groupName} ${a.name}`.localeCompare(`${b.groupName} ${b.name}`))
    , [productGroups]);


    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Reglas de Maduración</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Define los tiempos de transición entre estados para cada producto. Haz clic en los días para editar.</p>
            </div>
            
            <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700">
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">Nomenclatura de Estados</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {FRUIT_STATES.map(state => (
                        <div key={state} className="flex items-center gap-2">
                            <span className="text-xl">{stateIcons[state]}</span>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{state}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <div className="space-y-8">
                    {flatVarieties.map(variety => {
                        const varietyRules = rulesByVariety.get(variety.id) || [];
                        return (
                            <div key={variety.id}>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <span className="text-2xl">{variety.icon}</span>
                                    {variety.groupName} {variety.name}
                                </h3>
                                <div className="flex items-center flex-wrap gap-2 text-sm mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    {FRUIT_STATES.map((state, index) => {
                                        const nextState = FRUIT_STATES[index + 1];
                                        const rule = varietyRules.find(r => r.fromState === state && r.toState === nextState);
                                        const days = rule ? rule.days : 0;

                                        return (
                                            <React.Fragment key={state}>
                                                <div title={state} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center w-10 h-10">
                                                    <span className="text-2xl">{stateIcons[state]}</span>
                                                </div>
                                                {index < FRUIT_STATES.length - 1 && (
                                                    <div className="flex items-center gap-2">
                                                        <i className="fa-solid fa-arrow-right text-gray-400 dark:text-gray-500 mx-1"></i>
                                                        <EditableDays
                                                            days={days}
                                                            onSave={(newDays) => {
                                                                if(setRipeningRule) {
                                                                    setRipeningRule(variety.id, state, nextState, newDays)
                                                                }
                                                            }}
                                                        />
                                                        <i className="fa-solid fa-arrow-right text-gray-400 dark:text-gray-500 mx-1"></i>
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                     {flatVarieties.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-gray-500 dark:text-gray-400">No hay productos activos para configurar reglas.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default RipeningRules;