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
  };
};

