import { normalizeAiProviderConfig } from './aiProviderCatalog.js';

const bool = (value) => value === true || value === 'true' || value === '1';

export const runtimeGateMatrix = (config = {}) => {
  const snapshotConfigured = Boolean(config.pocketbaseBaseUrl);
  const snapshotMutationsEnabled = snapshotConfigured && Boolean(config.pocketbaseToken);
  const snapshotBackend = config.pocketbaseBackend === 'mysql' ? 'mysql' : 'pocketbase';
  const veeperConfigured = Boolean(config.veeperBaseUrl);
  const oneSignalLive = bool(config.allowOneSignalLive) && Boolean(config.oneSignalAppId);
  const aiConfigured = Boolean(config.codexGoalPath);
  const aiBridgeConfigured = Boolean(config.aiBridgeUrl);
  const ai = normalizeAiProviderConfig({
    provider: config.aiProvider,
    model: config.aiModel,
    variant: config.aiVariant,
  });
  return [
    {
      id: 'pocketbase',
      title: snapshotBackend === 'mysql' ? 'MySQL snapshot' : 'PocketBase realtime',
      status: snapshotConfigured ? (snapshotMutationsEnabled ? 'configured' : 'gated') : 'dry-run',
      detail: snapshotConfigured
        ? `${config.pocketbaseBaseUrl} via ${snapshotBackend}; ${snapshotMutationsEnabled ? 'mutaciones habilitadas' : 'mutaciones protegidas'}.`
        : 'Sin baseUrl; snapshot local.',
    },
    {
      id: 'onesignal',
      title: 'OneSignal live',
      status: oneSignalLive ? 'live-ready' : 'gated',
      detail: oneSignalLive ? config.oneSignalAppId : 'SDK bloqueado hasta deployment gate explicito.',
    },
    {
      id: 'veeper',
      title: 'Veeper WhatsApp',
      status: veeperConfigured ? 'configured' : 'dry-run',
      detail: veeperConfigured ? `${config.veeperBaseUrl}; validar con inspeccion.` : 'Sin endpoint; solo planes locales.',
    },
    {
      id: 'codex-goal',
      title: `${ai.providerLabel} AI`,
      status: aiBridgeConfigured || aiConfigured ? 'configured' : 'dry-run',
      detail: `${ai.model} (${ai.variant}); bridge ${config.aiBridgeUrl || 'sin bridge'}; ${config.codexGoalPath || 'sin ruta local configurada'}.`,
    },
  ];
};

export const gateSummary = (gates) => ({
  liveReady: gates.filter((gate) => gate.status === 'live-ready' || gate.status === 'local-ready').length,
  gated: gates.filter((gate) => gate.status === 'gated').length,
  dryRun: gates.filter((gate) => gate.status === 'dry-run').length,
  configured: gates.filter((gate) => gate.status === 'configured').length,
});
