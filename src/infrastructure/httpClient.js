export const createJsonClient = ({ baseUrl = '', token = '', browserClient = 'fideo-vue' } = {}) => {
  const buildUrl = (path) => new URL(path, baseUrl || window.location.href).href;

  const request = async (path, options = {}) => {
    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(browserClient ? { 'X-Veeper-Client': browserClient } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(buildUrl(path), {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: options.credentials || 'same-origin',
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(payload?.message || `HTTP ${response.status}`);
      error.payload = { ...(payload || {}), status: response.status };
      throw error;
    }
    return payload;
  };

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
  };
};
