"""Lokal HTTP-service der serverer en statisk tablet-side til Pepper.

Pepper's tablet aabnes via bridge-kommandoen ``show_tablet_url`` med
operator-maskinens LAN-adresse, fx http://192.168.1.42:5000/. Servicen
proxy'er ogsaa POSTs paa /api/command videre til pepper-robot-bridge saa
HTML-siden kan kalde robotten uden CORS-bekymringer.
"""
import argparse
import base64
import http.server
import json
import os
import re
import socketserver
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_PORT = 5000
DEFAULT_BRIDGE_HOST = "localhost"
DEFAULT_BRIDGE_PORT = 8080
BRIDGE_API_PATH = "/api/command"
BOOK_RECOMMEND_API_PATH = "/api/book-recommendation"
TRANSCRIBE_API_PATH = "/api/transcribe"
STATIC_DIR = Path(__file__).parent / "static"
BOOKS_FILE = STATIC_DIR / "data" / "books.json"
DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
DEFAULT_OLLAMA_MODEL = "llama3.1:8b"


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.bridge_host = kwargs.pop("bridge_host")
        self.bridge_port = kwargs.pop("bridge_port")
        self.mock_bridge = kwargs.pop("mock_bridge", False)
        self.ollama_url = kwargs.pop("ollama_url", DEFAULT_OLLAMA_URL)
        self.ollama_model = kwargs.pop("ollama_model", DEFAULT_OLLAMA_MODEL)
        self.whisper_cmd = kwargs.pop("whisper_cmd", "whisper")
        self.bridge_url = "http://%s:%d%s" % (
            self.bridge_host, self.bridge_port, BRIDGE_API_PATH
        )
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def _send_json(self, status_code, payload_obj):
        payload = json.dumps(payload_obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _mock_bridge_response(self, body):
        try:
            req = json.loads(body.decode("utf-8") if body else "{}")
        except Exception:
            req = {}

        command = req.get("command")
        params = req.get("params") or {}

        if command == "get_status":
            return {
                "status": "ok",
                "message": "Mock bridge kører lokalt.",
                "data": {
                    "connected": False,
                    "mode": "mock",
                },
            }

        return {
            "status": "ok",
            "mode": "mock",
            "command": command,
            "params": params,
            "message": "Mock-response: ingen fysisk robot involveret.",
        }

    def _load_books(self):
        if not BOOKS_FILE.exists():
            return []
        try:
            with BOOKS_FILE.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            return []

        if isinstance(payload, list):
            return payload
        return []

    def _tokenize(self, text):
        if not text:
            return []
        return re.findall(r"[a-zA-ZæøåÆØÅ]+", text.lower())

    def _read_json_body(self, body):
        try:
            return json.loads(body.decode("utf-8") if body else "{}")
        except Exception:
            return {}

    def _extract_json_object(self, text):
        if not text:
            return None
        cleaned = text.strip()
        try:
            return json.loads(cleaned)
        except Exception:
            pass

        # Ollama kan nogle gange omgive JSON med ekstra tekst. Prøv at udtrække
        # første JSON-objekt mellem den første og sidste klammeparentes.
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return json.loads(cleaned[start:end + 1])
        except Exception:
            return None

    def _score_book(self, book, tokens):
        tags = [str(v).lower() for v in (book.get("tags") or [])]
        title = str(book.get("title") or "").lower()
        description = str(book.get("description") or "").lower()

        score = 0
        for token in tokens:
            if token in tags:
                score += 3
            if token in title:
                score += 2
            if token in description:
                score += 1
        return score

    def _rule_based_pick(self, interest_text, books, exclude_ids=None):
        exclude_ids = set(exclude_ids or [])
        candidates = [book for book in books if str(book.get("id")) not in exclude_ids]
        if not candidates:
            candidates = books

        tokens = self._tokenize(interest_text)
        if not tokens:
            return candidates[0], "Valgt som standardanbefaling."

        scored = []
        for book in candidates:
            scored.append((self._score_book(book, tokens), book))
        scored.sort(key=lambda row: row[0], reverse=True)

        best_score, chosen = scored[0]
        if best_score <= 0:
            chosen = candidates[0]
            return chosen, "Valgt som standard, da ingen stærk match blev fundet."

        chosen_tags = [str(v).lower() for v in (chosen.get("tags") or [])]
        reasons = []
        for token in tokens:
            if token in chosen_tags and token not in reasons:
                reasons.append(token)
        if reasons:
            return chosen, "Valgt ud fra: %s." % ", ".join(reasons[:3])
        return chosen, "Valgt ud fra samlet tekstmatch."

    def _call_ollama_recommendation(self, interest_text, books, exclude_ids=None):
        exclude_ids = set(exclude_ids or [])
        candidates = [book for book in books if str(book.get("id")) not in exclude_ids]
        if not candidates:
            candidates = books

        shortlist = []
        for book in candidates[:60]:
            shortlist.append(
                {
                    "id": book.get("id"),
                    "title": book.get("title"),
                    "author": book.get("author"),
                    "short_pitch": book.get("short_pitch"),
                    "description": book.get("description"),
                    "tags": book.get("tags") or [],
                }
            )

        prompt = (
            "Du er biblioteksrobotten Norma.\n"
            "Vælg PRÆCIS én bog fra listen, baseret på brugerens interesse.\n"
            "Svar KUN med gyldigt JSON og ingen ekstra tekst.\n"
            "Format:\n"
            "{\n"
            "  \"book_id\": \"...\",\n"
            "  \"why\": \"kort begrundelse på dansk\",\n"
            "  \"spoken_reply\": \"kort mundtligt svar på dansk\",\n"
            "  \"follow_up_question\": \"kort opfølgende spørgsmål\"\n"
            "}\n\n"
            "Brugerens interesse:\n"
            "%s\n\n"
            "Bogliste:\n"
            "%s\n"
        ) % (interest_text, json.dumps(shortlist, ensure_ascii=False))

        payload = {
            "model": self.ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2},
        }
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        request = urllib.request.Request(
            self.ollama_url,
            data=data,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read()
            parsed = json.loads(raw.decode("utf-8"))

        model_text = str(parsed.get("response") or "")
        result = self._extract_json_object(model_text)
        if not isinstance(result, dict):
            raise ValueError("Ollama returnerede ikke gyldigt JSON-indhold")

        selected_id = str(result.get("book_id") or "").strip()
        selected_book = None
        for book in candidates:
            if str(book.get("id")) == selected_id:
                selected_book = book
                break

        if not selected_book:
            raise ValueError("Ollama valgte en bog-id der ikke findes i lokalt katalog")

        why = str(result.get("why") or "Valgt af modellen.").strip()
        spoken_reply = str(result.get("spoken_reply") or "").strip()
        follow_up = str(result.get("follow_up_question") or "Vil du have en mere?").strip()

        if not spoken_reply:
            spoken_reply = (
                "Jeg anbefaler \"%s\" af %s. %s %s"
                % (
                    selected_book.get("title", "Ukendt titel"),
                    selected_book.get("author", "ukendt forfatter"),
                    selected_book.get("short_pitch", "Den passer godt til dig."),
                    follow_up,
                )
            )

        return {
            "book": selected_book,
            "why": why,
            "spoken_reply": spoken_reply,
            "follow_up_question": follow_up,
        }

    def _transcribe_response(self, body):
        req = self._read_json_body(body)
        text = str(req.get("text") or "").strip()
        if text:
            return {
                "status": "ok",
                "mode": "text-dev",
                "transcript": text,
                "engine": "whisper-bypass",
            }

        audio_b64 = req.get("audio_base64")
        if not audio_b64:
            return {
                "status": "error",
                "message": "Mangler input. Send enten text eller audio_base64.",
            }

        language = str(req.get("language") or "da")
        whisper_model = str(req.get("model") or "small")
        audio_ext = str(req.get("audio_ext") or "wav").lower().strip(".")

        try:
            audio_bytes = base64.b64decode(audio_b64)
        except Exception:
            return {"status": "error", "message": "audio_base64 kunne ikke dekodes."}

        with tempfile.TemporaryDirectory(prefix="norma-whisper-") as tmp_dir:
            audio_path = Path(tmp_dir) / ("input." + audio_ext)
            audio_path.write_bytes(audio_bytes)

            command = [
                self.whisper_cmd,
                str(audio_path),
                "--model",
                whisper_model,
                "--language",
                language,
                "--task",
                "transcribe",
                "--output_format",
                "txt",
                "--output_dir",
                tmp_dir,
                "--fp16",
                "False",
            ]

            try:
                completed = subprocess.run(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                    text=True,
                )
            except FileNotFoundError:
                return {
                    "status": "error",
                    "message": "Whisper-kommando ikke fundet. Installer openai-whisper eller angiv --whisper-cmd.",
                }
            except subprocess.CalledProcessError as exc:
                return {
                    "status": "error",
                    "message": "Whisper fejlede under transskription.",
                    "details": (exc.stderr or "").strip()[:1200],
                }

            txt_path = Path(tmp_dir) / (audio_path.stem + ".txt")
            if not txt_path.exists():
                return {
                    "status": "error",
                    "message": "Whisper gav ingen txt-output.",
                    "details": (completed.stdout or "").strip()[:1200],
                }

            transcript = txt_path.read_text(encoding="utf-8").strip()
            return {
                "status": "ok",
                "mode": "audio-whisper",
                "transcript": transcript,
                "engine": "whisper",
            }

    def _book_recommendation_response(self, body):
        req = self._read_json_body(body)
        interest_text = str(req.get("interest") or "").strip()
        exclude_ids = req.get("exclude_ids") or []
        if not isinstance(exclude_ids, list):
            exclude_ids = []

        books = self._load_books()
        if not books:
            return {
                "status": "error",
                "message": "Ingen bogdata fundet lokalt. Tilfoej filer i static/data/books.json.",
            }

        engine = "ollama"
        try:
            llm_result = self._call_ollama_recommendation(interest_text, books, exclude_ids)
            chosen = llm_result["book"]
            match_reason = llm_result.get("why") or "Valgt af modellen."
            spoken_reply = llm_result.get("spoken_reply") or "Vil du have en mere?"
            follow_up = llm_result.get("follow_up_question") or "Vil du have en mere?"
        except Exception as exc:
            engine = "rule-based-fallback"
            chosen, match_reason = self._rule_based_pick(interest_text, books, exclude_ids)
            follow_up = "Vil du have en mere?"
            spoken_reply = (
                "Ud fra det du siger, anbefaler jeg \"%s\" af %s. %s. %s"
                % (
                    chosen.get("title", "Ukendt titel"),
                    chosen.get("author", "ukendt forfatter"),
                    chosen.get("short_pitch", "Den passer godt til dig"),
                    follow_up,
                )
            )
            match_reason = "%s (fallback aarsag: %s)" % (match_reason, str(exc))

        return {
            "status": "ok",
            "mode": "local-beta",
            "engine": engine,
            "heard_text": interest_text,
            "match_reason": match_reason,
            "book": chosen,
            "spoken_reply": spoken_reply,
            "follow_up_question": follow_up,
        }

    def do_POST(self):
        if self.path not in (BRIDGE_API_PATH, BOOK_RECOMMEND_API_PATH, TRANSCRIBE_API_PATH):
            return self.send_error(404, "Not Found")

        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""

        if self.path == TRANSCRIBE_API_PATH:
            result = self._transcribe_response(body)
            status_code = 200 if result.get("status") == "ok" else 400
            return self._send_json(status_code, result)

        if self.path == BOOK_RECOMMEND_API_PATH:
            return self._send_json(200, self._book_recommendation_response(body))

        if self.mock_bridge:
            return self._send_json(200, self._mock_bridge_response(body))

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
    parser = argparse.ArgumentParser(description="Pepper tablet static server + bridge proxy")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument(
        "--bridge-host",
        default=DEFAULT_BRIDGE_HOST,
        help="Host for pepper-robot-bridge",
    )
    parser.add_argument(
        "--bridge-port",
        type=int,
        default=DEFAULT_BRIDGE_PORT,
        help="Port for pepper-robot-bridge",
    )
    parser.add_argument(
        "--mock-bridge",
        action="store_true",
        help="Svar lokalt på /api/command uden at kontakte pepper-robot-bridge",
    )
    parser.add_argument(
        "--ollama-url",
        default=os.environ.get("OLLAMA_URL", DEFAULT_OLLAMA_URL),
        help="URL til Ollama generate endpoint (default: http://127.0.0.1:11434/api/generate)",
    )
    parser.add_argument(
        "--ollama-model",
        default=os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
        help="Modelnavn i lokal Ollama (fx llama3.1:8b)",
    )
    parser.add_argument(
        "--whisper-cmd",
        default=os.environ.get("WHISPER_CMD", "whisper"),
        help="Kommando til Whisper CLI (default: whisper)",
    )
    args = parser.parse_args()

    handler = lambda *args_, **kwargs_: Handler(
        *args_,
        bridge_host=args.bridge_host,
        bridge_port=args.bridge_port,
        mock_bridge=args.mock_bridge,
        ollama_url=args.ollama_url,
        ollama_model=args.ollama_model,
        whisper_cmd=args.whisper_cmd,
        **kwargs_
    )

    mode_label = "mock" if args.mock_bridge else "proxy"
    print(
        "Serverer %s paa http://%s:%d/ (mode=%s, bridge=%s:%d%s, ollama=%s, model=%s)" %
        (
            STATIC_DIR,
            args.host,
            args.port,
            mode_label,
            args.bridge_host,
            args.bridge_port,
            BRIDGE_API_PATH,
            args.ollama_url,
            args.ollama_model,
        )
    )
    with ReusableTCPServer((args.host, args.port), handler) as srv:
        srv.serve_forever()


if __name__ == "__main__":
    main()
