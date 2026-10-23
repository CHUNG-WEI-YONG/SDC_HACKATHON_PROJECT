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

print(
    "[Liggy bridge] STEP 1/3: environment loaded "
    f"(Firebase project={os.getenv('GOOGLE_CLOUD_PROJECT') or 'from credentials'}).",
    file=sys.stderr,
    flush=True,
)
from src.database import (  # noqa: E402
    get_customers,
    get_invoice_by_number,
    get_invoice_history,
    init_db,
    mark_invoice_email_sent,
    update_customer_email,
    create_user,
    get_user_by_email,
    get_user_by_id,
    update_invoice_file_path,
)
from src.pdf_generators import generate_invoice_pdf

print("[Liggy bridge] STEP 2/3: checking Firebase/Firestore connection.", file=sys.stderr, flush=True)
service = None
init_db()
print("[Liggy bridge] STEP 3/3: ready for account and invoice requests.", file=sys.stderr, flush=True)


def get_service():
    global service
    if service is None:
        print("[Liggy bridge] Loading invoice-agent workflow on first invoice request.", file=sys.stderr, flush=True)
        from src.main import InvoicePipelineService

        service = InvoicePipelineService(
            api_key=os.getenv("APIKEY") or os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("AI_URL") or os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_URL"),
            model=os.getenv("BASEMODEL") or os.getenv("OPENAI_MODEL"),
        )
    return service


def ensure_invoice_pdf(user_id, file_name=None, invoice_no=None):
    """Find a saved invoice PDF or recreate it from the invoice data in Firestore."""
    requested_name = Path(file_name).name if file_name else None
    invoice = next((
        row for row in get_invoice_history(user_id)
        if (invoice_no and str(row.get("invoice_no")) == str(invoice_no))
        or (requested_name and Path(row.get("file_path") or "").name == requested_name)
    ), None)
    if not invoice:
        raise FileNotFoundError("The invoice PDF was not found in this account's history.")

    saved_path = Path(invoice.get("file_path") or "")
    if saved_path.is_file() and saved_path.suffix.lower() == ".pdf":
        return str(saved_path.resolve())

    invoice_data = invoice.get("invoice_data") or {}
    if not isinstance(invoice_data, dict) or not invoice_data.get("invoice_no"):
        raise FileNotFoundError("This invoice has no saved details to recreate its missing PDF.")

    restored_path = generate_invoice_pdf(invoice_data)
    if not update_invoice_file_path(invoice["invoice_no"], restored_path, user_id):
        raise FileNotFoundError("The invoice record could not be updated with its restored PDF.")
    print(f"[Invoice PDF] Restored missing PDF for {invoice['invoice_no']}.", file=sys.stderr, flush=True)
    return str(Path(restored_path).resolve())


def handle(request):
    action = request.get("action")

    if action == "create_user":
        return create_user(request["username"], request["email"], request["password_hash"])
    if action == "find_user":
        return get_user_by_email(request["email"])
    if action == "get_user":
        return get_user_by_id(request["user_id"])
    if action == "update_customer_email":
        return update_customer_email(request.get("customer_name", ""), request.get("email", ""), user_id)

    user_id = request.get("user_id")
    if not user_id:
        raise ValueError("Sign in is required.")

    if action == "business_data":
        return {"customers": get_customers(user_id), "invoices": get_invoice_history(user_id)}

    if action == "restore_invoice_pdf":
        file_name = request.get("file_name")
        if not isinstance(file_name, str) or Path(file_name).name != file_name or not file_name.lower().endswith(".pdf"):
            raise ValueError("A valid invoice PDF name is required.")
        return {"file_path": ensure_invoice_pdf(user_id, file_name=file_name)}

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
            or ""
        ).strip()
        if not recipient:
            return {"status": "skipped", "message": "This customer has no email address on record, so the invoice was not sent."}

        host = os.getenv("SMTP_HOST")
        port = int(os.getenv("SMTP_PORT", "587"))
        sender = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
        if not host or not sender:
            raise ValueError(
                "Email delivery is not configured. Add SMTP_HOST, SMTP_PORT, and SMTP_FROM to the project-root .env file; add SMTP_USER and SMTP_PASSWORD too if your provider requires login, then restart the backend."
            )

        try:
            pdf_path = ensure_invoice_pdf(user_id, invoice_no=invoice_no)
        except FileNotFoundError as error:
            raise ValueError(str(error)) from error
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


# Announce readiness only after imports and database initialization succeed.
sys.stdout.write(json.dumps({"type": "ready"}) + "\n")
sys.stdout.flush()

for line in sys.stdin:
    request = None
    try:
        request = json.loads(line)
        response = {"id": request.get("id"), "ok": True, "result": handle(request)}
    except Exception as error:  # Errors are returned to the API without stopping the bridge.
        response = {"id": request.get("id") if isinstance(request, dict) else None, "ok": False, "error": str(error)}
    sys.stdout.write(json.dumps(response, default=str) + "\n")
    sys.stdout.flush()
