<?php
declare(strict_types=1);

const FIDEO_KILO_DEFAULT_MODEL = 'kilo/stepfun/step-3.7-flash:free';
const FIDEO_KILO_DEFAULT_TIMEOUT_MS = 25000;
const FIDEO_KILO_DEFAULT_PORT = 18767;

function fideo_kilo_project_root(): string
{
    $cursor = __DIR__;
    $publicFallback = '';
    for ($depth = 0; $depth < 8; $depth++) {
        if (is_dir($cursor . '/shared') || is_dir($cursor . '/releases')) {
            return $cursor;
        }
        if (is_file($cursor . '/index.html') && is_dir($cursor . '/api')) {
            $publicFallback = $cursor;
        }
        $parent = dirname($cursor);
        if ($parent === $cursor) {
            break;
        }
        $cursor = $parent;
    }
    return $publicFallback !== '' ? $publicFallback : dirname(__DIR__, 2);
}

function fideo_kilo_runtime_library(): string
{
    $root = fideo_kilo_project_root();
    $configured = trim((string)(getenv('FIDEO_KILO_RUNTIME_LIB') ?: ''));
    $candidates = array_values(array_filter([
        $configured,
        $root . '/shared/lib/codex-kilo-runtime/php/KiloRuntime.php',
        dirname($root) . '/lib/codex-kilo-runtime/php/KiloRuntime.php',
        $root . '/vendor/codex-kilo-runtime/php/KiloRuntime.php',
    ]));

    foreach ($candidates as $path) {
        if (is_readable($path)) {
            return $path;
        }
    }

    throw new RuntimeException('codex_kilo_runtime_missing');
}

require_once fideo_kilo_runtime_library();

function fideo_kilo_env(): array
{
    $root = fideo_kilo_project_root();
    $values = [];
    foreach ([$root . '/shared/env/kilo.env', $root . '/shared/.env'] as $path) {
        if (function_exists('env_values')) {
            $values = array_merge($values, env_values($path));
        } else {
            $values = array_merge($values, \CodexKiloRuntime\KiloRuntime::envFile($path));
        }
    }

    foreach ([
        'FIDEO_KILO_BASE',
        'FIDEO_KILO_EXECUTABLE',
        'FIDEO_KILO_WORKDIR',
        'FIDEO_KILO_HOME',
        'FIDEO_KILO_CONFIG_DIR',
        'FIDEO_KILO_TMPDIR',
        'FIDEO_KILO_TIMEOUT_MS',
        'FIDEO_KILO_PORT',
        'FIDEO_KILO_SERVER_URL',
        'FIDEO_KILO_ALLOW_WEB_START',
        'FIDEO_KILO_VERSION',
        'FIDEO_KILO_MODEL',
        'FIDEO_KILO_VARIANT',
        'KILO_AUTH_CONTENT',
        'KILO_ORG_ID',
        'KILO_API_KEY',
    ] as $key) {
        $value = getenv($key);
        if ($value !== false && trim((string)$value) !== '') {
            $values[$key] = (string)$value;
        }
    }

    return $values;
}

function fideo_kilo_config(): array
{
    $env = fideo_kilo_env();
    $root = fideo_kilo_project_root();
    $base = rtrim((string)($env['FIDEO_KILO_BASE'] ?? $root . '/shared/kilo'), '/');
    $home = (string)($env['FIDEO_KILO_HOME'] ?? $base . '/home');
    $timeout = (int)($env['FIDEO_KILO_TIMEOUT_MS'] ?? FIDEO_KILO_DEFAULT_TIMEOUT_MS);
    $port = max(1024, min(65535, (int)($env['FIDEO_KILO_PORT'] ?? FIDEO_KILO_DEFAULT_PORT)));

    return [
        'base' => $base,
        'executable' => $env['FIDEO_KILO_EXECUTABLE'] ?? $base . '/bin/kilo',
        'home' => $home,
        'configDir' => $env['FIDEO_KILO_CONFIG_DIR'] ?? $base . '/config',
        'tmpDir' => $env['FIDEO_KILO_TMPDIR'] ?? $base . '/tmp',
        'workDir' => $env['FIDEO_KILO_WORKDIR'] ?? $base . '/work',
        'model' => \CodexKiloRuntime\KiloRuntime::normalizeModel((string)($env['FIDEO_KILO_MODEL'] ?? FIDEO_KILO_DEFAULT_MODEL)),
        'variant' => trim((string)($env['FIDEO_KILO_VARIANT'] ?? '')),
        'timeoutMs' => max(5000, min(120000, $timeout)),
        'serverPort' => $port,
        'serverUrl' => rtrim((string)($env['FIDEO_KILO_SERVER_URL'] ?? 'http://127.0.0.1:' . $port), '/'),
        'serverPidFile' => $base . '/run/kilo-serve.pid',
        'serverLog' => $base . '/logs/kilo-serve.log',
        'allowWebStart' => ($env['FIDEO_KILO_ALLOW_WEB_START'] ?? '') === '1',
        'version' => trim((string)($env['FIDEO_KILO_VERSION'] ?? '')),
        'authFile' => $home . '/.local/share/kilo/auth.json',
        'authContent' => trim((string)($env['KILO_AUTH_CONTENT'] ?? '')),
        'orgId' => trim((string)($env['KILO_ORG_ID'] ?? '')),
        'apiKey' => trim((string)($env['KILO_API_KEY'] ?? '')),
    ];
}

