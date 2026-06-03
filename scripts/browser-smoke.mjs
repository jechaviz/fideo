import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const url = process.argv[2] || 'http://127.0.0.1:4173/';
const port = Number(process.env.FIDEOVUE_CDP_PORT || (9300 + Math.floor(Math.random() * 600)));
const expectLiveAiBridge = process.env.FIDEO_AI_BRIDGE_EXPECT_LIVE === '1';
const browserCandidates = [
  process.env.FIDEOVUE_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

const browser = browserCandidates.find((candidate) => existsSync(candidate));
if (!browser) {
  throw new Error('No Edge/Chrome executable found. Set FIDEOVUE_BROWSER.');
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quotePowerShell = (value) => `'${String(value).replace(/'/g, "''")}'`;

const withTimeout = (promise, label, ms = 20000) => {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
};

const fetchWithTimeout = async (targetUrl, options = {}, ms = 1500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(targetUrl, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const waitForJson = async (targetUrl, timeoutMs = 45000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const remaining = Math.max(250, deadline - Date.now());
      const response = await fetchWithTimeout(targetUrl, {}, Math.min(1500, remaining));
      if (response.ok) return response.json();
    } catch {
      await delay(Math.min(250, Math.max(0, deadline - Date.now())));
    }
  }
  throw new Error(`CDP endpoint not ready: ${targetUrl}`);
};

const userDataDir = await mkdtemp(join(tmpdir(), 'fideovue-cdp-'));
const browserArgs = [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank',
];
const launchBrowser = () => {
  if (process.platform !== 'win32') {
    return spawn(browser, browserArgs, { stdio: 'ignore' });
  }
  const command = [
    `$p = Start-Process -FilePath ${quotePowerShell(browser)}`,
    `-ArgumentList @(${browserArgs.map(quotePowerShell).join(',')})`,
    '-PassThru -WindowStyle Hidden;',
    'Write-Output $p.Id',
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.status !== 0) {
    throw new Error(`Browser launch failed status=${result.status} signal=${result.signal}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  const pid = Number(String(result.stdout || '').trim());
  if (!Number.isFinite(pid) || pid <= 0) {
    throw new Error(`Browser launch did not return a process id: ${result.stdout}`);
  }
  return { pid, kill: () => spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000 }) };
};
const child = launchBrowser();

const cleanup = async () => {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000 });
    const escapedUserDataDir = userDataDir.replace(/'/g, "''");
    spawnSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escapedUserDataDir}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ], { stdio: 'ignore', timeout: 5000 });
  } else {
    child.kill();
  }
  await delay(500);
  await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
};

try {
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const targetResponse = await fetchWithTimeout(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }, 5000);
  const target = await targetResponse.json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const logs = [];
  const exceptions = [];
  let nextId = 1;

  ws.onmessage = (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      pending.get(payload.id)(payload);
      pending.delete(payload.id);
      return;
    }
    if (payload.method === 'Runtime.exceptionThrown') {
      exceptions.push(payload.params?.exceptionDetails?.text || 'Runtime exception');
    }
    if (payload.method === 'Runtime.consoleAPICalled') {
      logs.push(payload.params.args?.map((arg) => arg.value || arg.description || '').join(' '));
    }
    if (payload.method === 'Log.entryAdded') {
      logs.push(payload.params.entry?.text || 'Log entry');
    }
  };

  await withTimeout(new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('CDP websocket error'));
    ws.onclose = () => reject(new Error('CDP websocket closed before ready'));
  }), 'CDP websocket open');

  const send = (method, params = {}) => {
    const id = nextId;
    nextId += 1;
    ws.send(JSON.stringify({ id, method, params }));
    return withTimeout(new Promise((resolve) => pending.set(id, resolve)), `CDP ${method}`);
  };

  const evaluatePage = async (expression) => {
    const response = await send('Runtime.evaluate', { returnByValue: true, expression });
    return response.result?.result?.value;
  };

  const waitForPageValue = async (expression, predicate, label, timeoutMs = 15000) => {
    const started = Date.now();
    let lastValue;
    while (Date.now() - started < timeoutMs) {
      try {
        lastValue = await evaluatePage(expression);
        if (predicate(lastValue)) return lastValue;
      } catch (error) {
        lastValue = { error: error.message };
      }
      await delay(400);
    }
    throw new Error(`${label} not ready after ${timeoutMs}ms: ${JSON.stringify(lastValue)} logs=${logs.join(' | ')}`);
  };

  const pageSnapshotExpression = `({
    text: document.body?.innerText || '',
    cloaked: Boolean(document.querySelector('[data-fideo-cloak]')),
    title: document.title,
    hasShell: Boolean(document.querySelector('.fideo-shell')),
    hasSidebar: Boolean(document.querySelector('aside')),
    hasPortal: Boolean(document.querySelector('.glass-panel-dark')),
    hasUnoRuntime: Boolean(document.querySelector('[data-unocss-runtime-layer]'))
  })`;

  const hasRequiredText = (requiredText) => (value) => (
    value
    && value.hasShell
    && value.hasSidebar
    && requiredText.every((text) => value.text.includes(text))
  );

  const clickControl = async (label) => {
    const expression = `(() => {
      const label = ${JSON.stringify(label)};
      const controls = Array.from(document.querySelectorAll('button,a'));
      const textOf = (item) => (item.textContent || '').replace(/\\s+/g, ' ').trim();
      const same = (value) => String(value || '').toLowerCase() === label.toLowerCase();
      const has = (value) => String(value || '').toLowerCase().includes(label.toLowerCase());
      const control = controls.find((item) =>
        same(item.getAttribute('aria-label'))
        || same(item.getAttribute('title'))
        || same(textOf(item))
        || (label.length > 3 && has(textOf(item)))
      );
      if (!control) return { clicked: false, label, text: document.body.innerText };
      control.click();
      return { clicked: true, label };
    })()`;
    const result = await send('Runtime.evaluate', { returnByValue: true, expression });
    const value = result.result?.result?.value;
    if (!value?.clicked) {
      throw new Error(`Could not click ${label}: ${JSON.stringify(value)}`);
    }
  };

  const waitForText = async (requiredText, label, timeoutMs = 15000) => waitForPageValue(
    pageSnapshotExpression,
    hasRequiredText(requiredText),
    label,
    timeoutMs,
  );

  await send('Page.enable');
  await send('Log.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });

  const value = await waitForText([
    'Centro Comercial',
    'Excepciones',
    'Excepciones operativas',
    'Pipelines por rol',
  ], 'FideoVue dashboard');
  if (value.cloaked) throw new Error('FideoVue remained cloaked after boot.');
  if (!value.hasUnoRuntime) throw new Error('UnoCSS runtime styles were not injected.');
  if (exceptions.length) throw new Error(`Browser exceptions: ${exceptions.join('; ')}`);

  await clickControl('Ruta');
  await waitForText(['Empaque, asignacion y ruta', 'Presencia ruta', 'Mapa entregas'], 'deliveries view');

  await clickControl('Stock');
  await waitForText(['TABLA INVENTARIO', 'Lotes operables'], 'inventory view');

  await clickControl('Abrir More');
  await clickControl('Proveedores');
  await waitForText(['ABASTO COORDINADO', 'Pipeline compras'], 'suppliers view');

  await clickControl('IA');
  await waitForText(['Insights IA', 'Gates runtime', 'AI plan'], 'training view');

  await clickControl('AI plan');

  const aiReceiptText = expectLiveAiBridge ? 'Kilo StepFun genero plan Fideo desde Spaceship.' : 'ai_engine_plan';
  const aiPlanValue = await waitForPageValue(
    `({ text: document.body.innerText })`,
    (candidate) => candidate?.text?.includes(aiReceiptText),
    'AI plan receipt',
    expectLiveAiBridge ? 90000 : 180000,
  );
  if (!aiPlanValue?.text.includes(aiReceiptText)) {
    throw new Error(`AI plan did not produce a visible receipt: ${JSON.stringify(aiPlanValue)}`);
  }

  await clickControl('Ruta');
  await waitForText(['Empaque, asignacion y ruta'], 'deliveries after AI');
  await clickControl('Enterado');
  await waitForText(['Iniciar'], 'delivery acknowledged');
  await clickControl('Iniciar');
  await waitForText(['Empacar'], 'delivery started');
  await clickControl('Empacar');

  await delay(500);
  const interactionValue = await evaluatePage(`({ text: document.body.innerText })`);
  if (!interactionValue?.text.includes('Pedido empacado') || !interactionValue?.text.includes('Asignar ruta')) {
    throw new Error(`Sale action did not update visible state: ${JSON.stringify(interactionValue)}`);
  }
  await clickControl('Enterado');
  await waitForText(['Iniciar'], 'route assignment acknowledged');
  await clickControl('Iniciar');
  await waitForText(['Asignar'], 'route assignment started');
  await clickControl('Asignar');
  await delay(500);
  const routeValue = await evaluatePage(`({ text: document.body.innerText })`);
  if (!routeValue?.text.includes('Pedido asignado') && !routeValue?.text.includes('Entregar Fruteria Lupita')) {
    throw new Error(`Route assignment did not update visible state: ${JSON.stringify(routeValue)}`);
  }

  await clickControl('Abrir More global');
  await clickControl('Cambiar a Cliente');
  await waitForPageValue(
    pageSnapshotExpression,
    (candidate) => candidate?.hasPortal && candidate?.text?.includes('Portal cliente') && candidate?.text?.includes('Fideo Cliente'),
    'customer portal',
  );

  await clickControl('Cambiar a Admin');
  await waitForText(['Centro Comercial', 'Excepciones operativas'], 'admin return');

  console.log(`FideoVue browser smoke passed: ${value.title}`);
  ws.close();
} finally {
  await cleanup();
}
