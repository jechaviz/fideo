import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AuthSessionProfile,
    clearAuthSession,
    mergeAuthSessionProfiles,
    restoreAuthProfile,
    signInWithPassword,
} from '../services/pocketbase/auth';
import { isPocketBaseEnabled, requirePocketBaseClient } from '../services/pocketbase/client';
import { Message, OperationalException, OperationalExceptionReassignInput, OperationalExceptionResolveInput, TaskReportInput } from '../types';
import {
    approveRemoteWorkspaceInterpretation,
    ApproveInterpretationResult,
    bootstrapRemoteWorkspace,
    correctRemoteWorkspaceInterpretation,
    CorrectInterpretationResult,
    fetchRemoteWorkspaceRuntimeOverview,
    interpretRemoteWorkspaceMessage,
    InterpretMessageResult,
    isPocketBaseRouteUnavailable,
    mergeRemoteOperationalRuntimeSnapshot,
    normalizePocketBaseError,
    pingRemoteWorkspacePresence,
    PersistableBusinessState,
    PersistResult,
    PresencePingResult,
    persistRemoteWorkspaceSnapshot,
    PocketBaseSyncError,
    reassignRemoteOperationalException,
    readRemoteOperationalRuntime,
    ReassignOperationalExceptionResult,
    resolveRemoteOperationalException,
    ResolveOperationalExceptionResult,
    revertRemoteWorkspaceInterpretation,
    RevertInterpretationResult,
    RemoteWorkspaceSnapshot,
    submitRemoteWorkspaceTaskReport,
    SubmitTaskReportResult,
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

type RuntimeActionResultLike = {
    snapshot?: Record<string, unknown>;
    version?: number;
    snapshotRecordId?: string;
    runtimeOverview?: RemoteWorkspaceSnapshot['runtimeOverview'];
    staffPresence?: NonNullable<RemoteWorkspaceSnapshot['staffPresence']>;
    exceptionInbox?: NonNullable<RemoteWorkspaceSnapshot['exceptionInbox']>;
};

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

const stripOperationalRuntimeFromSnapshot = (snapshot: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    if (!snapshot || typeof snapshot !== 'object') return {};

    const nextSnapshot = { ...snapshot };
    delete nextSnapshot.presenceRoster;
    delete nextSnapshot.operationalExceptions;
    return nextSnapshot;
};

const POCKETBASE_SNAPSHOT_COLLECTION = 'fideo_state_snapshots';

const readRealtimeSnapshotVersion = (record: Record<string, unknown> | null | undefined): number | null => {
    const rawVersion = record?.version;
    if (typeof rawVersion === 'number' && Number.isFinite(rawVersion)) {
        return rawVersion;
    }

    if (typeof rawVersion === 'string' && rawVersion.trim()) {
        const parsedVersion = Number(rawVersion);
        if (Number.isFinite(parsedVersion)) {
            return parsedVersion;
        }
    }

    return null;
};

const FIDEO_PRESENCE_SESSION_KEY = 'fideo/presence/session-id';
const FIDEO_PRESENCE_DEVICE_KEY = 'fideo/presence/device-id';
const FIDEO_PRESENCE_INSTALLATION_KEY = 'fideo/presence/installation-id';
const FIDEO_PRESENCE_HEARTBEAT_MS = 60_000;

const createSessionToken = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `fideo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const readOrCreateStorageValue = (storage: Storage, key: string) => {
    const existingValue = storage.getItem(key)?.trim();
    if (existingValue) return existingValue;

    const nextValue = createSessionToken();
    storage.setItem(key, nextValue);
    return nextValue;
};

const resolvePresenceStatus = (): 'active' | 'background' | 'idle' | 'offline' => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return 'offline';
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return 'background';
    }

    return 'active';
};

const resolvePresenceDeviceName = () => {
    if (typeof navigator === 'undefined') return 'web';

    const navigatorWithUA = navigator as Navigator & {
        userAgentData?: {
            mobile?: boolean;
            platform?: string;
        };
    };

    const platform =
        typeof navigatorWithUA.userAgentData?.platform === 'string' && navigatorWithUA.userAgentData.platform.trim()
            ? navigatorWithUA.userAgentData.platform.trim()
            : typeof navigatorWithUA.platform === 'string' && navigatorWithUA.platform.trim()
              ? navigatorWithUA.platform.trim()
              : 'web';

    const isMobile = Boolean(navigatorWithUA.userAgentData?.mobile) || /android|iphone|ipad|mobile/i.test(navigatorWithUA.userAgent || '');
    return isMobile ? `movil ${platform}` : `desktop ${platform}`;
};

const resolvePresenceContext = () => {
    if (typeof window === 'undefined') return null;

    try {
        const navigatorWithUA = navigator as Navigator & {
            userAgentData?: {
                mobile?: boolean;
                platform?: string;
            };
        };

        return {
            sessionId: readOrCreateStorageValue(window.sessionStorage, FIDEO_PRESENCE_SESSION_KEY),
            deviceId: readOrCreateStorageValue(window.localStorage, FIDEO_PRESENCE_DEVICE_KEY),
            installationId: readOrCreateStorageValue(window.localStorage, FIDEO_PRESENCE_INSTALLATION_KEY),
            deviceName: resolvePresenceDeviceName(),
            platform:
                (typeof navigator !== 'undefined'
                    && (navigatorWithUA.userAgentData?.platform || navigatorWithUA.platform || navigatorWithUA.userAgent))
                || 'web',
            appVersion: typeof import.meta.env.VITE_APP_VERSION === 'string' && import.meta.env.VITE_APP_VERSION.trim()
                ? import.meta.env.VITE_APP_VERSION.trim()
                : 'web',
        };
    } catch {
        return null;
    }
};

const syncWorkspaceRuntime = (
    workspace: RemoteWorkspaceSnapshot,
    profile: AuthSessionProfile | null | undefined,
): RemoteWorkspaceSnapshot => {
    const runtimeSources = [
        workspace.runtimeOverview || null,
        {
            staffPresence: workspace.staffPresence || [],
            exceptionInbox: workspace.exceptionInbox || [],
        },
    ];
    const resolvedProfile = profile || workspace.profile || null;
    const snapshot = mergeRemoteOperationalRuntimeSnapshot(workspace.snapshot, {
        profile: resolvedProfile,
        sources: runtimeSources,
    });
    const runtime = readRemoteOperationalRuntime(snapshot, {
        profile: resolvedProfile,
        sources: runtimeSources,
    });

    return {
        ...workspace,
        snapshot,
        staffPresence: runtime.presenceRoster,
        exceptionInbox: runtime.operationalExceptions,
    };
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
    const realtimeRefreshPromiseRef = useRef<Promise<RemoteWorkspaceSnapshot | null> | null>(null);
    const runtimeOverviewRefreshPromiseRef = useRef<Promise<void> | null>(null);
    const realtimeRefreshTargetVersionRef = useRef(0);
    const remoteCorrectionRouteAvailableRef = useRef(true);
    const remoteInterpretationRouteAvailableRef = useRef(true);
    const remoteRevertRouteAvailableRef = useRef(true);
    const remoteTaskReportRouteAvailableRef = useRef(true);
    const remotePresenceRouteAvailableRef = useRef(true);
    const remoteRuntimeOverviewRouteAvailableRef = useRef(true);
    const remoteResolveExceptionRouteAvailableRef = useRef(true);
    const remoteReassignExceptionRouteAvailableRef = useRef(true);

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
        realtimeRefreshPromiseRef.current = null;
        realtimeRefreshTargetVersionRef.current = 0;
        remoteCorrectionRouteAvailableRef.current = true;
        remoteInterpretationRouteAvailableRef.current = true;
        remoteRevertRouteAvailableRef.current = true;
        remoteTaskReportRouteAvailableRef.current = true;
        remotePresenceRouteAvailableRef.current = true;
        remoteRuntimeOverviewRouteAvailableRef.current = true;
        remoteResolveExceptionRouteAvailableRef.current = true;
        remoteReassignExceptionRouteAvailableRef.current = true;
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
            const resolvedWorkspace = syncWorkspaceRuntime(
                resolvedProfile ? { ...workspace, profile: resolvedProfile } : workspace,
                resolvedProfile ?? workspace.profile,
            );

            profileRef.current = resolvedWorkspace.profile;
            workspaceRef.current = resolvedWorkspace;
            pendingPersistRef.current = null;
            realtimeRefreshTargetVersionRef.current = resolvedWorkspace.version;
            remoteCorrectionRouteAvailableRef.current = true;
            remoteInterpretationRouteAvailableRef.current = true;
            remoteRevertRouteAvailableRef.current = true;
            remoteTaskReportRouteAvailableRef.current = true;
            remotePresenceRouteAvailableRef.current = true;
            remoteRuntimeOverviewRouteAvailableRef.current = true;
            remoteResolveExceptionRouteAvailableRef.current = true;
            remoteReassignExceptionRouteAvailableRef.current = true;
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

    const applyRuntimeActionResult = useCallback(
        (workspaceId: string, result: RuntimeActionResultLike) => {
            const shouldPatchWorkspace =
                Boolean(result.snapshot)
                || typeof result.version === 'number'
                || typeof result.snapshotRecordId === 'string'
                || result.runtimeOverview !== undefined
                || Array.isArray(result.staffPresence)
                || Array.isArray(result.exceptionInbox);

            if (!shouldPatchWorkspace) {
                return false;
            }

            let updated = false;

            setSessionState((previous) => {
                if (previous.status !== 'authenticated' || !previous.workspace || previous.workspace.workspaceId !== workspaceId) {
                    return previous;
                }

                const nextWorkspace = syncWorkspaceRuntime(
                    {
                        ...previous.workspace,
                        snapshotRecordId: result.snapshotRecordId || previous.workspace.snapshotRecordId,
                        version: typeof result.version === 'number' ? result.version : previous.workspace.version,
                        snapshot: result.snapshot || previous.workspace.snapshot,
                        runtimeOverview:
                            result.runtimeOverview !== undefined
                                ? result.runtimeOverview ?? previous.workspace.runtimeOverview ?? null
                                : previous.workspace.runtimeOverview,
                        staffPresence: Array.isArray(result.staffPresence) ? result.staffPresence : previous.workspace.staffPresence,
                        exceptionInbox: Array.isArray(result.exceptionInbox) ? result.exceptionInbox : previous.workspace.exceptionInbox,
                    },
                    previous.profile,
                );

                workspaceRef.current = nextWorkspace;
                updated = true;

                return {
                    ...previous,
                    error: null,
                    workspace: nextWorkspace,
                };
            });

            return updated;
        },
        [],
    );

    const refreshRuntimeOverview = useCallback(
        async (workspaceId?: string) => {
            if (!enabled || !remoteRuntimeOverviewRouteAvailableRef.current) {
                return;
            }

            const resolvedWorkspaceId = workspaceId || workspaceRef.current?.workspaceId;
            if (!resolvedWorkspaceId) {
                return;
            }

            if (runtimeOverviewRefreshPromiseRef.current) {
                return runtimeOverviewRefreshPromiseRef.current;
            }

            let refreshPromise: Promise<void> | null = null;

            refreshPromise = (async () => {
                try {
                    const runtime = await fetchRemoteWorkspaceRuntimeOverview(resolvedWorkspaceId);
                    setSessionState((previous) => {
                        if (previous.status !== 'authenticated' || !previous.workspace || previous.workspace.workspaceId !== resolvedWorkspaceId) {
                            return previous;
                        }

                        const nextWorkspace = syncWorkspaceRuntime({
                            ...previous.workspace,
                            workspaceSlug: runtime.workspaceSlug || previous.workspace.workspaceSlug,
                            runtimeOverview: runtime.runtimeOverview ?? previous.workspace.runtimeOverview ?? null,
                            staffPresence: runtime.staffPresence || previous.workspace.staffPresence || [],
                            exceptionInbox: runtime.exceptionInbox || previous.workspace.exceptionInbox || [],
                        }, previous.profile);

                        if (typeof runtime.version === 'number' && runtime.version > nextWorkspace.version) {
                            nextWorkspace.version = runtime.version;
                        }

                        if (runtime.snapshotRecordId) {
                            nextWorkspace.snapshotRecordId = runtime.snapshotRecordId;
                        }

                        workspaceRef.current = nextWorkspace;

                        return {
                            ...previous,
                            workspace: nextWorkspace,
                        };
                    });
                } catch (error) {
                    if (isPocketBaseRouteUnavailable(error)) {
                        remoteRuntimeOverviewRouteAvailableRef.current = false;
                        return;
                    }

                    const normalizedError = normalizePocketBaseError(
                        error,
                        'No se pudo refrescar la operacion viva del workspace en PocketBase.',
                    );

                    if (normalizedError.code === 'forbidden' || normalizedError.code === 'auth') {
                        remoteRuntimeOverviewRouteAvailableRef.current = false;
                        return;
                    }

                    if (
                        normalizedError.code !== 'offline'
                        && normalizedError.code !== 'cancelled'
                        && normalizedError.code !== 'unknown'
                    ) {
                        console.warn('No se pudo refrescar el runtime operativo de PocketBase.', normalizedError);
                    }
                }
            })();

            runtimeOverviewRefreshPromiseRef.current = refreshPromise.finally(() => {
                if (runtimeOverviewRefreshPromiseRef.current === refreshPromise) {
                    runtimeOverviewRefreshPromiseRef.current = null;
                }
            });

            return runtimeOverviewRefreshPromiseRef.current;
        },
        [enabled],
    );

    const applyPresenceToSession = useCallback((result: PresencePingResult) => {
        setSessionState((previous) => {
            if (previous.status !== 'authenticated' || !previous.profile || !previous.workspace) {
                return previous;
            }

            const nextProfile = mergeAuthSessionProfiles(
                {
                    ...previous.profile,
                    pushExternalId: result.pushExternalId ?? previous.profile.pushExternalId,
                    lastSeenAt: result.lastSeenAt ?? previous.profile.lastSeenAt,
                    presence: result.presence ?? previous.profile.presence,
                },
                previous.profile,
            );

            if (!nextProfile) {
                return previous;
            }

            const nextWorkspace = syncWorkspaceRuntime({
                ...previous.workspace,
                profile: nextProfile,
            }, nextProfile);

            profileRef.current = nextProfile;
            workspaceRef.current = nextWorkspace;

            return {
                ...previous,
                profile: nextProfile,
                workspace: nextWorkspace,
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

    const refreshWorkspaceFromRealtime = useCallback(
        async (snapshotRecordId: string, minimumVersion?: number): Promise<RemoteWorkspaceSnapshot | null> => {
            if (!enabled) return null;

            const currentWorkspace = workspaceRef.current;
            if (!currentWorkspace || currentWorkspace.snapshotRecordId !== snapshotRecordId) {
                return null;
            }

            const targetVersion = minimumVersion ?? currentWorkspace.version + 1;
            realtimeRefreshTargetVersionRef.current = Math.max(realtimeRefreshTargetVersionRef.current, targetVersion);

            if (realtimeRefreshPromiseRef.current) {
                return realtimeRefreshPromiseRef.current;
            }

            let refreshPromise: Promise<RemoteWorkspaceSnapshot | null> | null = null;

            refreshPromise = (async () => {
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    const workspaceBeforeRefresh = workspaceRef.current;
                    if (!workspaceBeforeRefresh || workspaceBeforeRefresh.snapshotRecordId !== snapshotRecordId) {
                        return null;
                    }

                    const remoteWorkspace = await bootstrapRemoteWorkspace();
                    const latestWorkspace = workspaceRef.current;
                    if (!latestWorkspace || latestWorkspace.snapshotRecordId !== snapshotRecordId) {
                        return null;
                    }

                    const requiredVersion = realtimeRefreshTargetVersionRef.current;

                    if (
                        latestWorkspace.version >= requiredVersion
                        && latestWorkspace.version >= remoteWorkspace.version
                    ) {
                        realtimeRefreshTargetVersionRef.current = latestWorkspace.version;
                        return latestWorkspace;
                    }

                    const resolvedWorkspace =
                        remoteWorkspace.version > latestWorkspace.version
                            ? setAuthenticatedWorkspace(remoteWorkspace, null, profileRef.current)
                            : latestWorkspace;

                    if (resolvedWorkspace.version >= requiredVersion) {
                        realtimeRefreshTargetVersionRef.current = resolvedWorkspace.version;
                        return resolvedWorkspace;
                    }

                    await new Promise((resolve) => setTimeout(resolve, 150));
                }

                return workspaceRef.current;
            })();

            realtimeRefreshPromiseRef.current = refreshPromise.finally(() => {
                if (realtimeRefreshPromiseRef.current === refreshPromise) {
                    realtimeRefreshPromiseRef.current = null;
                }
            });

            return realtimeRefreshPromiseRef.current;
        },
        [enabled, setAuthenticatedWorkspace],
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
            if (versionToUse === workspace.version && areSnapshotsEqual(snapshot, stripOperationalRuntimeFromSnapshot(workspace.snapshot))) {
                pendingPersistRef.current = null;
                return buildSyntheticPersistResult(workspace.version, workspace.snapshotRecordId);
            }

            try {
                const result = await persistRemoteWorkspaceSnapshot(workspaceId, snapshot, versionToUse);
                pendingPersistRef.current = null;
                setSessionState((previous) => {
                    if (!previous.workspace || previous.workspace.workspaceId !== workspaceId) return previous;

                    const updatedWorkspace = syncWorkspaceRuntime({
                        ...previous.workspace,
                        snapshotRecordId: result.snapshotRecordId,
                        version: result.version,
                        snapshot,
                    }, previous.profile);

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

                    const updatedWorkspace = syncWorkspaceRuntime({
                        ...previous.workspace,
                        snapshotRecordId: result.snapshotRecordId,
                        version: result.version,
                        snapshot: result.snapshot,
                    }, previous.profile);

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

                        const updatedWorkspace = syncWorkspaceRuntime({
                            ...previous.workspace,
                            snapshotRecordId: result.snapshotRecordId || previous.workspace.snapshotRecordId,
                            version: result.version,
                            snapshot: result.snapshot,
                        }, previous.profile);

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

                        const updatedWorkspace = syncWorkspaceRuntime({
                            ...previous.workspace,
                            snapshotRecordId: result.snapshotRecordId || previous.workspace.snapshotRecordId,
                            version: result.version,
                            snapshot: result.snapshot,
                        }, previous.profile);

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

                        const updatedWorkspace = syncWorkspaceRuntime({
                            ...previous.workspace,
                            snapshotRecordId: result.snapshotRecordId || previous.workspace.snapshotRecordId,
                            version: result.version,
                            snapshot: result.snapshot,
                        }, previous.profile);

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

    const submitTaskReportNow = useCallback(
        async (
            snapshot: PersistableBusinessState,
            taskId: string,
            report: TaskReportInput,
            expectedVersion: number,
            epoch: number,
        ): Promise<SubmitTaskReportResult | null> => {
            if (epoch !== workspaceEpochRef.current) {
                throw new PocketBaseSyncError(
                    'Se descarto un reporte pendiente porque el workspace ya se habia recargado desde PocketBase.',
                    {
                        code: 'conflict',
                        status: 409,
                        retryable: false,
                    },
                );
            }

            const workspace = workspaceRef.current;
            const workspaceId = workspace?.workspaceId;
            if (!enabled || !workspaceId || !remoteTaskReportRouteAvailableRef.current) {
                return null;
            }

            const versionToUse = Math.max(expectedVersion, workspace.version);

            try {
                const result = await submitRemoteWorkspaceTaskReport(
                    workspaceId,
                    snapshot,
                    taskId,
                    report,
                    versionToUse,
                );

                if (result.snapshot && typeof result.version === 'number') {
                    setSessionState((previous) => {
                        if (!previous.workspace || previous.workspace.workspaceId !== workspaceId) return previous;

                        const updatedWorkspace = syncWorkspaceRuntime({
                            ...previous.workspace,
                            snapshotRecordId: result.snapshotRecordId || previous.workspace.snapshotRecordId,
                            version: result.version,
                            snapshot: result.snapshot,
                        }, previous.profile);

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
                    remoteTaskReportRouteAvailableRef.current = false;
                    return null;
                }

                const normalizedError = normalizePocketBaseError(error, 'No se pudo enviar el reporte de tarea a PocketBase.');

                if (normalizedError.code === 'conflict') {
                    const conflictMessage = 'El workspace remoto cambio antes de registrar el reporte. Recargamos la version mas reciente de PocketBase.';

                    try {
                        await loadWorkspace({ errorAfterLoad: conflictMessage });
                    } catch (refreshError) {
                        const normalizedRefreshError = normalizePocketBaseError(
                            refreshError,
                            'No se pudo recargar el workspace despues del conflicto de reporte.',
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
                    console.warn('El reporte remoto no estuvo disponible. Seguimos con el flujo local.', normalizedError);
                    return null;
                }

                setAuthenticatedError(normalizedError.message);
                throw normalizedError;
            }
        },
        [enabled, loadWorkspace, setAuthenticatedError],
    );

    const resolveOperationalExceptionNow = useCallback(
        async (
            snapshot: PersistableBusinessState,
            exception: OperationalException,
            resolution: OperationalExceptionResolveInput,
            expectedVersion: number,
            epoch: number,
        ): Promise<ResolveOperationalExceptionResult | null> => {
            if (epoch !== workspaceEpochRef.current) {
                throw new PocketBaseSyncError(
                    'Se descarto una resolucion pendiente porque el workspace ya se habia recargado desde PocketBase.',
                    {
                        code: 'conflict',
                        status: 409,
                        retryable: false,
                    },
                );
            }

            const workspace = workspaceRef.current;
            const workspaceId = workspace?.workspaceId;
            if (!enabled || !workspaceId || !remoteResolveExceptionRouteAvailableRef.current) {
                return null;
            }

            const versionToUse = Math.max(expectedVersion, workspace.version);

            try {
                const result = await resolveRemoteOperationalException(
                    workspaceId,
                    snapshot,
                    exception,
                    resolution,
                    versionToUse,
                );

                applyRuntimeActionResult(workspaceId, result);
                setAuthenticatedError(null);
                await refreshRuntimeOverview(workspaceId);

                return result;
            } catch (error) {
                if (isPocketBaseRouteUnavailable(error)) {
                    remoteResolveExceptionRouteAvailableRef.current = false;
                    return null;
                }

                const normalizedError = normalizePocketBaseError(error, 'No se pudo resolver la excepcion en PocketBase.');

                if (normalizedError.code === 'conflict') {
                    const conflictMessage = 'El workspace remoto cambio antes de resolver la excepcion. Recargamos la version mas reciente de PocketBase.';

                    try {
                        await loadWorkspace({ errorAfterLoad: conflictMessage });
                    } catch (refreshError) {
                        const normalizedRefreshError = normalizePocketBaseError(
                            refreshError,
                            'No se pudo recargar el workspace despues del conflicto de resolucion.',
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
                    console.warn('La resolucion remota no estuvo disponible. Seguimos con el flujo local.', normalizedError);
                    return null;
                }

                setAuthenticatedError(normalizedError.message);
                throw normalizedError;
            }
        },
        [applyRuntimeActionResult, enabled, loadWorkspace, refreshRuntimeOverview, setAuthenticatedError],
    );

    const reassignOperationalExceptionNow = useCallback(
        async (
            snapshot: PersistableBusinessState,
            exception: OperationalException,
            reassignment: OperationalExceptionReassignInput,
            expectedVersion: number,
            epoch: number,
        ): Promise<ReassignOperationalExceptionResult | null> => {
            if (epoch !== workspaceEpochRef.current) {
                throw new PocketBaseSyncError(
                    'Se descarto una reasignacion pendiente porque el workspace ya se habia recargado desde PocketBase.',
                    {
                        code: 'conflict',
                        status: 409,
                        retryable: false,
                    },
                );
            }

            const workspace = workspaceRef.current;
            const workspaceId = workspace?.workspaceId;
            if (!enabled || !workspaceId || !remoteReassignExceptionRouteAvailableRef.current) {
                return null;
            }

            const versionToUse = Math.max(expectedVersion, workspace.version);

            try {
                const result = await reassignRemoteOperationalException(
                    workspaceId,
                    snapshot,
                    exception,
                    reassignment,
                    versionToUse,
                );

                applyRuntimeActionResult(workspaceId, result);
                setAuthenticatedError(null);
                await refreshRuntimeOverview(workspaceId);

                return result;
            } catch (error) {
                if (isPocketBaseRouteUnavailable(error)) {
                    remoteReassignExceptionRouteAvailableRef.current = false;
                    return null;
                }

                const normalizedError = normalizePocketBaseError(error, 'No se pudo reasignar la excepcion en PocketBase.');

                if (normalizedError.code === 'conflict') {
                    const conflictMessage = 'El workspace remoto cambio antes de reasignar la excepcion. Recargamos la version mas reciente de PocketBase.';

                    try {
                        await loadWorkspace({ errorAfterLoad: conflictMessage });
                    } catch (refreshError) {
                        const normalizedRefreshError = normalizePocketBaseError(
                            refreshError,
                            'No se pudo recargar el workspace despues del conflicto de reasignacion.',
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
                    console.warn('La reasignacion remota no estuvo disponible. Seguimos con el flujo local.', normalizedError);
                    return null;
                }

                setAuthenticatedError(normalizedError.message);
                throw normalizedError;
            }
        },
        [applyRuntimeActionResult, enabled, loadWorkspace, refreshRuntimeOverview, setAuthenticatedError],
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
        if (!enabled || sessionState.status !== 'authenticated') return;

        const snapshotRecordId = sessionState.workspace?.snapshotRecordId;
        if (!snapshotRecordId) return;

        const pb = requirePocketBaseClient();
        let isDisposed = false;
        let unsubscribe: (() => Promise<void>) | null = null;

        const handleRefreshError = (error: unknown) => {
            const normalizedError = normalizePocketBaseError(
                error,
                'No se pudo refrescar el workspace despues de un cambio remoto en PocketBase.',
            );

            if (normalizedError.code === 'auth' || normalizedError.code === 'forbidden') {
                clearAuthSession();
                resetWorkspaceSession('unauthenticated', normalizedError.message);
                return;
            }

            setAuthenticatedError(normalizedError.message);
            console.error(normalizedError);
        };

        const handleRealtimeChange = (event: { action: string; record: Record<string, unknown> }) => {
            if (isDisposed) return;

            const currentWorkspace = workspaceRef.current;
            if (!currentWorkspace || currentWorkspace.snapshotRecordId !== snapshotRecordId) {
                return;
            }

            if (event.action === 'delete') {
                void refreshWorkspaceFromRealtime(snapshotRecordId).catch(handleRefreshError);
                return;
            }

            const incomingVersion = readRealtimeSnapshotVersion(event.record);
            if (incomingVersion !== null && incomingVersion <= currentWorkspace.version) {
                return;
            }

            void refreshWorkspaceFromRealtime(snapshotRecordId, incomingVersion ?? undefined).catch(handleRefreshError);
        };

        void pb.collection(POCKETBASE_SNAPSHOT_COLLECTION)
            .subscribe(snapshotRecordId, handleRealtimeChange)
            .then((unsubscribeHandler) => {
                if (isDisposed) {
                    void unsubscribeHandler().catch((error) => {
                        console.error(error);
                    });
                    return;
                }

                unsubscribe = unsubscribeHandler;
            })
            .catch((error) => {
                if (isDisposed) return;

                const normalizedError = normalizePocketBaseError(
                    error,
                    'No se pudo activar la suscripcion realtime de PocketBase para esta sesion.',
                );
                console.warn('PocketBase realtime no estuvo disponible para la sesion actual.', normalizedError);
            });

        return () => {
            isDisposed = true;
            if (!unsubscribe) return;

            void unsubscribe().catch((error) => {
                console.error(error);
            });
        };
    }, [
        enabled,
        refreshWorkspaceFromRealtime,
        resetWorkspaceSession,
        sessionState.status,
        sessionState.workspace?.snapshotRecordId,
        setAuthenticatedError,
    ]);

    useEffect(() => {
        if (!enabled || sessionState.status !== 'authenticated' || !sessionState.workspace?.workspaceId) {
            return;
        }

        if (!remotePresenceRouteAvailableRef.current) {
            return;
        }

        const presenceContext = resolvePresenceContext();
        if (!presenceContext) {
            return;
        }

        let isDisposed = false;
        let isSyncing = false;

        const syncPresence = async (reason: string) => {
            if (isDisposed || isSyncing || !remotePresenceRouteAvailableRef.current) {
                return;
            }

            const currentWorkspace = workspaceRef.current;
            const currentProfile = profileRef.current;
            if (!currentWorkspace?.workspaceId || !currentProfile) {
                return;
            }

            isSyncing = true;

            try {
                const result = await pingRemoteWorkspacePresence({
                    workspaceId: currentWorkspace.workspaceId,
                    sessionId: presenceContext.sessionId,
                    deviceId: presenceContext.deviceId,
                    deviceName: presenceContext.deviceName,
                    installationId: presenceContext.installationId,
                    platform: presenceContext.platform,
                    appVersion: presenceContext.appVersion,
                    status: resolvePresenceStatus(),
                    pushExternalId: currentProfile.pushExternalId,
                    meta: {
                        reason,
                        role: currentProfile.role,
                        canSwitchRoles: currentProfile.canSwitchRoles,
                    },
                });

                if (isDisposed) return;
                applyPresenceToSession(result);
                void refreshRuntimeOverview(currentWorkspace.workspaceId);
            } catch (error) {
                if (isPocketBaseRouteUnavailable(error)) {
                    remotePresenceRouteAvailableRef.current = false;
                    return;
                }

                const normalizedError = normalizePocketBaseError(
                    error,
                    'No se pudo actualizar la presencia del workspace en PocketBase.',
                );

                if (normalizedError.code === 'auth' || normalizedError.code === 'forbidden') {
                    clearAuthSession();
                    resetWorkspaceSession('unauthenticated', normalizedError.message);
                    return;
                }

                if (
                    normalizedError.code !== 'offline'
                    && normalizedError.code !== 'cancelled'
                    && normalizedError.code !== 'unknown'
                ) {
                    console.warn('No se pudo sincronizar presencia con PocketBase.', normalizedError);
                }
            } finally {
                isSyncing = false;
            }
        };

        const handleVisibilityChange = () => {
            void syncPresence(document.visibilityState === 'hidden' ? 'background' : 'foreground');
        };

        const handleOnline = () => {
            void syncPresence('online');
        };

        const handleOffline = () => {
            void syncPresence('offline');
        };

        const handlePageHide = () => {
            void syncPresence('pagehide');
        };

        void syncPresence('session_ready');

        const intervalId = window.setInterval(() => {
            void syncPresence('heartbeat');
        }, FIDEO_PRESENCE_HEARTBEAT_MS);

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            isDisposed = true;
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [
        applyPresenceToSession,
        enabled,
        refreshRuntimeOverview,
        resetWorkspaceSession,
        sessionState.status,
        sessionState.workspace?.workspaceId,
    ]);

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

    const submitTaskReport = useCallback(
        (
            snapshot: PersistableBusinessState,
            taskId: string,
            report: TaskReportInput,
            expectedVersion: number,
        ): Promise<SubmitTaskReportResult | null> => {
            const epoch = workspaceEpochRef.current;
            return enqueuePersistTask(() =>
                submitTaskReportNow(snapshot, taskId, report, expectedVersion, epoch),
            );
        },
        [enqueuePersistTask, submitTaskReportNow],
    );

    const resolveOperationalException = useCallback(
        (
            snapshot: PersistableBusinessState,
            exception: OperationalException,
            resolution: OperationalExceptionResolveInput,
            expectedVersion: number,
        ): Promise<ResolveOperationalExceptionResult | null> => {
            const epoch = workspaceEpochRef.current;
            return enqueuePersistTask(() =>
                resolveOperationalExceptionNow(snapshot, exception, resolution, expectedVersion, epoch),
            );
        },
        [enqueuePersistTask, resolveOperationalExceptionNow],
    );

    const reassignOperationalException = useCallback(
        (
            snapshot: PersistableBusinessState,
            exception: OperationalException,
            reassignment: OperationalExceptionReassignInput,
            expectedVersion: number,
        ): Promise<ReassignOperationalExceptionResult | null> => {
            const epoch = workspaceEpochRef.current;
            return enqueuePersistTask(() =>
                reassignOperationalExceptionNow(snapshot, exception, reassignment, expectedVersion, epoch),
            );
        },
        [enqueuePersistTask, reassignOperationalExceptionNow],
    );

    const remoteRuntime = useMemo(
        () =>
            readRemoteOperationalRuntime(sessionState.workspace?.snapshot, {
                profile: sessionState.profile,
                sources: [
                    {
                        staffPresence: sessionState.workspace?.staffPresence || [],
                        exceptionInbox: sessionState.workspace?.exceptionInbox || [],
                    },
                ],
            }),
        [sessionState.profile, sessionState.workspace?.exceptionInbox, sessionState.workspace?.snapshot, sessionState.workspace?.staffPresence],
    );

    return {
        enabled,
        ...sessionState,
        presenceRoster: remoteRuntime.presenceRoster,
        operationalExceptions: remoteRuntime.operationalExceptions,
        signIn,
        signOut,
        retry: restore,
        persistSnapshot,
        approveInterpretation,
        interpretMessage,
        correctInterpretation,
        revertInterpretation,
        submitTaskReport,
        resolveOperationalException,
        reassignOperationalException,
        refreshRuntimeOverview,
    };
};
