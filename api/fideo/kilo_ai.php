<?php
declare(strict_types=1);

const FIDEO_KILO_DEFAULT_MODEL = 'kilo/stepfun/step-3.7-flash:free';
const FIDEO_KILO_DEFAULT_VARIANT = '';
const FIDEO_KILO_DEFAULT_TIMEOUT_MS = 25000;
const FIDEO_KILO_DEFAULT_PORT = 18767;

function fideo_kilo_project_root(): string
{
    return dirname(__DIR__, 5);
}

function fideo_kilo_env(): array
{
    $root = fideo_kilo_project_root();
    $values = [];
    foreach ([$root . '/shared/env/kilo.env', $root . '/shared/.env'] as $path) {
        $values = array_merge($values, env_values($path));
    }

    foreach ([
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
    $base = fideo_kilo_project_root() . '/shared/kilo';
    $home = $env['FIDEO_KILO_HOME'] ?? $base . '/home';
    $model = fideo_kilo_normalize_model($env['FIDEO_KILO_MODEL'] ?? FIDEO_KILO_DEFAULT_MODEL);
    $timeout = (int)($env['FIDEO_KILO_TIMEOUT_MS'] ?? FIDEO_KILO_DEFAULT_TIMEOUT_MS);
    $port = max(1024, min(65535, (int)($env['FIDEO_KILO_PORT'] ?? FIDEO_KILO_DEFAULT_PORT)));

    return [
        'base' => $base,
        'executable' => $env['FIDEO_KILO_EXECUTABLE'] ?? $base . '/bin/kilo',
        'home' => $home,
        'configDir' => $env['FIDEO_KILO_CONFIG_DIR'] ?? $base . '/config',
        'tmpDir' => $env['FIDEO_KILO_TMPDIR'] ?? $base . '/tmp',
        'workDir' => $env['FIDEO_KILO_WORKDIR'] ?? $base . '/work',
        'model' => $model,
        'variant' => trim((string)($env['FIDEO_KILO_VARIANT'] ?? FIDEO_KILO_DEFAULT_VARIANT)),
        'timeoutMs' => max(5000, min(120000, $timeout)),
        'serverPort' => $port,
        'serverUrl' => rtrim((string)($env['FIDEO_KILO_SERVER_URL'] ?? ('http://127.0.0.1:' . $port)), '/'),
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

function fideo_kilo_normalize_model(string $model): string
{
    $value = trim($model);
    $key = strtolower(str_replace(['_', '-'], ' ', $value));
    if ($key === '' || str_contains($key, 'stepfun 3.7 free') || str_contains($key, 'step 3.7 flash free')) {
        return FIDEO_KILO_DEFAULT_MODEL;
    }
    return $value;
}

function fideo_kilo_normalize_variant(string $model, string $variant): string
{
    $clean = trim($variant);
    if (str_contains($model, ':free') && in_array($clean, ['high', 'medium', 'low', 'max', 'minimal'], true)) {
        return '';
    }
    return $clean;
}

function fideo_kilo_prepare_runtime(array $config): void
{
    foreach (['home', 'configDir', 'tmpDir', 'workDir'] as $field) {
        if (!is_dir($config[$field])) {
            @mkdir($config[$field], 0770, true);
        }
    }

    $kiloDir = $config['workDir'] . '/.kilo';
    if (!is_dir($kiloDir)) {
        @mkdir($kiloDir, 0770, true);
    }

    $configPath = $kiloDir . '/kilo.json';
    if (!is_file($configPath)) {
        $workspaceConfig = [
            'indexing' => ['enabled' => false],
            'lsp' => false,
            'formatter' => false,
            'share' => 'disabled',
            'tools' => [
                'bash' => false,
                'edit' => false,
                'write' => false,
                'patch' => false,
                'webfetch' => false,
            ],
        ];
        @file_put_contents($configPath, json_encode($workspaceConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }
}

function fideo_kilo_http_json(string $method, string $url, ?array $payload, int $timeoutMs): array
{
    $headers = "Accept: application/json\r\n";
    $content = '';
    if ($payload !== null) {
        $headers .= "Content-Type: application/json\r\n";
        $content = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => $headers,
            'content' => $content,
            'ignore_errors' => true,
            'timeout' => max(1, (int)ceil($timeoutMs / 1000)),
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    $status = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) {
            $status = (int)$match[1];
            break;
        }
    }

    $text = is_string($body) ? $body : '';
    $json = json_decode($text, true);
    return [
        'ok' => $status >= 200 && $status < 300,
        'status' => $status,
        'body' => $text,
        'json' => is_array($json) ? $json : null,
    ];
}

function fideo_kilo_server_ready(array $config): bool
{
    $response = fideo_kilo_http_json('GET', $config['serverUrl'] . '/doc', null, 3000);
    return $response['ok'];
}

function fideo_kilo_start_server(array $config): bool
{
    if (fideo_kilo_server_ready($config)) {
        return true;
    }

    if (!$config['allowWebStart']) {
        return false;
    }

    if (!function_exists('proc_open') || !is_file($config['executable'])) {
        return false;
    }

    foreach ([dirname($config['serverPidFile']), dirname($config['serverLog'])] as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0770, true);
        }
    }

    $command = implode(' ', [
        'setsid',
        escapeshellarg($config['executable']),
        'serve',
        '--hostname',
        '127.0.0.1',
        '--port',
        (string)$config['serverPort'],
        '--pure',
        '>',
        escapeshellarg($config['serverLog']),
        '2>&1',
        '<',
        '/dev/null',
        '&',
        'echo',
        '$!',
    ]);

    $result = fideo_kilo_exec(['sh', '-c', $command], fideo_kilo_process_env($config), $config['workDir'], 5000);
    $pid = trim($result['stdout']);
    if ($pid !== '') {
        @file_put_contents($config['serverPidFile'], $pid);
    }

    for ($attempt = 0; $attempt < 20; $attempt++) {
        if (fideo_kilo_server_ready($config)) {
            return true;
        }
        usleep(250000);
    }

    return false;
}

function fideo_kilo_auth_ready(array $config): bool
{
    return $config['authContent'] !== '' || $config['apiKey'] !== '' || is_readable($config['authFile']);
}

function fideo_kilo_process_env(array $config): array
{
    $env = [
        'PATH' => getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin',
        'HOME' => $config['home'],
        'KILO_CONFIG_DIR' => $config['configDir'],
        'TMPDIR' => $config['tmpDir'],
        'KILO_NO_DAEMON' => '1',
        'KILO_DISABLE_CODEBASE_INDEXING' => 'vscode-no-workspace',
        'KILO_DISABLE_DEFAULT_PLUGINS' => '1',
        'KILO_DISABLE_AUTOCOMPACT' => '1',
    ];

    if ($config['authContent'] !== '') {
        $env['KILO_AUTH_CONTENT'] = $config['authContent'];
    } elseif ($config['apiKey'] !== '') {
        $env['KILO_AUTH_CONTENT'] = json_encode([
            'kilo' => [
                'type' => 'api',
                'key' => $config['apiKey'],
            ],
        ], JSON_UNESCAPED_SLASHES);
    }

    if ($config['orgId'] !== '') {
        $env['KILO_ORG_ID'] = $config['orgId'];
    }

    return $env;
}

function fideo_kilo_model_ref(string $model): array
{
    $parts = explode('/', $model, 2);
    return [
        'providerID' => $parts[0] ?: 'kilo',
        'modelID' => $parts[1] ?? 'stepfun/step-3.7-flash:free',
    ];
}

function fideo_kilo_message_text(array $message): string
{
    $texts = [];
    foreach (($message['parts'] ?? []) as $part) {
        if (is_array($part) && is_string($part['text'] ?? null)) {
            $texts[] = $part['text'];
        }
    }
    return trim(implode("\n", $texts));
}

function fideo_kilo_exec(array $command, array $env, string $cwd, int $timeoutMs): array
{
    if (!function_exists('proc_open')) {
        return [
            'exitCode' => 127,
            'stdout' => '',
            'stderr' => 'proc_open_unavailable',
            'timedOut' => false,
        ];
    }

    $pipes = [];
    $process = @proc_open($command, [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ], $pipes, $cwd, $env);

    if (!is_resource($process)) {
        return [
            'exitCode' => 127,
            'stdout' => '',
            'stderr' => 'process_unavailable',
            'timedOut' => false,
        ];
    }

    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    $stdout = '';
    $stderr = '';
    $timedOut = false;
    $started = microtime(true);

    while (true) {
        $stdout .= stream_get_contents($pipes[1]) ?: '';
        $stderr .= stream_get_contents($pipes[2]) ?: '';
        $status = proc_get_status($process);
        if (!$status['running']) {
            break;
        }
        if (((microtime(true) - $started) * 1000) >= $timeoutMs) {
            $timedOut = true;
            proc_terminate($process, 15);
            usleep(200000);
            $status = proc_get_status($process);
            if ($status['running']) {
                proc_terminate($process, 9);
            }
            break;
        }
        usleep(100000);
    }

    $stdout .= stream_get_contents($pipes[1]) ?: '';
    $stderr .= stream_get_contents($pipes[2]) ?: '';
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);

    return [
        'exitCode' => $exitCode,
        'stdout' => $stdout,
        'stderr' => $stderr,
        'timedOut' => $timedOut,
    ];
}

function fideo_kilo_collect_event_text(string $output): string
{
    $texts = [];
    foreach (preg_split('/\r?\n/', $output) ?: [] as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        $event = json_decode($line, true);
        if (!is_array($event)) {
            continue;
        }
        $part = $event['part'] ?? null;
        if (is_array($part) && is_string($part['text'] ?? null)) {
            $texts[] = $part['text'];
        } elseif (is_string($event['text'] ?? null)) {
            $texts[] = $event['text'];
        }
    }
    return trim(implode("\n", $texts));
}

function fideo_kilo_parse_final_json(string $output): ?array
{
    $texts = array_values(array_filter([fideo_kilo_collect_event_text($output), trim($output)]));
    foreach ($texts as $text) {
        $candidates = [$text];
        if (preg_match('/FINAL_JSON\s*:?\s*(.+)$/is', $text, $match)) {
            $candidates[] = trim($match[1]);
        }
        if (preg_match_all('/```(?:json)?\s*(.*?)```/is', $text, $matches)) {
            foreach ($matches[1] as $fenced) {
                $candidates[] = trim($fenced);
            }
        }
        foreach ($candidates as $candidate) {
            $first = strpos($candidate, '{');
            $last = strrpos($candidate, '}');
            $json = $first !== false && $last !== false && $last > $first
                ? substr($candidate, $first, $last - $first + 1)
                : $candidate;
            $parsed = json_decode($json, true);
            if (is_array($parsed)) {
                return $parsed;
            }
        }
    }
    return null;
}

function fideo_kilo_clip(string $value, int $length = 1200): string
{
    $text = trim(preg_replace('/\s+/', ' ', $value) ?? '');
    if (strlen($text) <= $length) {
        return $text;
    }
    return substr($text, 0, $length - 3) . '...';
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

    return 'Eres el engine server-side de Fideo en Spaceship. Devuelve solo JSON valido con ' .
        'summary, recommendedActions, risks, followUps y confidence. No uses herramientas, subagentes, ' .
        'lectura de archivos, busqueda ni comandos; responde solo con el contexto recibido. Contexto: ' .
        json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function fideo_kilo_health_payload(): array
{
    $config = fideo_kilo_config();
    fideo_kilo_prepare_runtime($config);
    $binaryReady = is_file($config['executable']);
    $serverReady = $binaryReady && fideo_kilo_start_server($config);

    return [
        'kind' => 'ai_engine',
        'status' => $binaryReady && $serverReady ? 'server-ready' : 'failed',
        'provider' => 'kilo',
        'model' => $config['model'],
        'variant' => $config['variant'],
        'runtime' => 'spaceship',
        'localDependency' => false,
        'binaryReady' => $binaryReady,
        'serverReady' => $serverReady,
        'serverPort' => $config['serverPort'],
        'version' => $config['version'] !== '' ? $config['version'] : null,
        'auth' => fideo_kilo_auth_ready($config) ? 'configured' : 'pending',
        'message' => $binaryReady && $serverReady
            ? 'Kilo corre server-side en Spaceship; el navegador usa este endpoint same-origin.'
            : ($binaryReady ? 'Kilo server-side esta instalado, pero el servidor loopback no esta listo.' : 'Kilo server-side no esta instalado en Spaceship.'),
    ];
}

function fideo_kilo_plan_payload(array $body): array
{
    $config = fideo_kilo_config();
    fideo_kilo_prepare_runtime($config);
    $model = fideo_kilo_normalize_model(is_scalar($body['model'] ?? null) ? (string)$body['model'] : $config['model']);
    $variant = fideo_kilo_normalize_variant($model, is_scalar($body['variant'] ?? null) ? (string)$body['variant'] : $config['variant']);

    if (!is_file($config['executable'])) {
        return [
            'kind' => 'ai_engine_plan',
            'status' => 'failed',
            'provider' => 'kilo',
            'model' => $model,
            'variant' => $variant,
            'runtime' => 'spaceship',
            'message' => 'Kilo server-side no esta instalado en Spaceship.',
        ];
    }

    if (!fideo_kilo_start_server($config)) {
        return [
            'kind' => 'ai_engine_plan',
            'status' => 'failed',
            'provider' => 'kilo',
            'model' => $model,
            'variant' => $variant,
            'runtime' => 'spaceship',
            'workspaceId' => is_scalar($body['workspaceId'] ?? null) ? (string)$body['workspaceId'] : 'fideo-default',
            'message' => 'Kilo server-side no pudo iniciar el servidor loopback en Spaceship.',
            'result' => [
                'summary' => is_readable($config['serverLog']) ? fideo_kilo_clip((string)@file_get_contents($config['serverLog'])) : '',
            ],
        ];
    }

    $directory = rawurlencode($config['workDir']);
    $create = fideo_kilo_http_json('POST', $config['serverUrl'] . '/session?directory=' . $directory, [
        'title' => 'Fideo AI plan',
        'agent' => 'code',
    ], 8000);
    $sessionId = is_array($create['json']) && is_string($create['json']['id'] ?? null) ? $create['json']['id'] : '';
    if (!$create['ok'] || $sessionId === '') {
        return [
            'kind' => 'ai_engine_plan',
            'status' => 'failed',
            'provider' => 'kilo',
            'model' => $model,
            'variant' => $variant,
            'runtime' => 'spaceship',
            'workspaceId' => is_scalar($body['workspaceId'] ?? null) ? (string)$body['workspaceId'] : 'fideo-default',
            'message' => 'Kilo server-side no pudo crear sesion.',
            'result' => [
                'summary' => fideo_kilo_clip($create['body']),
                'httpStatus' => $create['status'],
            ],
        ];
    }

    $promptPayload = [
        'model' => fideo_kilo_model_ref($model),
        'tools' => [
            'task' => false,
            'bash' => false,
            'glob' => false,
            'grep' => false,
            'list' => false,
            'read' => false,
            'write' => false,
            'edit' => false,
            'patch' => false,
            'webfetch' => false,
            'websearch' => false,
            'todowrite' => false,
        ],
        'parts' => [[
            'type' => 'text',
            'text' => fideo_kilo_prompt($body, $model),
        ]],
    ];
    if ($variant !== '') {
        $promptPayload['variant'] = $variant;
    }

    $prompt = fideo_kilo_http_json(
        'POST',
        $config['serverUrl'] . '/session/' . rawurlencode($sessionId) . '/message?directory=' . $directory,
        $promptPayload,
        $config['timeoutMs']
    );
    $message = is_array($prompt['json']) ? $prompt['json'] : [];
    $text = fideo_kilo_message_text($message);
    $parsed = fideo_kilo_parse_final_json($text !== '' ? $text : $prompt['body']);
    $ok = $prompt['ok'] && $text !== '';

    return [
        'kind' => 'ai_engine_plan',
        'status' => $ok ? 'ok' : 'failed',
        'provider' => 'kilo',
        'model' => $model,
        'variant' => $variant,
        'runtime' => 'spaceship',
        'workspaceId' => is_scalar($body['workspaceId'] ?? null) ? (string)$body['workspaceId'] : 'fideo-default',
        'message' => $ok
            ? 'Kilo StepFun genero plan Fideo desde Spaceship.'
            : 'Kilo server-side devolvio salida no exitosa.',
        'result' => $parsed ?? [
            'summary' => fideo_kilo_clip($text !== '' ? $text : $prompt['body']),
            'sessionId' => $sessionId,
            'httpStatus' => $prompt['status'],
        ],
    ];
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
