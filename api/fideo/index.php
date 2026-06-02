<?php
declare(strict_types=1);

const FIDEO_IDEMPOTENCY_COLLECTION = 'fideo_idempotency';

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

function send_json_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
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

function snapshot_record_id(string $workspaceId): string
{
    return $workspaceId . ':snapshot';
}

function version_key(string $workspaceId): string
{
    return 'fideo_snapshot_version:' . $workspaceId;
}

function expected_version(array $body): ?int
{
    if (!array_key_exists('expectedVersion', $body) || $body['expectedVersion'] === null || $body['expectedVersion'] === '') {
        return null;
    }
    return max(0, (int)$body['expectedVersion']);
}

function idempotency_key(array $body): string
{
    foreach (['idempotencyKey', 'actionId'] as $field) {
        $value = $body[$field] ?? '';
        if (is_scalar($value) && trim((string)$value) !== '') {
            return trim((string)$value);
        }
    }
    return '';
}

function idempotency_record_id(string $workspaceId, string $route, string $key): string
{
    return 'idem_' . sha1($workspaceId . ':' . $route . ':' . $key);
}

function event_record_id(string $workspaceId, string $route, string $key): string
{
    return $key === '' ? uniqid('evt_', true) : 'evt_' . sha1($workspaceId . ':' . $route . ':' . $key);
}

