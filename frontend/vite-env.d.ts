/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_POCKETBASE_URL?: string;
    readonly VITE_GEMINI_API_KEY?: string;
    readonly VITE_ONESIGNAL_ENABLED?: string;
    readonly VITE_ONESIGNAL_APP_ID?: string;
    readonly VITE_ONESIGNAL_WORKER_PATH?: string;
    readonly VITE_ONESIGNAL_WORKER_SCOPE?: string;
    readonly VITE_ONESIGNAL_ALLOW_LOCALHOST?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
