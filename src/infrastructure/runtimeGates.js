const bool = (value) => value === true || value === 'true' || value === '1';

export const runtimeGateMatrix = (config = {}) => {
  const pocketbaseLive = Boolean(config.pocketbaseBaseUrl);
  const snapshotBackend = config.pocketbaseBackend === 'mysql' ? 'mysql' : 'pocketbase';
  const veeperLive = Boolean(config.veeperBaseUrl);
  const oneSignalLive = bool(config.allowOneSignalLive) && Boolean(config.oneSignalAppId);
  const aiLive = Boolean(config.codexGoalPath);
  return [
    {
      id: 'pocketbase',
      title: snapshotBackend === 'mysql' ? 'MySQL snapshot' : 'PocketBase realtime',
      status: pocketbaseLive ? 'live-ready' : 'dry-run',
      detail: pocketbaseLive
        ? `${config.pocketbaseBaseUrl} via ${snapshotBackend}`
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
      status: veeperLive ? 'live-ready' : 'dry-run',
      detail: veeperLive ? config.veeperBaseUrl : 'Sin endpoint; solo planes locales.',
    },
    {
      id: 'codex-goal',
      title: 'codex-goal AI',
      status: aiLive ? 'local-ready' : 'dry-run',
      detail: config.codexGoalPath || 'Sin ruta local configurada.',
    },
  ];
};

export const gateSummary = (gates) => ({
  liveReady: gates.filter((gate) => gate.status === 'live-ready' || gate.status === 'local-ready').length,
  gated: gates.filter((gate) => gate.status === 'gated').length,
  dryRun: gates.filter((gate) => gate.status === 'dry-run').length,
});
