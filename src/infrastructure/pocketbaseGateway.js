export const createPocketBaseGateway = ({ baseUrl = '' } = {}) => ({
  async inspect() {
    if (!baseUrl) {
      return {
        kind: 'pocketbase',
        status: 'dry-run',
        message: 'PocketBase no esta configurado en este slice estatico.',
      };
    }

    const response = await fetch(new URL('/api/health', baseUrl).href, {
      credentials: 'same-origin',
    });

    return {
      kind: 'pocketbase',
      status: response.ok ? 'ok' : 'failed',
      message: response.ok ? 'PocketBase responde health.' : `PocketBase HTTP ${response.status}`,
    };
  },
});

