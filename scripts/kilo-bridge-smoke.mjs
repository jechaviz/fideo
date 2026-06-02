import { spawn, spawnSync } from 'node:child_process';

const port = Number(process.env.FIDEO_KILO_BRIDGE_SMOKE_PORT || 18765);
const bridgeUrl = `http://127.0.0.1:${port}`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (path, options = {}) => {
  const response = await fetch(`${bridgeUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  return { response, payload };
};

const child = spawn(process.execPath, ['scripts/kilo-bridge.mjs', String(port)], {
  cwd: new URL('..', import.meta.url).pathname.slice(1),
  env: {
    ...process.env,
    FIDEO_KILO_BRIDGE_MOCK: '1',
    FIDEO_KILO_MODEL: 'kilo/stepfun/step-3.7-flash:free',
  },
  stdio: 'ignore',
  windowsHide: true,
});

try {
  let healthy = null;
  for (let index = 0; index < 80; index += 1) {
    try {
      healthy = await fetchJson('/health');
      if (healthy.response.ok) break;
    } catch {
      await delay(250);
    }
  }
  if (!healthy?.response.ok) throw new Error('Kilo bridge health failed.');
  if (healthy.payload.model !== 'kilo/stepfun/step-3.7-flash:free') {
    throw new Error(`Unexpected model ${healthy.payload.model}`);
  }

  const plan = await fetchJson('/plan', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: 'fideo-demo',
      intent: 'smoke',
      provider: 'kilo',
      model: 'kilo/stepfun/step-3.7-flash:free',
      variant: 'high',
    }),
  });
  if (!plan.response.ok || plan.payload.status !== 'ok') {
    throw new Error(`Kilo bridge plan failed: ${JSON.stringify(plan.payload)}`);
  }
  console.log('Fideo Kilo bridge smoke passed.');
} finally {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000 });
  } else {
    child.kill();
  }
}
