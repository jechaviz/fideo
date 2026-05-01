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

const mapAuthRecord = (record: Record<string, unknown> | null | undefined): AuthSessionProfile | null => {
    if (!record) return null;

    return {
        id: String(record.id || ''),
        email: String(record.email || ''),
        name: String(record.name || record.email || 'Fideo User'),
        role: normalizeRole(record.role),
        workspaceId: record.workspace ? String(record.workspace) : null,
        customerId: record.customerId ? String(record.customerId) : null,
        supplierId: record.supplierId ? String(record.supplierId) : null,
        canSwitchRoles: Boolean(record.canSwitchRoles),
    };
};

export const signInWithPassword = async (email: string, password: string): Promise<AuthSessionProfile> => {
    const pb = requirePocketBaseClient();
    const authData = await pb.collection(POCKETBASE_AUTH_COLLECTION).authWithPassword(email, password);
    const profile = mapAuthRecord(authData.record as Record<string, unknown>);
    if (!profile) {
        throw new Error('No se pudo leer el perfil autenticado de PocketBase.');
    }
    return profile;
};

export const restoreAuthProfile = async (): Promise<AuthSessionProfile | null> => {
    const pb = requirePocketBaseClient();
    if (!pb.authStore.isValid) return null;
    const authData = await pb.collection(POCKETBASE_AUTH_COLLECTION).authRefresh();
    return mapAuthRecord(authData.record as Record<string, unknown>);
};

export const clearAuthSession = () => {
    const pb = requirePocketBaseClient();
    pb.authStore.clear();
};
