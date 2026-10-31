"""
app.py
CodeBuddy AI - Flask Application & REST API Server
Provides endpoints for code analysis, conversational follow-up chat with history,
sample snippets, health checks, and modern web interface.
"""

import os
import logging
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()

from services.ai_service import AIService, SUPPORTED_LANGUAGES, SUPPORTED_MODES

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("codebuddy")

def create_app() -> Flask:
    """Factory to create and configure the Flask application."""
    app = Flask(__name__)
    CORS(app)

    # Security: Limit maximum payload size to 1MB
    app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024

    # Initialize AI service
    ai_service = AIService()

    @app.route("/")
    def index():
        """Serves the main single-page application."""
        return render_template(
            "index.html",
            is_live_ai=ai_service.is_live,
            provider_name=getattr(ai_service, "provider_name", "AI"),
            model_name=ai_service.model if ai_service.is_live else "Demo Engine",
            supported_languages=SUPPORTED_LANGUAGES,
            supported_modes=SUPPORTED_MODES
        )

    @app.route("/api/health", methods=["GET"])
    def health_check():
        """Returns API health status, active provider, model info, and supported configurations."""
        provider_label = getattr(ai_service, "provider_name", "AI")
        return jsonify({
            "status": "healthy",
            "is_live_ai": ai_service.is_live,
            "provider": provider_label,
            "model": ai_service.model,
            "mode_label": f"Live {provider_label} ({ai_service.model})" if ai_service.is_live else "Demo Mode (Gemma 4 Simulated)",
            "supported_languages": list(SUPPORTED_LANGUAGES.keys()),
            "supported_modes": list(SUPPORTED_MODES.keys())
        }), 200

    @app.route("/api/samples", methods=["GET"])
    def get_samples():
        """Returns beginner sample code snippets for each supported language."""
        samples = ai_service.get_sample_code()
        return jsonify({
            "status": "success",
            "samples": samples
        }), 200

    @app.route("/api/analyze", methods=["POST"])
    def analyze_code():
        """
        Primary analysis & code generation endpoint.
        Expects JSON payload:
        {
            "code": "string",
            "language": "python|javascript|java|c|cpp",
            "mode": "explain|bugs|improve|generate|tests|learn"
        }
        """
        if not request.is_json:
            return jsonify({
                "status": "error",
                "message": "Invalid request: Expected JSON body with Content-Type: application/json."
            }), 400

        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "status": "error",
                "message": "Malformed JSON payload."
            }), 400

        code = data.get("code")
        language = data.get("language")
        mode = data.get("mode")

        # 1. Validation checks
        if not isinstance(code, str) or not code.strip():
            return jsonify({
                "status": "error",
                "message": "Please enter or paste your code snippet or prompt before running analysis."
            }), 400

        if not isinstance(language, str) or language.lower() not in SUPPORTED_LANGUAGES:
            return jsonify({
                "status": "error",
                "message": f"Invalid language '{language}'. Supported: {', '.join(SUPPORTED_LANGUAGES.keys())}"
            }), 400

        if not isinstance(mode, str) or mode.lower() not in SUPPORTED_MODES:
            return jsonify({
                "status": "error",
                "message": f"Invalid mode '{mode}'. Supported: {', '.join(SUPPORTED_MODES.keys())}"
            }), 400

        if len(code) > 15000:
            return jsonify({
                "status": "error",
                "message": "Input exceeds 15,000 characters limit. Please submit a shorter snippet."
            }), 400

        # 2. Execute analysis
        try:
            result = ai_service.analyze_code(
                code=code,
                language=language.lower(),
                mode=mode.lower()
            )
            return jsonify({
                "status": "success",
                "data": result
            }), 200

        except ValueError as ve:
            return jsonify({
                "status": "error",
                "message": str(ve)
            }), 400
        except Exception as e:
            logger.exception("Unexpected error during code analysis: %s", str(e))
            return jsonify({
                "status": "error",
                "message": "An unexpected error occurred while analyzing the code. Please try again or switch to Demo Mode."
            }), 500

    @app.route("/api/chat", methods=["POST"])
    def chat_followup():
        """
        Conversational follow-up assistant maintaining chat history.
        Expects JSON payload:
        {
            "message": "string",
            "code": "string",
            "language": "python|javascript|java|c|cpp",
            "history": [{"role": "user"|"model", "content": "..."}] (optional)
        }
        """
        if not request.is_json:
            return jsonify({
                "status": "error",
                "message": "Expected JSON payload with Content-Type: application/json."
            }), 400

        data = request.get_json(silent=True) or {}
        message = data.get("message", "")
        code = data.get("code", "")
        language = data.get("language", "python")
        history = data.get("history", [])

        if not isinstance(message, str) or not message.strip():
            return jsonify({
                "status": "error",
                "message": "Message cannot be empty."
            }), 400

        if not isinstance(history, list):
            history = []

        try:
            result = ai_service.chat_followup(
                message=message.strip(),
                code=str(code),
                language=str(language),
                history=history
            )
            return jsonify({
                "status": "success",
                "data": result
            }), 200
        except ValueError as ve:
            return jsonify({
                "status": "error",
                "message": str(ve)
            }), 400
        except Exception as e:
            logger.exception("Chat follow-up error: %s", str(e))
            return jsonify({
                "status": "error",
                "message": "Failed to generate follow-up answer. Please try again."
            }), 500

    @app.errorhandler(413)
    def payload_too_large(e):
        return jsonify({
            "status": "error",
            "message": "Payload too large. Submitted input must be under 1MB."
        }), 413

    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith("/api/"):
            return jsonify({
                "status": "error",
                "message": "API endpoint not found."
            }), 404
        return render_template(
            "index.html",
            is_live_ai=ai_service.is_live,
            provider_name=getattr(ai_service, "provider_name", "AI"),
            model_name=ai_service.model if ai_service.is_live else "Demo Engine",
            supported_languages=SUPPORTED_LANGUAGES,
            supported_modes=SUPPORTED_MODES
        ), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({
            "status": "error",
            "message": "Internal server error occurred. Please try again shortly."
        }), 500

    return app

app = create_app()

if __name__ == "__main__":
    import socket
    preferred_port = int(os.getenv("PORT", 5000))
    debug_mode = os.getenv("FLASK_ENV", "development").lower() == "development"

    port = preferred_port
    candidate_ports = [preferred_port] + [p for p in [5001, 5050, 8080, 8000] if p != preferred_port]
    for p in candidate_ports:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", p))
                port = p
                break
            except OSError:
                continue

    active_service = AIService()
    provider_str = f"Live {getattr(active_service, 'provider_name', 'AI')} ({active_service.model})" if active_service.is_live else "Demo Mode (Simulated AI)"
    print("\n" + "="*60)
    print(" [CodeBuddy AI] - Your Personal AI Coding Mentor")
    print(f" [Server] Running on: http://127.0.0.1:{port}")
    print(f" [Engine] Mode: {provider_str}")
    print("="*60 + "\n")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
