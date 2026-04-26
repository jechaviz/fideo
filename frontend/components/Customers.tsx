
import React, { useState, useMemo, useEffect } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Customer, FruitState, Quality, CreditStatus, Sale, Payment } from '../types';
import { PlusIcon, XMarkIcon, ChevronDownIcon, ChevronRightIcon, ArrowUturnLeftIcon, SparklesIcon, SettingsIcon, ListIcon, GridIcon, FinanceIcon, CheckCircleIcon } from './icons/Icons';
import MessageConfig from './MessageConfig';
import Promotions from './Promotions';

const CREDIT_STATUSES: CreditStatus[] = ['Confiable', 'En Observación', 'Contado Solamente'];
type MainTab = 'dashboard' | 'directory' | 'messages';
type MessageSubTab = 'config' | 'campaigns';
type DirectoryViewMode = 'list' | 'grid';
type CustomerTab = 'insights' | 'details' | 'orders' | 'crates' | 'prices';

// --- Intelligent Dashboard Components ---

const KpiCard: React.FC<{ title: string; value: string; subtext?: string; icon: React.ReactNode; color: string }> = ({ title, value, subtext, icon, color }) => (
    <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md flex items-center gap-4 border-l-4 ${color.replace('bg-', 'border-').split(' ')[0]}`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl text-white ${color}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
            <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            {subtext && <p className="text-xs text-gray-500 dark:text-gray-400">{subtext}</p>}
        </div>
    </div>
);

const CustomerSummaryCard: React.FC<{ 
    customer: Customer; 
    sales: Sale[]; 
    payments: Payment[]; 
    onClick: () => void; 
}> = ({ customer, sales, payments, onClick }) => {
    
    const stats = useMemo(() => {
        const debtFromSales = sales
            .filter(s => s.customer === customer.name && s.paymentStatus === 'En Deuda' && s.status === 'Completado')
            .reduce((sum, s) => sum + s.price, 0);
        const totalPayments = payments
            .filter(p => p.customerId === customer.id)
            .reduce((sum, p) => sum + p.amount, 0);
        const monetaryDebt = Math.max(0, debtFromSales - totalPayments);
        
        const lastSale = sales.filter(s => s.customer === customer.name).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        
        // Determine top products visually (Mock logic for DNA)
        const productCounts: Record<string, number> = {};
        sales.filter(s => s.customer === customer.name).forEach(s => {
            const key = s.productGroupName; // e.g. 'Aguacate'
            productCounts[key] = (productCounts[key] || 0) + 1;
        });
        const topProducts = Object.entries(productCounts).sort((a,b) => b[1] - a[1]).slice(0, 3).map(k => k[0]);

        return { monetaryDebt, lastSale, topProducts };
    }, [customer, sales, payments]);

    const creditUsagePct = customer.creditLimit ? Math.min(100, (stats.monetaryDebt / customer.creditLimit) * 100) : 0;
    const reliabilityColor = customer.creditStatus === 'Confiable' ? 'bg-green-100 text-green-800' : customer.creditStatus === 'En Observación' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

    const productIcons: Record<string, string> = { 'Manzana': '🍎', 'Aguacate': '🥑', 'Mango': '🥭', 'Uva': '🍇' };

    return (
        <div onClick={onClick} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{customer.name}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${reliabilityColor} mt-1 inline-block`}>
                        {customer.creditStatus}
                    </span>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Deuda Actual</p>
                    <p className={`font-bold ${stats.monetaryDebt > 0 ? 'text-orange-600' : 'text-gray-800 dark:text-gray-200'}`}>
                        {stats.monetaryDebt.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'})}
                    </p>
                </div>
            </div>

            {/* Credit Bar */}
            {customer.creditLimit ? (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-4 overflow-hidden">
                    <div 
                        className={`h-1.5 rounded-full ${creditUsagePct > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${creditUsagePct}%` }}
                    ></div>
                </div>
            ) : (
                <div className="h-1.5 mb-4"></div> 
            )}

            <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1" title="Productos frecuentes">
                    {stats.topProducts.map(p => (
                        <span key={p} className="text-lg">{productIcons[p] || '📦'}</span>
                    ))}
                    {stats.topProducts.length === 0 && <span className="text-xs italic">Sin compras</span>}
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs">
                        {stats.lastSale ? `Hace ${Math.floor((Date.now() - new Date(stats.lastSale.timestamp).getTime()) / (1000 * 60 * 60 * 24))} días` : 'Nunca'}
                    </span>
                    <ChevronRightIcon />
                </div>
            </div>
        </div>
    );
};

