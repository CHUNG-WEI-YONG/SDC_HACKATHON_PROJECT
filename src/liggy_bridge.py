"""JSON-lines adapter that lets Liggy call the invoice pipeline process."""

import base64
import json
import os
import sys
import tempfile
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(ROOT / ".env")

from src.main import InvoicePipelineService  # noqa: E402

service = None


def get_service():
    global service
    if service is None:
        service = InvoicePipelineService(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_URL", "https://api.deepseek.com"),
            model=os.getenv("OPENAI_MODEL", "deepseek-chat"),
        )
    return service


def handle(request):
    action = request.get("action")
    pipeline = get_service()

    if action == "analyze":
        extension = request.get("extension", "")
        allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".json", ".csv"}
        if extension.lower() not in allowed_extensions:
            raise ValueError("Upload a PDF, image, TXT, JSON, or CSV invoice document.")

        content = base64.b64decode(request.get("content", ""), validate=True)
        if not content or len(content) > 10 * 1024 * 1024:
            raise ValueError("The document must be between 1 byte and 10 MB.")

        handle = tempfile.NamedTemporaryFile(suffix=extension.lower(), delete=False)
        try:
            handle.write(content)
            handle.close()
            thread_id, state = pipeline.process_invoice(handle.name)
        finally:
            try:
                os.unlink(handle.name)
            except OSError:
                pass

        return {"thread_id": thread_id, "state": state}

    if action in {"approve", "reject"}:
        thread_id = request.get("thread_id")
        if not isinstance(thread_id, str) or not thread_id.startswith("session-"):
            raise ValueError("A valid invoice review session is required.")
        result = pipeline.submit_decision(
            thread_id,
            approved=(action == "approve"),
            reason=request.get("reason", ""),
        )
        return result

    raise ValueError("Unknown invoice action.")


for line in sys.stdin:
    request = None
    try:
        request = json.loads(line)
        response = {"id": request.get("id"), "ok": True, "result": handle(request)}
    except Exception as error:  # Errors are returned to the API without stopping the bridge.
        response = {"id": request.get("id") if isinstance(request, dict) else None, "ok": False, "error": str(error)}
    sys.stdout.write(json.dumps(response, default=str) + "\n")
    sys.stdout.flush()
