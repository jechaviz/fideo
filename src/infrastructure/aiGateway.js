import { normalizeAiProviderConfig } from './aiProviderCatalog.js';

const cleanUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const parsePayload = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const requestBridge = async (fetchImpl, bridgeUrl, path, options = {}) => {
  const headers = {
    'content-type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetchImpl(`${bridgeUrl}${path}`, {
    ...options,
    headers,
  });
  const payload = await parsePayload(response);
  return { ok: response.ok, status: response.status, payload };
};

export const createAiGateway = ({
  codexGoalPath,
  provider,
  model,
  variant,
  bridgeUrl,
  fetchImpl = fetch,
}) => {
  const aiConfig = normalizeAiProviderConfig({ provider, model, variant });
  const engineLabel = `${aiConfig.providerLabel} ${aiConfig.model}`;
  const bridge = cleanUrl(bridgeUrl);

  return {
    async inspect() {
      if (bridge) {
        try {
          const result = await requestBridge(fetchImpl, bridge, '/health');
          if (result.ok) {
            return {
              ...result.payload,
              kind: 'ai_engine',
              status: 'local-ready',
              message: `${engineLabel} conectado por bridge local.`,
              bridgeUrl: bridge,
            };
          }
          return {
            kind: 'ai_engine',
            status: 'failed',
            message: result.payload.message || `Kilo bridge fallo (${result.status}).`,
            bridgeUrl: bridge,
          };
        } catch (error) {
          return {
            kind: 'ai_engine',
            status: 'failed',
            message: `Kilo bridge no responde: ${error.message}`,
            bridgeUrl: bridge,
          };
        }
      }
      return {
        kind: 'ai_engine',
        status: 'dry-run',
        message: `Adapter listo para ${engineLabel}.`,
        path: codexGoalPath,
        provider: aiConfig.provider,
        model: aiConfig.model,
        variant: aiConfig.variant,
        providers: aiConfig.providers,
      };
    },
    async planInsightRun(workspaceId, intent) {
      if (bridge) {
        try {
          const result = await requestBridge(fetchImpl, bridge, '/plan', {
            method: 'POST',
            body: JSON.stringify({
              workspaceId,
              intent,
              provider: aiConfig.provider,
              model: aiConfig.model,
              variant: aiConfig.variant,
              codexGoalPath,
            }),
          });
          if (result.ok) {
            return {
              kind: 'ai_engine_plan',
              status: result.payload.status || 'ok',
              message: result.payload.message || `${engineLabel} ejecuto el plan.`,
              path: codexGoalPath,
              workspaceId,
              provider: aiConfig.provider,
              model: aiConfig.model,
              variant: aiConfig.variant,
              bridgeUrl: bridge,
              result: result.payload.result,
            };
          }
          return {
            kind: 'ai_engine_plan',
            status: 'failed',
            message: result.payload.message || `Kilo bridge fallo (${result.status}).`,
            workspaceId,
            provider: aiConfig.provider,
            model: aiConfig.model,
            bridgeUrl: bridge,
          };
        } catch (error) {
          return {
            kind: 'ai_engine_plan',
            status: 'failed',
            message: `Kilo bridge no responde: ${error.message}`,
            workspaceId,
            provider: aiConfig.provider,
            model: aiConfig.model,
            bridgeUrl: bridge,
          };
        }
      }
      return {
        kind: 'ai_engine_plan',
        status: 'dry-run',
        message: `${engineLabel} planificado para ${intent}.`,
        path: codexGoalPath,
        workspaceId,
        provider: aiConfig.provider,
        model: aiConfig.model,
        variant: aiConfig.variant,
      };
    },
  };
};
