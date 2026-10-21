import os
import uuid
from pathlib import Path
from typing import Dict, Any, Tuple
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

from .database import init_db
from .workflow import build_workflow
from .document_reader import read_document

load_dotenv(Path(__file__).resolve().parent / ".env")

class InvoicePipelineService:
    def __init__(self, api_key: str, base_url: str = "https://api.deepseek.com", model: str = "deepseek-flash"):

        if not api_key:
            raise ValueError("API key must be provided.")

        self.api_key = api_key
        self.base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_URL") or base_url
        self.model = model

        # Ensure SQLite tables exist
        init_db()

        # Build dynamic LLM instance
        self.llm = ChatOpenAI(
            model=self.model,
            api_key=self.api_key,
            base_url=self.base_url,
            temperature=0
        )

        # Compile the graph
        self.app = build_workflow(self.llm)

    def process_invoice(self, file_path: str) -> Tuple[str, Dict[str, Any]]:
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

        raw_document_text = read_document(file_path)

        initial_state = {
            "raw_text": raw_document_text,
            "invoice_data": None,
            "verification_errors": [],
            "is_verified": False,
            "manager_approval": None,
            "rejection_reason": None,
            "generated_pdf_path": None
        }

        # Run until paused at interrupt_before=['store']
        for _ in self.app.stream(initial_state, config=config):
            pass

        snapshot = self.app.get_state(config)
        return thread_id, snapshot.values

    def submit_decision(self, thread_id: str, approved: bool, reason: str = "") -> Dict[str, Any]:
        """
        Step 3: Called when user clicks 'Approve' or 'Reject' in the UI.
        Resumes the graph and saves to PDF/DB if approved.
        """
        config = {"configurable": {"thread_id": thread_id}}

        if approved:
            self.app.update_state(config, {"manager_approval": True})
            for _ in self.app.stream(None, config=config):
                pass
            saved_state = self.app.get_state(config).values
            return {
                "status": "approved",
                "message": "e-Invoice approved, PDF saved, and logged to database.",
                "file_name": os.path.basename(saved_state.get("generated_pdf_path", "")),
            }
        else:
            self.app.update_state(config, {"manager_approval": False, "rejection_reason": reason})
            return {
                "status": "rejected",
                "message": f"e-Invoice rejected. Reason: {reason}"
            }

    
