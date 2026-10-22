import os
import uuid
from datetime import date
from pathlib import Path
from typing import Dict, Any, Tuple
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

from .database import init_db
from .workflow import build_workflow
from .document_reader import read_document
from .agents import verification_node

load_dotenv(Path(__file__).resolve().parent / ".env")

class InvoicePipelineService:
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):

        api_key = os.getenv("APIKEY") or api_key
        base_url = os.getenv("AI_URL") or os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_URL") or base_url
        model = os.getenv("BASEMODEL") or os.getenv("OPENAI_MODEL") or model
        missing = [name for name, value in (("APIKEY", api_key), ("AI_URL", base_url), ("BASEMODEL", model)) if not value]
        if missing:
            raise ValueError(f"Set {', '.join(missing)} in src/.env to configure the invoice agent.")

        self.api_key = api_key
        self.base_url = base_url
        self.model = model

        # Ensure Firebase Admin is initialized before processing requests.
        init_db()

        # Build dynamic LLM instance
        self.llm = ChatOpenAI(
            model=self.model,
            api_key=self.api_key,
            base_url=self.base_url,
            temperature=0,
            # DeepSeek rejects tool_choice in thinking mode. Invoice extraction
            # uses function-call structured output, so use its non-thinking mode.
            extra_body={"thinking": {"type": "disabled"}} if "deepseek.com" in self.base_url.lower() else None,
        )

        # Compile the graph
        self.app = build_workflow(self.llm)

    def process_invoice(self, file_path: str, user_id: int) -> Tuple[str, Dict[str, Any]]:
        """
        Step 2: Receives the filepath from your UI.
        Extracts document text, runs extraction + verification, 
        and pauses before 'store'.
        
        Returns:
            thread_id (str): Session token needed for the next step.
            state (dict): Contains 'invoice_data' and 'verification_errors'.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        thread_id = f"session-{uuid.uuid4().hex[:8]}"
        config = {"configurable": {"thread_id": thread_id}}

        # Reuse the same configured model client used by the invoice workflow.
        # This keeps APIKEY/AI_URL/BASEMODEL consistent for image transcription.
        raw_document_text = read_document(file_path, vision_llm=self.llm)

        initial_state = {
            "raw_text": raw_document_text,
            "invoice_data": None,
            "verification_errors": [],
            "is_verified": False,
            "manager_approval": None,
            "rejection_reason": None,
            "generated_pdf_path": None,
            "invoice_source": "document",
            "user_id": user_id,
        }

        return self._start_review(initial_state, thread_id)

    def process_typed_invoice(self, invoice_data: Dict[str, Any], user_id: int) -> Tuple[str, Dict[str, Any]]:
        """Validate a typed invoice through the same review and approval graph."""
        items = invoice_data.get("items") or [{
            "description": invoice_data.get("description", ""),
            "quantity": invoice_data.get("quantity", 1),
            "unit_price": invoice_data.get("unit_price", invoice_data.get("price", 0)),
        }]
        normalized_items = []
        for item in items:
            quantity = float(item.get("quantity") or 0)
            unit_price = float(item.get("unit_price") or 0)
            normalized_items.append({
                "description": str(item.get("description") or "").strip(),
                "quantity": quantity,
                "unit_price": unit_price,
                "total": round(quantity * unit_price, 2),
            })

        subtotal = round(sum(item["total"] for item in normalized_items), 2)
        tax = round(float(invoice_data.get("tax") or 0), 2)
        data = {
            "invoice_no": str(invoice_data.get("invoice_no") or f"INV-{uuid.uuid4().hex[:8].upper()}"),
            "seller_name": str(invoice_data.get("seller_name") or "").strip(),
            "seller_tin": str(invoice_data.get("seller_tin") or "").strip(),
            "customer_name": str(invoice_data.get("customer_name") or "").strip(),
            "customer_tin": str(invoice_data.get("customer_tin") or "").strip(),
            "customer_email": str(invoice_data.get("customer_email") or "").strip(),
            "items": normalized_items,
            "subtotal": subtotal,
            "tax": tax,
            "total_amount": round(subtotal + tax, 2),
            "invoice_date": str(invoice_data.get("invoice_date") or date.today().isoformat()),
            "notes": str(invoice_data.get("notes") or "").strip(),
            "currency": str(invoice_data.get("currency") or "MYR"),
        }
        if not data["customer_name"]:
            raise ValueError("Enter the customer name.")
        if not normalized_items or any(not item["description"] or item["quantity"] <= 0 or item["unit_price"] < 0 for item in normalized_items):
            raise ValueError("Add an item with a description, positive quantity, and non-negative unit price.")

        initial_state = {
            "raw_text": "Typed invoice draft",
            "invoice_data": data,
            "verification_errors": [],
            "is_verified": False,
            "manager_approval": None,
            "rejection_reason": None,
            "generated_pdf_path": None,
            "invoice_source": "typed",
            "user_id": user_id,
        }
        return self._start_review(initial_state)

    def _start_review(self, initial_state: Dict[str, Any], thread_id: str = None):
        thread_id = thread_id or f"session-{uuid.uuid4().hex[:8]}"
        config = {"configurable": {"thread_id": thread_id}}

        # Run until paused at interrupt_before=['store']
        for _ in self.app.stream(initial_state, config=config):
            pass

        snapshot = self.app.get_state(config)
        extracted = snapshot.values.get("invoice_data") or {}
        if not extracted.get("invoice_no"):
            extracted["invoice_no"] = f"INV-{uuid.uuid4().hex[:8].upper()}"
            self.app.update_state(config, {"invoice_data": extracted})
            snapshot = self.app.get_state(config)
        return thread_id, snapshot.values

    def submit_decision(self, thread_id: str, approved: bool, reason: str = "", invoice_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Step 3: Called when user clicks 'Approve' or 'Reject' in the UI.
        Resumes the graph and saves to PDF/DB if approved.
        """
        config = {"configurable": {"thread_id": thread_id}}

        if approved:
            updates = {"manager_approval": True}
            if invoice_data:
                state = self.app.get_state(config).values
                current = state.get("invoice_data") or {}
                merged = {**current, **{
                    key: value for key, value in invoice_data.items()
                    if value is not None and value != ""
                }}
                items = merged.get("items") or []
                normalized_items = []
                for item in items:
                    quantity = float(item.get("quantity") or 0)
                    unit_price = float(item.get("unit_price") or 0)
                    normalized_items.append({
                        **item,
                        "quantity": quantity,
                        "unit_price": unit_price,
                        "total": round(quantity * unit_price, 2),
                    })
                merged["items"] = normalized_items
                merged["subtotal"] = round(sum(item["total"] for item in normalized_items), 2)
                merged["tax"] = round(float(merged.get("tax") or 0), 2)
                merged["total_amount"] = round(merged["subtotal"] + merged["tax"], 2)
                checked = verification_node({**state, "invoice_data": merged})
                updates.update(checked)
            self.app.update_state(config, updates)
            for _ in self.app.stream(None, config=config):
                pass
            saved_state = self.app.get_state(config).values
            return {
                "status": "approved",
                "message": "e-Invoice approved, PDF saved, and logged to database.",
                "file_name": os.path.basename(saved_state.get("generated_pdf_path", "")),
                "invoice_no": (saved_state.get("invoice_data") or {}).get("invoice_no", ""),
                "customer_email": (saved_state.get("invoice_data") or {}).get("customer_email", ""),
            }
        else:
            self.app.update_state(config, {"manager_approval": False, "rejection_reason": reason})
            return {
                "status": "rejected",
                "message": f"e-Invoice rejected. Reason: {reason}"
            }

    
