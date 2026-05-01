import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OneSignal from 'react-onesignal';
import type { AuthSessionProfile } from '../services/pocketbase/auth';
import type { RemoteWorkspaceSnapshot } from '../services/pocketbase/state';
import {
    buildOneSignalIdentity,
    clearOneSignalIdentity,
    createEmptyOneSignalPushState,
    ensureOneSignalReady,
    normalizeOneSignalError,
    oneSignalPushConfig,
    OneSignalPushState,
    optInOneSignalPush,
    optOutOneSignalPush,
    readOneSignalPushState,
    syncOneSignalIdentity,
} from '../services/onesignal/client';

type SessionStatus = 'disabled' | 'loading' | 'unauthenticated' | 'bootstrapping' | 'authenticated' | 'error';

interface UseOneSignalPushOptions {
    authEnabled: boolean;
    sessionStatus: SessionStatus;
    profile: AuthSessionProfile | null;
    workspace: RemoteWorkspaceSnapshot | null;
}

export interface OneSignalPushController {
    state: OneSignalPushState;
    refreshState: () => Promise<OneSignalPushState>;
    promptSubscription: () => Promise<boolean>;
    optOut: () => Promise<boolean>;
    clearIdentity: () => Promise<void>;
}

const mergeSdkState = (
    previousState: OneSignalPushState,
    identity: ReturnType<typeof buildOneSignalIdentity> = null,
    patch: Partial<OneSignalPushState> = {},
): OneSignalPushState => ({
    ...previousState,
    ...readOneSignalPushState(identity),
    ...patch,
});

