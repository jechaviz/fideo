<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

echo json_encode([
    'status' => 'ok',
    'backend' => 'mysql',
    'plugin' => 'pb-mysql',
    'message' => 'MySQL snapshot adapter responds.',
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
