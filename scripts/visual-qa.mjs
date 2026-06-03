import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(projectRoot, '.audit', 'visual-qa');
const browserCandidates = [
  process.env.FIDEOVUE_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

const browser = browserCandidates.find((candidate) => existsSync(candidate));
if (!browser) throw new Error('No Edge/Chrome executable found.');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quotePowerShell = (value) => `'${String(value).replace(/'/g, "''")}'`;
const withSearchParam = (targetUrl, key, value) => {
  if (!value) return targetUrl;
  const nextUrl = new URL(targetUrl);
  nextUrl.searchParams.set(key, value);
  return nextUrl.toString();
};

const withTimeout = (promise, label, ms = 60000) => {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
};

const fetchJson = async (targetUrl, timeoutMs = 45000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(targetUrl, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return response.json();
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Endpoint not ready: ${targetUrl}`);
};

const startProcess = (file, args, cwd, env = {}) => {
  const command = [
    `$p = Start-Process -FilePath ${quotePowerShell(file)}`,
    `-ArgumentList @(${args.map(quotePowerShell).join(',')})`,
    `-WorkingDirectory ${quotePowerShell(cwd)}`,
    '-PassThru -WindowStyle Hidden;',
    'Write-Output $p.Id',
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`Start-Process failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  const pid = Number(String(result.stdout || '').trim());
  return { pid, kill: () => spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }) };
};

