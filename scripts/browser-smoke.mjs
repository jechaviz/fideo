import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const url = process.argv[2] || 'http://127.0.0.1:4173/';
const port = Number(process.env.FIDEOVUE_CDP_PORT || (9300 + Math.floor(Math.random() * 600)));
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

const withTimeout = (promise, label, ms = 8000) => {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
};

const waitForJson = async (targetUrl, tries = 40) => {
  for (let index = 0; index < tries; index += 1) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) return response.json();
    } catch {
      await delay(250);
    }
  }
  throw new Error(`CDP endpoint not ready: ${targetUrl}`);
};

const userDataDir = await mkdtemp(join(tmpdir(), 'fideovue-cdp-'));
const child = spawn(browser, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank',
], { stdio: 'ignore' });

const cleanup = async () => {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill();
  }
  await delay(500);
  await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
};

try {
  await withTimeout(waitForJson(`http://127.0.0.1:${port}/json/version`), 'CDP version');
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
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

  await send('Page.enable');
  await send('Log.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });
  await delay(2500);

  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `({
      text: document.body.innerText,
      cloaked: Boolean(document.querySelector('[data-fideo-cloak]')),
      title: document.title,
      hasActionCenter: Boolean(document.body.innerText.match(/action center/i)),
      hasUnoRuntime: Boolean(document.querySelector('[data-unocss-runtime-layer]'))
    })`,
  });

  const value = result.result?.result?.value;
  if (!value || !value.text.includes('Mesa operativa') || !value.hasActionCenter) {
    throw new Error(`FideoVue did not render expected cockpit text: ${JSON.stringify(value)} logs=${logs.join(' | ')}`);
  }
  if (value.cloaked) throw new Error('FideoVue remained cloaked after boot.');
  if (!value.hasUnoRuntime) throw new Error('UnoCSS runtime styles were not injected.');
  if (exceptions.length) throw new Error(`Browser exceptions: ${exceptions.join('; ')}`);

  console.log(`FideoVue browser smoke passed: ${value.title}`);
  ws.close();
} finally {
  await cleanup();
}
