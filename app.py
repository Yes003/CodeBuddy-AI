"""CodeBuddy AI - Flask application.

Routes:
    GET  /              the web app (landing page, dashboard, about)
    GET  /api/health    status + limits, used by the frontend on load
    POST /api/analyze   analyze submitted code

Every API response uses the same JSON shape:
    success: {"success": true,  "data": {...}, "meta": {...}}
    failure: {"success": false, "error": {"code": "...", "message": "..."}}
"""

import logging
import os
import time
from collections import defaultdict, deque

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()  # reads the backend .env file (never sent to the browser)

from services import ai_service  # noqa: E402  (must come after load_dotenv)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("codebuddy.app")

MAX_REQUEST_BYTES = 64 * 1024          # hard limit on request body size
RATE_LIMIT_REQUESTS = 20               # per client, per window
RATE_LIMIT_WINDOW_SECONDS = 60

_request_log = defaultdict(deque)      # client address -> recent request times


def error_response(code, message, status):
    return jsonify({"success": False, "error": {"code": code, "message": message}}), status


def rate_limited(client_id):
    """Tiny in-memory limiter so one browser can't drain the API quota."""
    now = time.monotonic()
    recent = _request_log[client_id]
    while recent and now - recent[0] > RATE_LIMIT_WINDOW_SECONDS:
        recent.popleft()
    if len(recent) >= RATE_LIMIT_REQUESTS:
        return True
    recent.append(now)
    return False


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES
    app.config["JSON_SORT_KEYS"] = False

    # ---------------------------------------------------------------- pages
    @app.get("/")
    def index():
        return render_template("index.html")

    # ------------------------------------------------------------------ api
    @app.get("/api/health")
    def health():
        return jsonify({
            "success": True,
            "data": {
                "status": "ok",
                "demo_mode": ai_service.is_demo_mode(),
                "max_code_chars": ai_service.MAX_CODE_CHARS,
                "languages": ai_service.SUPPORTED_LANGUAGES,
                "modes": ai_service.SUPPORTED_MODES,
            },
        })

    @app.post("/api/analyze")
    def analyze():
        if rate_limited(request.remote_addr or "unknown"):
            return error_response(
                "too_many_requests",
                "You're sending requests very quickly. Wait a few seconds and try again.",
                429,
            )

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return error_response("invalid_request", "Send a JSON body with code, language and mode.", 400)

        code = payload.get("code")
        language = payload.get("language")
        mode = payload.get("mode")

        if not isinstance(code, str):
            return error_response("invalid_request", "The 'code' field must be text.", 400)
        if not code.strip():
            return error_response("empty_code", "Please paste or type some code first.", 400)
        if len(code) > ai_service.MAX_CODE_CHARS:
            return error_response(
                "code_too_long",
                f"Your code is {len(code):,} characters. The limit is {ai_service.MAX_CODE_CHARS:,}. "
                "Try analyzing a smaller part.",
                413,
            )

        language = language.strip().lower() if isinstance(language, str) else ""
        if language not in ai_service.SUPPORTED_LANGUAGES:
            supported = ", ".join(ai_service.SUPPORTED_LANGUAGES.values())
            return error_response("unsupported_language", f"Choose one of: {supported}.", 400)

        mode = mode.strip().lower() if isinstance(mode, str) else ""
        if mode not in ai_service.SUPPORTED_MODES:
            return error_response("unsupported_mode", "Choose a valid analysis type.", 400)

        try:
            data, meta = ai_service.analyze_code(code, language, mode)
        except ai_service.AIServiceError as exc:
            return error_response(exc.code, exc.message, exc.status)
        except Exception as exc:  # last line of defense: no stack traces to users
            # Log only the exception type: never the code or the key.
            logger.error("Unexpected error in /api/analyze: %s", type(exc).__name__)
            return error_response("server_error", "Something went wrong on our side. Please try again.", 500)

        # Log request metadata only. The submitted code is not logged or stored.
        logger.info("analyzed mode=%s language=%s chars=%d demo=%s", mode, language, len(code), meta["demo"])
        return jsonify({"success": True, "data": data, "meta": meta})

    # --------------------------------------------------------------- errors
    @app.errorhandler(404)
    def not_found(_):
        if request.path.startswith("/api/"):
            return error_response("not_found", "That API endpoint does not exist.", 404)
        return render_template("index.html"), 404

    @app.errorhandler(405)
    def method_not_allowed(_):
        return error_response("method_not_allowed", "That method is not allowed for this endpoint.", 405)

    @app.errorhandler(413)
    def too_large(_):
        return error_response("request_too_large", "That request is too large.", 413)

    @app.errorhandler(500)
    def server_error(_):
        return error_response("server_error", "Something went wrong on our side. Please try again.", 500)

    # ------------------------------------------------------ security headers
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://cdnjs.cloudflare.com; "
            "style-src 'self' https://fonts.googleapis.com; "
            "font-src https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        )
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    return app


app = create_app()

if __name__ == "__main__":
    # Debug mode shows stack traces in the browser. Keep it OFF unless you are
    # developing locally: set FLASK_DEBUG=1 in .env to turn it on.
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    port = int(os.environ.get("PORT", "5000"))
    mode = "DEMO MODE (no API key found)" if ai_service.is_demo_mode() else "LIVE AI"
    print(f"\n  CodeBuddy AI running in {mode}\n  Open http://127.0.0.1:{port}\n")
    app.run(host="127.0.0.1", port=port, debug=debug)
