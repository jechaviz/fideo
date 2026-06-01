import { createJsonClient } from './httpClient.js';

export const createVeeperGateway = ({ baseUrl, token = '' }) => {
  const client = createJsonClient({
    baseUrl,
    token,
    browserClient: 'veeper-ui',
  });

  return {
    async inspect() {
      try {
        const state = await client.get('/api/readiness');
        return {
          kind: 'veeper',
          status: 'ok',
          message: `Veeper readiness ${state.production_score ?? 'n/a'}%.`,
        };
      } catch (error) {
        return {
          kind: 'veeper',
          status: 'dry-run',
          message: `Veeper no disponible: ${error.message}`,
        };
      }
    },
    async planWhatsAppFollowUp(input) {
      try {
        const plan = await client.post('/api/automessage/plan', {
          chat_id: input.taskId || 'fideo-follow-up',
          account_id: 'acc-whatsapp-local',
          intent: 'operational_follow_up',
          tone: 'direct',
          cadence: 'once',
          context: `${input.summary}. ${input.detail}`,
          media_kinds: ['text'],
          consent_scope: 'client_authorized_operations',
          enabled: true,
        });

        return {
          kind: 'veeper_whatsapp_plan',
          status: 'ok',
          message: plan.message || 'Seguimiento WhatsApp planeado por Veeper.',
        };
      } catch (error) {
        return {
          kind: 'veeper_whatsapp_plan',
          status: 'dry-run',
          message: `Plan Veeper pendiente: ${error.message}`,
        };
      }
    },
    async planPromotion(input) {
      try {
        const plan = await client.post('/api/automessage/plan', {
          chat_id: input.campaignId || 'fideo-promotion',
          account_id: 'acc-whatsapp-local',
          intent: 'commercial_promotion',
          tone: 'premium_direct',
          cadence: 'once',
          context: input.message,
          media_kinds: ['text'],
          consent_scope: 'client_authorized_marketing',
          enabled: true,
          targets: input.targets || [],
        });

        return {
          kind: 'veeper_promotion_plan',
          status: 'ok',
          message: plan.message || 'Promocion WhatsApp planeada por Veeper.',
        };
      } catch (error) {
        return {
          kind: 'veeper_promotion_plan',
          status: 'dry-run',
          message: `Promocion Veeper pendiente: ${error.message}`,
        };
      }
    },
    async planProviderReceipt(input) {
      try {
        const receipt = await client.post('/api/automessage/receipt', {
          campaign_id: input.campaignId,
          provider: input.provider || 'veeper',
          delivered: input.delivered || 0,
          failed: input.failed || 0,
        });

        return {
          kind: 'veeper_provider_receipt',
          status: 'ok',
          message: receipt.message || 'Recibo de proveedor sincronizado con Veeper.',
        };
      } catch (error) {
        return {
          kind: 'veeper_provider_receipt',
          status: 'dry-run',
          message: `Recibo Veeper pendiente: ${error.message}`,
        };
      }
    },
  };
};