function load_record(array $config, string $collection, string $id): ?array
{
    $raw = mysql_exec($config, 'SELECT data FROM pbm_records WHERE collection = ' .
        sql_quote($collection) . ' AND id = ' . sql_quote($id) . ' LIMIT 1');
    if ($raw === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function read_metadata_version(array $config, string $workspaceId): ?int
{
    $raw = mysql_exec($config, 'SELECT value_text FROM pbm_metadata WHERE name = ' .
        sql_quote(version_key($workspaceId)) . ' LIMIT 1');
    return $raw === '' ? null : max(0, (int)$raw);
}

function read_snapshot_version(array $config, string $workspaceId): ?int
{
    $record = load_record($config, 'fideo_snapshots', snapshot_record_id($workspaceId));
    if (!$record || !isset($record['version'])) {
        return null;
    }
    return max(0, (int)$record['version']);
}

function current_snapshot_version(array $config, string $workspaceId): int
{
    return read_metadata_version($config, $workspaceId) ?? read_snapshot_version($config, $workspaceId) ?? 1;
}

function next_unchecked_version(array $config, string $workspaceId): int
{
    $current = read_metadata_version($config, $workspaceId) ?? read_snapshot_version($config, $workspaceId);
    $version = $current === null ? 1 : max(1, $current + 1);
    mysql_exec($config, 'INSERT INTO pbm_metadata (name, value_text) VALUES (' .
        sql_quote(version_key($workspaceId)) . ', ' . sql_quote((string)$version) .
        ') ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)');
    return $version;
}

function reserve_version(array $config, string $workspaceId, ?int $expectedVersion): array
{
    if ($expectedVersion === null) {
        return ['ok' => true, 'version' => next_unchecked_version($config, $workspaceId)];
    }

    $current = current_snapshot_version($config, $workspaceId);
    if ($current !== $expectedVersion) {
        return ['ok' => false, 'current' => $current];
    }

    $next = $current + 1;
    if (read_metadata_version($config, $workspaceId) === null) {
        $inserted = mysql_exec($config, 'INSERT IGNORE INTO pbm_metadata (name, value_text) VALUES (' .
            sql_quote(version_key($workspaceId)) . ', ' . sql_quote((string)$next) . '); SELECT ROW_COUNT()');
        if ((int)$inserted === 1) {
            return ['ok' => true, 'version' => $next];
        }
        return ['ok' => false, 'current' => current_snapshot_version($config, $workspaceId)];
    }

    $updated = mysql_exec($config, 'UPDATE pbm_metadata SET value_text = ' . sql_quote((string)$next) .
        ' WHERE name = ' . sql_quote(version_key($workspaceId)) .
        ' AND CAST(value_text AS UNSIGNED) = ' . $expectedVersion . '; SELECT ROW_COUNT()');
    if ((int)$updated === 1) {
        return ['ok' => true, 'version' => $next];
    }
    return ['ok' => false, 'current' => current_snapshot_version($config, $workspaceId)];
}

function store_record(array $config, string $collection, string $id, array $data): void
{
    $now = gmdate('Y-m-d H:i:s');
    mysql_exec($config, 'INSERT INTO pbm_records (collection, id, created, updated, data) VALUES (' .
        sql_quote($collection) . ', ' . sql_quote($id) . ', ' . sql_quote($now) . ', ' . sql_quote($now) . ', ' .
        sql_quote(json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) .
        ') ON DUPLICATE KEY UPDATE updated = VALUES(updated), data = VALUES(data)');
}

function insert_record_once(array $config, string $collection, string $id, array $data): bool
{
    $now = gmdate('Y-m-d H:i:s');
    $sql = 'INSERT IGNORE INTO pbm_records (collection, id, created, updated, data) VALUES (' .
        sql_quote($collection) . ', ' . sql_quote($id) . ', ' . sql_quote($now) . ', ' . sql_quote($now) . ', ' .
        sql_quote(json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) . '); SELECT ROW_COUNT()';
    return (int)mysql_exec($config, $sql) === 1;
}

function claim_idempotency(array $config, string $id, string $workspaceId, string $route, string $key): bool
{
    return insert_record_once($config, FIDEO_IDEMPOTENCY_COLLECTION, $id, [
        'state' => 'pending',
        'workspaceId' => $workspaceId,
        'route' => $route,
        'key' => $key,
        'updatedAt' => gmdate('c'),
    ]);
}

function complete_idempotency(array $config, string $id, int $httpStatus, array $response): void
{
    $record = load_record($config, FIDEO_IDEMPOTENCY_COLLECTION, $id) ?? [];
    store_record($config, FIDEO_IDEMPOTENCY_COLLECTION, $id, array_merge($record, [
        'state' => 'completed',
        'httpStatus' => $httpStatus,
        'response' => $response,
        'updatedAt' => gmdate('c'),
    ]));
}

function idempotency_replay(array $config, string $id): ?array
{
    $record = load_record($config, FIDEO_IDEMPOTENCY_COLLECTION, $id);
    if (!$record) {
        return null;
    }
    if (($record['state'] ?? '') === 'completed' && is_array($record['response'] ?? null)) {
        return [
            'httpStatus' => (int)($record['httpStatus'] ?? 200),
            'response' => $record['response'],
        ];
    }
    return [
        'httpStatus' => 409,
        'response' => [
            'kind' => 'fideo_mysql_snapshot',
            'status' => 'failed',
            'backend' => 'mysql',
            'plugin' => 'pb-mysql',
            'message' => 'Idempotent action is already being persisted.',
        ],
    ];
}

function versioned_snapshot(array $snapshot, string $workspaceId, int $version): array
{
    $snapshot['workspace'] = is_array($snapshot['workspace'] ?? null) ? $snapshot['workspace'] : [];
    $snapshot['workspace']['id'] = $snapshot['workspace']['id'] ?? $workspaceId;
    $snapshot['workspace']['version'] = $version;
    return $snapshot;
}

function success_payload(string $workspaceId, string $route, int $version, string $updatedAt, array $snapshot): array
{
    return [
        'kind' => 'fideo_mysql_snapshot',
        'status' => 'ok',
        'backend' => 'mysql',
        'plugin' => 'pb-mysql',
        'message' => 'Snapshot persisted through MySQL adapter.',
        'version' => $version,
        'snapshotRecordId' => snapshot_record_id($workspaceId),
        'updatedAt' => $updatedAt,
        'snapshot' => $snapshot,
        'runtimeOverview' => [
            'backend' => 'mysql',
            'workspaceId' => $workspaceId,
            'route' => $route,
        ],
    ];
}

function conflict_payload(string $workspaceId, string $route, int $version): array
{
    return [
        'kind' => 'fideo_mysql_snapshot',
        'status' => 'conflict',
        'backend' => 'mysql',
        'plugin' => 'pb-mysql',
        'message' => 'Snapshot version conflict.',
        'version' => $version,
        'snapshotRecordId' => snapshot_record_id($workspaceId),
        'runtimeOverview' => [
            'backend' => 'mysql',
            'workspaceId' => $workspaceId,
            'route' => $route,
        ],
    ];
}

function fideo_handle_request(): void
{
    send_json_headers();

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
        $idempotencyKey = idempotency_key($body);
        $idempotencyId = $idempotencyKey === '' ? '' : idempotency_record_id($workspaceId, $route, $idempotencyKey);
        if ($idempotencyId !== '') {
            $replay = idempotency_replay($config, $idempotencyId);
            if ($replay) {
                respond($replay['httpStatus'], $replay['response']);
            }
            if (!claim_idempotency($config, $idempotencyId, $workspaceId, $route, $idempotencyKey)) {
                $replay = idempotency_replay($config, $idempotencyId) ?? [
                    'httpStatus' => 409,
                    'response' => [
                        'kind' => 'fideo_mysql_snapshot',
                        'status' => 'failed',
                        'backend' => 'mysql',
                        'plugin' => 'pb-mysql',
                        'message' => 'Idempotent action is already being persisted.',
                    ],
                ];
                respond($replay['httpStatus'], $replay['response']);
            }
        }

        $reserve = reserve_version($config, $workspaceId, expected_version($body));
        if (!$reserve['ok']) {
            $payload = conflict_payload($workspaceId, $route, (int)$reserve['current']);
            if ($idempotencyId !== '') {
                complete_idempotency($config, $idempotencyId, 409, $payload);
            }
            respond(409, $payload);
        }

        $snapshot = $body['snapshot'] ?? $body['seedSnapshot'] ?? [];
        $snapshot = versioned_snapshot(is_array($snapshot) ? $snapshot : [], $workspaceId, (int)$reserve['version']);
        $version = (int)$reserve['version'];
        $recordId = snapshot_record_id($workspaceId);
        $updatedAt = gmdate('c');
        store_record($config, 'fideo_snapshots', $recordId, [
            'workspaceId' => $workspaceId,
            'route' => $route,
            'version' => $version,
            'updatedAt' => $updatedAt,
            'snapshot' => $snapshot,
        ]);
        store_record($config, 'fideo_events', event_record_id($workspaceId, $route, $idempotencyKey), [
            'workspaceId' => $workspaceId,
            'route' => $route,
            'version' => $version,
            'idempotencyKey' => $idempotencyKey,
            'at' => $updatedAt,
            'body' => $body,
        ]);
        $payload = success_payload($workspaceId, $route, $version, $updatedAt, $snapshot);
        if ($idempotencyId !== '') {
            complete_idempotency($config, $idempotencyId, 200, $payload);
        }
        respond(200, $payload);
    } catch (Throwable $error) {
        respond(503, [
            'kind' => 'fideo_mysql_snapshot',
            'status' => 'failed',
            'backend' => 'mysql',
            'plugin' => 'pb-mysql',
            'message' => 'MySQL snapshot adapter unavailable.',
        ]);
    }
}

if (!defined('FIDEO_API_NO_RUN')) {
    fideo_handle_request();
}
