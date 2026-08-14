#!/usr/bin/env python3
"""Official Nuuk operator UI backend for Norma.

Serves a browser UI and proxies operator actions to norma-runner.sh.
No external dependencies.
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import subprocess
import urllib.parse
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent.parent
RUNNER = REPO_DIR / "scripts" / "norma-runner.sh"
STATIC_DIR = REPO_DIR / "static" / "nuuk-control"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5051


class ControlHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def _send_json(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/status":
            return self._send_json(200, get_status_payload())
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/api/action":
            return self.send_error(404, "Not Found")

        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {}

        action = str(payload.get("action") or "").strip().lower()
        if action not in {"start", "show", "status", "restart", "stop", "logs"}:
            return self._send_json(400, {"status": "error", "message": "Ugyldig handling."})

        result = run_runner(action)
        response = get_status_payload()
        response["last_action"] = action
        response["command_output"] = result
        return self._send_json(200, response)


def run_runner(action: str) -> str:
    completed = subprocess.run(
        [str(RUNNER), action],
        cwd=str(REPO_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    return (completed.stdout or "").rstrip()


def parse_status_output(output: str):
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    parsed = {
        "runner": "Ukendt",
        "bridge": "Ukendt",
        "robot": "Ukendt",
        "screen": "Ukendt",
        "tablet_url": "",
        "raw_lines": lines,
    }

    for line in lines:
        low = line.lower()
        if low.startswith("runner:"):
            parsed["runner"] = line.split(":", 1)[1].strip()
        elif low.startswith("bridge endpoint:"):
            parsed["bridge"] = line.split(":", 1)[1].strip()
        elif low.startswith("robot link:"):
            parsed["robot"] = line.split(":", 1)[1].strip()
        elif low.startswith("screen endpoint:"):
            parsed["screen"] = line.split(":", 1)[1].strip()
        elif low.startswith("tablet url:"):
            parsed["tablet_url"] = line.split(":", 1)[1].strip()

    return parsed


def derive_next_step(parsed_status):
    runner = parsed_status["runner"].lower()
    bridge = parsed_status["bridge"].lower()
    robot = parsed_status["robot"].lower()
    screen = parsed_status["screen"].lower()

    if "stoppet" in runner:
        return "Tryk Start. Når systemet er oppe, tryk derefter Vis skærm."
    if "fejl" in bridge:
        return "Bridge svarer ikke endnu. Tjek at Norma er tændt, og tryk derefter Genstart."
    if "fejl" in robot:
        return "Bridge kører, men der er ikke robotforbindelse. Tjek Norma og netværk, og tryk Genstart."
    if "fejl" in screen:
        return "Skærmserveren svarer ikke. Tryk Genstart."
    if "ok" in bridge and "ok" in robot and "ok" in screen:
        return "Klar til borgere. Hvis tablet ikke skifter, tryk Vis skærm."
    return "Tryk Status igen om få sekunder."


def get_status_payload():
    status_output = run_runner("status")
    parsed = parse_status_output(status_output)
    return {
        "status": "ok",
        "panel": "Norma Nuuk Control",
        "status_output": status_output,
        "parsed": parsed,
        "next_step": derive_next_step(parsed),
        "fallback": "Norma Driftpanel (Terminal)",
    }


def main():
    parser = argparse.ArgumentParser(description="Norma Nuuk Control backend")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    server = http.server.ThreadingHTTPServer((args.host, args.port), ControlHandler)
    print("Norma Nuuk Control kører på http://%s:%d/" % (args.host, args.port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
