import OneSignal from 'react-onesignal';
import type { UserRole } from '../../types';
import type { AuthPresenceStatus, AuthSessionProfile } from '../pocketbase/auth';
import type { RemoteWorkspaceSnapshot } from '../pocketbase/state';

const PUSH_TAG_KEYS = [
    'app',
    'role',
    'workspace_id',
    'workspace_slug',
    'channel',
    'employee_id',
    'customer_id',
    'supplier_id',
    'can_switch_roles',
    'auth_source',
    'user_id',
    'push_external_id',
    'external_id_source',
    'presence_status',
    'session_key',
    'device_id',
    'device_name',
    'installation_id',
    'platform',
    'app_version',
] as const;

const PUSH_ALIAS_KEYS = [
    'fideo_user_id',
    'employee_id',
    'workspace_id',
    'workspace_slug',
    'customer_id',
    'supplier_id',
] as const;

const appBase = ensureTrailingSlash(import.meta.env.BASE_URL || '/');

export type OneSignalPushBindingStatus = 'disabled' | 'idle' | 'syncing' | 'bound' | 'stale' | 'error';
export type OneSignalPushExternalIdSource = 'pushExternalId' | 'userId';

export interface OneSignalPushConfig {
    configured: boolean;
    enabled: boolean;
    appId: string;
    workerPath: string;
    workerScope: string;
    allowLocalhostAsSecureOrigin: boolean;
    defaultTitle: string;
    defaultUrl: string;
}

export interface OneSignalPushState {
    configured: boolean;
    enabled: boolean;
    supported: boolean;
    initialized: boolean;
    permission: boolean;
    permissionNative: NotificationPermission;
    optedIn: boolean;
    externalId: string;
    subscriptionId: string;
    onesignalId: string;
    initError: string;
    lastError: string;
    syncing: boolean;
    prompting: boolean;
    bindingStatus: OneSignalPushBindingStatus;
    bindingMessage: string;
    bindingExternalId: string;
    bindingExternalIdSource: OneSignalPushExternalIdSource | 'none';
    bindingUserId: string;
    bindingPushExternalId: string;
    bindingEmployeeId: string;
    bindingWorkspaceId: string;
    bindingWorkspaceSlug: string;
    bindingRole: UserRole | '';
    bindingChannel: 'internal' | 'portal' | '';
    bindingPresenceStatus: AuthPresenceStatus | 'unknown';
    bindingSessionKey: string;
    bindingDeviceId: string;
    bindingDeviceName: string;
    bindingInstallationId: string;
    bindingPlatform: string;
    bindingAppVersion: string;
    bindingTags: Record<string, string>;
    lastSyncedAt: string;
}

export interface OneSignalPushIdentity {
    externalId: string;
    externalIdSource: OneSignalPushExternalIdSource;
    userId: string;
    pushExternalId: string | null;
    role: UserRole;
    workspaceId: string;
    workspaceSlug: string;
    channel: 'internal' | 'portal';
    employeeId: string | null;
    customerId: string | null;
    supplierId: string | null;
    canSwitchRoles: boolean;
    sessionKey: string | null;
    deviceId: string | null;
    deviceName: string | null;
    installationId: string | null;
    platform: string | null;
    appVersion: string | null;
    presenceStatus: AuthPresenceStatus;
}

let initPromise: Promise<typeof OneSignal | null> | null = null;
let isInitialized = false;
let initError = '';
let lastSyncedIdentityKey = '';
let lastSyncedAt = '';

function ensureTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`;
}

function trimLeadingSlash(value: string) {
    return value.replace(/^\/+/, '');
}

function parseBoolean(value: string | undefined, fallback = false) {
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function isAbsoluteUrl(value: string) {
    return /^https?:\/\//i.test(value);
}

function resolvePublicPath(value: string | undefined, fallback: string) {
    const raw = (value || fallback).trim();
    if (!raw) return raw;
    if (isAbsoluteUrl(raw) || raw.startsWith('/')) return raw;
    return `${appBase}${trimLeadingSlash(raw)}`;
}

function resolveWorkerScope(value: string | undefined, fallback: string) {
    const resolved = resolvePublicPath(value, fallback);
    return ensureTrailingSlash(resolved);
}

function isPortalRole(role: UserRole) {
    return role === 'Cliente' || role === 'Proveedor';
}

function buildIdentityKey(identity: OneSignalPushIdentity) {
    return [
        identity.externalId,
        identity.externalIdSource,
        identity.userId,
        identity.pushExternalId || '',
        identity.role,
        identity.workspaceId,
        identity.workspaceSlug,
        identity.channel,
        identity.employeeId || '',
        identity.customerId || '',
        identity.supplierId || '',
        identity.canSwitchRoles ? '1' : '0',
        identity.sessionKey || '',
        identity.deviceId || '',
        identity.installationId || '',
        identity.platform || '',
        identity.appVersion || '',
        identity.presenceStatus,
    ].join('|');
}

function getPushSupport() {
    if (typeof window === 'undefined') return false;
    try {
        return Boolean(OneSignal.Notifications.isPushSupported());
    } catch {
        return false;
    }
}

function buildTagMap(identity: OneSignalPushIdentity) {
    const tags: Record<string, string> = {
        app: 'fideo',
        role: identity.role,
        workspace_id: identity.workspaceId,
        workspace_slug: identity.workspaceSlug,
        channel: identity.channel,
        user_id: identity.userId,
        push_external_id: identity.pushExternalId || identity.externalId,
        external_id_source: identity.externalIdSource,
        presence_status: identity.presenceStatus,
        can_switch_roles: identity.canSwitchRoles ? '1' : '0',
        auth_source: 'pocketbase',
    };

    if (identity.employeeId) tags.employee_id = identity.employeeId;
    if (identity.customerId) tags.customer_id = identity.customerId;
    if (identity.supplierId) tags.supplier_id = identity.supplierId;
    if (identity.sessionKey) tags.session_key = identity.sessionKey;
    if (identity.deviceId) tags.device_id = identity.deviceId;
    if (identity.deviceName) tags.device_name = identity.deviceName;
    if (identity.installationId) tags.installation_id = identity.installationId;
    if (identity.platform) tags.platform = identity.platform;
    if (identity.appVersion) tags.app_version = identity.appVersion;

    return tags;
}

function buildAliasMap(identity: OneSignalPushIdentity) {
    const aliases: Record<string, string> = {
        fideo_user_id: identity.userId,
        workspace_id: identity.workspaceId,
        workspace_slug: identity.workspaceSlug,
    };

    if (identity.employeeId) aliases.employee_id = identity.employeeId;
    if (identity.customerId) aliases.customer_id = identity.customerId;
    if (identity.supplierId) aliases.supplier_id = identity.supplierId;

    return aliases;
}

function resolvePushExternalBinding(profile: AuthSessionProfile) {
    const explicitExternalId = [profile.pushExternalId, profile.presence?.pushExternalId]
        .find((value) => typeof value === 'string' && value.trim())
        ?.trim()
        || '';

    if (explicitExternalId) {
        return {
            externalId: explicitExternalId,
            externalIdSource: 'pushExternalId' as const,
            pushExternalId: explicitExternalId,
        };
    }

    return {
        externalId: String(profile.id),
        externalIdSource: 'userId' as const,
        pushExternalId: null,
    };
}

function readSdkTags() {
    try {
        const tags = OneSignal.User.getTags();
        if (!tags || typeof tags !== 'object') return {};
        return Object.fromEntries(
            Object.entries(tags)
                .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
        );
    } catch {
        return {};
    }
}

function buildBindingFields(
    identity: OneSignalPushIdentity | null | undefined,
    actualExternalId = '',
    actualTags: Record<string, string> = {},
): Pick<
    OneSignalPushState,
    | 'bindingStatus'
    | 'bindingMessage'
    | 'bindingExternalId'
    | 'bindingExternalIdSource'
    | 'bindingUserId'
    | 'bindingPushExternalId'
    | 'bindingEmployeeId'
    | 'bindingWorkspaceId'
    | 'bindingWorkspaceSlug'
    | 'bindingRole'
    | 'bindingChannel'
    | 'bindingPresenceStatus'
    | 'bindingSessionKey'
    | 'bindingDeviceId'
    | 'bindingDeviceName'
    | 'bindingInstallationId'
    | 'bindingPlatform'
    | 'bindingAppVersion'
    | 'bindingTags'
> {
    if (!identity) {
        return {
            bindingStatus: oneSignalPushConfig.enabled ? 'idle' : 'disabled',
            bindingMessage: oneSignalPushConfig.enabled ? 'Sin identidad autenticada.' : 'Push desactivado.',
            bindingExternalId: '',
            bindingExternalIdSource: 'none',
            bindingUserId: '',
            bindingPushExternalId: '',
            bindingEmployeeId: '',
            bindingWorkspaceId: '',
            bindingWorkspaceSlug: '',
            bindingRole: '',
            bindingChannel: '',
            bindingPresenceStatus: 'unknown',
            bindingSessionKey: '',
            bindingDeviceId: '',
            bindingDeviceName: '',
            bindingInstallationId: '',
            bindingPlatform: '',
            bindingAppVersion: '',
            bindingTags: actualTags,
        };
    }

    const expectedTags = buildTagMap(identity);
    const mismatchedKeys = Object.entries(expectedTags)
        .filter(([key, value]) => actualTags[key] !== value)
        .map(([key]) => key);
    const externalMatches = Boolean(actualExternalId) && actualExternalId === identity.externalId;
    const isBound = externalMatches && mismatchedKeys.length === 0;

    let bindingMessage = 'Listo para enlazar push.';
    let bindingStatus: OneSignalPushBindingStatus = 'idle';

    if (isBound) {
        bindingStatus = 'bound';
        bindingMessage = identity.employeeId
            ? `Enlazado con ${identity.employeeId}.`
            : `Enlazado con ${identity.externalIdSource === 'pushExternalId' ? 'pushExternalId' : 'userId'}.`;
    } else if (actualExternalId || Object.keys(actualTags).length > 0) {
        bindingStatus = 'stale';
        bindingMessage = externalMatches
            ? `Faltan tags: ${mismatchedKeys.slice(0, 3).join(', ')}${mismatchedKeys.length > 3 ? '...' : ''}`
            : 'external_id fuera de contrato.';
    }

    return {
        bindingStatus,
        bindingMessage,
        bindingExternalId: identity.externalId,
        bindingExternalIdSource: identity.externalIdSource,
        bindingUserId: identity.userId,
        bindingPushExternalId: identity.pushExternalId || '',
        bindingEmployeeId: identity.employeeId || '',
        bindingWorkspaceId: identity.workspaceId,
        bindingWorkspaceSlug: identity.workspaceSlug,
        bindingRole: identity.role,
        bindingChannel: identity.channel,
        bindingPresenceStatus: identity.presenceStatus,
        bindingSessionKey: identity.sessionKey || '',
        bindingDeviceId: identity.deviceId || '',
        bindingDeviceName: identity.deviceName || '',
        bindingInstallationId: identity.installationId || '',
        bindingPlatform: identity.platform || '',
        bindingAppVersion: identity.appVersion || '',
        bindingTags: expectedTags,
    };
}

function applyDefaultStateOverlays(state: OneSignalPushState) {
    return {
        ...state,
        configured: oneSignalPushConfig.configured,
        enabled: oneSignalPushConfig.enabled,
        initError,
    };
}

export const oneSignalPushConfig: OneSignalPushConfig = {
    configured: Boolean(import.meta.env.VITE_ONESIGNAL_APP_ID?.trim()),
    enabled:
        parseBoolean(import.meta.env.VITE_ONESIGNAL_ENABLED, false)
        && Boolean(import.meta.env.VITE_ONESIGNAL_APP_ID?.trim()),
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID?.trim() || '',
    workerPath: resolvePublicPath(import.meta.env.VITE_ONESIGNAL_WORKER_PATH, 'onesignal/OneSignalSDKWorker.js'),
    workerScope: resolveWorkerScope(import.meta.env.VITE_ONESIGNAL_WORKER_SCOPE, 'onesignal/'),
    allowLocalhostAsSecureOrigin: parseBoolean(import.meta.env.VITE_ONESIGNAL_ALLOW_LOCALHOST, true),
    defaultTitle: 'Fideo',
    defaultUrl: appBase,
};

export const createEmptyOneSignalPushState = (): OneSignalPushState => ({
    configured: oneSignalPushConfig.configured,
    enabled: oneSignalPushConfig.enabled,
    supported: getPushSupport(),
    initialized: isInitialized,
    permission: false,
    permissionNative: 'default',
    optedIn: false,
    externalId: '',
    subscriptionId: '',
    onesignalId: '',
    initError,
    lastError: '',
    syncing: false,
    prompting: false,
    bindingStatus: oneSignalPushConfig.enabled ? 'idle' : 'disabled',
    bindingMessage: oneSignalPushConfig.enabled ? 'Pendiente de enlace.' : 'Push desactivado.',
    bindingExternalId: '',
    bindingExternalIdSource: 'none',
    bindingUserId: '',
    bindingPushExternalId: '',
    bindingEmployeeId: '',
    bindingWorkspaceId: '',
    bindingWorkspaceSlug: '',
    bindingRole: '',
    bindingChannel: '',
    bindingPresenceStatus: 'unknown',
    bindingSessionKey: '',
    bindingDeviceId: '',
    bindingDeviceName: '',
    bindingInstallationId: '',
    bindingPlatform: '',
    bindingAppVersion: '',
    bindingTags: {},
    lastSyncedAt,
});

export const normalizeOneSignalError = (error: unknown, fallback = 'No se pudo enlazar push.') => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error.trim();
    return fallback;
};

export const readOneSignalPushState = (identity?: OneSignalPushIdentity | null): OneSignalPushState => {
    const baseState = createEmptyOneSignalPushState();

    if (typeof window === 'undefined') {
        return {
            ...baseState,
            ...buildBindingFields(identity),
        };
    }

    const tags = readSdkTags();
    const externalId = String(OneSignal.User.externalId || '');

    return applyDefaultStateOverlays({
        ...baseState,
        ...buildBindingFields(identity, externalId, tags),
        supported: getPushSupport(),
        initialized: isInitialized,
        permission: Boolean(OneSignal.Notifications.permission),
        permissionNative: OneSignal.Notifications.permissionNative,
        optedIn: Boolean(OneSignal.User.PushSubscription.optedIn),
        externalId,
        subscriptionId: String(OneSignal.User.PushSubscription.id || ''),
        onesignalId: String(OneSignal.User.onesignalId || ''),
        lastSyncedAt,
    });
};

export const buildOneSignalIdentity = (
    profile: AuthSessionProfile | null | undefined,
    workspace: RemoteWorkspaceSnapshot | null | undefined,
): OneSignalPushIdentity | null => {
    if (!profile || !workspace) return null;
    const pushBinding = resolvePushExternalBinding(profile);

    return {
        externalId: pushBinding.externalId,
        externalIdSource: pushBinding.externalIdSource,
        userId: profile.id,
        pushExternalId: pushBinding.pushExternalId,
        role: profile.role,
        workspaceId: workspace.workspaceId,
        workspaceSlug: workspace.workspaceSlug,
        channel: isPortalRole(profile.role) ? 'portal' : 'internal',
        employeeId: profile.employeeId,
        customerId: profile.customerId,
        supplierId: profile.supplierId,
        canSwitchRoles: profile.canSwitchRoles,
        sessionKey: profile.presence?.sessionKey || null,
        deviceId: profile.presence?.deviceId || null,
        deviceName: profile.presence?.deviceName || null,
        installationId: profile.presence?.installationId || null,
        platform: profile.presence?.platform || null,
        appVersion: profile.presence?.appVersion || null,
        presenceStatus: profile.presence?.status || 'offline',
    };
};

export const ensureOneSignalReady = async (): Promise<typeof OneSignal | null> => {
    if (typeof window === 'undefined') return null;
    if (!oneSignalPushConfig.configured || !oneSignalPushConfig.enabled) return null;
    if (isInitialized) return OneSignal;
    if (initPromise) return initPromise;

    initPromise = OneSignal.init({
        appId: oneSignalPushConfig.appId,
        allowLocalhostAsSecureOrigin: oneSignalPushConfig.allowLocalhostAsSecureOrigin,
        serviceWorkerPath: oneSignalPushConfig.workerPath,
        serviceWorkerParam: {
            scope: oneSignalPushConfig.workerScope,
        },
        autoResubscribe: true,
    })
        .then(async () => {
            isInitialized = true;
            initError = '';
            try {
                await OneSignal.Notifications.setDefaultTitle(oneSignalPushConfig.defaultTitle);
            } catch {}
            try {
                await OneSignal.Notifications.setDefaultUrl(oneSignalPushConfig.defaultUrl);
            } catch {}
            return OneSignal;
        })
        .catch((error) => {
            initPromise = null;
            isInitialized = false;
            initError = normalizeOneSignalError(error, 'No se pudo inicializar OneSignal.');
            throw new Error(initError);
        });

    return initPromise;
};

export const syncOneSignalIdentity = async (identity: OneSignalPushIdentity) => {
    const client = await ensureOneSignalReady();
    if (!client) return null;

    const identityKey = buildIdentityKey(identity);
    const expectedTags = buildTagMap(identity);
    const currentTags = readSdkTags();
    const tagsMatch = Object.entries(expectedTags).every(([key, value]) => currentTags[key] === value);

    if (lastSyncedIdentityKey === identityKey && client.User.externalId === identity.externalId && tagsMatch) {
        return client;
    }

    await client.login(identity.externalId);

    client.User.addTags(expectedTags);

    const aliases = buildAliasMap(identity);
    client.User.addAliases(aliases);

    const staleKeys = PUSH_TAG_KEYS.filter((key) => !(key in expectedTags));
    if (staleKeys.length > 0) {
        client.User.removeTags(staleKeys as string[]);
    }

    const staleAliasKeys = PUSH_ALIAS_KEYS.filter((key) => !(key in aliases));
    if (staleAliasKeys.length > 0) {
        client.User.removeAliases(staleAliasKeys as string[]);
    }

    lastSyncedIdentityKey = identityKey;
    lastSyncedAt = new Date().toISOString();
    return client;
};

export const clearOneSignalIdentity = async () => {
    if (typeof window === 'undefined' || (!isInitialized && !initPromise)) return null;

    const client = await ensureOneSignalReady();
    if (!client) return null;

    client.User.removeTags([...PUSH_TAG_KEYS]);
    client.User.removeAliases([...PUSH_ALIAS_KEYS]);
    await client.logout();
    lastSyncedIdentityKey = '';
    lastSyncedAt = '';
    return client;
};

export const optInOneSignalPush = async (identity: OneSignalPushIdentity) => {
    const client = await syncOneSignalIdentity(identity);
    if (!client) return null;
    await client.User.PushSubscription.optIn();
    return client;
};

export const optOutOneSignalPush = async () => {
    const client = await ensureOneSignalReady();
    if (!client) return null;
    await client.User.PushSubscription.optOut();
    return client;
};
