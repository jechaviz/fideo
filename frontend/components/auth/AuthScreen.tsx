import React, { useState } from 'react';

const inputClass =
    'w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20';

interface QuickAccessAccount {
    id: string;
    label: string;
    email: string;
    password: string;
}

const quickAccessAccounts: QuickAccessAccount[] = [
    {
        id: 'operacion',
        label: 'Operacion Fideo | Admin',
        email: 'operacion@fideo.local',
        password: 'FideoDev!2026',
    },
    {
        id: 'cliente-portal',
        label: 'Portal cliente',
        email: 'cliente.portal@fideo.local',
        password: 'FideoPortal!2026',
    },
    {
        id: 'proveedor-portal',
        label: 'Portal proveedor',
        email: 'proveedor.portal@fideo.local',
        password: 'FideoPortal!2026',
    },
];

export const AuthBootstrapScreen: React.FC<{
    title: string;
    detail: string;
    error?: string | null;
    onRetry?: () => void;
}> = ({ title, detail, error, onRetry }) => (
    <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.14),transparent_24%),radial-gradient(circle_at_left,rgba(56,189,248,0.12),transparent_20%)]" />
        <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
            <div className="glass-panel-dark w-full max-w-md rounded-[2rem] border border-white/10 p-6 shadow-panel">
                <p className="text-xs font-black text-white">{title}</p>
                <p className="mt-2 text-sm text-slate-400">{detail}</p>

                {!error ? (
                    <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-transparent" />
                        Preparando...
                    </div>
                ) : (
                    <div className="mt-6">
                        <div className="rounded-[1.4rem] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="mt-4 rounded-2xl bg-brand-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-brand-300"
                            >
                                Reintentar
                            </button>
                        )}
                    </div>
                )}
            </div>
        </main>
    </div>
);

const AuthScreen: React.FC<{
    onSubmit: (email: string, password: string) => Promise<void>;
    error?: string | null;
}> = ({ onSubmit, error }) => {
    const [selectedAccountId, setSelectedAccountId] = useState(quickAccessAccounts[0]?.id || '');
    const [email, setEmail] = useState(quickAccessAccounts[0]?.email || '');
    const [password, setPassword] = useState(quickAccessAccounts[0]?.password || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const applyQuickAccessAccount = (accountId: string) => {
        setSelectedAccountId(accountId);
        const account = quickAccessAccounts.find((item) => item.id === accountId);
        if (!account) return;
        setEmail(account.email);
        setPassword(account.password);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit(email, password);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.16),transparent_24%),radial-gradient(circle_at_left,rgba(56,189,248,0.12),transparent_18%)]" />
            <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
                <div className="glass-panel-dark w-full max-w-md rounded-[2.2rem] border border-white/10 p-6 shadow-panel md:p-7">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-brand-400 shadow-[0_0_16px_rgba(163,230,53,0.7)]"></div>
                        <p className="text-sm font-black text-white">Fideo</p>
                    </div>

                    <h1 className="text-3xl font-black tracking-tight text-white">Entrar</h1>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div>
                            <label htmlFor="quick-account" className="sr-only">
                                Usuario
                            </label>
                            <select
                                id="quick-account"
                                value={selectedAccountId}
                                onChange={(event) => applyQuickAccessAccount(event.target.value)}
                                className={inputClass}
                            >
                                {quickAccessAccounts.map((account) => (
                                    <option key={account.id} value={account.id} className="bg-slate-950 text-slate-100">
                                        {account.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="email" className="sr-only">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className={inputClass}
                                placeholder="Email"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className={inputClass}
                                placeholder="Password"
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        {error ? <div className="rounded-[1.4rem] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-400 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                                    Entrando...
                                </>
                            ) : (
                                'Entrar'
                            )}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AuthScreen;
