import OneSignal from 'react-onesignal';
import type { UserRole } from '../../types';
import type { AuthSessionProfile } from '../pocketbase/auth';
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
] as const;

const appBase = ensureTrailingSlash(import.meta.env.BASE_URL || '/');

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
    initError: string;
    lastError: string;
    syncing: boolean;
    prompting: boolean;
}

export interface OneSignalPushIdentity {
    externalId: string;
    role: UserRole;
    workspaceId: string;
    workspaceSlug: string;
    channel: 'internal' | 'portal';
    employeeId: string | null;
    customerId: string | null;
    supplierId: string | null;
    canSwitchRoles: boolean;
}

let initPromise: Promise<typeof OneSignal | null> | null = null;
let isInitialized = false;
let initError = '';
let lastSyncedIdentityKey = '';

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
        identity.role,
        identity.workspaceId,
        identity.workspaceSlug,
        identity.channel,
        identity.employeeId || '',
        identity.customerId || '',
        identity.supplierId || '',
        identity.canSwitchRoles ? '1' : '0',
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
        can_switch_roles: identity.canSwitchRoles ? '1' : '0',
        auth_source: 'pocketbase',
    };

    if (identity.employeeId) tags.employee_id = identity.employeeId;
    if (identity.customerId) tags.customer_id = identity.customerId;
    if (identity.supplierId) tags.supplier_id = identity.supplierId;

    return tags;
}

function resolvePushExternalId(profile: AuthSessionProfile) {
    const explicitExternalId = typeof profile.pushExternalId === 'string' ? profile.pushExternalId.trim() : '';
    if (explicitExternalId) return explicitExternalId;
    return String(profile.id);
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
    initError,
    lastError: '',
    syncing: false,
    prompting: false,
});

export const normalizeOneSignalError = (error: unknown, fallback = 'No se pudo enlazar push.') => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error.trim();
    return fallback;
};

export const readOneSignalPushState = (): OneSignalPushState => {
    const baseState = createEmptyOneSignalPushState();

    if (typeof window === 'undefined') {
        return baseState;
    }

    return applyDefaultStateOverlays({
        ...baseState,
        supported: getPushSupport(),
        initialized: isInitialized,
        permission: Boolean(OneSignal.Notifications.permission),
        permissionNative: OneSignal.Notifications.permissionNative,
        optedIn: Boolean(OneSignal.User.PushSubscription.optedIn),
        externalId: String(OneSignal.User.externalId || ''),
        subscriptionId: String(OneSignal.User.PushSubscription.id || ''),
    });
};

export const buildOneSignalIdentity = (
    profile: AuthSessionProfile | null | undefined,
    workspace: RemoteWorkspaceSnapshot | null | undefined,
): OneSignalPushIdentity | null => {
    if (!profile || !workspace) return null;

    return {
        externalId: resolvePushExternalId(profile),
        role: profile.role,
        workspaceId: workspace.workspaceId,
        workspaceSlug: workspace.workspaceSlug,
        channel: isPortalRole(profile.role) ? 'portal' : 'internal',
        employeeId: profile.employeeId,
        customerId: profile.customerId,
        supplierId: profile.supplierId,
        canSwitchRoles: profile.canSwitchRoles,
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
    if (lastSyncedIdentityKey === identityKey && client.User.externalId === identity.externalId) {
        return client;
    }

    await client.login(identity.externalId);

    const tags = buildTagMap(identity);
    client.User.addTags(tags);

    const staleKeys = PUSH_TAG_KEYS.filter((key) => !(key in tags));
    if (staleKeys.length > 0) {
        client.User.removeTags(staleKeys as string[]);
    }

    lastSyncedIdentityKey = identityKey;
    return client;
};

export const clearOneSignalIdentity = async () => {
    if (typeof window === 'undefined' || (!isInitialized && !initPromise)) return null;

    const client = await ensureOneSignalReady();
    if (!client) return null;

    client.User.removeTags([...PUSH_TAG_KEYS]);
    await client.logout();
    lastSyncedIdentityKey = '';
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
