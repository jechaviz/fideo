import React, { Suspense, lazy } from 'react';
import { BusinessData } from '../hooks/useBusinessData';
import { OneSignalPushController } from '../hooks/useOneSignalPush';
import RoleSwitcher from '../components/RoleSwitcher';

const CustomerView = lazy(() => import('../views/CustomerView'));
const SupplierView = lazy(() => import('../views/SupplierView'));

const PortalLoadingState: React.FC = () => (
    <div className="flex min-h-[320px] items-center justify-center rounded-[1.8rem] border border-white/10 bg-white/[0.03] px-6 py-12">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-transparent" />
            Cargando portal...
        </div>
    </div>
);

const PortalLayout: React.FC<{ data: BusinessData; push: OneSignalPushController }> = ({ data, push }) => {
    const { currentRole } = data;

    const renderPortalView = () => {
        switch (currentRole) {
            case 'Cliente': return <CustomerView data={data} />;
            case 'Proveedor': return <SupplierView data={data} />;
            default: return <div>Portal no disponible</div>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_24%),radial-gradient(circle_at_left,rgba(56,189,248,0.1),transparent_18%)]" />
            <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/72 backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-300">Portal</p>
                        <h1 className="mt-2 text-2xl font-black tracking-tight text-white">Fideo {currentRole}</h1>
                    </div>
                    <RoleSwitcher data={data} push={push} />
                </div>
            </header>
            <main className="relative">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="glass-panel-dark rounded-[2rem] p-4 md:p-6">
                        <Suspense fallback={<PortalLoadingState />}>{renderPortalView()}</Suspense>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PortalLayout;
