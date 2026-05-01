import React, { Suspense, lazy, useCallback, useEffect } from 'react';
import AuthScreen, { AuthBootstrapScreen } from './components/auth/AuthScreen';
import { useBusinessData } from './hooks/useBusinessData';
import { useOneSignalPush } from './hooks/useOneSignalPush';
import { usePocketBaseSession } from './hooks/usePocketBaseSession';
import { canPersistRemoteStateForProfile } from './services/pocketbase/auth';
import { getBusinessDataStorageKey } from './services/pocketbase/state';
import { UserRole } from './types';

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const PortalLayout = lazy(() => import('./layouts/PortalLayout'));

const App: React.FC = () => {
    const session = usePocketBaseSession();
    const push = useOneSignalPush({
        authEnabled: session.enabled,
        sessionStatus: session.status,
        profile: session.profile,
        workspace: session.workspace,
    });

    const handleSignOut = useCallback(() => {
        void push
            .clearIdentity()
            .catch((error) => {
                console.error('No se pudo limpiar OneSignal al cerrar sesion.', error);
            })
            .finally(() => {
                session.signOut();
            });
    }, [push, session]);

    const businessData = useBusinessData({
        storageKey: getBusinessDataStorageKey(session.profile?.id || 'local'),
        hydratedSnapshot: session.workspace?.snapshot || null,
        hydrationKey: session.workspace ? `${session.workspace.workspaceId}:${session.workspace.version}` : null,
        authProfile: session.profile,
        authEnabled: session.enabled,
        authError: session.status === 'authenticated' ? session.error : null,
        workspaceLabel: session.workspace?.workspaceSlug || null,
        remoteVersion: session.workspace?.version || 0,
        onPersistRemoteState:
            session.enabled && session.status === 'authenticated' && canPersistRemoteStateForProfile(session.profile)
                ? session.persistSnapshot
                : undefined,
        onApproveRemoteInterpretation:
            session.enabled && session.status === 'authenticated' && canPersistRemoteStateForProfile(session.profile)
                ? session.approveInterpretation
                : undefined,
        onInterpretRemoteMessage:
            session.enabled && session.status === 'authenticated' && canPersistRemoteStateForProfile(session.profile)
                ? session.interpretMessage
                : undefined,
        onCorrectRemoteInterpretation:
            session.enabled && session.status === 'authenticated' && canPersistRemoteStateForProfile(session.profile)
                ? session.correctInterpretation
                : undefined,
        onRevertRemoteInterpretation:
            session.enabled && session.status === 'authenticated' && canPersistRemoteStateForProfile(session.profile)
                ? session.revertInterpretation
                : undefined,
        onSignOut: handleSignOut,
    });

    const { currentRole, theme } = businessData;

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    const isInternalRole = (role: UserRole): boolean => ['Admin', 'Empacador', 'Repartidor', 'Cajero'].includes(role);

    if (session.enabled) {
        if (session.status === 'loading' || session.status === 'bootstrapping') {
            return <AuthBootstrapScreen title="Conectando" detail="Cargando datos." />;
        }

        if (session.status === 'error') {
            return <AuthBootstrapScreen title="Sin conexion" detail="No pudimos conectar." error={session.error} onRetry={() => void session.retry()} />;
        }

        if (session.status === 'unauthenticated') {
            return <AuthScreen onSubmit={session.signIn} error={session.error} />;
        }
    }

    if (isInternalRole(currentRole)) {
        return (
            <Suspense fallback={<AuthBootstrapScreen title="Abriendo" detail="Cargando panel." />}>
                <AdminLayout data={businessData} push={push} />
            </Suspense>
        );
    }

    return (
        <Suspense fallback={<AuthBootstrapScreen title="Abriendo" detail="Cargando portal." />}>
            <PortalLayout data={businessData} push={push} />
        </Suspense>
    );
};

export default App;
