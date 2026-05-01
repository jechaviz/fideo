import { UserRole } from '../../types';
import { POCKETBASE_AUTH_COLLECTION, requirePocketBaseClient } from './client';

export interface AuthSessionProfile {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    workspaceId: string | null;
    customerId: string | null;
    supplierId: string | null;
    employeeId: string | null;
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

const resolveRequiredText = (...values: unknown[]): string => {
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const normalized = value.trim();
        if (normalized) return normalized;
    }

    return '';
};

const mapAuthRecord = (record: Record<string, unknown> | null | undefined): AuthSessionProfile | null => {
    if (!record) return null;

    return {
        id: resolveRequiredText(record.id),
        email: resolveRequiredText(record.email),
        name: resolveRequiredText(record.name, record.email) || 'Fideo User',
        role: normalizeRole(record.role),
        workspaceId: normalizeOptionalId(record.workspace),
        customerId: normalizeOptionalId(record.customerId),
        supplierId: normalizeOptionalId(record.supplierId),
        employeeId: normalizeOptionalId(record.employeeId),
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
        workspaceId: normalizeOptionalId(primary?.workspaceId) ?? normalizeOptionalId(fallback?.workspaceId),
        customerId: normalizeOptionalId(primary?.customerId) ?? normalizeOptionalId(fallback?.customerId),
        supplierId: normalizeOptionalId(primary?.supplierId) ?? normalizeOptionalId(fallback?.supplierId),
        employeeId: normalizeOptionalId(primary?.employeeId) ?? normalizeOptionalId(fallback?.employeeId),
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
