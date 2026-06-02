import { existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { extractKiloTextOutput, parseKiloFinalJson } from '../src/infrastructure/kiloOutputParser.js';

const port = Number(process.env.FIDEO_KILO_BRIDGE_PORT || process.argv[2] || 8765);
const host = '127.0.0.1';
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

const send = (response, status, payload, origin = '') => {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-private-network': 'true',
  };
  if (origin) {
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

const buildPrompt = (body) => [
  'Devuelve solo JSON valido, sin markdown.',
  `Contexto: Fideo workspace=${body.workspaceId || 'fideo-demo'} intent=${body.intent || 'fideo-insights'} modelo=${body.model || model}.`,
  'Schema: {"summary":"...","nextActions":["..."],"risks":["..."],"receiptMessage":"..."}',
].join('\n');

const clipText = (value, limit = 500) => {
  const text = String(value || '').trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
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
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  let lineCursor = 0;
  let finishTimer;
  const settle = (payload) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    clearTimeout(finishTimer);
    if (!child.killed) child.kill();
    resolve(payload);
  };
  const processLines = () => {
    const lines = stdout.split(/\r?\n/);
    const completeCount = Math.max(0, lines.length - 1);
    for (; lineCursor < completeCount; lineCursor += 1) {
      try {
        const entry = JSON.parse(String(lines[lineCursor] || '').trim());
        if (entry.type === 'step_finish') {
          finishTimer = setTimeout(() => settle({ status: 'ok', stdout, stderr, exitCode: 0 }), 100);
          return;
        }
        if (entry.type === 'text' && parseKiloFinalJson(stdout)) {
          settle({ status: 'ok', stdout, stderr, exitCode: 0 });
          return;
        }
      } catch {}
    }
  };
  const timer = setTimeout(() => {
    settle({ status: 'failed', stdout, stderr: stderr || `Kilo timeout after ${timeoutMs}ms`, exitCode: -1 });
  }, timeoutMs);

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    processLines();
  });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('close', (exitCode) => {
    settle({ status: exitCode === 0 ? 'ok' : 'failed', stdout, stderr, exitCode });
  });
  child.on('error', (error) => {
    settle({ status: 'failed', stdout, stderr: error.message, exitCode: -1 });
  });
  child.stdin.end('', 'utf8');
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
  if (request.method === 'OPTIONS') {
    send(response, 204, {}, origin);
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
      const parsed = parseKiloFinalJson(result.stdout);
      const outputText = extractKiloTextOutput(result.stdout);
      const fallbackResult = outputText ? {
        summary: clipText(outputText),
        nextActions: [],
        risks: [],
      } : null;
      send(response, result.status === 'ok' ? 200 : 502, {
        kind: 'ai_engine_plan',
        status: result.status,
        provider: 'kilo',
        model: String(body.model || model),
        variant: String(body.variant || variant),
        message: parsed?.receiptMessage || parsed?.summary || fallbackResult?.summary || result.stderr || 'Kilo ejecuto el plan.',
        result: parsed || fallbackResult,
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
});
