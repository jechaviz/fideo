export const aiProviderCatalog = Object.freeze([
  {
    id: 'kilo',
    label: 'Kilo Code',
    defaultModel: 'kilo/stepfun/step-3.7-flash:free',
    models: [
      'kilo/stepfun/step-3.7-flash:free',
      'kilo/stepfun/step-3.5-flash:free',
      'kilo/z-ai/glm-5.1',
      'kilo/nvidia/nemotron-3-super-120b-a12b:free',
    ],
    variants: ['high', 'medium', 'low', 'max', 'minimal'],
    defaultVariant: 'high',
  },
  {
    id: 'gemini',
    label: 'Gemini Free',
    defaultModel: 'gemini-3-flash-preview',
    models: ['gemini-3-flash-preview'],
    variants: ['off'],
    defaultVariant: 'off',
  },
  {
    id: 'omniroute',
    label: 'OmniRoute Gateway',
    defaultModel: 'stepfun-ai/step-3.7-flash',
    models: ['stepfun-ai/step-3.7-flash'],
    variants: ['off'],
    defaultVariant: 'off',
  },
]);

const providerAliases = Object.freeze({
  stepfun: 'kilo',
  'step-fun': 'kilo',
  step: 'kilo',
});

const modelAliases = Object.freeze({
  'kilo-auto/free': 'kilo/stepfun/step-3.7-flash:free',
  'stepfun 3.7 free': 'kilo/stepfun/step-3.7-flash:free',
  'stepfun-3.7-free': 'kilo/stepfun/step-3.7-flash:free',
  'stepfun/step-3.7-flash:free': 'kilo/stepfun/step-3.7-flash:free',
  'kilo/stepfun-step-3.7-flash': 'kilo/stepfun/step-3.7-flash:free',
  'omniroute/step-3.7-flash': 'stepfun-ai/step-3.7-flash',
  'stepfun-ai/step-3.7-flash': 'stepfun-ai/step-3.7-flash',
});

const catalogById = new Map(aiProviderCatalog.map((provider) => [provider.id, provider]));

const normalizeId = (value) => String(value || '').trim().toLowerCase();

export const normalizeAiModel = (model) => {
  const clean = String(model || '').trim();
  return modelAliases[clean] || clean;
};

export const providerForModel = (model) => {
  const normalizedModel = normalizeAiModel(model);
  return aiProviderCatalog.find((provider) => provider.models.includes(normalizedModel)) || null;
};

export const normalizeAiProviderConfig = (config = {}) => {
  const requestedProvider = normalizeId(config.provider || config.aiProvider || '');
  const requestedModelInput = config.model || config.aiModel || '';
  const providerId = providerAliases[requestedProvider] || requestedProvider || providerForModel(requestedModelInput)?.id || 'kilo';
  const provider = catalogById.get(providerId) || catalogById.get('kilo');
  const requestedModel = normalizeAiModel(requestedModelInput);
  const model = provider.models.includes(requestedModel) ? requestedModel : provider.defaultModel;
  const requestedVariant = String(config.variant || config.aiVariant || '').trim();
  const variant = provider.variants.includes(requestedVariant) ? requestedVariant : provider.defaultVariant;

  return {
    provider: provider.id,
    providerLabel: provider.label,
    model,
    variant,
    models: [...provider.models],
    providers: aiProviderCatalog.map((item) => ({
      id: item.id,
      label: item.label,
      defaultModel: item.defaultModel,
    })),
  };
};
