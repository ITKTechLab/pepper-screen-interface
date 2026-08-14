#!/usr/bin/env bash
# Opretter desktop-genveje til start/stop/status for driftspersonale.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$here/.." && pwd)"
runner="$repo_dir/scripts/norma-runner.sh"
apps_dir="$HOME/.local/share/applications"
autostart_dir="$HOME/.config/autostart"

want_autostart="false"
if [[ "${1:-}" == "--autostart" ]]; then
    want_autostart="true"
fi

mkdir -p "$apps_dir"

write_entry() {
    local file_path="$1"
    local name="$2"
    local comment="$3"
    local command="$4"
    local terminal_mode="$5"
    local no_display="${6:-false}"

    cat >"$file_path" <<EOF
[Desktop Entry]
Type=Application
Name=$name
Comment=$comment
Exec=bash -lc 'cd "$repo_dir" && $command; echo; echo "Tryk Enter for at lukke"; read -r _'
Terminal=$terminal_mode
Categories=Utility;
NoDisplay=$no_display
EOF

    chmod +x "$file_path"
}

write_entry "$apps_dir/norma-start.desktop" "Norma Start" "Start Norma control" "./scripts/norma-runner.sh start" "true" "true"
write_entry "$apps_dir/norma-show-tablet.desktop" "Norma Vis Skaerm" "Vis side paa Norma tablet" "./scripts/norma-runner.sh show" "true" "true"
write_entry "$apps_dir/norma-status.desktop" "Norma Status" "Vis status for Norma control" "./scripts/norma-runner.sh status" "true" "true"
write_entry "$apps_dir/norma-stop.desktop" "Norma Stop" "Stop Norma control" "./scripts/norma-runner.sh stop" "true" "true"
write_entry "$apps_dir/norma-driftpanel.desktop" "Norma Driftpanel (Terminal)" "Fallback-panel med status og naeste skridt" "python3 ./scripts/norma-operator-panel.py" "true" "false"

cat >"$apps_dir/norma-nuuk-control.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Norma Nuuk Control
Comment=Officiel browser-baseret operatorflade
Exec=bash -lc 'cd "$repo_dir" && ./scripts/norma-nuuk-control.sh'
Terminal=false
Categories=Utility;
NoDisplay=false
EOF

chmod +x "$apps_dir/norma-nuuk-control.desktop"

if [[ "$want_autostart" == "true" ]]; then
    mkdir -p "$autostart_dir"
    cat >"$autostart_dir/norma-start.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Norma Auto Start
Exec=bash -lc 'cd "$repo_dir" && ./scripts/norma-runner.sh start'
X-GNOME-Autostart-enabled=true
EOF
    chmod +x "$autostart_dir/norma-start.desktop"
    echo "Autostart installeret i $autostart_dir/norma-start.desktop"
fi

echo "Genveje oprettet i $apps_dir"
echo "Soeg i app-menuen efter: Norma Nuuk Control, Norma Driftpanel (Terminal)"
echo "Hjaelpegenveje Start/Vis Skaerm/Status/Stop er stadig installeret, men skjult fra app-menuen."
if [[ "$want_autostart" != "true" ]]; then
    echo "Tip: koer med --autostart for auto-start ved login."
fi

if [[ ! -f "$repo_dir/config/operator.env" ]]; then
    echo ""
    echo "OBS: Opret foerst konfigurationsfil:"
    echo "  cp $repo_dir/config/operator.env.example $repo_dir/config/operator.env"
    echo "  rediger ROBOT_IP i $repo_dir/config/operator.env"
fi
