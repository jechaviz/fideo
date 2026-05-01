import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AuthSessionProfile,
    clearAuthSession,
    mergeAuthSessionProfiles,
    restoreAuthProfile,
    signInWithPassword,
} from '../services/pocketbase/auth';
import { isPocketBaseEnabled } from '../services/pocketbase/client';
import { Message } from '../types';
import {
    approveRemoteWorkspaceInterpretation,
    ApproveInterpretationResult,
    bootstrapRemoteWorkspace,
    correctRemoteWorkspaceInterpretation,
    CorrectInterpretationResult,
    interpretRemoteWorkspaceMessage,
    InterpretMessageResult,
    isPocketBaseRouteUnavailable,
    normalizePocketBaseError,
    PersistableBusinessState,
    PersistResult,
    persistRemoteWorkspaceSnapshot,
    PocketBaseSyncError,
    revertRemoteWorkspaceInterpretation,
    RevertInterpretationResult,
    RemoteWorkspaceSnapshot,
} from '../services/pocketbase/state';

type SessionStatus = 'disabled' | 'loading' | 'unauthenticated' | 'bootstrapping' | 'authenticated' | 'error';

interface SessionState {
    status: SessionStatus;
    profile: AuthSessionProfile | null;
    workspace: RemoteWorkspaceSnapshot | null;
    error: string | null;
}

interface QueuedPersistSnapshot {
    snapshot: PersistableBusinessState;
    expectedVersion: number;
    epoch: number;
}

const buildSyntheticPersistResult = (version: number, snapshotRecordId = ''): PersistResult => ({
    version,
    snapshotRecordId,
    updatedAt: new Date().toISOString(),
});

const areSnapshotsEqual = (left: Record<string, unknown> | null | undefined, right: Record<string, unknown> | null | undefined) => {
    try {
        return JSON.stringify(left || {}) === JSON.stringify(right || {});
    } catch {
        return false;
    }
};

