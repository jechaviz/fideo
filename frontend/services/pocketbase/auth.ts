import { UserRole } from '../../types';
import { POCKETBASE_AUTH_COLLECTION, requirePocketBaseClient } from './client';

export type AuthPresenceStatus = 'active' | 'background' | 'idle' | 'offline';

export interface AuthPresenceState {
    sessionKey: string | null;
    status: AuthPresenceStatus;
    sessionId: string | null;
    deviceId: string | null;
    deviceName: string | null;
    installationId: string | null;
    platform: string | null;
    appVersion: string | null;
    pushExternalId: string | null;
    meta: Record<string, unknown> | null;
}

export interface AuthSessionProfile {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    workspaceId: string | null;
    customerId: string | null;
    supplierId: string | null;
    employeeId: string | null;
    pushExternalId: string | null;
    lastSeenAt: string | null;
    presence: AuthPresenceState | null;
    canSwitchRoles: boolean;
}

export const isInternalRole = (role: UserRole): boolean => ['Admin', 'Repartidor', 'Empacador', 'Cajero'].includes(role);

export const isPortalRole = (role: UserRole): boolean => ['Cliente', 'Proveedor'].includes(role);

export const isPortalOnlyProfile = (profile: AuthSessionProfile | null | undefined): boolean =>
    Boolean(profile && isPortalRole(profile.role) && !profile.canSwitchRoles);

export const canPersistRemoteStateForProfile = (profile: AuthSessionProfile | null | undefined): boolean =>
    !isPortalOnlyProfile(profile);

const normalizeRole = (value: unknown): UserRole => {
    const allowedRoles: UserRole[] = ['Admin', 'Repartidor', 'Empacador', 'Cajero', 'Cliente', 'Proveedor'];
    return allowedRoles.includes(value as UserRole) ? (value as UserRole) : 'Admin';
};

const normalizeOptionalId = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
};

const resolveOptionalText = (...values: unknown[]): string | null => {
    for (const value of values) {
        const normalized = normalizeOptionalId(value);
        if (normalized) return normalized;
    }

    return null;
};

const resolveRequiredText = (...values: unknown[]): string => {
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const normalized = value.trim();
        if (normalized) return normalized;
    }

    return '';
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const normalizePresenceStatus = (value: unknown): AuthPresenceStatus => {
    if (value === 'background' || value === 'idle' || value === 'offline') return value;
    return 'active';
};

const mapPresenceState = (value: unknown): AuthPresenceState | null => {
    const record = asRecord(value);
    if (!record) return null;

    return {
        sessionKey: resolveOptionalText(record.sessionKey),
        status: normalizePresenceStatus(record.status),
        sessionId: resolveOptionalText(record.sessionId),
        deviceId: resolveOptionalText(record.deviceId),
        deviceName: resolveOptionalText(record.deviceName),
        installationId: resolveOptionalText(record.installationId),
        platform: resolveOptionalText(record.platform),
        appVersion: resolveOptionalText(record.appVersion),
        pushExternalId: resolveOptionalText(record.pushExternalId),
        meta: asRecord(record.meta),
    };
};

const mapAuthRecord = (record: Record<string, unknown> | null | undefined): AuthSessionProfile | null => {
    if (!record) return null;

    return {
        id: resolveRequiredText(record.id),
        email: resolveRequiredText(record.email),
        name: resolveRequiredText(record.name, record.email) || 'Fideo User',
        role: normalizeRole(record.role),
        workspaceId: resolveOptionalText(record.workspaceId, record.workspace),
        customerId: resolveOptionalText(record.customerId),
        supplierId: resolveOptionalText(record.supplierId),
        employeeId: resolveOptionalText(record.employeeId),
        pushExternalId: resolveOptionalText(record.pushExternalId),
        lastSeenAt: resolveOptionalText(record.lastSeenAt),
        presence: mapPresenceState(record.presence),
        canSwitchRoles: Boolean(record.canSwitchRoles),
    };
};

export const mergeAuthSessionProfiles = (
    primary: Partial<AuthSessionProfile> | null | undefined,
    fallback: AuthSessionProfile | null | undefined,
): AuthSessionProfile | null => {
    if (!primary && !fallback) return null;

    return {
        id: resolveRequiredText(primary?.id, fallback?.id),
        email: resolveRequiredText(primary?.email, fallback?.email),
        name: resolveRequiredText(primary?.name, fallback?.name, primary?.email, fallback?.email) || 'Fideo User',
        role: normalizeRole(primary?.role ?? fallback?.role),
        workspaceId: resolveOptionalText(primary?.workspaceId, fallback?.workspaceId),
        customerId: resolveOptionalText(primary?.customerId, fallback?.customerId),
        supplierId: resolveOptionalText(primary?.supplierId, fallback?.supplierId),
        employeeId: resolveOptionalText(primary?.employeeId, fallback?.employeeId),
        pushExternalId: resolveOptionalText(primary?.pushExternalId, fallback?.pushExternalId),
        lastSeenAt: resolveOptionalText(primary?.lastSeenAt, fallback?.lastSeenAt),
        presence: primary?.presence || fallback?.presence || null,
        canSwitchRoles: typeof primary?.canSwitchRoles === 'boolean' ? primary.canSwitchRoles : Boolean(fallback?.canSwitchRoles),
    };
};

export const signInWithPassword = async (email: string, password: string): Promise<AuthSessionProfile> => {
    const pb = requirePocketBaseClient();
    const authData = await pb.collection(POCKETBASE_AUTH_COLLECTION).authWithPassword(email, password);
    const profile = mapAuthRecord((authData.record || pb.authStore.record) as Record<string, unknown>);
    if (!profile) {
        throw new Error('No se pudo leer el perfil autenticado de PocketBase.');
    }
    return profile;
};

export const restoreAuthProfile = async (): Promise<AuthSessionProfile | null> => {
    const pb = requirePocketBaseClient();
    if (!pb.authStore.isValid) return null;
    const authData = await pb.collection(POCKETBASE_AUTH_COLLECTION).authRefresh();
    return mapAuthRecord((authData.record || pb.authStore.record) as Record<string, unknown>);
};

export const clearAuthSession = () => {
    const pb = requirePocketBaseClient();
    pb.authStore.clear();
};
