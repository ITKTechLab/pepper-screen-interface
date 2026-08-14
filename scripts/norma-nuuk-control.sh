#!/usr/bin/env bash
# Starter den officielle browser-baserede Nuuk operatorflade og aabner den.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$here/.." && pwd)"
log_dir="$repo_dir/logs"
pid_file="$log_dir/nuuk-control.pid"
log_file="$log_dir/nuuk-control.log"
host="127.0.0.1"
port="5051"
url="http://${host}:${port}/"

mkdir -p "$log_dir"

is_running() {
    [[ -f "$pid_file" ]] || return 1
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    [[ -n "$pid" ]] || return 1
    kill -0 "$pid" 2>/dev/null
}

if ! is_running; then
    (
        cd "$repo_dir"
        nohup python3 ./scripts/norma-nuuk-control-server.py --host "$host" --port "$port" >>"$log_file" 2>&1 &
        echo $! >"$pid_file"
    )
fi

if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
fi

echo "Norma Nuuk Control: $url"
echo "Fallback: Norma Driftpanel (Terminal)"
