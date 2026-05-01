import PocketBase from 'pocketbase';

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL?.trim() || '';

let pocketBaseClient: PocketBase | null = null;

export const isPocketBaseEnabled = () => Boolean(pocketBaseUrl);

export const getPocketBaseClient = (): PocketBase | null => {
    if (!isPocketBaseEnabled()) return null;
    if (!pocketBaseClient) {
        pocketBaseClient = new PocketBase(pocketBaseUrl);
        pocketBaseClient.autoCancellation(false);
    }
    return pocketBaseClient;
};

export const requirePocketBaseClient = (): PocketBase => {
    const client = getPocketBaseClient();
    if (!client) {
        throw new Error('PocketBase no esta configurado. Define VITE_POCKETBASE_URL para habilitar el backend.');
    }
    return client;
};

export const POCKETBASE_AUTH_COLLECTION = 'fideo_users';
