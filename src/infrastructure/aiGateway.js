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

const requestBridge = async (fetchImpl, bridgeUrl, token, path, options = {}) => {
  const response = await fetchImpl(`${bridgeUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-fideo-ai-token': token,
      ...(options.headers || {}),
    },
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
  bridgeToken,
  fetchImpl = fetch,
}) => {
  const aiConfig = normalizeAiProviderConfig({ provider, model, variant });
  const engineLabel = `${aiConfig.providerLabel} ${aiConfig.model}`;
  const bridge = cleanUrl(bridgeUrl);
  const token = String(bridgeToken || '').trim();
  const activationHint = 'Inicia scripts/kilo-bridge.mjs y guarda FIDEO_AI_BRIDGE_TOKEN en localStorage.';

  const gatedReceipt = (kind) => ({
    kind,
    status: 'gated',
    message: `Kilo bridge requiere token local. ${activationHint}`,
    provider: aiConfig.provider,
    model: aiConfig.model,
    variant: aiConfig.variant,
    bridgeUrl: bridge,
  });

  return {
    async inspect() {
      if (bridge && !token) return gatedReceipt('ai_engine');
      if (bridge && token) {
        try {
          const result = await requestBridge(fetchImpl, bridge, token, '/health');
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
        message: `Adapter listo para ${engineLabel}. ${activationHint}`,
        path: codexGoalPath,
        provider: aiConfig.provider,
        model: aiConfig.model,
        variant: aiConfig.variant,
        providers: aiConfig.providers,
      };
    },
    async planInsightRun(workspaceId, intent) {
      if (bridge && !token) return gatedReceipt('ai_engine_plan');
      if (bridge && token) {
        try {
          const result = await requestBridge(fetchImpl, bridge, token, '/plan', {
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
        message: `${engineLabel} planificado para ${intent}. ${activationHint}`,
        path: codexGoalPath,
        workspaceId,
        provider: aiConfig.provider,
        model: aiConfig.model,
        variant: aiConfig.variant,
      };
    },
  };
};
