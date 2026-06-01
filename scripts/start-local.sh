#!/usr/bin/env bash
# Lokal opstart af pepper-screen-interface + pepper-robot-bridge i ét greb.
#
# Forudsætninger:
#   - pepper-robot-bridge findes som soester-mappe (default) eller via --bridge-path
#   - bridge har en aktiv .venv27 med pepper_bridge installeret
#   - python3 (>= 3.11) findes i PATH
#
# Eksempel:
#   scripts/start-local.sh --operator-ip 192.168.1.42 --robot-ip 192.168.1.155

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
proxy_dir="$(cd "$here/.." && pwd)"
bridge_dir="$(cd "$proxy_dir/../pepper-robot-bridge" 2>/dev/null && pwd || echo "")"

usage() {
    cat <<EOF
Usage: $(basename "$0") [--operator-ip IP] [--robot-ip IP] [--bridge-port N] [--proxy-port N] [--bridge-path DIR] [--skip-bridge]

Options:
  --operator-ip   IP paa operator-maskinen som Pepper skal aabne (auto-detect hvis udeladt).
  --robot-ip      IP paa Pepper/NAO (paakraevet hvis bridge skal startes).
  --bridge-port   Port for pepper-robot-bridge HTTP API (default: 8080).
  --proxy-port    Port for pepper-screen-interface (default: 5000).
  --bridge-path   Sti til pepper-robot-bridge-mappen (default: ../pepper-robot-bridge).
  --skip-bridge   Start kun screen-interfacen og forvent at bridge allerede koerer.
  --help          Vis denne hjaelp.
EOF
    exit 1
}

bridge_host="localhost"
bridge_port=8080
proxy_port=5000
operator_ip=""
robot_ip=""
start_bridge=true

require_bridge_activator() {
    # Bridge'ens activate-with-naoqi.sh saetter baade venv og PYTHONPATH for
    # NAOqi-SDK'et - vi spawner bridge gennem den i stedet for at kalde python
    # direkte, saa naoqi-importen virker.
    local helper="$bridge_dir/activate-with-naoqi.sh"
    if [[ ! -f "$helper" ]]; then
        echo "Kan ikke finde $helper" >&2
        echo "Koer bridge'ens setup-script foerst (scripts/setup-linux.sh ...)." >&2
        exit 1
    fi
    echo "$helper"
}

detect_local_ip() {
    if command -v ip >/dev/null 2>&1; then
        ip route get 1.1.1.1 2>/dev/null | awk '/src/ {print $7; exit}'
        return
    fi
    if command -v hostname >/dev/null 2>&1; then
        hostname -I 2>/dev/null | awk '{print $1}'
    fi
}

wait_for_bridge() {
    local deadline=$((SECONDS + 15))
    while [[ $SECONDS -lt $deadline ]]; do
        if curl -sS "http://$bridge_host:$bridge_port/api/status" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

send_show_tablet_url() {
    local page_url="$1"
    local payload
    payload=$(printf '{"command":"show_tablet_url","params":{"url":"%s"}}' "$page_url")
    echo "Sender show_tablet_url til bridge med URL: $page_url"
    curl -sS -X POST "http://$bridge_host:$bridge_port/api/command" \
        -H "Content-Type: application/json" -d "$payload" \
        | (command -v python3 >/dev/null 2>&1 && python3 -m json.tool 2>/dev/null || cat)
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --operator-ip)  operator_ip="$2"; shift 2 ;;
        --robot-ip)     robot_ip="$2"; shift 2 ;;
        --bridge-port)  bridge_port="$2"; shift 2 ;;
        --proxy-port)   proxy_port="$2"; shift 2 ;;
        --bridge-path)  bridge_dir="$(cd "$2" && pwd)"; shift 2 ;;
        --skip-bridge)  start_bridge=false; shift ;;
        --help|-h)      usage ;;
        *)              echo "Ukendt parameter: $1" >&2; usage ;;
    esac
done

if [[ -z "$operator_ip" ]]; then
    operator_ip="$(detect_local_ip || true)"
    if [[ -z "$operator_ip" ]]; then
        read -rp "Indtast IP paa operator-maskinen: " operator_ip
    else
        echo "Bruger automatisk fundet operator-IP: $operator_ip"
    fi
fi
[[ -n "$operator_ip" ]] || { echo "Fejl: operator-IP maa ikke vaere tom." >&2; exit 1; }

mkdir -p "$proxy_dir/logs"

if [[ "$start_bridge" == true ]]; then
    [[ -d "$bridge_dir" ]] || { echo "Kan ikke finde pepper-robot-bridge i $bridge_dir (brug --bridge-path)." >&2; exit 1; }
    [[ -z "$robot_ip" ]] && read -rp "Indtast IP paa Pepper/NAO: " robot_ip
    [[ -n "$robot_ip" ]] || { echo "Fejl: robot-IP paakraevet naar bridge skal startes." >&2; exit 1; }

    activator="$(require_bridge_activator)"
    echo "Starter pepper-robot-bridge paa localhost:$bridge_port med robot-IP $robot_ip"
    (
        cd "$bridge_dir"
        # shellcheck disable=SC1090
        source "$activator" >/dev/null
        exec pepper-bridge --robot-ip "$robot_ip" --host localhost --port "$bridge_port"
    ) >"$proxy_dir/logs/bridge.log" 2>&1 &
    bridge_pid=$!
fi

command -v python3 >/dev/null 2>&1 || { echo "python3 paakraevet." >&2; exit 1; }

(
    cd "$proxy_dir"
    exec python3 app.py --host 0.0.0.0 --port "$proxy_port" \
        --bridge-host "$bridge_host" --bridge-port "$bridge_port"
) >"$proxy_dir/logs/proxy.log" 2>&1 &
proxy_pid=$!

cleanup() {
    echo ""
    echo "Stopper tjenester..."
    [[ -n "${bridge_pid:-}" ]] && kill "$bridge_pid" 2>/dev/null || true
    kill "$proxy_pid" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Starter pepper-screen-interface paa http://0.0.0.0:$proxy_port/"
if [[ -n "${bridge_pid:-}" ]]; then
    echo "Venter paa at bridge bliver klar..."
    wait_for_bridge || { echo "Bridge svarer ikke. Se $proxy_dir/logs/bridge.log" >&2; exit 1; }
fi

send_show_tablet_url "http://$operator_ip:$proxy_port/" || \
    echo "Kunne ikke sende show_tablet_url. Kontroller at robotten kan naa $operator_ip:$proxy_port." >&2

echo ""
echo "Tryk Ctrl+C for at stoppe."
wait
