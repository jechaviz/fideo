import React, { useMemo, useState } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { Sale } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Line, ComposedChart } from 'recharts';
import { SparklesIcon } from './icons/Icons';

type OperationalTaskStatus = 'assigned' | 'acknowledged' | 'in_progress' | 'blocked' | 'done';
type OperationalTaskStage = 'packing' | 'assignment' | 'route' | 'other';
type LooseRecord = Record<string, unknown>;
type DashboardTask = { saleId?: string; stage: OperationalTaskStage; status: OperationalTaskStatus };

const saleStatusToStageMap: Partial<Record<Sale['status'], OperationalTaskStage>> = {
    'Pendiente de Empaque': 'packing',
    'Listo para Entrega': 'assignment',
    'En Ruta': 'route',
};

const saleStatusToTaskStatusMap: Partial<Record<Sale['status'], OperationalTaskStatus>> = {
    'Pendiente de Empaque': 'assigned',
    'Listo para Entrega': 'assigned',
    'En Ruta': 'in_progress',
    Completado: 'done',
    Cancelado: 'done',
};

const asRecord = (value: unknown): LooseRecord | null => (value && typeof value === 'object' ? (value as LooseRecord) : null);

const readString = (sources: Array<LooseRecord | null>, keys: string[]) => {
    for (const source of sources) {
        if (!source) continue;
        for (const key of keys) {
            const value = source[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
    }
    return undefined;
};

const normalizeTaskStatus = (value: unknown): OperationalTaskStatus | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (normalized === 'assigned' || normalized === 'acknowledged' || normalized === 'in_progress' || normalized === 'blocked' || normalized === 'done') {
        return normalized;
    }
    if (normalized === 'inprogress') return 'in_progress';
    if (normalized === 'pending' || normalized === 'todo') return 'assigned';
    if (normalized === 'started' || normalized === 'active') return 'in_progress';
    return undefined;
};

const inferTaskStage = (signals: string[], sale?: Sale): OperationalTaskStage => {
    const haystack = signals.join(' ').toLowerCase();
    if (/(pack|empaque|empacar|picker|prepar)/.test(haystack)) return 'packing';
    if (/(assign|asign|dispatch|driver|repartidor)/.test(haystack)) return 'assignment';
    if (/(route|ruta|delivery|entrega|reparto|en_ruta)/.test(haystack)) return 'route';
    if (sale) return saleStatusToStageMap[sale.status] || 'other';
    return 'other';
};

const buildDashboardTask = (input: unknown, sales: Sale[]): DashboardTask | null => {
    const task = asRecord(input);
    if (!task) return null;

    const saleRecord = asRecord(task.sale);
    const sources = [task, asRecord(task.payload), asRecord(task.context), asRecord(task.metadata), saleRecord, asRecord(task.assignee), asRecord(task.owner)];
    const saleId = readString(sources, ['saleId', 'relatedSaleId', 'orderId', 'order_id', 'relatedId']) || (typeof saleRecord?.id === 'string' ? saleRecord.id : undefined);
    const sale = saleId ? sales.find((item) => item.id === saleId) : undefined;
    const stageSignals = [
        readString(sources, ['taskType', 'type', 'kind', 'category', 'operation', 'stage', 'workflow']),
        readString(sources, ['title', 'label', 'name']),
        readString(sources, ['description', 'summary']),
        sale?.status,
    ].filter((value): value is string => Boolean(value));

    const status =
        normalizeTaskStatus(readString(sources, ['status', 'state'])) ||
        (sale ? saleStatusToTaskStatusMap[sale.status] : undefined) ||
        'assigned';

    if (status === 'done') return null;

    return {
        saleId,
        stage: inferTaskStage(stageSignals, sale),
        status,
    };
};

const buildDashboardTaskFromSale = (sale: Sale): DashboardTask | null => {
    const stage = saleStatusToStageMap[sale.status];
    const status = saleStatusToTaskStatusMap[sale.status];
    if (!stage || !status || status === 'done') return null;
    return { saleId: sale.id, stage, status };
};

const KpiCard: React.FC<{ title: string; value: string; subtext?: string; icon: string; accent: string }> = ({ title, value, subtext, icon, accent }) => (
    <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{title}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
                {subtext && <p className="mt-2 text-sm text-slate-400">{subtext}</p>}
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${accent}`}>
                <i className={`fa-solid ${icon} text-lg`}></i>
            </div>
        </div>
    </div>
);

const ChartContainer: React.FC<{ title: string; eyebrow: string; children: React.ReactNode }> = ({ title, eyebrow, children }) => (
    <div className="glass-panel-dark rounded-[2rem] border border-white/10 p-5">
        <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-white">{title}</h2>
        </div>
        <div className="h-72">
            {children}
        </div>
    </div>
);

const InteligenciaFideo: React.FC<{ insights: string; isLoading: boolean }> = ({ insights, isLoading }) => {
    return (
        <div className="rounded-[2rem] border border-brand-400/20 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.18),transparent_45%),rgba(15,23,42,0.88)] p-5 shadow-glow">
            <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400 text-slate-950">
                    <SparklesIcon />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-200/70">Motor Fideo</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-white">Inteligencia comercial</h2>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center text-slate-300">
                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3">
                        <div className="h-5 w-5 rounded-full border-2 border-brand-200 border-t-transparent animate-spin"></div>
                        <span className="text-sm font-semibold">Analizando actividad...</span>
                    </div>
                </div>
            ) : insights ? (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-200 prose-headings:text-white prose-strong:text-white prose-li:text-slate-200" dangerouslySetInnerHTML={{ __html: insights.replace(/\* (.*)/g, '<li class="ml-4">$1</li>') }} />
            ) : (
                <div className="flex h-64 flex-col items-center justify-center text-center text-slate-300">
                    <p className="max-w-xs text-base font-semibold text-white">Activa la lectura diaria para detectar oportunidades de venta, margen e inventario.</p>
                    <p className="mt-3 max-w-sm text-sm text-slate-400">Fideo sintetiza lo mas importante del dia con foco en decisiones rapidas.</p>
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC<{ data: BusinessData }> = ({ data }) => {
    const { sales, inventory, productGroups, theme } = data;
    const taskAssignments = ((data as BusinessData & { taskAssignments?: unknown }).taskAssignments ?? []) as unknown[];
    const isDark = theme === 'dark';
    const [insights, setInsights] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const generateInsights = async () => {
        setIsLoading(true);
        setInsights('');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todaySales = sales.filter((s) => new Date(s.timestamp) >= today);

            const profitByCustomer = todaySales.reduce((acc, sale) => {
                acc[sale.customer] = (acc[sale.customer] || 0) + (sale.price - sale.cogs);
                return acc;
            }, {} as Record<string, number>);
            const topCustomers = Object.entries(profitByCustomer).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

            const profitByProduct = todaySales.reduce((acc, sale) => {
                const productName = `${sale.varietyName} ${sale.size}`;
                acc[productName] = (acc[productName] || 0) + (sale.price - sale.cogs);
                return acc;
            }, {} as Record<string, number>);
            const topProducts = Object.entries(profitByProduct).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

            const dailyStats = {
                ventas: todaySales.reduce((sum, s) => sum + s.price, 0),
                ganancia: todaySales.reduce((sum, s) => sum + (s.price - s.cogs), 0),
                margen: 0,
                topCustomers,
                topProducts,
            };
            dailyStats.margen = dailyStats.ventas > 0 ? (dailyStats.ganancia / dailyStats.ventas) * 100 : 0;

            const inventorySummary = inventory.slice(0, 5).map((item) => {
                const varietyInfo = productGroups.flatMap((pg) => pg.varieties).find((v) => v.id === item.varietyId);
                return {
                    name: `${varietyInfo?.name || item.varietyId} ${item.size}`,
                    quantity: item.quantity,
                    daysOnHand: 10,
                };
            });

            const { generateBusinessInsights } = await import('../services/geminiService');
            const result = await generateBusinessInsights(dailyStats, inventorySummary);
            setInsights(result);
        } catch {
            setInsights('Error al generar insights. Revisa la conexion con la API.');
        } finally {
            setIsLoading(false);
        }
    };

    const dashboardData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySales = sales.filter((s) => new Date(s.timestamp) >= today);
        const normalizedTasks = Array.isArray(taskAssignments)
            ? taskAssignments
                  .map((task) => buildDashboardTask(task, sales))
                  .filter((task): task is DashboardTask => Boolean(task))
            : [];
        const coveredStages = new Set(
            normalizedTasks
                .filter((task) => task.saleId)
                .map((task) => `${task.saleId}:${task.stage}`),
        );
        const fallbackTasks = sales
            .map((sale) => buildDashboardTaskFromSale(sale))
            .filter((task): task is DashboardTask => Boolean(task))
            .filter((task) => !task.saleId || !coveredStages.has(`${task.saleId}:${task.stage}`));
        const operationalTasks = [...normalizedTasks, ...fallbackTasks];

        const ventasHoy = todaySales.reduce((sum, s) => sum + s.price, 0);
        const profitHoy = todaySales.reduce((sum, s) => sum + (s.price - s.cogs), 0);
        const margenBrutoHoy = ventasHoy > 0 ? (profitHoy / ventasHoy) * 100 : 0;
        const ticketPromedio = todaySales.length > 0 ? ventasHoy / todaySales.length : 0;
        const taskSignals = operationalTasks.reduce(
            (accumulator, task) => {
                accumulator.open += 1;
                accumulator[task.status] += 1;
                accumulator.byStage[task.stage] += 1;
                return accumulator;
            },
            {
                open: 0,
                assigned: 0,
                acknowledged: 0,
                in_progress: 0,
                blocked: 0,
                done: 0,
                byStage: { packing: 0, assignment: 0, route: 0, other: 0 } as Record<OperationalTaskStage, number>,
            } as {
                open: number;
                assigned: number;
                acknowledged: number;
                in_progress: number;
                blocked: number;
                done: number;
                byStage: Record<OperationalTaskStage, number>;
            },
        );

        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 6);
        last7Days.setHours(0, 0, 0, 0);
        const recentSales = sales.filter((s) => new Date(s.timestamp) >= last7Days);
        const salesByDay = Array(7).fill(0).map((_, i) => {
            const d = new Date(last7Days);
            d.setDate(d.getDate() + i);
            return { name: d.toLocaleDateString('es-MX', { weekday: 'short' }), ventas: 0, ganancia: 0 };
        });
        recentSales.forEach((s) => {
            const dayIndex = Math.floor((new Date(s.timestamp).getTime() - last7Days.getTime()) / (1000 * 3600 * 24));
            if (dayIndex >= 0 && dayIndex < 7) {
                salesByDay[dayIndex].ventas += s.price;
                salesByDay[dayIndex].ganancia += (s.price - s.cogs);
            }
        });

        const salesByCategory = todaySales.reduce((acc, sale) => {
            const category = productGroups.find((pg) => pg.id === sale.productGroupId)?.category || 'Otro';
            acc[category] = (acc[category] || 0) + sale.price;
            return acc;
        }, {} as Record<string, number>);
        const salesCompositionData = Object.entries(salesByCategory).map(([name, value]) => ({ name, value }));

        const profitByProduct = todaySales.reduce((acc, sale) => {
            const productName = `${sale.varietyName} ${sale.size}`;
            acc[productName] = (acc[productName] || 0) + (sale.price - sale.cogs);
            return acc;
        }, {} as Record<string, number>);
        const top5Products = Object.entries(profitByProduct).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 5).map(([name, profit]) => ({ name, profit }));

        const profitByCustomer = todaySales.reduce((acc, sale) => {
            acc[sale.customer] = (acc[sale.customer] || 0) + (sale.price - sale.cogs);
            return acc;
        }, {} as Record<string, number>);
        const top5Customers = Object.entries(profitByCustomer).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 5).map(([name, profit]) => ({ name, profit }));

        const unidadesActivas = inventory.reduce((sum, batch) => sum + batch.quantity, 0);

        return {
            ventasHoy,
            margenBrutoHoy,
            ticketPromedio,
            taskSignals,
            salesByDay,
            salesCompositionData,
            top5Products,
            top5Customers,
            unidadesActivas,
            ventasRegistradas: todaySales.length,
        };
    }, [inventory, productGroups, sales, taskAssignments]);

    const PIE_COLORS = ['#a3e635', '#38bdf8', '#f59e0b', '#22c55e', '#fb7185'];
    const axisColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.16)';
    const tooltipStyle = {
        backgroundColor: isDark ? 'rgba(2, 6, 23, 0.95)' : '#ffffff',
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(148,163,184,0.2)',
        borderRadius: '18px',
        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)',
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.16),transparent_35%),rgba(15,23,42,0.92)] p-6 shadow-panel md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-brand-300">Control diario</p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">La operacion del dia en una sola lectura.</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Ventas, inventario y cola operativa en el mismo primer pantallazo.</p>
                    </div>

                    <div className="flex flex-col gap-3 lg:min-w-[360px]">
                        <button onClick={generateInsights} disabled={isLoading} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-400 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-70">
                            {isLoading ? <div className="h-5 w-5 rounded-full border-2 border-slate-900 border-t-transparent animate-spin"></div> : <SparklesIcon />}
                            <span>{isLoading ? 'Analizando...' : 'Analizar ahora'}</span>
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Pendientes</p>
                                <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.assigned}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Acuses</p>
                                <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.acknowledged}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Bloqueos</p>
                                <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.blocked}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">En curso</p>
                                <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.in_progress}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="Ventas de hoy" value={dashboardData.ventasHoy.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} subtext="Facturacion registrada en el dia." icon="fa-sack-dollar" accent="border-brand-400/40 bg-brand-400/10 text-brand-200" />
                <KpiCard title="Margen bruto" value={`${dashboardData.margenBrutoHoy.toFixed(1)}%`} subtext="Rentabilidad promedio del dia." icon="fa-percent" accent="border-sky-400/40 bg-sky-400/10 text-sky-200" />
                <KpiCard title="Ticket promedio" value={dashboardData.ticketPromedio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} subtext="Valor por salida comercial." icon="fa-file-invoice-dollar" accent="border-amber-400/40 bg-amber-400/10 text-amber-200" />
                <KpiCard title="Tareas abiertas" value={dashboardData.taskSignals.open.toString()} subtext="Empaque, asignacion y ruta sin cerrar." icon="fa-box-check" accent="border-violet-400/40 bg-violet-400/10 text-violet-200" />
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="glass-panel-dark rounded-[1.6rem] border border-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Empaque</p>
                    <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.byStage.packing}</p>
                </div>
                <div className="glass-panel-dark rounded-[1.6rem] border border-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Asignacion</p>
                    <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.byStage.assignment}</p>
                </div>
                <div className="glass-panel-dark rounded-[1.6rem] border border-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Ruta</p>
                    <p className="mt-2 text-2xl font-black text-white">{dashboardData.taskSignals.byStage.route}</p>
                </div>
                <div className="glass-panel-dark rounded-[1.6rem] border border-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Ventas hoy</p>
                    <p className="mt-2 text-2xl font-black text-white">{dashboardData.ventasRegistradas}</p>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <ChartContainer title="Ventas y ganancia" eyebrow="Ultimos 7 dias">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <ComposedChart data={dashboardData.salesByDay}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                <XAxis dataKey="name" stroke={axisColor} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" stroke={axisColor} tick={{ fontSize: 10 }} tickFormatter={(val) => `$${Number(val) / 1000}k`} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), name]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar yAxisId="left" dataKey="ventas" name="Ventas" fill="#a3e635" radius={[10, 10, 0, 0]} />
                                <Line yAxisId="left" type="monotone" dataKey="ganancia" name="Ganancia" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3, fill: '#38bdf8' }} activeDot={{ r: 5 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
                <ChartContainer title="Composicion de ventas" eyebrow="Mix de categorias">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <PieChart>
                            <Pie data={dashboardData.salesCompositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={94} paddingAngle={5}>
                                {dashboardData.salesCompositionData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <ChartContainer title="Productos mas rentables" eyebrow="Top 5 de hoy">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={dashboardData.top5Products} layout="vertical" margin={{ left: 16 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke={axisColor} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} />
                            <Bar dataKey="profit" name="Ganancia" fill="#38bdf8" radius={[0, 10, 10, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title="Clientes mas rentables" eyebrow="Top 5 de hoy">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={dashboardData.top5Customers} layout="vertical" margin={{ left: 16 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke={axisColor} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} />
                            <Bar dataKey="profit" name="Ganancia" fill="#f59e0b" radius={[0, 10, 10, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>

                <InteligenciaFideo insights={insights} isLoading={isLoading} />
            </section>
        </div>
    );
};

export default Dashboard;