const startBrowser = async () => {
  const port = Number(process.env.FIDEO_VISUAL_CDP_PORT || (9811 + Math.floor(Math.random() * 400)));
  const userDataDir = await mkdir(join(tmpdir(), `fideo-visual-cdp-${Date.now()}`), { recursive: true })
    .then(() => join(tmpdir(), `fideo-visual-cdp-${Date.now()}`));
  await mkdir(userDataDir, { recursive: true });
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars=false',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];
  const command = [
    `$p = Start-Process -FilePath ${quotePowerShell(browser)}`,
    `-ArgumentList @(${args.map(quotePowerShell).join(',')})`,
    '-PassThru -WindowStyle Hidden;',
    'Write-Output $p.Id',
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.status !== 0) throw new Error(`Browser launch failed: ${result.stderr || result.stdout}`);
  const pid = Number(String(result.stdout || '').trim());
  await fetchJson(`http://127.0.0.1:${port}/json/version`);
  return {
    port,
    pid,
    cleanup: async () => {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
      await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
};

const connectTarget = async (port) => {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = await response.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;
  ws.onmessage = (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      pending.get(payload.id)(payload);
      pending.delete(payload.id);
      return;
    }
    events.push(payload);
  };
  await withTimeout(new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('CDP websocket error'));
  }), 'CDP websocket open');
  const send = (method, params = {}) => {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return withTimeout(new Promise((resolve) => pending.set(id, resolve)), `CDP ${method}`);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.clear(); sessionStorage.clear(); } catch {}`,
  });
  return { ws, send, events };
};

const evaluate = async (send, expression) => {
  const result = await send('Runtime.evaluate', { returnByValue: true, expression });
  return result.result?.result?.value;
};

const waitForText = async (send, text, timeoutMs = 70000) => {
  const deadline = Date.now() + timeoutMs;
  let lastValue = '';
  while (Date.now() < deadline) {
    const value = await evaluate(send, `document.body?.innerText || ''`);
    lastValue = String(value || '');
    if (String(value || '').includes(text)) return value;
    await delay(400);
  }
  throw new Error(`Text not found: ${text}; current=${lastValue.slice(0, 1200)}`);
};

const waitForVisualReady = async (send, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await evaluate(send, `(() => {
      const brand = document.querySelector('.fa-apple-whole')?.parentElement;
      const shell = document.querySelector('.fideo-shell');
      const brandBg = brand ? getComputedStyle(brand).backgroundColor : '';
      const shellBg = shell ? getComputedStyle(shell).backgroundColor : '';
      const hasUno = Boolean(document.querySelector('[data-unocss-runtime-layer]'));
      const paintedBrand = !brand || (brandBg && brandBg !== 'rgba(0, 0, 0, 0)' && brandBg !== 'transparent');
      const paintedShell = !shell || (shellBg && shellBg !== 'rgba(0, 0, 0, 0)' && shellBg !== 'transparent');
      return { ready: paintedBrand && paintedShell, hasUno, brandBg, shellBg };
    })()`);
    if (lastValue?.ready) return lastValue;
    await delay(300);
  }
  throw new Error(`Visual styles not ready: ${JSON.stringify(lastValue)}`);
};

const clickText = async (send, label, options = {}) => {
  const expression = `(() => {
    const label = ${JSON.stringify(label)};
    const pickLast = ${options.last ? 'true' : 'false'};
    const same = (v) => String(v || '').trim().toLowerCase() === label.toLowerCase();
    const has = (v) => label.length > 3 && String(v || '').trim().toLowerCase().includes(label.toLowerCase());
    const matches = Array.from(document.querySelectorAll('button,a,[role="button"]')).filter((item) => {
      const text = (item.textContent || '').replace(/\\s+/g, ' ').trim();
      return same(item.getAttribute('aria-label')) || same(item.getAttribute('title')) || same(text) || has(text);
    });
    const control = pickLast ? matches[matches.length - 1] : matches[0];
    if (!control) return { clicked: false, label, text: document.body.innerText };
    control.click();
    return { clicked: true, label };
  })()`;
  const value = await evaluate(send, expression);
  if (!value?.clicked) throw new Error(`Could not click ${label}: ${JSON.stringify(value).slice(0, 1200)}`);
  await delay(650);
};

const selectValue = async (send, label, value) => {
  const expression = `(() => {
    const label = ${JSON.stringify(label)};
    const value = ${JSON.stringify(value)};
    const select = Array.from(document.querySelectorAll('select')).find((item) =>
      String(item.getAttribute('aria-label') || item.id || '').toLowerCase() === label.toLowerCase()
    );
    if (!select) return { selected: false, label, text: document.body.innerText };
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { selected: true, label, value };
  })()`;
  const result = await evaluate(send, expression);
  if (!result?.selected) throw new Error(`Could not select ${label}=${value}: ${JSON.stringify(result).slice(0, 1200)}`);
  await delay(900);
};

const capture = async (send, item) => {
  let visualReady = null;
  await send('Emulation.setDeviceMetricsOverride', {
    width: item.viewport.width,
    height: item.viewport.height,
    deviceScaleFactor: 1,
    mobile: item.viewport.mobile,
  });
  try {
    await send('Page.navigate', { url: item.url });
    await delay(900);
    await evaluate(send, `(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} return true; })()`);
    await send('Page.navigate', { url: item.url });
    await waitForText(send, item.waitFor || 'Fideo');
    if (item.steps) {
      for (const step of item.steps) {
        if (step.click) await clickText(send, step.click, step);
        if (step.selectLabel) await selectValue(send, step.selectLabel, step.value);
        if (step.waitFor) await waitForText(send, step.waitFor);
        if (step.delay) await delay(step.delay);
      }
    }
    visualReady = await waitForVisualReady(send);
  } catch (error) {
    const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const text = await evaluate(send, `document.body?.innerText || ''`);
    await writeFile(join(outDir, `${item.name}.failed.png`), Buffer.from(screenshot.result.data, 'base64'));
    await writeFile(join(outDir, `${item.name}.failed.txt`), String(text || ''), 'utf8');
    if (item.allowFailure) {
      return { name: item.name, failed: true, error: error.message, pngPath: join(outDir, `${item.name}.failed.png`) };
    }
    throw new Error(`${item.name}: ${error.message}`);
  }
  await delay(item.settleMs || Number(process.env.FIDEO_VISUAL_SETTLE_MS || 1200));
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const text = await evaluate(send, `document.body?.innerText || ''`);
  const dom = process.env.FIDEO_VISUAL_SAVE_DOM === '1'
    ? await evaluate(send, `document.documentElement.outerHTML`)
    : '';
  const pngPath = join(outDir, `${item.name}.png`);
  await writeFile(pngPath, Buffer.from(screenshot.result.data, 'base64'));
  await writeFile(join(outDir, `${item.name}.txt`), String(text || ''), 'utf8');
  if (dom) await writeFile(join(outDir, `${item.name}.html`), String(dom), 'utf8');
  return { name: item.name, pngPath, textLength: String(text || '').length, visualReady };
};

await mkdir(outDir, { recursive: true });

const reactPort = Number(process.env.FIDEO_REACT_PORT || 3107);
const react = startProcess('bun', ['run', 'dev', '--host', '127.0.0.1', '--port', String(reactPort)], 'C:\\git\\customers\\fideo\\frontend', {
  VITE_POCKETBASE_URL: '',
});
await delay(4000);

const browserSession = await startBrowser();
const target = await connectTarget(browserSession.port);
const desktop = { width: 1366, height: 768, mobile: false };
const mobile = { width: 390, height: 844, mobile: true };
const reactBase = `http://127.0.0.1:${reactPort}/`;
const visualStateProfile = process.env.FIDEO_VISUAL_STATE || 'react-default';
const vueBase = withSearchParam(
  process.env.FIDEO_VUE_URL || 'https://appniverse.com/fideo/',
  'fideo_state',
  visualStateProfile,
);

