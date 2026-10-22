"""JSON-lines adapter that lets Liggy call the invoice pipeline process."""

import base64
import json
import os
import sys
import tempfile
import smtplib
from contextlib import redirect_stdout
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

from src.main import InvoicePipelineService  # noqa: E402
from src.database import (  # noqa: E402
    get_customers,
    get_invoice_by_number,
    get_invoice_history,
    get_customer_info,
    init_db,
    mark_invoice_email_sent,
    create_user,
    get_user_by_email,
    get_user_by_id,
)

service = None
init_db()


def get_service():
    global service
    if service is None:
        service = InvoicePipelineService(
            api_key=os.getenv("APIKEY") or os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("AI_URL") or os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_URL"),
            model=os.getenv("BASEMODEL") or os.getenv("OPENAI_MODEL"),
        )
    return service


def handle(request):
    action = request.get("action")

    if action == "create_user":
        return create_user(request["username"], request["email"], request["password_hash"])
    if action == "find_user":
        return get_user_by_email(request["email"])
    if action == "get_user":
        return get_user_by_id(request["user_id"])

    user_id = request.get("user_id")
    if not user_id:
        raise ValueError("Sign in is required.")

    if action == "business_data":
        return {"customers": get_customers(user_id), "invoices": get_invoice_history(user_id)}

    if action == "manual":
        pipeline = get_service()
        thread_id, state = pipeline.process_typed_invoice(request.get("invoice_data") or {}, user_id)
        return {"thread_id": thread_id, "state": state}

    if action == "analyze":
        pipeline = get_service()
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
            with redirect_stdout(sys.stderr):
                thread_id, state = pipeline.process_invoice(handle.name, user_id)
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
        pipeline = get_service()
        result = pipeline.submit_decision(
            thread_id,
            approved=(action == "approve"),
            reason=request.get("reason", ""),
            invoice_data=request.get("invoice_data"),
        )
        return result

    if action == "send_email":
        invoice_no = str(request.get("invoice_no") or "")
        invoice = get_invoice_by_number(invoice_no, user_id)
        if not invoice:
            raise ValueError("The saved invoice could not be found.")
        recipient = (
            (invoice.get("invoice_data") or {}).get("customer_email")
            or (get_customer_info(invoice.get("customer_name") or "", user_id) or {}).get("email")
            or ""
        ).strip()
        if not recipient:
            return {"status": "skipped", "message": "This customer has no email address on record, so the invoice was not sent."}

        host = os.getenv("SMTP_HOST")
        port = int(os.getenv("SMTP_PORT", "587"))
        sender = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
        if not host or not sender:
            raise ValueError("Email delivery is not configured. Set SMTP_HOST and SMTP_FROM in the server environment.")

        pdf_path = invoice.get("file_path") or ""
        if not pdf_path or not os.path.isfile(pdf_path):
            raise ValueError("The saved invoice PDF could not be found.")
        data = invoice.get("invoice_data") or {}
        message = EmailMessage()
        message["Subject"] = f"E-Invoice {invoice_no}"
        message["From"] = sender
        message["To"] = recipient
        message.set_content(
            f"Hello {invoice.get('customer_name') or 'customer'},\n\n"
            f"Please find attached e-invoice {invoice_no} for "
            f"{data.get('currency', 'MYR')} {float(invoice.get('total_amount') or 0):.2f}.\n\n"
            "Thank you."
        )
        with open(pdf_path, "rb") as attachment:
            message.add_attachment(
                attachment.read(),
                maintype="application",
                subtype="pdf",
                filename=Path(pdf_path).name,
            )

        use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            if use_tls:
                smtp.starttls()
            if os.getenv("SMTP_USER"):
                smtp.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD", ""))
            smtp.send_message(message)
        mark_invoice_email_sent(invoice_no, user_id)
        return {"status": "sent", "message": f"Invoice sent to {recipient}."}

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
