"""Lokal HTTP-service der serverer Norma-tablet-siden.

Norma's tablet aabnes via bridge-kommandoen show_tablet_url med
operator-maskinens LAN-adresse, fx http://192.168.1.42:5000/.
"""
import argparse
import http.server
import socketserver
from pathlib import Path

DEFAULT_PORT = 5000
STATIC_DIR = Path(__file__).parent / "static"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)


def main():
    parser = argparse.ArgumentParser(description="Norma tablet static server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    with socketserver.ThreadingTCPServer((args.host, args.port), Handler) as srv:
        print("Serverer {} paa http://{}:{}/".format(STATIC_DIR, args.host, args.port))
        srv.serve_forever()


if __name__ == "__main__":
    main()
