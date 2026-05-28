"""Lokal HTTP-service der serverer Norma-tablet-siden.

Norma's tablet aabnes via bridge-kommandoen show_tablet_url med
operator-maskinens LAN-adresse, fx http://192.168.1.42:5000/.
"""
import argparse
import http.server
import json
import socketserver
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_PORT = 5000
DEFAULT_BRIDGE_HOST = "localhost"
DEFAULT_BRIDGE_PORT = 8080
BRIDGE_API_PATH = "/api/command"
STATIC_DIR = Path(__file__).parent / "static"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.bridge_host = kwargs.pop("bridge_host")
        self.bridge_port = kwargs.pop("bridge_port")
        self.bridge_url = "http://%s:%d%s" % (
            self.bridge_host, self.bridge_port, BRIDGE_API_PATH
        )
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_POST(self):
        if self.path != BRIDGE_API_PATH:
            return self.send_error(404, "Not Found")

        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""

        request = urllib.request.Request(
            self.bridge_url,
            data=body,
            headers={
                "Content-Type": self.headers.get("Content-Type", "application/json"),
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = response.read()
                self.send_response(response.getcode())
                self.send_header(
                    "Content-Type",
                    response.headers.get("Content-Type", "application/json"),
                )
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as exc:
            payload = exc.read()
            self.send_response(exc.code)
            self.send_header(
                "Content-Type",
                exc.headers.get("Content-Type", "application/json"),
            )
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except urllib.error.URLError as exc:
            message = {"status": "error", "message": "Kan ikke kontakte bridge: %s" % exc}
            payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)


def main():
    parser = argparse.ArgumentParser(description="Norma tablet static server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument(
        "--bridge-host",
        default=DEFAULT_BRIDGE_HOST,
        help="Host for norma-robot-bridge",
    )
    parser.add_argument(
        "--bridge-port",
        type=int,
        default=DEFAULT_BRIDGE_PORT,
        help="Port for norma-robot-bridge",
    )
    args = parser.parse_args()

    handler = lambda *args_, **kwargs_: Handler(
        *args_, bridge_host=args.bridge_host, bridge_port=args.bridge_port, **kwargs_
    )

    print(
        "Serverer %s paa http://%s:%d/ (proxy -> %s:%d%s)" %
        (STATIC_DIR, args.host, args.port, args.bridge_host, args.bridge_port, BRIDGE_API_PATH)
    )
    with socketserver.ThreadingTCPServer((args.host, args.port), handler) as srv:
        srv.serve_forever()


if __name__ == "__main__":
    main()
