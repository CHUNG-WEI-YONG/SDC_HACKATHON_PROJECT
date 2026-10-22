"""Firestore persistence for Liggy's Python invoice agent.

Uses the same GOOGLE_APPLICATION_CREDENTIALS / Application Default Credentials
configuration as the Express Firebase Admin SDK.
"""

import json
import os
from datetime import datetime, timezone
from urllib.parse import quote

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter


def _db():
    """Return the shared Firestore client, initializing Firebase once per process."""
    if not firebase_admin._apps:
        credential_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if credential_json:
            firebase_admin.initialize_app(credentials.Certificate(json.loads(credential_json)))
        else:
            firebase_admin.initialize_app()
    return firestore.client()


def _user(user_id):
    return _db().collection("users").document(str(user_id))


def _invoice_doc(user_id, invoice_no):
    return _user(user_id).collection("invoices").document(quote(str(invoice_no), safe=""))


def init_db():
    """Verify that Firebase credentials and Firestore configuration are usable."""
    _db()


def create_user(username, email, password_hash):
    db = _db()
    normalized_email = email.strip().lower()
    matches = list(db.collection("users").where(filter=FieldFilter("email", "==", normalized_email)).limit(1).stream())
    if matches:
        raise ValueError("An account with this email already exists.")
    ref = db.collection("users").document()
    user = {
        "id": ref.id,
        "username": username,
        "email": normalized_email,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    ref.set(user)
    return {key: user[key] for key in ("id", "username", "email")}


def get_user_by_email(email):
    matches = _db().collection("users").where(
        filter=FieldFilter("email", "==", email.strip().lower())
    ).limit(1).stream()
    for doc in matches:
        return doc.to_dict()
    return None


def get_user_by_id(user_id):
    doc = _user(user_id).get()
    if not doc.exists:
        return None
    user = doc.to_dict()
    return {key: user[key] for key in ("id", "username", "email") if key in user}


def get_customer_info(name: str, user_id: str):
    if not name or not name.strip():
        return None
    needle = name.strip().casefold()
    for doc in _user(user_id).collection("customers").stream():
        row = doc.to_dict()
        if needle in row.get("customer_name", "").casefold():
            return {key: row.get(key) for key in ("customer_name", "tin_number", "email")}
    return None


def log_invoice_to_db(invoice_data: dict, file_path: str, user_id: str, status: str = "Approved", source: str = "document"):
    customer_name = (invoice_data.get("customer_name") or "Unknown customer").strip()
    customer_ref = _user(user_id).collection("customers").document(quote(customer_name.casefold(), safe=""))
    customer = customer_ref.get().to_dict() or {"customer_name": customer_name}
    # Preserve the original display spelling of an existing customer record.
    customer_name = customer.get("customer_name", customer_name)
    for source_key, target_key in (("customer_tin", "tin_number"), ("customer_registration_no", "registration_no"), ("customer_email", "email")):
        value = invoice_data.get(source_key)
        if value:
            customer[target_key] = value
    customer_ref.set(customer, merge=True)

    invoice_no = str(invoice_data["invoice_no"])
    invoice = {
        "invoice_no": invoice_no,
        "seller_name": invoice_data.get("seller_name", ""),
        "customer_name": customer_name,
        "customer_tin": invoice_data.get("customer_tin", ""),
        "subtotal": invoice_data["subtotal"],
        "tax": invoice_data["tax"],
        "total_amount": invoice_data["total_amount"],
        "file_path": file_path,
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "invoice_date": invoice_data.get("invoice_date") or "",
        "invoice_data": json.dumps(invoice_data),
        "source": source,
        "email_sent": False,
    }
    _invoice_doc(user_id, invoice_no).set(invoice)


def get_invoice_history(user_id: str):
    rows = [doc.to_dict() for doc in _user(user_id).collection("invoices").stream()]
    for item in rows:
        try:
            item["invoice_data"] = json.loads(item.get("invoice_data") or "{}")
        except (TypeError, json.JSONDecodeError):
            item["invoice_data"] = {}
    return sorted(rows, key=lambda item: (item.get("invoice_date") or item.get("created_at") or "", item.get("created_at") or ""), reverse=True)


def get_customers(user_id: str):
    customers = {}
    for doc in _user(user_id).collection("customers").stream():
        row = doc.to_dict()
        name = row.get("customer_name", "")
        customers[name] = {**row, "invoice_count": 0, "last_invoice_at": None, "total_spent_by_currency": {}}
    for invoice in get_invoice_history(user_id):
        name = invoice.get("customer_name") or "Unknown customer"
        data = invoice.get("invoice_data") or {}
        customer = customers.setdefault(name, {
            "customer_name": name,
            "tin_number": invoice.get("customer_tin") or "",
            "registration_no": "",
            "email": data.get("customer_email", ""),
            "invoice_count": 0,
            "last_invoice_at": invoice.get("created_at"),
            "total_spent_by_currency": {},
        })
        customer["invoice_count"] += 1
        if not customer.get("last_invoice_at") or (invoice.get("created_at") or "") > customer["last_invoice_at"]:
            customer["last_invoice_at"] = invoice.get("created_at")
        currency = data.get("currency") or "MYR"
        totals = customer["total_spent_by_currency"]
        totals[currency] = round(totals.get(currency, 0) + float(invoice.get("total_amount") or 0), 2)
    return sorted(customers.values(), key=lambda row: (-sum(row["total_spent_by_currency"].values()), row["customer_name"].lower()))


def get_invoice_by_number(invoice_no: str, user_id: str):
    doc = _invoice_doc(user_id, invoice_no).get()
    if not doc.exists:
        return None
    result = doc.to_dict()
    try:
        result["invoice_data"] = json.loads(result.get("invoice_data") or "{}")
    except (TypeError, json.JSONDecodeError):
        result["invoice_data"] = {}
    return result


def mark_invoice_email_sent(invoice_no: str, user_id: str):
    ref = _invoice_doc(user_id, invoice_no)
    if not ref.get().exists:
        return False
    ref.update({"email_sent": True})
    return True