export const useOneSignalPush = ({
    authEnabled,
    sessionStatus,
    profile,
    workspace,
}: UseOneSignalPushOptions): OneSignalPushController => {
    const [state, setState] = useState<OneSignalPushState>(() => createEmptyOneSignalPushState());
    const hadIdentityRef = useRef(false);

    const identity = useMemo(() => buildOneSignalIdentity(profile, workspace), [profile, workspace]);
    const identityKey = useMemo(() => JSON.stringify(identity || null), [identity]);

    const refreshState = useCallback(async () => {
        if (!oneSignalPushConfig.configured || !oneSignalPushConfig.enabled) {
            const nextState = createEmptyOneSignalPushState();
            setState(nextState);
            return nextState;
        }

        try {
            await ensureOneSignalReady();
            const nextState = readOneSignalPushState(identity);
            setState((previousState) => mergeSdkState(previousState, identity, { ...nextState, initError: '', lastError: '' }));
            return nextState;
        } catch (error) {
            const message = normalizeOneSignalError(error, 'No se pudo inicializar push.');
            const nextState = {
                ...createEmptyOneSignalPushState(),
                ...readOneSignalPushState(identity),
                initError: message,
                lastError: message,
                bindingStatus: 'error' as const,
                bindingMessage: message,
            };
            setState(nextState);
            return nextState;
        }
    }, [identity]);

    const clearIdentity = useCallback(async () => {
        if (!oneSignalPushConfig.configured || !oneSignalPushConfig.enabled) return;

        try {
            await clearOneSignalIdentity();
            hadIdentityRef.current = false;
            setState((previousState) => mergeSdkState(previousState, null, { lastError: '' }));
        } catch (error) {
            const message = normalizeOneSignalError(error, 'No se pudo limpiar push al salir.');
            setState((previousState) => mergeSdkState(previousState, null, { lastError: message, bindingStatus: 'error', bindingMessage: message }));
            throw error;
        }
    }, []);

    const promptSubscription = useCallback(async () => {
        if (!identity || !authEnabled || sessionStatus !== 'authenticated') return false;

        setState((previousState) => ({ ...previousState, prompting: true, syncing: true, lastError: '', bindingStatus: 'syncing', bindingMessage: 'Solicitando permiso...' }));

        try {
            await optInOneSignalPush(identity);
            hadIdentityRef.current = true;
            const nextState = readOneSignalPushState(identity);
            setState((previousState) => mergeSdkState(previousState, identity, { ...nextState, prompting: false, syncing: false }));
            return Boolean(nextState.optedIn);
        } catch (error) {
            const message = normalizeOneSignalError(error, 'No se pudo activar push.');
            setState((previousState) => mergeSdkState(previousState, identity, { prompting: false, syncing: false, lastError: message, bindingStatus: 'error', bindingMessage: message }));
            return false;
        }
    }, [authEnabled, identity, sessionStatus]);

    const optOut = useCallback(async () => {
        setState((previousState) => ({ ...previousState, prompting: true, syncing: true, lastError: '', bindingStatus: 'syncing', bindingMessage: 'Desenlazando push...' }));

        try {
            await optOutOneSignalPush();
            const nextState = readOneSignalPushState(identity);
            setState((previousState) => mergeSdkState(previousState, identity, { ...nextState, prompting: false, syncing: false }));
            return !nextState.optedIn;
        } catch (error) {
            const message = normalizeOneSignalError(error, 'No se pudo desactivar push.');
            setState((previousState) => mergeSdkState(previousState, identity, { prompting: false, syncing: false, lastError: message, bindingStatus: 'error', bindingMessage: message }));
            return false;
        }
    }, [identity]);

    useEffect(() => {
        if (!authEnabled || sessionStatus !== 'authenticated' || !identity || !oneSignalPushConfig.enabled) {
            return;
        }

        let cancelled = false;

        const syncStateFromSdk = () => {
            if (cancelled) return;
            setState((previousState) => mergeSdkState(previousState, identity));
        };

        const attachAndSync = async () => {
            setState((previousState) => ({
                ...previousState,
                syncing: true,
                lastError: '',
                bindingStatus: 'syncing',
                bindingMessage: identity.employeeId ? `Enlazando ${identity.employeeId}...` : 'Enlazando push...',
            }));

            try {
                await ensureOneSignalReady();
                if (cancelled) return;

                OneSignal.Notifications.addEventListener('permissionChange', syncStateFromSdk);
                OneSignal.User.PushSubscription.addEventListener('change', syncStateFromSdk);
                OneSignal.User.addEventListener('change', syncStateFromSdk);

                await syncOneSignalIdentity(identity);
                if (cancelled) return;

                hadIdentityRef.current = true;
                setState((previousState) => mergeSdkState(previousState, identity, { syncing: false, lastError: '' }));
            } catch (error) {
                if (cancelled) return;
                const message = normalizeOneSignalError(error, 'No se pudo sincronizar push.');
                setState((previousState) => mergeSdkState(previousState, identity, { syncing: false, lastError: message, bindingStatus: 'error', bindingMessage: message }));
            }
        };

        void attachAndSync();

        return () => {
            cancelled = true;
            OneSignal.Notifications.removeEventListener('permissionChange', syncStateFromSdk);
            OneSignal.User.PushSubscription.removeEventListener('change', syncStateFromSdk);
            OneSignal.User.removeEventListener('change', syncStateFromSdk);
        };
    }, [authEnabled, identity, identityKey, sessionStatus]);

    useEffect(() => {
        if (!oneSignalPushConfig.enabled) {
            setState(createEmptyOneSignalPushState());
            return;
        }

        if (sessionStatus !== 'unauthenticated' || !hadIdentityRef.current) {
            return;
        }

        let cancelled = false;

        void clearOneSignalIdentity()
            .then(() => {
                if (cancelled) return;
                hadIdentityRef.current = false;
                setState((previousState) => mergeSdkState(previousState, null, { lastError: '' }));
            })
            .catch((error) => {
                if (cancelled) return;
                const message = normalizeOneSignalError(error, 'No se pudo limpiar push al cerrar sesion.');
                setState((previousState) => mergeSdkState(previousState, null, { lastError: message, bindingStatus: 'error', bindingMessage: message }));
            });

        return () => {
            cancelled = true;
        };
    }, [sessionStatus]);

    useEffect(() => {
        if (!oneSignalPushConfig.enabled) return;
        setState((previousState) => {
            if (previousState.syncing) {
                return mergeSdkState(previousState, identity, {
                    bindingStatus: 'syncing',
                    bindingMessage: previousState.bindingMessage || 'Sincronizando push...',
                });
            }

            if (previousState.lastError || previousState.initError) {
                const message = previousState.lastError || previousState.initError;
                return mergeSdkState(previousState, identity, {
                    bindingStatus: 'error',
                    bindingMessage: message,
                });
            }

            return mergeSdkState(previousState, identity);
        });
    }, [identity, identityKey]);

    return {
        state,
        refreshState,
        promptSubscription,
        optOut,
        clearIdentity,
    };
};
