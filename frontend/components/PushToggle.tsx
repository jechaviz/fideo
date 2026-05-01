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
    const hasError = Boolean(state.lastError || state.initError || state.bindingStatus === 'error');
    const isStale = state.bindingStatus === 'stale';

    const bindingTitle = [
        `estado: ${state.bindingStatus}`,
        state.bindingMessage,
        state.bindingEmployeeId ? `employeeId: ${state.bindingEmployeeId}` : '',
        state.bindingExternalId ? `external_id: ${state.bindingExternalId}` : '',
        state.bindingPushExternalId ? `pushExternalId: ${state.bindingPushExternalId}` : `source: ${state.bindingExternalIdSource}`,
    ]
        .filter(Boolean)
        .join('\n');

    const title = unsupported
        ? 'Push no disponible aqui.'
        : active
            ? `Push activo.\n${bindingTitle}\nClick para apagarlo.`
            : hasError
                ? `Push con error.\n${state.lastError || state.initError || state.bindingMessage}`
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
        : hasError
            ? 'border-red-400/20 bg-red-500/10 text-red-100'
            : isStale
                ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
        : active
            ? 'border-brand-400/30 bg-brand-400/12 text-brand-100'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white';

    const dotClass = unsupported || hasError
        ? 'bg-red-300'
        : isStale
            ? 'bg-amber-300'
            : active
                ? 'bg-brand-300'
                : 'bg-slate-400';

    const ariaLabel = active
        ? `Desactivar push. ${state.bindingMessage}`
        : `Activar push. ${state.bindingMessage}`;

    return (
        <button
            type="button"
            aria-label={ariaLabel}
            title={title}
            onClick={() => void handleClick()}
            disabled={disabled}
            className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${toneClass} ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
        >
            <i
                className={`fa-solid ${
                    busy ? 'fa-spinner fa-spin' : unsupported ? 'fa-bell-slash' : active ? 'fa-bell' : 'fa-bell'
                } text-sm`}
            />
            <span className={`absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full ${dotClass}`} />
        </button>
    );
};

export default PushToggle;