export const usePocketBaseSession = () => {
    const enabled = useMemo(() => isPocketBaseEnabled(), []);
    const [sessionState, setSessionState] = useState<SessionState>({
        status: enabled ? 'loading' : 'disabled',
        profile: null,
        workspace: null,
        error: null,
    });

    const profileRef = useRef<AuthSessionProfile | null>(null);
    const workspaceRef = useRef<RemoteWorkspaceSnapshot | null>(null);
    const pendingPersistRef = useRef<QueuedPersistSnapshot | null>(null);
    const workspaceEpochRef = useRef(0);
    const persistSequenceRef = useRef<Promise<void>>(Promise.resolve());
    const remoteCorrectionRouteAvailableRef = useRef(true);
    const remoteInterpretationRouteAvailableRef = useRef(true);
    const remoteRevertRouteAvailableRef = useRef(true);

    useEffect(() => {
        profileRef.current = sessionState.profile;
    }, [sessionState.profile]);

    useEffect(() => {
        workspaceRef.current = sessionState.workspace;
    }, [sessionState.workspace]);

    const resetWorkspaceSession = useCallback((status: SessionStatus, error: string | null) => {
        profileRef.current = null;
        workspaceRef.current = null;
        pendingPersistRef.current = null;
        remoteCorrectionRouteAvailableRef.current = true;
        remoteInterpretationRouteAvailableRef.current = true;
        remoteRevertRouteAvailableRef.current = true;
        workspaceEpochRef.current += 1;
        setSessionState({
            status,
            profile: null,
            workspace: null,
            error,
        });
    }, []);

    const setAuthenticatedWorkspace = useCallback(
        (
            workspace: RemoteWorkspaceSnapshot,
            error: string | null = null,
            fallbackProfile: AuthSessionProfile | null = profileRef.current,
        ) => {
            const resolvedProfile = mergeAuthSessionProfiles(workspace.profile, fallbackProfile);
            const resolvedWorkspace = resolvedProfile ? { ...workspace, profile: resolvedProfile } : workspace;

            profileRef.current = resolvedWorkspace.profile;
            workspaceRef.current = resolvedWorkspace;
            pendingPersistRef.current = null;
            remoteCorrectionRouteAvailableRef.current = true;
            remoteInterpretationRouteAvailableRef.current = true;
            remoteRevertRouteAvailableRef.current = true;
            workspaceEpochRef.current += 1;
            setSessionState({
                status: 'authenticated',
                profile: resolvedWorkspace.profile,
                workspace: resolvedWorkspace,
                error,
            });
            return resolvedWorkspace;
        },
        [],
    );

    const setAuthenticatedError = useCallback((error: string | null) => {
        setSessionState((previous) => {
            if (previous.status !== 'authenticated') return previous;
            return {
                ...previous,
                error,
            };
        });
    }, []);

    const loadWorkspace = useCallback(
        async (options: { showBootstrapping?: boolean; errorAfterLoad?: string | null; fallbackProfile?: AuthSessionProfile | null } = {}) => {
            if (options.showBootstrapping) {
                setSessionState((previous) => ({ ...previous, status: 'bootstrapping', error: null }));
            }
            const workspace = await bootstrapRemoteWorkspace();
            return setAuthenticatedWorkspace(workspace, options.errorAfterLoad ?? null, options.fallbackProfile ?? profileRef.current);
        },
        [setAuthenticatedWorkspace],
    );

    const enqueuePersistTask = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
        const nextTask = persistSequenceRef.current.then(task, task);
        persistSequenceRef.current = nextTask.then(
            () => undefined,
            () => undefined,
        );
        return nextTask;
    }, []);

    const persistSnapshotNow = useCallback(
        async (snapshot: PersistableBusinessState, expectedVersion: number, epoch: number): Promise<PersistResult> => {
            if (epoch !== workspaceEpochRef.current) {
                throw new PocketBaseSyncError(
                    'Se descarto un guardado pendiente porque el workspace ya se habia recargado desde PocketBase.',
                    {
                        code: 'conflict',
                        status: 409,
                        retryable: false,
                    },
                );
            }

            const workspace = workspaceRef.current;
            const workspaceId = workspace?.workspaceId;
            if (!enabled || !workspaceId) {
                return buildSyntheticPersistResult(expectedVersion, workspace?.snapshotRecordId || '');
            }

            const versionToUse = Math.max(expectedVersion, workspace.version);
            if (versionToUse === workspace.version && areSnapshotsEqual(snapshot, workspace.snapshot)) {
                pendingPersistRef.current = null;
                return buildSyntheticPersistResult(workspace.version, workspace.snapshotRecordId);
            }

            try {
                const result = await persistRemoteWorkspaceSnapshot(workspaceId, snapshot, versionToUse);
                pendingPersistRef.current = null;
                setSessionState((previous) => {
                    if (!previous.workspace || previous.workspace.workspaceId !== workspaceId) return previous;

                    const updatedWorkspace: RemoteWorkspaceSnapshot = {
                        ...previous.workspace,
                        snapshotRecordId: result.snapshotRecordId,
                        version: result.version,
                        snapshot,
                    };

                    workspaceRef.current = updatedWorkspace;

                    return {
                        ...previous,
                        error: null,
                        workspace: updatedWorkspace,
                    };
                });
                return result;
            } catch (error) {
                const normalizedError = normalizePocketBaseError(error, 'No se pudo persistir el snapshot en PocketBase.');

                if (normalizedError.code === 'offline' || normalizedError.code === 'cancelled') {
                    pendingPersistRef.current = {
                        snapshot,
                        expectedVersion: versionToUse,
                        epoch,
                    };
                    setAuthenticatedError(normalizedError.message);
                    throw normalizedError;
                }

                if (normalizedError.code === 'conflict') {
                    const conflictMessage = 'El workspace remoto cambio antes de guardar. Recargamos la version mas reciente de PocketBase.';

                    try {
                        await loadWorkspace({ errorAfterLoad: conflictMessage });
                    } catch (refreshError) {
                        const normalizedRefreshError = normalizePocketBaseError(
                            refreshError,
                            'No se pudo recargar el workspace despues del conflicto de version.',
                        );
                        setAuthenticatedError(normalizedRefreshError.message);
                        throw normalizedRefreshError;
                    }

                    throw new PocketBaseSyncError(conflictMessage, {
                        code: normalizedError.code,
                        status: normalizedError.status,
                        retryable: false,
                        conflictVersion: normalizedError.conflictVersion,
                        snapshotRecordId: normalizedError.snapshotRecordId,
                        cause: normalizedError,
                    });
                }

                setAuthenticatedError(normalizedError.message);
                throw normalizedError;
            }
        },
        [enabled, loadWorkspace, setAuthenticatedError],
    );

    const approveInterpretationNow = useCallback(
        async (
            snapshot: PersistableBusinessState,
            messageId: string,
            message: Message,
            expectedVersion: number,
            epoch: number,
        ): Promise<ApproveInterpretationResult> => {
            if (epoch !== workspaceEpochRef.current) {
                throw new PocketBaseSyncError(
                    'Se descarto una aprobacion pendiente porque el workspace ya se habia recargado desde PocketBase.',
                    {
                        code: 'conflict',
                        status: 409,
                        retryable: false,
                    },
                );
            }

            const workspace = workspaceRef.current;
            const workspaceId = workspace?.workspaceId;
            if (!enabled || !workspaceId) {
                throw new PocketBaseSyncError('No hay un workspace remoto listo para aprobar acciones.', {
                    code: 'forbidden',
                    status: 403,
                    retryable: false,
                });
            }

            const versionToUse = Math.max(expectedVersion, workspace.version);

            try {
                const result = await approveRemoteWorkspaceInterpretation(
                    workspaceId,
                    snapshot,
                    messageId,
                    message,
                    versionToUse,
                );

                pendingPersistRef.current = null;
                setSessionState((previous) => {
                    if (!previous.workspace || previous.workspace.workspaceId !== workspaceId) return previous;

                    const updatedWorkspace: RemoteWorkspaceSnapshot = {
                        ...previous.workspace,
                        snapshotRecordId: result.snapshotRecordId,
                        version: result.version,
                        snapshot: result.snapshot,
                    };

                    workspaceRef.current = updatedWorkspace;

                    return {
                        ...previous,
                        error: null,
                        workspace: updatedWorkspace,
                    };
                });

                return result;
            } catch (error) {
                const normalizedError = normalizePocketBaseError(error, 'No se pudo aprobar la accion en PocketBase.');

                if (normalizedError.code === 'conflict') {
                    const conflictMessage = 'El workspace remoto cambio antes de aprobar la accion. Recargamos la version mas reciente de PocketBase.';

                    try {
                        await loadWorkspace({ errorAfterLoad: conflictMessage });
                    } catch (refreshError) {
                        const normalizedRefreshError = normalizePocketBaseError(
                            refreshError,
                            'No se pudo recargar el workspace despues del conflicto de version.',
                        );
                        setAuthenticatedError(normalizedRefreshError.message);
                        throw normalizedRefreshError;
                    }

                    throw new PocketBaseSyncError(conflictMessage, {
                        code: normalizedError.code,
                        status: normalizedError.status,
                        retryable: false,
                        conflictVersion: normalizedError.conflictVersion,
                        snapshotRecordId: normalizedError.snapshotRecordId,
                        cause: normalizedError,
                    });
                }

                setAuthenticatedError(normalizedError.message);
                throw normalizedError;
            }
        },
        [enabled, loadWorkspace, setAuthenticatedError],
    );

    const interpretMessageNow = useCallback(
        async (
            snapshot: PersistableBusinessState,
            messageId: string,
            message: Message,
            expectedVersion: number,
            epoch: number,
        ): Promise<InterpretMessageResult | null> => {
            if (epoch !== workspaceEpochRef.current) {
                throw new PocketBaseSyncError(
                    'Se descarto una interpretacion pendiente porque el workspace ya se habia recargado desde PocketBase.',
                    {
                        code: 'conflict',
                        status: 409,
                        retryable: false,
                    },
                );
            }

            const workspace = workspaceRef.current;
            const workspaceId = workspace?.workspaceId;
            if (!enabled || !workspaceId || !remoteInterpretationRouteAvailableRef.current) {
                return null;
            }

            const versionToUse = Math.max(expectedVersion, workspace.version);

            try {
                const result = await interpretRemoteWorkspaceMessage(
                    workspaceId,
                    snapshot,
                    messageId,
                    message,
                    versionToUse,
                );

                if (result.snapshot && typeof result.version === 'number') {
                    setSessionState((previous) => {
                        if (!previous.workspace || previous.workspace.workspaceId !== workspaceId) return previous;

                        const updatedWorkspace: RemoteWorkspaceSnapshot = {
                            ...previous.workspace,
                            snapshotRecordId: result.snapshotRecordId || previous.workspace.snapshotRecordId,
                            version: result.version,
                            snapshot: result.snapshot,
                        };

                        workspaceRef.current = updatedWorkspace;

                        return {
                            ...previous,
                            error: null,
                            workspace: updatedWorkspace,
                        };
                    });
                } else {
                    setAuthenticatedError(null);
                }

                return result;
            } catch (error) {
                if (isPocketBaseRouteUnavailable(error)) {
                    remoteInterpretationRouteAvailableRef.current = false;
                    return null;
                }

                const normalizedError = normalizePocketBaseError(error, 'No se pudo interpretar el mensaje en PocketBase.');

                if (normalizedError.code === 'conflict') {
                    const conflictMessage = 'El workspace remoto cambio antes de interpretar el mensaje. Recargamos la version mas reciente de PocketBase.';

                    try {
                        await loadWorkspace({ errorAfterLoad: conflictMessage });
                    } catch (refreshError) {
                        const normalizedRefreshError = normalizePocketBaseError(
                            refreshError,
                            'No se pudo recargar el workspace despues del conflicto de interpretacion.',
                        );
                        setAuthenticatedError(normalizedRefreshError.message);
                        throw normalizedRefreshError;
                    }

                    throw new PocketBaseSyncError(conflictMessage, {
                        code: normalizedError.code,
                        status: normalizedError.status,
                        retryable: false,
                        conflictVersion: normalizedError.conflictVersion,
                        snapshotRecordId: normalizedError.snapshotRecordId,
                        cause: normalizedError,
                    });
                }

                if (
                    normalizedError.code === 'offline'
                    || normalizedError.code === 'cancelled'
                    || normalizedError.code === 'auth'
                    || normalizedError.code === 'forbidden'
                    || normalizedError.code === 'unknown'
                ) {
                    console.warn('La interpretacion remota no estuvo disponible. Seguimos con el flujo local.', normalizedError);
                    return null;
                }

                setAuthenticatedError(normalizedError.message);
                throw normalizedError;
            }
        },
        [enabled, loadWorkspace, setAuthenticatedError],
    );

    const correctInterpretationNow = useCallback(
        async (
            snapshot: PersistableBusinessState,
            messageId: string,
            message: Message,
            interpretation: Message['interpretation'],
            expectedVersion: number,
            epoch: number,
        ): Promise<CorrectInterpretationResult | null> => {
            if (epoch !== workspaceEpochRef.current) {
                throw new PocketBaseSyncError(
                    'Se descarto una correccion pendiente porque el workspace ya se habia recargado desde PocketBase.',
                    {
                        code: 'conflict',
                        status: 409,
                        retryable: false,
                    },
                );
            }

            const workspace = workspaceRef.current;
            const workspaceId = workspace?.workspaceId;
            if (!enabled || !workspaceId || !interpretation || !remoteCorrectionRouteAvailableRef.current) {
                return null;
            }

            const versionToUse = Math.max(expectedVersion, workspace.version);

            try {
                const result = await correctRemoteWorkspaceInterpretation(
                    workspaceId,
                    snapshot,
                    messageId,
                    message,
                    interpretation,
                    versionToUse,
                );

                if (result.snapshot && typeof result.version === 'number') {
                    setSessionState((previous) => {
                        if (!previous.workspace || previous.workspace.workspaceId !== workspaceId) return previous;

                        const updatedWorkspace: RemoteWorkspaceSnapshot = {
                            ...previous.workspace,
                            snapshotRecordId: result.snapshotRecordId || previous.workspace.snapshotRecordId,
                            version: result.version,
                            snapshot: result.snapshot,
                        };

                        workspaceRef.current = updatedWorkspace;

                        return {
                            ...previous,
                            error: null,
                            workspace: updatedWorkspace,
                        };
                    });
                } else {
                    setAuthenticatedError(null);
                }

                return result;
            } catch (error) {
                if (isPocketBaseRouteUnavailable(error)) {
                    remoteCorrectionRouteAvailableRef.current = false;
                    return null;
                }

                const normalizedError = normalizePocketBaseError(error, 'No se pudo corregir la interpretacion en PocketBase.');

                if (normalizedError.code === 'conflict') {
                    const conflictMessage = 'El workspace remoto cambio antes de corregir la interpretacion. Recargamos la version mas reciente de PocketBase.';

                    try {
                        await loadWorkspace({ errorAfterLoad: conflictMessage });
                    } catch (refreshError) {
                        const normalizedRefreshError = normalizePocketBaseError(
                            refreshError,
                            'No se pudo recargar el workspace despues del conflicto de correccion.',
                        );
                        setAuthenticatedError(normalizedRefreshError.message);
                        throw normalizedRefreshError;
                    }

                    throw new PocketBaseSyncError(conflictMessage, {
                        code: normalizedError.code,
                        status: normalizedError.status,
                        retryable: false,
                        conflictVersion: normalizedError.conflictVersion,
                        snapshotRecordId: normalizedError.snapshotRecordId,
                        cause: normalizedError,
                    });
                }

                if (
                    normalizedError.code === 'offline'
                    || normalizedError.code === 'cancelled'
                    || normalizedError.code === 'auth'
                    || normalizedError.code === 'forbidden'
                    || normalizedError.code === 'unknown'
                ) {
                    console.warn('La correccion remota no estuvo disponible. Seguimos con el flujo local.', normalizedError);
                    return null;
                }

                setAuthenticatedError(normalizedError.message);
                throw normalizedError;
            }
        },
        [enabled, loadWorkspace, setAuthenticatedError],
    );

    const revertInterpretationNow = useCallback(
        async (
            snapshot: PersistableBusinessState,
            messageId: string,
            message: Message,
            expectedVersion: number,
            epoch: number,
            actionId?: string,
        ): Promise<RevertInterpretationResult | null> => {
            if (epoch !== workspaceEpochRef.current) {
                throw new PocketBaseSyncError(
                    'Se descarto una reversion pendiente porque el workspace ya se habia recargado desde PocketBase.',
                    {
                        code: 'conflict',
                        status: 409,
                        retryable: false,
                    },
                );
            }

            const workspace = workspaceRef.current;
            const workspaceId = workspace?.workspaceId;
            if (!enabled || !workspaceId || !remoteRevertRouteAvailableRef.current) {
                return null;
            }

            const versionToUse = Math.max(expectedVersion, workspace.version);

            try {
                const result = await revertRemoteWorkspaceInterpretation(
                    workspaceId,
                    snapshot,
                    messageId,
                    message,
                    versionToUse,
                    actionId,
                );

                if (result.snapshot && typeof result.version === 'number') {
                    setSessionState((previous) => {
                        if (!previous.workspace || previous.workspace.workspaceId !== workspaceId) return previous;

                        const updatedWorkspace: RemoteWorkspaceSnapshot = {
                            ...previous.workspace,
                            snapshotRecordId: result.snapshotRecordId || previous.workspace.snapshotRecordId,
                            version: result.version,
                            snapshot: result.snapshot,
                        };

                        workspaceRef.current = updatedWorkspace;

                        return {
                            ...previous,
                            error: null,
                            workspace: updatedWorkspace,
                        };
                    });
                } else {
                    setAuthenticatedError(null);
                }

                return result;
            } catch (error) {
                if (isPocketBaseRouteUnavailable(error)) {
                    remoteRevertRouteAvailableRef.current = false;
                    return null;
                }

                const normalizedError = normalizePocketBaseError(error, 'No se pudo revertir la accion en PocketBase.');

                if (normalizedError.code === 'conflict') {
                    const conflictMessage = 'El workspace remoto cambio antes de revertir la accion. Recargamos la version mas reciente de PocketBase.';

                    try {
                        await loadWorkspace({ errorAfterLoad: conflictMessage });
                    } catch (refreshError) {
                        const normalizedRefreshError = normalizePocketBaseError(
                            refreshError,
                            'No se pudo recargar el workspace despues del conflicto de reversion.',
                        );
                        setAuthenticatedError(normalizedRefreshError.message);
                        throw normalizedRefreshError;
                    }

                    throw new PocketBaseSyncError(conflictMessage, {
                        code: normalizedError.code,
                        status: normalizedError.status,
                        retryable: false,
                        conflictVersion: normalizedError.conflictVersion,
                        snapshotRecordId: normalizedError.snapshotRecordId,
                        cause: normalizedError,
                    });
                }

                if (
                    normalizedError.code === 'offline'
                    || normalizedError.code === 'cancelled'
                    || normalizedError.code === 'auth'
                    || normalizedError.code === 'forbidden'
                    || normalizedError.code === 'unknown'
                ) {
                    console.warn('La reversion remota no estuvo disponible. Seguimos con el flujo local.', normalizedError);
                    return null;
                }

                setAuthenticatedError(normalizedError.message);
                throw normalizedError;
            }
        },
        [enabled, loadWorkspace, setAuthenticatedError],
    );

    const flushPendingPersist = useCallback((): Promise<PersistResult | null> => {
        const pendingSnapshot = pendingPersistRef.current;
        if (!pendingSnapshot) {
            return Promise.resolve(null);
        }

        return enqueuePersistTask(() =>
            persistSnapshotNow(pendingSnapshot.snapshot, pendingSnapshot.expectedVersion, pendingSnapshot.epoch),
        );
    }, [enqueuePersistTask, persistSnapshotNow]);

    const restore = useCallback(async () => {
        if (!enabled) return;

        try {
            const profile = await restoreAuthProfile();
            if (!profile) {
                resetWorkspaceSession('unauthenticated', null);
                return;
            }

            await loadWorkspace({ showBootstrapping: true, fallbackProfile: profile });
        } catch (error) {
            const normalizedError = normalizePocketBaseError(error, 'No se pudo restaurar la sesion con PocketBase.');
            console.error(normalizedError);

            if (normalizedError.code === 'auth' || normalizedError.code === 'forbidden') {
                clearAuthSession();
                resetWorkspaceSession('unauthenticated', normalizedError.message);
                return;
            }

            resetWorkspaceSession('error', normalizedError.message);
        }
    }, [enabled, loadWorkspace, resetWorkspaceSession]);

    useEffect(() => {
        void restore();
    }, [restore]);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return;

        const handleOnline = () => {
            void flushPendingPersist().catch((error) => {
                if (!(error instanceof PocketBaseSyncError) || (error.code !== 'offline' && error.code !== 'cancelled')) {
                    console.error(error);
                }
            });
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [enabled, flushPendingPersist]);

    useEffect(() => {
        if (!enabled || sessionState.status !== 'authenticated' || !pendingPersistRef.current) return;

        void flushPendingPersist().catch((error) => {
            if (!(error instanceof PocketBaseSyncError) || (error.code !== 'offline' && error.code !== 'cancelled')) {
                console.error(error);
            }
        });
    }, [enabled, flushPendingPersist, sessionState.status, sessionState.workspace?.workspaceId]);

    const signIn = useCallback(
        async (email: string, password: string) => {
            if (!enabled) return;

            setSessionState((previous) => ({ ...previous, status: 'loading', error: null }));
            try {
                const profile = await signInWithPassword(email, password);
                await loadWorkspace({ showBootstrapping: true, fallbackProfile: profile });
            } catch (error) {
                const normalizedError = normalizePocketBaseError(error, 'No se pudo iniciar sesion.');
                console.error(normalizedError);

                if (normalizedError.code === 'auth' || normalizedError.code === 'forbidden') {
                    clearAuthSession();
                    resetWorkspaceSession('unauthenticated', normalizedError.message);
                } else {
                    resetWorkspaceSession('error', normalizedError.message);
                }

                throw normalizedError;
            }
        },
        [enabled, loadWorkspace, resetWorkspaceSession],
    );

    const signOut = useCallback(() => {
        if (!enabled) return;
        clearAuthSession();
        resetWorkspaceSession('unauthenticated', null);
    }, [enabled, resetWorkspaceSession]);

    const persistSnapshot = useCallback(
        (snapshot: PersistableBusinessState, expectedVersion: number): Promise<PersistResult> => {
            const epoch = workspaceEpochRef.current;
            return enqueuePersistTask(() => persistSnapshotNow(snapshot, expectedVersion, epoch));
        },
        [enqueuePersistTask, persistSnapshotNow],
    );

    const approveInterpretation = useCallback(
        (
            snapshot: PersistableBusinessState,
            messageId: string,
            message: Message,
            expectedVersion: number,
        ): Promise<ApproveInterpretationResult> => {
            const epoch = workspaceEpochRef.current;
            return enqueuePersistTask(() =>
                approveInterpretationNow(snapshot, messageId, message, expectedVersion, epoch),
            );
        },
        [approveInterpretationNow, enqueuePersistTask],
    );

    const interpretMessage = useCallback(
        (
            snapshot: PersistableBusinessState,
            messageId: string,
            message: Message,
            expectedVersion: number,
        ): Promise<InterpretMessageResult | null> => {
            const epoch = workspaceEpochRef.current;
            return interpretMessageNow(snapshot, messageId, message, expectedVersion, epoch);
        },
        [interpretMessageNow],
    );

    const correctInterpretation = useCallback(
        (
            snapshot: PersistableBusinessState,
            messageId: string,
            message: Message,
            interpretation: Message['interpretation'],
            expectedVersion: number,
        ): Promise<CorrectInterpretationResult | null> => {
            const epoch = workspaceEpochRef.current;
            return correctInterpretationNow(snapshot, messageId, message, interpretation, expectedVersion, epoch);
        },
        [correctInterpretationNow],
    );

    const revertInterpretation = useCallback(
        (
            snapshot: PersistableBusinessState,
            messageId: string,
            message: Message,
            expectedVersion: number,
            actionId?: string,
        ): Promise<RevertInterpretationResult | null> => {
            const epoch = workspaceEpochRef.current;
            return enqueuePersistTask(() =>
                revertInterpretationNow(snapshot, messageId, message, expectedVersion, epoch, actionId),
            );
        },
        [enqueuePersistTask, revertInterpretationNow],
    );

    return {
        enabled,
        ...sessionState,
        signIn,
        signOut,
        retry: restore,
        persistSnapshot,
        approveInterpretation,
        interpretMessage,
        correctInterpretation,
        revertInterpretation,
    };
};