const items = [
  { name: 'react_admin_desktop', url: reactBase, viewport: desktop, waitFor: 'Centro Comercial' },
  { name: 'vue_admin_desktop', url: vueBase, viewport: desktop, waitFor: 'Centro Comercial' },
  { name: 'react_route_desktop', url: reactBase, viewport: desktop, waitFor: 'Centro Comercial', steps: [{ click: 'Ruta' }, { waitFor: 'Entregas' }] },
  { name: 'vue_route_desktop', url: vueBase, viewport: desktop, waitFor: 'Centro Comercial', steps: [{ click: 'Ruta' }, { waitFor: 'Entregas' }] },
  { name: 'react_customer_desktop', url: reactBase, viewport: desktop, waitFor: 'Centro Comercial', steps: [{ click: 'More', last: true }, { selectLabel: 'Rol', value: 'Cliente' }, { waitFor: 'Portal cliente' }], allowFailure: true },
  { name: 'vue_customer_desktop', url: vueBase, viewport: desktop, waitFor: 'Centro Comercial', steps: [{ click: 'Abrir More global' }, { click: 'Cambiar a Cliente' }, { waitFor: 'Portal cliente' }] },
  { name: 'react_admin_mobile', url: reactBase, viewport: mobile, waitFor: 'Centro Comercial' },
  { name: 'vue_admin_mobile', url: vueBase, viewport: mobile, waitFor: 'Centro Comercial' },
];
const scope = process.env.FIDEO_VISUAL_SCOPE || 'all';
const selectedItems = scope === 'mobile'
  ? items.filter((item) => item.name.includes('mobile'))
  : scope === 'route-only'
    ? items.filter((item) => item.name.includes('route_desktop'))
  : scope === 'desktop-core'
    ? items.filter((item) => item.name.includes('admin_desktop') || item.name.includes('route_desktop'))
    : items;

const results = [];
try {
  for (const item of selectedItems) results.push(await capture(target.send, item));
  await writeFile(join(outDir, 'capture-manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    visualStateProfile,
    results,
  }, null, 2));
  target.ws.close();
  console.log(JSON.stringify({ ok: true, outDir, results }, null, 2));
} finally {
  await browserSession.cleanup();
  react.kill();
}
