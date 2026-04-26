
import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Line, ComposedChart } from 'recharts';
import { SparklesIcon } from './icons/Icons';
import { generateBusinessInsights } from '../services/geminiService';

const KpiCard: React.FC<{ title: string; value: string; subtext?: string; icon: string; color: string }> = ({ title, value, subtext, icon, color }) => (
    <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md flex items-center gap-4`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl text-white ${color}`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
            <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            {subtext && <p className="text-xs text-gray-500 dark:text-gray-400">{subtext}</p>}
        </div>
    </div>
);

const ChartContainer: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
        <h2 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-4 px-2">{title}</h2>
        <div className="h-60">
            {children}
        </div>
    </div>
);

const InteligenciaFideo: React.FC<{ insights: string; isLoading: boolean; }> = ({ insights, isLoading }) => {
    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-blue-900/50 p-5 rounded-xl shadow-md h-full flex flex-col">
            <h2 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                <SparklesIcon/> Inteligencia Fideo
            </h2>
            {isLoading ? (
                 <div className="flex-grow flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-2">Analizando...</span>
                </div>
            ) : insights ? (
                 <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans" dangerouslySetInnerHTML={{ __html: insights.replace(/\* (.*)/g, '<li class="ml-4">$1</li>') }} />
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                    <p>Obtén recomendaciones basadas en la actividad de hoy.</p>
                </div>
            )}
        </div>
    )
};


