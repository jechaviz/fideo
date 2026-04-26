
import React, { useState, useMemo, useEffect } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { FixedAsset, FixedAssetCategory, AssetStatus, CrateType, CrateLoan } from '../types';
import { PlusIcon, XMarkIcon } from './icons/Icons';

const ASSET_CATEGORIES: FixedAssetCategory[] = ['Vehículos', 'Equipo de Carga', 'Contenedores', 'Mobiliario', 'Electrónicos', 'Básculas'];
type Tab = 'fijos' | 'cajas';

const StatCard: React.FC<{ title: string; value: string | number; subtext: string; color: string }> = ({ title, value, subtext, color }) => (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 ${color}`}>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtext}</p>
    </div>
);

const AssetStatusPill: React.FC<{ status: AssetStatus | CrateLoan['status'] }> = ({ status }) => {
    const colorMap: Record<string, string> = {
        'Operativo': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        'Dañado': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        'En Reparación': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        'Fuera de Servicio': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        'Prestado': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        'Devuelto': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        'No Devuelto': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorMap[status]}`}>{status}</span>;
}

const FixedAssetsView: React.FC<{data: BusinessData}> = ({ data }) => {
    const { fixedAssets } = data;
    const assetsByCategory = useMemo(() => {
        const grouped: Record<string, FixedAsset[]> = {};
        for (const asset of fixedAssets) {
            if (!grouped[asset.category]) grouped[asset.category] = [];
            grouped[asset.category].push(asset);
        }
        return Object.fromEntries(Object.entries(grouped).sort(([catA], [catB]) => ASSET_CATEGORIES.indexOf(catA as FixedAssetCategory) - ASSET_CATEGORIES.indexOf(catB as FixedAssetCategory)));
    }, [fixedAssets]);

    return (
        <div className="space-y-8">
            {Object.entries(assetsByCategory).map(([category, assets]: [string, FixedAsset[]]) => (
                <div key={category}>
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 pb-2 border-b-2 dark:border-gray-700">{category}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {assets.map(asset => (
                            <div key={asset.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md flex flex-col justify-between overflow-hidden">
                                {asset.photoUrl && <img src={asset.photoUrl} alt={asset.name} className="w-full h-40 object-cover" />}
                                <div className="p-5 flex flex-col flex-grow">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{asset.name}</h3>
                                            <AssetStatusPill status={asset.status} />
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Comprado: {new Date(asset.purchaseDate).toLocaleDateString('es-MX')}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Costo: {asset.cost.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
                                        <div className="mt-3 pt-3 border-t dark:border-gray-700 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                                            {Object.entries(asset.metadata).map(([key, value]) => (
                                                <p key={key}><span className="font-semibold">{key}:</span> {String(value)}</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

const EditableCrateTypeRow: React.FC<{
    crateType: CrateType;
    onUpdate: (id: string, updates: Partial<CrateType>) => void;
    onDelete: (id: string) => void;
}> = ({ crateType, onUpdate, onDelete }) => {
    const [data, setData] = useState(crateType);
    useEffect(() => setData(crateType), [crateType]);

    const handleBlur = (field: keyof CrateType) => {
        if (data[field] !== crateType[field]) {
            onUpdate(crateType.id, { [field]: data[field] });
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setData(d => ({...d, [name]: name === 'cost' ? Number(value) : value }));
    };

    return (
        <tr>
            <td className="px-4 py-1"><input name="name" value={data.name} onChange={handleChange} onBlur={() => handleBlur('name')} className="p-2 w-full bg-transparent border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded-md"/></td>
            <td className="px-4 py-1"><input name="color" value={data.color} onChange={handleChange} onBlur={() => handleBlur('color')} className="p-2 w-full bg-transparent border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded-md"/></td>
            <td className="px-4 py-1"><input name="size" value={data.size} onChange={handleChange} onBlur={() => handleBlur('size')} className="p-2 w-full bg-transparent border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded-md"/></td>
            <td className="px-4 py-1"><input name="cost" type="number" value={data.cost} onChange={handleChange} onBlur={() => handleBlur('cost')} className="p-2 w-full bg-transparent border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded-md font-mono"/></td>
            <td className="px-4 py-1 text-center"><button onClick={() => onDelete(crateType.id)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><XMarkIcon /></button></td>
        </tr>
    );
};

const AddCrateTypeRow: React.FC<{ onAdd: (data: Omit<CrateType, 'id'>) => void }> = ({ onAdd }) => {
    const [data, setData] = useState({ name: '', color: '', size: '', cost: 0 });
    const handleAdd = () => {
        if (data.name && data.cost > 0) {
            onAdd(data);
            setData({ name: '', color: '', size: '', cost: 0 });
        }
    };
    return (
        <tr className="bg-green-50 dark:bg-green-900/20">
            <td className="px-4 py-2"><input value={data.name} onChange={e => setData({...data, name: e.target.value})} placeholder="Nombre (ej. Caja Mediana Azul)" className="p-2 w-full rounded bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600"/></td>
            <td className="px-4 py-2"><input value={data.color} onChange={e => setData({...data, color: e.target.value})} placeholder="Color" className="p-2 w-full rounded bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600"/></td>
            <td className="px-4 py-2"><input value={data.size} onChange={e => setData({...data, size: e.target.value})} placeholder="Tamaño" className="p-2 w-full rounded bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600"/></td>
            <td className="px-4 py-2"><input type="number" value={data.cost} onChange={e => setData({...data, cost: Number(e.target.value)})} placeholder="Costo" className="p-2 w-full rounded bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600"/></td>
            <td className="px-4 py-2 text-center"><button onClick={handleAdd} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><PlusIcon /></button></td>
        </tr>
    );
};


const CrateManagementView: React.FC<{data: BusinessData}> = ({ data }) => {
    const { crateTypes, crateInventory, crateLoans, returnCrateLoan, markCrateAsLost, addCrateType, updateCrateType, deleteCrateType } = data;
    
    const crateStats = useMemo(() => {
        const totalOwned = crateInventory.reduce((sum, inv) => sum + inv.quantityOwned, 0);
        const totalValue = crateInventory.reduce((sum, inv) => {
            const type = crateTypes.find(t => t.id === inv.crateTypeId);
            return sum + (inv.quantityOwned * (type?.cost || 0));
        }, 0);
        
        const loanedCrates = crateLoans.filter(l => l.status === 'Prestado');
        const lostCrates = crateLoans.filter(l => l.status === 'No Devuelto');
        
        const totalLoaned = loanedCrates.reduce((sum, l) => sum + l.quantity, 0);
        const totalLost = lostCrates.reduce((sum, l) => sum + l.quantity, 0);
        
        const inStock = totalOwned - totalLoaned;

        return { totalOwned, totalValue, totalLoaned, totalLost, inStock };
    }, [crateTypes, crateInventory, crateLoans]);
    
    const activeLoansAndLosses = useMemo(() => {
        return crateLoans
            .filter(l => l.status === 'Prestado' || l.status === 'No Devuelto')
            .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [crateLoans]);

    return (
        <div className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Inventario Cajas" value={crateStats.totalOwned} subtext="Suma de todas las cajas compradas" color="border-blue-500" />
                <StatCard title="Valor del Inventario" value={crateStats.totalValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} subtext="Costo total de adquisición" color="border-green-500" />
                <StatCard title="Cajas en Bodega" value={crateStats.inStock} subtext="Disponibles para préstamo o uso" color="border-teal-500" />
                <StatCard title="Cajas Perdidas" value={crateStats.totalLost} subtext="Marcadas como no devueltas" color="border-red-500" />
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Tipos de Caja</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Color</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tamaño</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Unitario</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {crateTypes.map(type => (
                                <EditableCrateTypeRow key={type.id} crateType={type} onUpdate={updateCrateType} onDelete={deleteCrateType} />
                            ))}
                            <AddCrateTypeRow onAdd={addCrateType} />
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Préstamos y Pérdidas</h2>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo de Caja</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cantidad</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Límite</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {activeLoansAndLosses.map(loan => {
                                const type = crateTypes.find(t => t.id === loan.crateTypeId);
                                const isOverdue = new Date(loan.dueDate) < new Date() && loan.status === 'Prestado';
                                return (
                                <tr key={loan.id} className={isOverdue ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                    <td className="px-4 py-3 font-semibold">{loan.customer}</td>
                                    <td className="px-4 py-3">{type?.name || 'N/A'}</td>
                                    <td className="px-4 py-3 font-mono">{loan.quantity}</td>
                                    <td className="px-4 py-3">{new Date(loan.dueDate).toLocaleDateString('es-MX')}</td>
                                    <td className="px-4 py-3"><AssetStatusPill status={loan.status} /></td>
                                    <td className="px-4 py-3">
                                        {loan.status === 'Prestado' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => returnCrateLoan(loan.id)} className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200 rounded-md hover:bg-green-200 dark:hover:bg-green-700">Devuelto</button>
                                                <button onClick={() => markCrateAsLost(loan.id)} className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-700">Perdido</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const Assets: React.FC<{ data: BusinessData }> = ({ data }) => {
    const [activeTab, setActiveTab] = useState<Tab>('fijos');
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Activos</h1>
            </div>
            
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    <button onClick={() => setActiveTab('fijos')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'fijos' ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                        Activos Fijos
                    </button>
                    <button onClick={() => setActiveTab('cajas')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'cajas' ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                        Gestión de Cajas
                    </button>
                </nav>
            </div>

            {activeTab === 'fijos' ? <FixedAssetsView data={data} /> : <CrateManagementView data={data} />}
        </div>
    );
};

export default Assets;
