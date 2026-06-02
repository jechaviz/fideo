#!/usr/bin/env bash
set -euo pipefail

base="${FIDEO_KILO_BASE:-/home/agingriouh/apps/fideo/shared/kilo}"
port="${FIDEO_KILO_PORT:-18767}"
host="127.0.0.1"
url="http://$host:$port"
bin="${FIDEO_KILO_EXECUTABLE:-$base/bin/kilo}"
home_dir="${FIDEO_KILO_HOME:-$base/home}"
config_dir="${FIDEO_KILO_CONFIG_DIR:-$base/config}"
tmp_dir="${FIDEO_KILO_TMPDIR:-$base/tmp}"
work_dir="${FIDEO_KILO_WORKDIR:-$base/work}"
run_dir="$base/run"
log_dir="$base/logs"
pid_file="$run_dir/kilo-serve.pid"
lock_file="$run_dir/kilo-serve.lock"
log_file="$log_dir/kilo-serve.log"

mkdir -p "$run_dir" "$log_dir" "$tmp_dir" "$work_dir/.kilo"
exec 9>"$lock_file"
flock -n 9 || exit 0

if curl -fsS "$url/doc" >/dev/null 2>&1; then
  exit 0
fi

if [[ -s "$pid_file" ]]; then
  old_pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ "$old_pid" =~ ^[0-9]+$ ]]; then
    kill "$old_pid" >/dev/null 2>&1 || true
  fi
fi

cat >"$work_dir/.kilo/kilo.json" <<'JSON'
{
  "indexing": { "enabled": false },
  "lsp": false,
  "formatter": false,
  "share": "disabled",
  "tools": {
    "bash": false,
    "edit": false,
    "write": false,
    "patch": false,
    "webfetch": false
  }
}
JSON

HOME="$home_dir" \
KILO_CONFIG_DIR="$config_dir" \
TMPDIR="$tmp_dir" \
KILO_NO_DAEMON=1 \
KILO_DISABLE_CODEBASE_INDEXING=vscode-no-workspace \
KILO_DISABLE_DEFAULT_PLUGINS=1 \
KILO_DISABLE_AUTOCOMPACT=1 \
nohup "$bin" serve --hostname "$host" --port "$port" --pure >>"$log_file" 2>&1 &

echo "$!" >"$pid_file"

for _ in $(seq 1 20); do
  if curl -fsS "$url/doc" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

exit 1