function fideo_kilo_runtime(): \CodexKiloRuntime\KiloRuntime
{
    return new \CodexKiloRuntime\KiloRuntime(fideo_kilo_config());
}

function fideo_kilo_prompt(array $body, string $model): string
{
    $context = [
        'workspaceId' => is_scalar($body['workspaceId'] ?? null) ? (string)$body['workspaceId'] : 'fideo-default',
        'intent' => is_scalar($body['intent'] ?? null) ? (string)$body['intent'] : 'fideo-insights',
        'provider' => 'kilo',
        'model' => $model,
        'goal' => 'Auditar y proponer el siguiente paso operativo para pedidos, comunicacion, seguimiento y visibilidad admin.',
    ];

    return 'Eres el engine server-side de Fideo en Spaceship. Si necesitas razonar, hazlo brevemente, pero ' .
        'termina obligatoriamente con una linea FINAL_JSON: seguida de un unico objeto JSON valido y no escribas ' .
        'nada despues de ese objeto. Campos requeridos: summary string, recommendedActions array de strings, ' .
        'risks array de strings, followUps array de strings y confidence string. No uses herramientas, subagentes, ' .
        'lectura de archivos, busqueda ni comandos; responde solo con el contexto recibido. Contexto JSON: ' .
        json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function fideo_kilo_health_payload(): array
{
    $payload = fideo_kilo_runtime()->health();
    $payload['runtime'] = 'spaceship';
    $payload['message'] = $payload['status'] === 'server-ready'
        ? 'Kilo corre server-side en Spaceship; el navegador usa este endpoint same-origin.'
        : $payload['message'];
    return $payload;
}

function fideo_kilo_needs_fallback(array $payload): bool
{
    return ($payload['status'] ?? '') !== 'ok';
}

function fideo_kilo_fallback_result(array $body, array $payload): array
{
    $workspaceId = is_scalar($body['workspaceId'] ?? null) ? (string)$body['workspaceId'] : 'fideo-default';
    return [
        'summary' => 'Kilo respondio sin JSON parseable; Fideo normalizo un plan operativo baseline para no bloquear el flujo.',
        'recommendedActions' => [
            'Revisar pedidos sin siguiente responsable y asignar empaque o ruta antes del cierre operativo.',
            'Confirmar comunicacion pendiente con clientes y proveedores desde el inbox unico.',
            'Escalar al admin excepciones con reportes abiertos, bloqueo o SLA vencido.',
            'Registrar acuse MySQL de cada seguimiento para conservar trazabilidad por workspace.',
        ],
        'risks' => [
            'El modelo produjo salida no estructurada y podria ocultar recomendaciones especificas.',
            'Pedidos o incidencias sin acuse pueden perder seguimiento entre roles.',
            'Admin podria tomar decisiones con visibilidad parcial si no se normalizan recibos.',
        ],
        'followUps' => [
            'Reintentar StepFun cuando el servidor este estable y comparar con este baseline.',
            'Auditar receipts de pedidos, mensajes y ruta despues de cada turno.',
            'Mantener habilitado el fallback hasta que Kilo entregue FINAL_JSON consistentemente.',
        ],
        'confidence' => 'fallback',
        'workspaceId' => $workspaceId,
        'rawSummary' => (string)($payload['result']['summary'] ?? $payload['message'] ?? ''),
    ];
}

function fideo_kilo_plan_payload(array $body): array
{
    $body['workspaceId'] = is_scalar($body['workspaceId'] ?? null) ? (string)$body['workspaceId'] : 'fideo-default';
    $body['title'] = is_scalar($body['title'] ?? null) ? (string)$body['title'] : 'Fideo AI plan';

    $payload = fideo_kilo_runtime()->plan($body, 'fideo_kilo_prompt');
    $payload['runtime'] = 'spaceship';
    if ($payload['status'] === 'ok') {
        $payload['message'] = 'Kilo StepFun genero plan Fideo desde Spaceship.';
    } elseif (fideo_kilo_needs_fallback($payload)) {
        $payload['status'] = 'ok';
        $payload['message'] = 'Kilo StepFun normalizo plan Fideo desde Spaceship.';
        $payload['fallback'] = true;
        $payload['result'] = fideo_kilo_fallback_result($body, $payload);
    }
    return $payload;
}

function fideo_handle_ai_request(string $route): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET' && ($route === 'ai' || $route === 'ai/health')) {
        respond(200, fideo_kilo_health_payload());
    }

    if ($method === 'POST' && $route === 'ai/plan') {
        respond(200, fideo_kilo_plan_payload(json_body()));
    }

    respond(404, [
        'kind' => 'ai_engine',
        'status' => 'failed',
        'provider' => 'kilo',
        'message' => 'AI route not found.',
    ]);
}
