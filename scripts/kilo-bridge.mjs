import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const port = Number(process.env.FIDEO_KILO_BRIDGE_PORT || process.argv[2] || 8765);
const host = '127.0.0.1';
const token = String(process.env.FIDEO_KILO_BRIDGE_TOKEN || randomBytes(24).toString('hex'));
const model = String(process.env.FIDEO_KILO_MODEL || 'kilo/stepfun/step-3.7-flash:free');
const variant = String(process.env.FIDEO_KILO_VARIANT || 'high');
const detectKiloExecutable = () => {
  const configured = String(process.env.CODEX_GOAL_KILO_COMMAND || '').trim();
  if (configured) return configured;

  const exeName = process.platform === 'win32' ? 'kilo.exe' : 'kilo';
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    const output = execFileSync(locator, [exeName], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0];
    if (output) return output;
  } catch {}

  const roots = [
    join(homedir(), '.vscode', 'extensions'),
    join(homedir(), '.vscode-insiders', 'extensions'),
  ];
  for (const root of roots) {
    try {
      const candidates = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^kilocode\.kilo-code-/i.test(entry.name))
        .map((entry) => join(root, entry.name, 'bin', exeName))
        .filter((candidate) => existsSync(candidate));
      if (candidates.length) return candidates.sort().at(-1);
    } catch {}
  }

  return exeName;
};

const kiloExecutable = String(process.env.FIDEO_KILO_EXECUTABLE || process.env.KILO_EXECUTABLE || detectKiloExecutable());
const cwd = String(process.env.FIDEO_KILO_WORKDIR || process.cwd());
const timeoutMs = Number(process.env.FIDEO_KILO_TIMEOUT_MS || 180000);
const mockMode = process.env.FIDEO_KILO_BRIDGE_MOCK === '1';
const allowedOrigins = new Set(String(process.env.FIDEO_KILO_BRIDGE_ORIGINS
  || 'https://appniverse.com,https://www.appniverse.com,http://127.0.0.1:4173,http://127.0.0.1:4174,http://localhost:4173')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean));

const send = (response, status, payload, origin = '') => {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-fideo-ai-token,authorization',
    'access-control-allow-private-network': 'true',
  };
  if (origin && allowedOrigins.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
};

const readBody = async (request, limit = 1_000_000) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const parseJsonBody = async (request) => {
  const text = await readBody(request);
  if (!text.trim()) return {};
  return JSON.parse(text);
};

const authorized = (request) => {
  const headerToken = request.headers['x-fideo-ai-token'] || '';
  const bearer = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return token && (headerToken === token || bearer === token);
};

const buildPrompt = (body) => [
  'Eres el operador IA de Fideo. Usa respuestas concretas, accionables y seguras.',
  `Workspace: ${body.workspaceId || 'fideo-demo'}`,
  `Intent: ${body.intent || 'fideo-insights'}`,
  `Provider: ${body.provider || 'kilo'}`,
  `Modelo: ${body.model || model}`,
  '',
  'Devuelve al final una linea FINAL_JSON con esta forma exacta:',
  '{"summary":"...","nextActions":["..."],"risks":["..."],"receiptMessage":"..."}',
].join('\n');

const parseFinalJson = (text) => {
  const finalLine = String(text || '').split(/\r?\n/).reverse()
    .find((line) => line.includes('FINAL_JSON'));
  const candidate = finalLine ? finalLine.replace(/^.*FINAL_JSON\s*:?\s*/i, '') : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

const runKilo = (body) => new Promise((resolve) => {
  if (mockMode) {
    resolve({
      status: 'ok',
      stdout: 'FINAL_JSON {"summary":"Mock Kilo listo","nextActions":["Validar pedidos"],"risks":[],"receiptMessage":"Kilo mock genero plan Fideo."}',
      stderr: '',
      exitCode: 0,
    });
    return;
  }

  const args = [
    'run',
    '--format', 'json',
    '--model', String(body.model || model),
    '--dir', cwd,
  ];
  if (body.variant || variant) args.push('--variant', String(body.variant || variant));
  args.push(buildPrompt(body));

  const child = spawn(kiloExecutable, args, {
    cwd,
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
  }, timeoutMs);

  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('close', (exitCode) => {
    clearTimeout(timer);
    resolve({ status: exitCode === 0 ? 'ok' : 'failed', stdout, stderr, exitCode });
  });
  child.on('error', (error) => {
    clearTimeout(timer);
    resolve({ status: 'failed', stdout, stderr: error.message, exitCode: -1 });
  });
});

const healthPayload = () => ({
  kind: 'fideo_kilo_bridge',
  status: 'ok',
  provider: 'kilo',
  model,
  variant,
  mock: mockMode,
});

const server = createServer(async (request, response) => {
  const origin = String(request.headers.origin || '');
  if (origin && !allowedOrigins.has(origin)) {
    send(response, 403, { kind: 'fideo_kilo_bridge', status: 'forbidden', message: 'Origin no permitido.' });
    return;
  }
  if (request.method === 'OPTIONS') {
    send(response, 204, {}, origin);
    return;
  }
  if (!authorized(request)) {
    send(response, 401, { kind: 'fideo_kilo_bridge', status: 'unauthorized', message: 'Token local requerido.' }, origin);
    return;
  }

  try {
    const url = new URL(request.url || '/', `http://${host}:${port}`);
    if (request.method === 'GET' && url.pathname === '/health') {
      send(response, 200, healthPayload(), origin);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/plan') {
      const body = await parseJsonBody(request);
      const result = await runKilo(body);
      const parsed = parseFinalJson(result.stdout);
      send(response, result.status === 'ok' ? 200 : 502, {
        kind: 'ai_engine_plan',
        status: result.status,
        provider: 'kilo',
        model: String(body.model || model),
        variant: String(body.variant || variant),
        message: parsed?.receiptMessage || parsed?.summary || result.stderr || 'Kilo ejecuto el plan.',
        result: parsed,
        exitCode: result.exitCode,
      }, origin);
      return;
    }
    send(response, 404, { kind: 'fideo_kilo_bridge', status: 'not_found', message: 'Ruta no encontrada.' }, origin);
  } catch (error) {
    send(response, 500, { kind: 'fideo_kilo_bridge', status: 'failed', message: error.message }, origin);
  }
});

server.listen(port, host, () => {
  console.log(`Fideo Kilo bridge listening at http://${host}:${port}`);
  console.log(`Set browser token: localStorage.setItem('FIDEO_AI_BRIDGE_TOKEN', '${token}')`);
});