const DirectoryCard: React.FC<{ customer: Customer; onClick: () => void }> = ({ customer, onClick }) => (
    <div onClick={onClick} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 cursor-pointer transition-colors flex flex-col justify-between h-full">
        <div>
            <div className="flex justify-between items-start">
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 text-lg font-bold">
                    {customer.name.charAt(0)}
                </div>
                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${customer.creditStatus === 'Confiable' ? 'bg-green-100 text-green-800' : customer.creditStatus === 'En Observación' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {customer.creditStatus}
                </span>
            </div>
            <h3 className="mt-3 font-bold text-gray-800 dark:text-gray-100 truncate">{customer.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {customer.contacts.find(c => c.isPrimary)?.name || 'Sin contacto principal'}
            </p>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Ver Detalles &rarr;</span>
        </div>
    </div>
);

// --- Existing Command Center (Refactored as a Sub-View) ---

const CustomerCommandCenter: React.FC<{ data: BusinessData, customerId: string, onBack: () => void }> = ({ data, customerId, onBack }) => {
  const { 
    customers, sales, payments, crateLoans, 
    crateTypes,
    generateCustomerSummary, aiCustomerSummary, isGeneratingSummary,
  } = data;
  
  const [activeTab, setActiveTab] = useState<CustomerTab>('insights');
  const customer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);
  const { monetaryDebt, lentCratesValue, totalBalance } = useMemo(() => {
      if (!customer) {
          return { monetaryDebt: 0, lentCratesValue: 0, totalBalance: 0 };
      }
      const debtFromSales = sales
        .filter(s => s.customer === customer.name && s.paymentStatus === 'En Deuda' && s.status === 'Completado')
        .reduce((sum, s) => sum + s.price, 0);
      const totalPayments = payments
        .filter(p => p.customerId === customer.id)
        .reduce((sum, p) => sum + p.amount, 0);
      const finalMonetaryDebt = Math.max(0, debtFromSales - totalPayments);
      const loans = crateLoans.filter(l => l.customer === customer.name && (l.status === 'Prestado' || l.status === 'No Devuelto'));
      const finalLentCratesValue = loans.reduce((sum, loan) => {
          const crateType = crateTypes.find(ct => ct.id === loan.crateTypeId);
          return sum + (loan.quantity * (crateType?.cost || 50));
      }, 0);
      return { monetaryDebt: finalMonetaryDebt, lentCratesValue: finalLentCratesValue, totalBalance: finalMonetaryDebt + finalLentCratesValue };
  }, [customer, sales, payments, crateLoans, crateTypes]);

  if (!customer) return <div>Cliente no encontrado</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="p-6 border-b dark:border-gray-700">
            <button onClick={onBack} className="text-gray-500 dark:text-gray-400 mb-4 text-sm flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                <ArrowUturnLeftIcon /> Volver al Dashboard
            </button>
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                 <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{customer.name}</h2>
                    <div className="flex gap-2 mt-2">
                        {customer.contacts.map(c => <span key={c.name} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-gray-600 dark:text-gray-300">{c.name}</span>)}
                    </div>
                 </div>
                 <div className="text-left md:text-right">
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Balance Total</p>
                    <p className={`text-3xl font-bold ${totalBalance > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                        {totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Monetario: {monetaryDebt.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} | Cajas: {lentCratesValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </p>
                 </div>
            </div>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <nav className="-mb-px flex space-x-4 px-6 min-w-max">
                <TabButton name="Análisis IA" tab="insights" activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton name="Detalles" tab="details" activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton name="Pedidos" tab="orders" activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton name="Cajas" tab="crates" activeTab={activeTab} setActiveTab={setActiveTab} />
                <TabButton name="Lista de Precios" tab="prices" activeTab={activeTab} setActiveTab={setActiveTab} />
            </nav>
        </div>

        <div className="p-6">
            {activeTab === 'insights' && (
                <div>
                    <button onClick={() => generateCustomerSummary(customer.id)} disabled={isGeneratingSummary} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors shadow-sm">
                        {isGeneratingSummary ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <SparklesIcon />}
                        {isGeneratingSummary ? 'Analizando...' : 'Generar Resumen de Negocio con IA'}
                    </button>
                    {aiCustomerSummary ? (
                        <div className="mt-6 p-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700 prose prose-sm dark:prose-invert max-w-none shadow-inner">
                            {aiCustomerSummary.error ? <p className="text-red-500">{aiCustomerSummary.error}</p> : <div dangerouslySetInnerHTML={{ __html: aiCustomerSummary.content.replace(/### (.*)/g, '<h3 class="font-bold text-lg mt-4 mb-2 text-blue-800 dark:text-blue-300">$1</h3>').replace(/\* (.*)/g, '<li class="ml-4 marker:text-blue-500">$1</li>') }} />}
                        </div>
                    ) : !isGeneratingSummary && <p className="mt-4 text-center text-gray-500 dark:text-gray-400">Solicita un análisis para ver patrones de compra y recomendaciones personalizadas.</p>}
                </div>
            )}
            {activeTab === 'details' && <CustomerDetails data={data} customer={customer} />}
            {activeTab === 'orders' && <CustomerOrders data={data} customer={customer} />}
            {activeTab === 'crates' && <CustomerCrates data={data} customer={customer} />}
            {activeTab === 'prices' && <CustomerPrices data={data} customer={customer} />}
        </div>
    </div>
  );
};

// --- Main Component ---

const Customers: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { customers, sales, payments } = data;
    const [mainTab, setMainTab] = useState<MainTab>('dashboard');
    const [messageSubTab, setMessageSubTab] = useState<MessageSubTab>('config');
    const [directoryView, setDirectoryView] = useState<DirectoryViewMode>('list');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    // Reset selection when switching main tabs
    useEffect(() => {
        if (mainTab !== 'dashboard') setSelectedCustomerId(null);
    }, [mainTab]);

    // Calculate Portfolio Stats
    const portfolioStats = useMemo(() => {
        let totalDebt = 0;
        const activeCustomerIds = new Set();
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

        customers.forEach(c => {
            const debt = sales
                .filter(s => s.customer === c.name && s.paymentStatus === 'En Deuda')
                .reduce((sum, s) => sum + s.price, 0) 
                - payments.filter(p => p.customerId === c.id).reduce((sum, p) => sum + p.amount, 0);
            totalDebt += Math.max(0, debt);
        });

        sales.forEach(s => {
            if(new Date(s.timestamp) > thirtyDaysAgo) {
                const c = customers.find(cust => cust.name === s.customer);
                if(c) activeCustomerIds.add(c.id);
            }
        });

        return {
            totalDebt,
            activeCount: activeCustomerIds.size,
            totalCustomers: customers.length
        };
    }, [customers, sales, payments]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Gestión de Clientes</h1>
            </div>

            {/* Main Navigation Tabs */}
            {!selectedCustomerId && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-b border-gray-200 dark:border-gray-700 mb-6 p-1 flex space-x-1 w-fit">
                    <button onClick={() => setMainTab('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mainTab === 'dashboard' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                        Dashboard
                    </button>
                    <button onClick={() => setMainTab('directory')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mainTab === 'directory' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                        Directorio
                    </button>
                    <button onClick={() => setMainTab('messages')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mainTab === 'messages' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                        Mensajes y Promociones
                    </button>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-grow">
                {selectedCustomerId ? (
                    <CustomerCommandCenter 
                        data={data} 
                        customerId={selectedCustomerId} 
                        onBack={() => setSelectedCustomerId(null)} 
                    />
                ) : (
                    <>
                        {mainTab === 'dashboard' && (
                            <div className="space-y-6">
                                {/* BI Section */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <KpiCard 
                                        title="Cartera Vencida Total" 
                                        value={portfolioStats.totalDebt.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} 
                                        subtext="Deuda acumulada activa"
                                        icon={<FinanceIcon />} 
                                        color="bg-orange-500" 
                                    />
                                    <KpiCard 
                                        title="Clientes Activos (30d)" 
                                        value={`${portfolioStats.activeCount} / ${portfolioStats.totalCustomers}`} 
                                        subtext="Tasa de retención"
                                        icon={<CheckCircleIcon />} 
                                        color="bg-green-500" 
                                    />
                                    <KpiCard 
                                        title="Salud de Crédito" 
                                        value="Estable" 
                                        subtext="Basado en pagos recientes"
                                        icon={<SparklesIcon />} 
                                        color="bg-blue-500" 
                                    />
                                </div>

                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-8 mb-4">Atención Prioritaria</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {customers.map(c => (
                                        <CustomerSummaryCard 
                                            key={c.id} 
                                            customer={c} 
                                            sales={sales} 
                                            payments={payments}
                                            onClick={() => setSelectedCustomerId(c.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {mainTab === 'directory' && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Lista de Clientes</h2>
                                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                        <button onClick={() => setDirectoryView('list')} className={`p-2 rounded-md transition-colors ${directoryView === 'list' ? 'bg-white dark:bg-gray-600 shadow text-green-600' : 'text-gray-500'}`}>
                                            <ListIcon />
                                        </button>
                                        <button onClick={() => setDirectoryView('grid')} className={`p-2 rounded-md transition-colors ${directoryView === 'grid' ? 'bg-white dark:bg-gray-600 shadow text-green-600' : 'text-gray-500'}`}>
                                            <GridIcon />
                                        </button>
                                    </div>
                                </div>

                                {directoryView === 'list' ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contactos</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estatus</th>
                                                    <th className="px-6 py-3 text-right"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                {customers.map(customer => (
                                                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{customer.name}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{customer.contacts.map(c => c.name).join(', ')}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.creditStatus === 'Confiable' ? 'bg-green-100 text-green-800' : customer.creditStatus === 'En Observación' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                                {customer.creditStatus}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button onClick={() => setSelectedCustomerId(customer.id)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Editar</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {customers.map(customer => (
                                            <DirectoryCard key={customer.id} customer={customer} onClick={() => setSelectedCustomerId(customer.id)} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {mainTab === 'messages' && (
                            <div className="space-y-6">
                                {/* Sub-tabs for Messages */}
                                <div className="flex space-x-4 border-b dark:border-gray-700 overflow-x-auto pb-2">
                                    <button onClick={() => setMessageSubTab('config')} className={`pb-2 px-2 font-semibold text-sm transition-colors ${messageSubTab === 'config' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                        Configuración
                                    </button>
                                    <button onClick={() => setMessageSubTab('campaigns')} className={`pb-2 px-2 font-semibold text-sm transition-colors ${messageSubTab === 'campaigns' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                        Campañas
                                    </button>
                                </div>

                                {messageSubTab === 'config' && (
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                            <SettingsIcon /> Configuración de Plantillas
                                        </h2>
                                        <MessageConfig data={data} />
                                    </div>
                                )}

                                {messageSubTab === 'campaigns' && (
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-t-4 border-green-500">
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                            <SparklesIcon /> Enviar Promoción Masiva
                                        </h2>
                                        <Promotions data={data} />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// --- Sub-components (Helpers from original file, slightly adapted) ---

const TabButton: React.FC<{name: string, tab: CustomerTab, activeTab: CustomerTab, setActiveTab: (tab: CustomerTab) => void}> = ({ name, tab, activeTab, setActiveTab }) => (
    <button onClick={() => setActiveTab(tab)} className={`whitespace-nowrap py-3 px-3 border-b-2 font-semibold text-sm transition-colors ${activeTab === tab ? 'border-green-600 text-green-700 dark:text-green-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
        {name}
    </button>
);

const CustomerDetails: React.FC<{data: BusinessData, customer: Customer}> = ({data, customer}) => {
    const { updateCustomer } = data;
    const [customerData, setCustomerData] = useState<Partial<Customer>>(customer);
    const [newContactName, setNewContactName] = useState('');
    useEffect(() => setCustomerData(customer), [customer]);

    const handleBlur = () => {
        const updates = { ...customerData };
        if (updates.creditLimit) updates.creditLimit = Number(updates.creditLimit);
        updateCustomer(customer.id, updates);
    };

    const handleAddContact = () => {
        if (newContactName.trim()) {
            const updatedContacts = [...customer.contacts, { name: newContactName.trim(), isPrimary: false }];
            updateCustomer(customer.id, { contacts: updatedContacts });
            setNewContactName('');
        }
    };
    const handleRemoveContact = (contactNameToRemove: string) => {
        const updatedContacts = customer.contacts.filter(c => c.name !== contactNameToRemove && !c.isPrimary);
        updateCustomer(customer.id, { contacts: updatedContacts });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Nivel de Confianza</label>
                    <select value={customerData.creditStatus || ''} onChange={e => setCustomerData(d => ({...d, creditStatus: e.target.value as CreditStatus}))} onBlur={handleBlur} className="w-full p-2 border rounded-md text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                        {CREDIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Límite de Crédito</label>
                    <input type="number" placeholder="Sin límite" value={customerData.creditLimit || ''} onChange={e => setCustomerData(d => ({...d, creditLimit: Number(e.target.value) || undefined}))} onBlur={handleBlur} className="w-full p-2 border rounded-md text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" disabled={customerData.creditStatus !== 'Confiable'} />
                </div>
            </div>
            <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Contactos y apodos</label>
                <div className="flex flex-wrap gap-2">
                    {customer.contacts.map(contact => (
                        <div key={contact.name} className={`flex items-center gap-2 text-sm rounded-full px-3 py-1 ${contact.isPrimary ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                            <span>{contact.name}</span>
                            {!contact.isPrimary && (<button onClick={() => handleRemoveContact(contact.name)} className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><XMarkIcon /></button>)}
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex gap-2">
                    <input type="text" value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Añadir apodo..." className="flex-grow p-2 border border-gray-200 rounded-md text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    <button onClick={handleAddContact} className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"><PlusIcon /></button>
                </div>
            </div>
            <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Horario de Compra</label>
                <div className="flex gap-2">
                    <input type="text" placeholder="Días (ej. Lunes, Miércoles)" value={customerData.schedule?.days.join(', ') || ''} onChange={e => setCustomerData(d => ({...d, schedule: {...d.schedule, days: e.target.value.split(',').map(s=>s.trim())}}))} onBlur={handleBlur} className="w-2/3 p-2 border rounded-md text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                    <input type="text" placeholder="Hora (ej. 05:00 - 07:00)" value={customerData.schedule?.time || ''} onChange={e => setCustomerData(d => ({...d, schedule: {...d.schedule, time: e.target.value}}))} onBlur={handleBlur} className="w-1/3 p-2 border rounded-md text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Notas de Entrega</label>
                <textarea value={customerData.deliveryNotes || ''} onChange={e => setCustomerData(d => ({...d, deliveryNotes: e.target.value}))} onBlur={handleBlur} placeholder="Ej: Camioneta blanca, Rampa C..." rows={2} className="w-full p-2 border rounded-md text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
            </div>
        </div>
    )
};

const CustomerOrders: React.FC<{data: BusinessData, customer: Customer}> = ({data, customer}) => {
    const customerSales = useMemo(() => data.sales.filter(s => s.customer === customer.name).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()), [data.sales, customer.name]);
    return (
        <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
            {customerSales.length > 0 ? customerSales.map(sale => (
                <div key={sale.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold dark:text-gray-200">{sale.quantity}x {sale.varietyName} {sale.size}</p>
                        <p className="font-bold text-green-700 dark:text-green-400">{sale.price.toLocaleString('es-MX', {style:'currency', currency: 'MXN'})}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(sale.timestamp).toLocaleString('es-MX')} - {sale.status} / {sale.paymentStatus}</p>
                </div>
            )) : <p className="text-center text-gray-500 dark:text-gray-400 py-4">No hay historial de pedidos.</p>}
        </div>
    );
};

const CustomerCrates: React.FC<{data: BusinessData, customer: Customer}> = ({data, customer}) => {
    const { crateLoans, crateTypes, returnCrateLoan } = data;
    const customerLoans = useMemo(() => crateLoans.filter(l => l.customer === customer.name).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()), [crateLoans, customer.name]);
    return (
        <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
            {customerLoans.length > 0 ? customerLoans.map(loan => {
                 const crateType = crateTypes.find(ct => ct.id === loan.crateTypeId);
                 const isOverdue = new Date(loan.dueDate) < new Date() && loan.status === 'Prestado';
                 return (
                     <div key={loan.id} className={`p-3 rounded-md flex justify-between items-center ${isOverdue ? 'bg-red-50 dark:bg-red-900/30' : 'bg-yellow-50 dark:bg-yellow-900/30'}`}>
                         <div>
                             <span className="font-semibold text-gray-700 dark:text-gray-200">{loan.quantity} x {crateType?.name || 'Caja'}</span>
                             <span className={`ml-3 text-sm ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                                 {loan.status} | Vence: {new Date(loan.dueDate).toLocaleDateString('es-MX')}
                             </span>
                         </div>
                         {loan.status === 'Prestado' && <button onClick={() => returnCrateLoan(loan.id)} className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200 rounded-md hover:bg-green-200 dark:hover:bg-green-700 flex items-center gap-1" title="Registrar devolución"><ArrowUturnLeftIcon /> Devolver</button>}
                     </div>
                 )
            }) : <p className="text-center text-gray-500 dark:text-gray-400 py-4">No hay historial de préstamos de cajas.</p>}
        </div>
    );
};

const CustomerPrices: React.FC<{data: BusinessData, customer: Customer}> = ({data, customer}) => {
    const { productGroups, prices, setSpecialPrice, stateIcons, qualities: qualityIcons } = data;
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const toggleRow = (key: string) => setExpandedRows(prev => { const newSet = new Set(prev); if (newSet.has(key)) newSet.delete(key); else newSet.add(key); return newSet; });
    const productVarietySizes = useMemo(() => productGroups.filter(pg => !pg.archived).flatMap(pg => pg.varieties.filter(v => !v.archived).flatMap(v => v.sizes.map(s => ({ group: pg, variety: v, size: s })))), [productGroups]);
    const sellableStates: FruitState[] = ['Verde', 'Entrado', 'Maduro', 'Suave'];
    const sellableQualities: Quality[] = ['Normal', 'Con Defectos'];

    const handlePriceChange = (varietyId: string, size: string, quality: Quality, state: FruitState, price: string) => {
        const numericPrice = parseFloat(price);
        setSpecialPrice(customer.id, varietyId, size, quality, state, isNaN(numericPrice) ? 0 : numericPrice);
    };

    return (
        <div className="max-h-96 overflow-y-auto">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Estos precios anulan el precio de venta regular para este cliente.</p>
            <table className="min-w-full">
                <tbody>
                    {productVarietySizes.map(({group, variety, size}) => {
                        const productKey = `${variety.id}-${size}`;
                        const isExpanded = expandedRows.has(productKey);
                        const specialPricesForProduct = customer.specialPrices.filter(sp => sp.varietyId === variety.id && sp.size === size);
                        return (
                            <React.Fragment key={productKey}>
                                <tr onClick={() => toggleRow(productKey)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg">
                                    <td className="pl-2 py-3 text-gray-400">{isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}</td>
                                    <td className="px-2 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{group.name} {variety.name} - <span className="text-gray-600 dark:text-gray-400 font-normal">{size}</span></td>
                                    <td className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400 text-right">
                                        {specialPricesForProduct.length > 0 && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{specialPricesForProduct.length} activo(s)</span>}
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td />
                                        <td colSpan={2} className="px-2 pb-4">
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                                {sellableQualities.map(quality => (
                                                    <div key={quality}>
                                                        <h4 className="flex items-center gap-2 text-md font-bold text-gray-700 dark:text-gray-200 mb-2"><span className="text-lg">{qualityIcons[quality].icon}</span>{quality}</h4>
                                                        <div className="space-y-2 pl-6">
                                                            {sellableStates.map(state => {
                                                                const specialPrice = specialPricesForProduct.find(p => p.quality === quality && p.state === state)?.price;
                                                                const regularPrice = prices.find(p => p.varietyId === variety.id && p.size === size && p.quality === quality && p.state === state)?.price;
                                                                return (
                                                                    <div key={state} className="grid grid-cols-2 gap-2 items-center">
                                                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300"><span className="text-lg">{stateIcons[state]}</span>{state}</label>
                                                                        <input type="number" placeholder={regularPrice ? `Reg: ${regularPrice}` : 'N/A'} defaultValue={specialPrice || ''} onBlur={(e) => handlePriceChange(variety.id, size, quality, state, e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full p-2 border border-gray-200 rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm"/>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default Customers;
