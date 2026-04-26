import React from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale } from '../types';

const PackerCard: React.FC<{ sale: Sale; onPack: (saleId: string) => void }> = ({ sale, onPack }) => (
  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border-l-4 border-yellow-500">
    <div className="flex justify-between items-start">
      <div>
        <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{sale.customer}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {sale.quantity}x {sale.productGroupName} {sale.varietyName} ({sale.size})
        </p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{new Date(sale.timestamp).toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}</p>
    </div>
    <button
      onClick={() => onPack(sale.id)}
      className="mt-4 w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 transition-colors"
    >
      Marcar como Empacado
    </button>
  </div>
);

const PackerView: React.FC<{ data: BusinessData }> = ({ data }) => {
  const { sales, markOrderAsPacked } = data;
  const pendingPacking = sales.filter(s => s.status === 'Pendiente de Empaque');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Pedidos por Empacar</h1>
      {pendingPacking.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {pendingPacking.map(sale => (
            <PackerCard key={sale.id} sale={sale} onPack={markOrderAsPacked} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">¡Todo al día!</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">No hay pedidos pendientes de empaque.</p>
        </div>
      )}
    </div>
  );
};

export default PackerView;
