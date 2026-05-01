import React from 'react';
import { OneSignalPushController } from '../hooks/useOneSignalPush';

const PushToggle: React.FC<{ push: OneSignalPushController }> = ({ push }) => {
    const { state } = push;

    if (!state.configured || !state.enabled) {
        return null;
    }

    const unsupported = state.initialized && !state.supported;
    const busy = state.prompting || state.syncing;
    const active = state.optedIn;
    const disabled = busy || unsupported;

    const title = unsupported
        ? 'Push no disponible aqui.'
        : active
            ? 'Push activo. Click para apagarlo.'
            : state.lastError || state.initError
                ? `Push con error. ${state.lastError || state.initError}`
                : 'Activar push.';

    const handleClick = async () => {
        if (disabled) return;
        if (active) {
            await push.optOut();
            return;
        }
        await push.promptSubscription();
    };

    const toneClass = unsupported
        ? 'border-red-400/20 bg-red-500/10 text-red-100'
        : active
            ? 'border-brand-400/30 bg-brand-400/12 text-brand-100'
            : state.lastError || state.initError
                ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white';

    return (
        <button
            type="button"
            aria-label={active ? 'Desactivar push' : 'Activar push'}
            title={title}
            onClick={() => void handleClick()}
            disabled={disabled}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${toneClass} ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
        >
            <i
                className={`fa-solid ${
                    busy ? 'fa-spinner fa-spin' : unsupported ? 'fa-bell-slash' : active ? 'fa-bell' : 'fa-bell'
                } text-sm`}
            />
        </button>
    );
};

export default PushToggle;
