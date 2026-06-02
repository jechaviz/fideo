import { normalizeAiProviderConfig } from './aiProviderCatalog.js';

export const createAiGateway = ({ codexGoalPath, provider, model, variant }) => {
  const aiConfig = normalizeAiProviderConfig({ provider, model, variant });
  const engineLabel = `${aiConfig.providerLabel} ${aiConfig.model}`;

  return {
    async inspect() {
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
