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
    patch: Partial<OneSignalPushState> = {},
): OneSignalPushState => ({
    ...previousState,
    ...readOneSignalPushState(),
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
            const nextState = readOneSignalPushState();
            setState((previousState) => mergeSdkState(previousState, { ...nextState, initError: '', lastError: '' }));
            return nextState;
        } catch (error) {
            const message = normalizeOneSignalError(error, 'No se pudo inicializar push.');
            const nextState = {
                ...createEmptyOneSignalPushState(),
                initError: message,
                lastError: message,
            };
            setState(nextState);
            return nextState;
        }
    }, []);

    const clearIdentity = useCallback(async () => {
        if (!oneSignalPushConfig.configured || !oneSignalPushConfig.enabled) return;

        try {
            await clearOneSignalIdentity();
            hadIdentityRef.current = false;
            setState((previousState) => mergeSdkState(previousState, { lastError: '' }));
        } catch (error) {
            const message = normalizeOneSignalError(error, 'No se pudo limpiar push al salir.');
            setState((previousState) => mergeSdkState(previousState, { lastError: message }));
            throw error;
        }
    }, []);

    const promptSubscription = useCallback(async () => {
        if (!identity || !authEnabled || sessionStatus !== 'authenticated') return false;

        setState((previousState) => ({ ...previousState, prompting: true, lastError: '' }));

        try {
            await optInOneSignalPush(identity);
            hadIdentityRef.current = true;
            const nextState = readOneSignalPushState();
            setState((previousState) => mergeSdkState(previousState, { ...nextState, prompting: false }));
            return Boolean(nextState.optedIn);
        } catch (error) {
            const message = normalizeOneSignalError(error, 'No se pudo activar push.');
            setState((previousState) => mergeSdkState(previousState, { prompting: false, lastError: message }));
            return false;
        }
    }, [authEnabled, identity, sessionStatus]);

    const optOut = useCallback(async () => {
        setState((previousState) => ({ ...previousState, prompting: true, lastError: '' }));

        try {
            await optOutOneSignalPush();
            const nextState = readOneSignalPushState();
            setState((previousState) => mergeSdkState(previousState, { ...nextState, prompting: false }));
            return !nextState.optedIn;
        } catch (error) {
            const message = normalizeOneSignalError(error, 'No se pudo desactivar push.');
            setState((previousState) => mergeSdkState(previousState, { prompting: false, lastError: message }));
            return false;
        }
    }, []);

    useEffect(() => {
        if (!authEnabled || sessionStatus !== 'authenticated' || !identity || !oneSignalPushConfig.enabled) {
            return;
        }

        let cancelled = false;

        const syncStateFromSdk = () => {
            if (cancelled) return;
            setState((previousState) => mergeSdkState(previousState));
        };

        const attachAndSync = async () => {
            setState((previousState) => ({ ...previousState, syncing: true, lastError: '' }));

            try {
                await ensureOneSignalReady();
                if (cancelled) return;

                OneSignal.Notifications.addEventListener('permissionChange', syncStateFromSdk);
                OneSignal.User.PushSubscription.addEventListener('change', syncStateFromSdk);
                OneSignal.User.addEventListener('change', syncStateFromSdk);

                await syncOneSignalIdentity(identity);
                if (cancelled) return;

                hadIdentityRef.current = true;
                setState((previousState) => mergeSdkState(previousState, { syncing: false, lastError: '' }));
            } catch (error) {
                if (cancelled) return;
                const message = normalizeOneSignalError(error, 'No se pudo sincronizar push.');
                setState((previousState) => mergeSdkState(previousState, { syncing: false, lastError: message }));
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
                setState((previousState) => mergeSdkState(previousState, { lastError: '' }));
            })
            .catch((error) => {
                if (cancelled) return;
                const message = normalizeOneSignalError(error, 'No se pudo limpiar push al cerrar sesion.');
                setState((previousState) => mergeSdkState(previousState, { lastError: message }));
            });

        return () => {
            cancelled = true;
        };
    }, [sessionStatus]);

    return {
        state,
        refreshState,
        promptSubscription,
        optOut,
        clearIdentity,
    };
};
