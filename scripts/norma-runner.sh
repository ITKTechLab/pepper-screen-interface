#!/usr/bin/env bash
# Drift-runner for Norma: start/stop/status/show uden manuelle argumenter.
# Konfiguration laeses fra config/operator.env

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$here/.." && pwd)"
config_file="$repo_dir/config/operator.env"
config_example="$repo_dir/config/operator.env.example"
state_dir="$repo_dir/logs"
pid_file="$state_dir/norma-runner.pid"
runner_log="$state_dir/norma-runner.log"

usage() {
    cat <<EOF
Usage: $(basename "$0") <start|stop|restart|status|show|logs>

Commands:
  start    Start resilient Norma flow in background
  stop     Stop running Norma flow
  restart  Stop then start
  status   Show process and endpoint health
  show     Send show_tablet_url to robot again
  logs     Tail runner log
EOF
}

ensure_dirs() {
    mkdir -p "$state_dir"
}

is_running() {
    [[ -f "$pid_file" ]] || return 1
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    [[ -n "$pid" ]] || return 1
    kill -0 "$pid" 2>/dev/null
}

load_config() {
    if [[ ! -f "$config_file" ]]; then
        echo "Mangler $config_file" >&2
        echo "Kopier $config_example til $config_file og udfyld ROBOT_IP." >&2
        exit 1
    fi

    # shellcheck disable=SC1090
    source "$config_file"

    ROBOT_IP="${ROBOT_IP:-}"
    OPERATOR_IP="${OPERATOR_IP:-}"
    BRIDGE_PORT="${BRIDGE_PORT:-8080}"
    PROXY_PORT="${PROXY_PORT:-5000}"
    BRIDGE_PATH="${BRIDGE_PATH:-../pepper-robot-bridge}"

    if [[ -z "$ROBOT_IP" ]]; then
        echo "ROBOT_IP mangler i $config_file" >&2
        exit 1
    fi
}

detect_operator_ip() {
    if command -v ip >/dev/null 2>&1; then
        ip route get 1.1.1.1 2>/dev/null | awk '/src/ {print $7; exit}'
        return
    fi
    if command -v hostname >/dev/null 2>&1; then
        hostname -I 2>/dev/null | awk '{print $1}'
    fi
}

ensure_operator_ip() {
    if [[ -z "$OPERATOR_IP" ]]; then
        OPERATOR_IP="$(detect_operator_ip || true)"
    fi
    if [[ -z "$OPERATOR_IP" ]]; then
        echo "Kunne ikke auto-detektere OPERATOR_IP. Saet den i $config_file" >&2
        exit 1
    fi
}

start_runner() {
    ensure_dirs
    load_config
    ensure_operator_ip

    if is_running; then
        echo "Norma flow koerer allerede (pid $(cat "$pid_file"))."
        return 0
    fi

    local start_cmd
    start_cmd=("$repo_dir/scripts/run-resilient.sh"
        --robot-ip "$ROBOT_IP"
        --operator-ip "$OPERATOR_IP"
        --bridge-port "$BRIDGE_PORT"
        --proxy-port "$PROXY_PORT"
        --bridge-path "$BRIDGE_PATH")

    echo "Starter Norma flow i baggrunden..."
    (
        cd "$repo_dir"
        nohup "${start_cmd[@]}" >>"$runner_log" 2>&1 &
        echo $! >"$pid_file"
    )

    sleep 1
    if is_running; then
        echo "Startet. PID: $(cat "$pid_file")"
        echo "Log: $runner_log"
        status_runner || true
    else
        echo "Kunne ikke starte runner. Se $runner_log" >&2
        exit 1
    fi
}

stop_runner() {
    if ! is_running; then
        rm -f "$pid_file"
        echo "Norma flow koerer ikke."
        return 0
    fi

    local pid
    pid="$(cat "$pid_file")"
    echo "Stopper Norma flow (pid $pid)..."
    kill "$pid" 2>/dev/null || true

    local deadline=$((SECONDS + 10))
    while [[ $SECONDS -lt $deadline ]]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
        sleep 1
    done

    if kill -0 "$pid" 2>/dev/null; then
        echo "Tvangsstopper pid $pid"
        kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f "$pid_file"
    echo "Stoppet."
}

status_runner() {
    load_config
    ensure_operator_ip

    if is_running; then
        echo "Runner: KOERER (pid $(cat "$pid_file"))"
    else
        echo "Runner: STOPPET"
    fi

    if command -v curl >/dev/null 2>&1; then
        local bridge_json
        bridge_json="$(curl -sS "http://127.0.0.1:${BRIDGE_PORT}/api/status" 2>/dev/null || true)"

        if [[ -n "$bridge_json" ]]; then
            echo "Bridge endpoint: OK (127.0.0.1:${BRIDGE_PORT})"
            if command -v python3 >/dev/null 2>&1; then
                printf '%s' "$bridge_json" | python3 -c '
import json, sys
try:
    payload = json.load(sys.stdin)
except Exception:
    print("Robot link: UKENDT (kunne ikke parse bridge-status)")
    raise SystemExit(0)

if payload.get("status") != "success":
    print("Robot link: FEJL (bridge svarer men rapporterer ikke success)")
    raise SystemExit(0)

data = payload.get("data") or {}
ip = data.get("ip") or "?"
port = data.get("port") or "?"
count = data.get("interaction_count")
if count is None:
    count = "?"
print("Robot link: OK (%s:%s, interactions=%s)" % (ip, port, count))
'
            else
                echo "Robot link: UKENDT (python3 mangler til detaljevisning)"
            fi
        else
            echo "Bridge endpoint: FEJL (127.0.0.1:${BRIDGE_PORT})"
            echo "Robot link: FEJL (bridge utilgaengelig)"
        fi

        if curl -sS "http://127.0.0.1:${PROXY_PORT}/index.html" >/dev/null 2>&1; then
            echo "Screen endpoint: OK (127.0.0.1:${PROXY_PORT})"
        else
            echo "Screen endpoint: FEJL (127.0.0.1:${PROXY_PORT})"
        fi
    fi

    echo "Tablet URL: http://${OPERATOR_IP}:${PROXY_PORT}/"
}

show_tablet() {
    load_config
    ensure_operator_ip

    local payload
    payload=$(printf '{"command":"show_tablet_url","params":{"url":"http://%s:%s/"}}' "$OPERATOR_IP" "$PROXY_PORT")

    echo "Sender show_tablet_url: http://${OPERATOR_IP}:${PROXY_PORT}/"
    curl -sS -X POST "http://127.0.0.1:${BRIDGE_PORT}/api/command" \
        -H "Content-Type: application/json" \
        -d "$payload"
    echo ""
}

show_logs() {
    ensure_dirs
    if [[ ! -f "$runner_log" ]]; then
        echo "Ingen log endnu: $runner_log"
        return 0
    fi
    tail -n 120 "$runner_log"
}

cmd="${1:-}"
case "$cmd" in
    start)   start_runner ;;
    stop)    stop_runner ;;
    restart) stop_runner; start_runner ;;
    status)  status_runner ;;
    show)    show_tablet ;;
    logs)    show_logs ;;
    -h|--help|help|"") usage ;;
    *)
        echo "Ukendt kommando: $cmd" >&2
        usage
        exit 1
        ;;
esac
