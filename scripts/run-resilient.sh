#!/usr/bin/env bash
# Wrapper der genstarter start-local.sh automatisk hvis processen crasher.
# Bruges i demos hvor hurtig recovery er vigtig.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
start_script="$here/start-local.sh"

if [[ ! -f "$start_script" ]]; then
    echo "Kan ikke finde $start_script" >&2
    exit 1
fi

for arg in "$@"; do
    if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
        exec "$start_script" "$@"
    fi
done

attempt=1
while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starter Norma interface (forsoeg $attempt)..."

    set +e
    "$start_script" "$@"
    exit_code=$?
    set -e

    if [[ $exit_code -eq 0 ]]; then
        echo "start-local.sh afsluttede normalt. Stopper resilient runner."
        exit 0
    fi

    if [[ $exit_code -eq 130 || $exit_code -eq 143 ]]; then
        echo "Afsluttet af bruger (exit $exit_code). Ingen auto-genstart."
        exit "$exit_code"
    fi

    echo "start-local.sh stoppede med exit $exit_code. Genstarter om 2 sekunder..."
    sleep 2
    attempt=$((attempt + 1))
done
