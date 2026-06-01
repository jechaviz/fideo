<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function env_values(string $path): array
{
    if (!is_readable($path)) {
        return [];
    }
    $values = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $value = trim($value);
        if (strlen($value) >= 2 && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
            $value = substr($value, 1, -1);
        }
        $values[trim($key)] = $value;
    }
    return $values;
}

function app_env(): array
{
    $projectRoot = dirname(__DIR__, 5);
    $paths = [
        $projectRoot . '/shared/env/mysql.env',
        $projectRoot . '/shared/.env',
    ];
    $values = [];
    foreach ($paths as $path) {
        $values = array_merge($values, env_values($path));
    }
    foreach (['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'] as $key) {
        $value = getenv($key);
        if ($value !== false) {
            $values[$key] = $value;
        }
    }
    return $values;
}

function db_config(): array
{
    $env = app_env();
    return [
        'host' => $env['MYSQL_HOST'] ?? '127.0.0.1',
        'port' => (int)($env['MYSQL_PORT'] ?? 3306),
        'name' => $env['MYSQL_DATABASE'] ?? '',
        'user' => $env['MYSQL_USER'] ?? '',
        'pass' => $env['MYSQL_PASSWORD'] ?? '',
    ];
}

function mysql_binary(): string
{
    return is_file('/usr/bin/mariadb') ? '/usr/bin/mariadb' : '/usr/bin/mysql';
}

function mysql_exec(array $config, string $sql): string
{
    if ($config['name'] === '' || $config['user'] === '') {
        throw new RuntimeException('mysql_unconfigured');
    }
    $command = [
        mysql_binary(),
        '--batch',
        '--raw',
        '--skip-column-names',
        '-h', $config['host'],
        '-P', (string)$config['port'],
        '-u', $config['user'],
        $config['name'],
        '-e', $sql,
    ];
    $pipes = [];
    $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, array_merge($_ENV, [
        'MYSQL_PWD' => $config['pass'],
    ]));
    if (!is_resource($process)) {
        throw new RuntimeException('mysql_cli_unavailable');
    }
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]) ?: '';
    $error = stream_get_contents($pipes[2]) ?: '';
    fclose($pipes[1]);
    fclose($pipes[2]);
    $code = proc_close($process);
    if ($code !== 0) {
        throw new RuntimeException('mysql_cli_failed');
    }
    return trim($output);
}

function sql_quote(string $value): string
{
    return "'" . str_replace(["\\", "'"], ["\\\\", "\\'"], $value) . "'";
}

function ensure_schema(array $config): void
{
    mysql_exec($config, "CREATE TABLE IF NOT EXISTS pbm_metadata (
  name VARCHAR(128) NOT NULL PRIMARY KEY,
  value_text TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    mysql_exec($config, "CREATE TABLE IF NOT EXISTS pbm_records (
  collection VARCHAR(128) NOT NULL,
  id VARCHAR(191) NOT NULL,
  created DATETIME(3) NULL,
  updated DATETIME(3) NULL,
  data JSON NOT NULL,
  PRIMARY KEY (collection, id),
  INDEX idx_pbm_records_collection_updated (collection, updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function json_body(): array
{
    $raw = file_get_contents('php://input') ?: '{}';
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function route_path(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    $marker = '/api/fideo/';
    $pos = strpos($path, $marker);
    return $pos === false ? '' : trim(substr($path, $pos + strlen($marker)), '/');
}

function workspace_id(array $body): string
{
    $snapshot = $body['snapshot'] ?? $body['seedSnapshot'] ?? [];
    $workspace = is_array($snapshot) ? ($snapshot['workspace'] ?? []) : [];
    $id = $body['workspaceId'] ?? (is_array($workspace) ? ($workspace['id'] ?? '') : '');
    return is_string($id) && $id !== '' ? $id : 'fideo-default';
}

function next_version(array $config, string $workspaceId): int
{
    $key = 'fideo_snapshot_version:' . $workspaceId;
    $current = mysql_exec($config, 'SELECT value_text FROM pbm_metadata WHERE name = ' . sql_quote($key) . ' LIMIT 1');
    $version = max(1, (int)$current + 1);
    mysql_exec($config, 'INSERT INTO pbm_metadata (name, value_text) VALUES (' . sql_quote($key) . ', ' . sql_quote((string)$version) . ') ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)');
    return $version;
}

function store_record(array $config, string $collection, string $id, array $data): void
{
    $now = gmdate('Y-m-d H:i:s');
    mysql_exec($config, 'INSERT INTO pbm_records (collection, id, created, updated, data) VALUES (' .
        sql_quote($collection) . ', ' . sql_quote($id) . ', ' . sql_quote($now) . ', ' . sql_quote($now) . ', ' .
        sql_quote(json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) .
        ') ON DUPLICATE KEY UPDATE updated = VALUES(updated), data = VALUES(data)');
}

try {
    $config = db_config();
    ensure_schema($config);
    $route = route_path();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        respond(200, [
            'kind' => 'fideo_mysql_runtime',
            'status' => 'ok',
            'backend' => 'mysql',
            'plugin' => 'pb-mysql',
            'message' => 'MySQL runtime overview ready.',
            'route' => $route,
        ]);
    }

    $body = json_body();
    $workspaceId = workspace_id($body);
    $snapshot = $body['snapshot'] ?? $body['seedSnapshot'] ?? [];
    $version = next_version($config, $workspaceId);
    $recordId = $workspaceId . ':snapshot';
    $updatedAt = gmdate('c');
    store_record($config, 'fideo_snapshots', $recordId, [
        'workspaceId' => $workspaceId,
        'route' => $route,
        'version' => $version,
        'updatedAt' => $updatedAt,
        'snapshot' => $snapshot,
    ]);
    store_record($config, 'fideo_events', uniqid('evt_', true), [
        'workspaceId' => $workspaceId,
        'route' => $route,
        'at' => $updatedAt,
        'body' => $body,
    ]);
    respond(200, [
        'kind' => 'fideo_mysql_snapshot',
        'status' => 'ok',
        'backend' => 'mysql',
        'plugin' => 'pb-mysql',
        'message' => 'Snapshot persisted through MySQL adapter.',
        'version' => $version,
        'snapshotRecordId' => $recordId,
        'updatedAt' => $updatedAt,
        'snapshot' => $snapshot,
        'runtimeOverview' => [
            'backend' => 'mysql',
            'workspaceId' => $workspaceId,
            'route' => $route,
        ],
    ]);
} catch (Throwable $error) {
    respond(503, [
        'kind' => 'fideo_mysql_snapshot',
        'status' => 'failed',
        'backend' => 'mysql',
        'plugin' => 'pb-mysql',
        'message' => 'MySQL snapshot adapter unavailable.',
    ]);
}