const Dashboard: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { sales, inventory, productGroups, theme } = data;
    const isDark = theme === 'dark';
    const [insights, setInsights] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const generateInsights = async () => {
        setIsLoading(true);
        setInsights('');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todaySales = sales.filter(s => new Date(s.timestamp) >= today);
            
            const profitByCustomer = todaySales.reduce((acc, sale) => {
                acc[sale.customer] = (acc[sale.customer] || 0) + (sale.price - sale.cogs);
                return acc;
            }, {} as Record<string, number>);
            const topCustomers = Object.entries(profitByCustomer).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0,3).map(([name]) => name);

            const profitByProduct = todaySales.reduce((acc, sale) => {
                const productName = `${sale.varietyName} ${sale.size}`;
                acc[productName] = (acc[productName] || 0) + (sale.price - sale.cogs);
                return acc;
            }, {} as Record<string, number>);
            const topProducts = Object.entries(profitByProduct).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0,3).map(([name]) => name);

            const dailyStats = {
                ventas: todaySales.reduce((sum, s) => sum + s.price, 0),
                ganancia: todaySales.reduce((sum, s) => sum + (s.price - s.cogs), 0),
                margen: 0,
                topCustomers,
                topProducts
            };
            dailyStats.margen = dailyStats.ventas > 0 ? (dailyStats.ganancia / dailyStats.ventas) * 100 : 0;
            
            const inventorySummary = inventory.slice(0, 5).map(item => {
                 const varietyInfo = productGroups.flatMap(pg => pg.varieties).find(v => v.id === item.varietyId);
                return {
                    name: `${varietyInfo?.name || item.varietyId} ${item.size}`,
                    quantity: item.quantity,
                    daysOnHand: 10 // Dummy value for now
                }
            });

            const result = await generateBusinessInsights(dailyStats, inventorySummary);
            setInsights(result);
        } catch {
            setInsights("Error al generar insights. Revisa la conexión con la API.");
        } finally {
            setIsLoading(false);
        }
    };


    const dashboardData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySales = sales.filter(s => new Date(s.timestamp) >= today);

        const ventasHoy = todaySales.reduce((sum, s) => sum + s.price, 0);
        const profitHoy = todaySales.reduce((sum, s) => sum + (s.price - s.cogs), 0);
        const margenBrutoHoy = ventasHoy > 0 ? (profitHoy / ventasHoy) * 100 : 0;
        const ticketPromedio = todaySales.length > 0 ? ventasHoy / todaySales.length : 0;
        const entregasPendientes = sales.filter(s => ['Pendiente de Empaque', 'Listo para Entrega'].includes(s.status)).length;
        
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 6);
        last7Days.setHours(0, 0, 0, 0);
        const recentSales = sales.filter(s => new Date(s.timestamp) >= last7Days);
        const salesByDay = Array(7).fill(0).map((_, i) => {
            const d = new Date(last7Days);
            d.setDate(d.getDate() + i);
            return { name: d.toLocaleDateString('es-MX', { weekday: 'short' }), ventas: 0, ganancia: 0 };
        });
        recentSales.forEach(s => {
            const dayIndex = Math.floor((new Date(s.timestamp).getTime() - last7Days.getTime()) / (1000 * 3600 * 24));
            if (dayIndex >= 0 && dayIndex < 7) {
                salesByDay[dayIndex].ventas += s.price;
                salesByDay[dayIndex].ganancia += (s.price - s.cogs);
            }
        });

        const salesByCategory = todaySales.reduce((acc, sale) => {
            const category = productGroups.find(pg => pg.id === sale.productGroupId)?.category || 'Otro';
            acc[category] = (acc[category] || 0) + sale.price;
            return acc;
        }, {} as Record<string, number>);
        const salesCompositionData = Object.entries(salesByCategory).map(([name, value]) => ({ name, value }));
        
        const profitByProduct = todaySales.reduce((acc, sale) => {
            const productName = `${sale.varietyName} ${sale.size}`;
            acc[productName] = (acc[productName] || 0) + (sale.price - sale.cogs);
            return acc;
        }, {} as Record<string, number>);
        const top5Products = Object.entries(profitByProduct).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 5).map(([name, profit]) => ({name, profit}));

        const profitByCustomer = todaySales.reduce((acc, sale) => {
            acc[sale.customer] = (acc[sale.customer] || 0) + (sale.price - sale.cogs);
            return acc;
        }, {} as Record<string, number>);
        const top5Customers = Object.entries(profitByCustomer).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 5).map(([name, profit]) => ({name, profit}));

        return { ventasHoy, margenBrutoHoy, ticketPromedio, entregasPendientes, salesByDay, salesCompositionData, top5Products, top5Customers };
    }, [sales, productGroups]);
    
    const PIE_COLORS = ['#34D399', '#60A5FA', '#FBBF24', '#A78BFA', '#F87171'];

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Dashboard de Inteligencia</h1>
                 <button onClick={generateInsights} disabled={isLoading} className="px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 w-full sm:w-auto">
                    {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <SparklesIcon />}
                    <span>{isLoading ? 'Analizando...' : 'Analizar Ahora'}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <KpiCard title="Ventas de Hoy" value={dashboardData.ventasHoy.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} icon="fa-sack-dollar" color="bg-green-500" />
                <KpiCard title="Margen Bruto Hoy" value={`${dashboardData.margenBrutoHoy.toFixed(1)}%`} icon="fa-percent" color="bg-sky-500" />
                <KpiCard title="Ticket Promedio" value={dashboardData.ticketPromedio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} icon="fa-file-invoice-dollar" color="bg-orange-500" />
                <KpiCard title="Entregas Pendientes" value={dashboardData.entregasPendientes.toString()} subtext="Por empacar o asignar" icon="fa-box-check" color="bg-blue-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2">
                    <ChartContainer title="Ventas y Ganancia (Últimos 7 Días)">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <ComposedChart data={dashboardData.salesByDay}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#4A5568' : '#E2E8F0'} vertical={false}/>
                                <XAxis dataKey="name" stroke={isDark ? '#A0AEC0' : '#4A5568'} tick={{fontSize: 12}} />
                                <YAxis yAxisId="left" stroke={isDark ? '#A0AEC0' : '#4A5568'} tick={{fontSize: 10}} tickFormatter={(val) => `$${Number(val)/1000}k`} />
                                <Tooltip formatter={(value: number, name: string) => [value.toLocaleString('es-MX', {style: 'currency', currency:'MXN'}), name]}/>
                                <Legend />
                                <Bar yAxisId="left" dataKey="ventas" name="Ventas" fill="#34D399" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="left" type="monotone" dataKey="ganancia" name="Ganancia" stroke="#3B82F6" strokeWidth={2} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
                <div>
                     <ChartContainer title="Composición de Ventas (Hoy)">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                           <PieChart>
                              <Pie data={dashboardData.salesCompositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5}>
                                {dashboardData.salesCompositionData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(value: number) => value.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'})} />
                              <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ChartContainer title="Top 5 Productos por Ganancia (Hoy)">
                     <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={dashboardData.top5Products} layout="vertical" margin={{left: 20}}>
                           <XAxis type="number" hide />
                           <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 11}} stroke={isDark ? '#A0AEC0' : '#4A5568'}/>
                           <Tooltip formatter={(value: number) => value.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'})} />
                           <Bar dataKey="profit" name="Ganancia" fill="#60A5FA" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title="Top 5 Clientes por Ganancia (Hoy)">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={dashboardData.top5Customers} layout="vertical" margin={{left: 20}}>
                           <XAxis type="number" hide />
                           <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 11}} stroke={isDark ? '#A0AEC0' : '#4A5568'}/>
                           <Tooltip formatter={(value: number) => value.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'})} />
                           <Bar dataKey="profit" name="Ganancia" fill="#A78BFA" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
                
                <InteligenciaFideo insights={insights} isLoading={isLoading} />
            </div>
        </div>
    );
};

export default Dashboard;
