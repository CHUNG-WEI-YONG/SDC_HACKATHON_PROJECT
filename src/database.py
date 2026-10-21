import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "sme_records.db"


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with _connect() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        customer_columns = {row[1] for row in conn.execute("PRAGMA table_info(customers)")}
        if not customer_columns:
            conn.execute("""CREATE TABLE customers (
                user_id INTEGER REFERENCES users(id),
                customer_name TEXT NOT NULL,
                tin_number TEXT,
                registration_no TEXT,
                email TEXT,
                PRIMARY KEY(user_id, customer_name)
            )""")
        elif "user_id" not in customer_columns:
            conn.execute("ALTER TABLE customers RENAME TO customers_legacy")
            conn.execute("""CREATE TABLE customers (
                user_id INTEGER REFERENCES users(id), customer_name TEXT NOT NULL,
                tin_number TEXT, registration_no TEXT, email TEXT,
                PRIMARY KEY(user_id, customer_name))""")
            conn.execute("""INSERT INTO customers(user_id, customer_name, tin_number, registration_no, email)
                SELECT NULL, customer_name, tin_number, registration_no, email FROM customers_legacy""")
            conn.execute("DROP TABLE customers_legacy")

        invoice_columns = {row[1] for row in conn.execute("PRAGMA table_info(invoices)")}
        if not invoice_columns:
            conn.execute("""CREATE TABLE invoices (
                user_id INTEGER REFERENCES users(id), invoice_no TEXT NOT NULL,
                customer_name TEXT, customer_tin TEXT, subtotal REAL, tax REAL, total_amount REAL,
                file_path TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                seller_name TEXT, invoice_date TEXT, invoice_data TEXT, source TEXT DEFAULT 'document',
                email_sent INTEGER DEFAULT 0, PRIMARY KEY(user_id, invoice_no))""")
        elif "user_id" not in invoice_columns:
            conn.execute("ALTER TABLE invoices RENAME TO invoices_legacy")
            conn.execute("""CREATE TABLE invoices (
                user_id INTEGER REFERENCES users(id), invoice_no TEXT NOT NULL,
                customer_name TEXT, customer_tin TEXT, subtotal REAL, tax REAL, total_amount REAL,
                file_path TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                seller_name TEXT, invoice_date TEXT, invoice_data TEXT, source TEXT DEFAULT 'document',
                email_sent INTEGER DEFAULT 0, PRIMARY KEY(user_id, invoice_no))""")
            legacy = {row[1] for row in conn.execute("PRAGMA table_info(invoices_legacy)")}
            cols = ["invoice_no", "customer_name", "customer_tin", "subtotal", "tax", "total_amount", "file_path", "status", "created_at", "seller_name", "invoice_date", "invoice_data", "source", "email_sent"]
            select = [col if col in legacy else ("'document'" if col == "source" else "0" if col == "email_sent" else "NULL") for col in cols]
            conn.execute(f"INSERT INTO invoices(user_id, {', '.join(cols)}) SELECT NULL, {', '.join(select)} FROM invoices_legacy")
            conn.execute("DROP TABLE invoices_legacy")


def create_user(username, email, password_hash):
    with _connect() as conn:
        first_user = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
        cursor = conn.execute("INSERT INTO users(username,email,password_hash) VALUES(?,?,?)", (username, email.lower(), password_hash))
        user_id = cursor.lastrowid
        if first_user:
            # The previous app had one shared demo workspace. Give that legacy data
            # to the first account and preserve it as a separate tenant thereafter.
            conn.execute("UPDATE invoices SET user_id=? WHERE user_id IS NULL", (user_id,))
            conn.execute("UPDATE customers SET user_id=? WHERE user_id IS NULL", (user_id,))
        return {"id": user_id, "username": username, "email": email.lower()}


def get_user_by_email(email):
    with _connect() as conn:
        row = conn.execute("SELECT id, username, email, password_hash FROM users WHERE email=? COLLATE NOCASE", (email,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id):
    with _connect() as conn:
        row = conn.execute("SELECT id, username, email FROM users WHERE id=?", (user_id,)).fetchone()
        return dict(row) if row else None


def get_customer_info(name: str, user_id: int):
    if not name or not name.strip():
        return None
    with _connect() as conn:
        row = conn.execute("SELECT customer_name,tin_number,email FROM customers WHERE user_id=? AND LOWER(customer_name) LIKE LOWER(?)", (user_id, f"%{name}%")).fetchone()
        return {"customer_name": row[0], "tin_number": row[1], "email": row[2]} if row else None


def log_invoice_to_db(invoice_data: dict, file_path: str, user_id: int, status: str = "Approved", source: str = "document"):
    with _connect() as conn:
        customer_name = (invoice_data.get("customer_name") or "Unknown customer").strip()
        existing = conn.execute("SELECT customer_name FROM customers WHERE user_id=? AND LOWER(customer_name)=LOWER(?) LIMIT 1", (user_id, customer_name)).fetchone()
        if existing:
            customer_name = existing[0]
        conn.execute("""INSERT INTO customers(user_id,customer_name,tin_number,registration_no,email) VALUES(?,?,?,?,?)
            ON CONFLICT(user_id,customer_name) DO UPDATE SET
            tin_number=CASE WHEN excluded.tin_number!='' THEN excluded.tin_number ELSE customers.tin_number END,
            registration_no=CASE WHEN excluded.registration_no!='' THEN excluded.registration_no ELSE customers.registration_no END,
            email=CASE WHEN excluded.email!='' THEN excluded.email ELSE customers.email END""",
            (user_id, customer_name, invoice_data.get("customer_tin") or "", invoice_data.get("customer_registration_no") or "", invoice_data.get("customer_email") or ""))
        conn.execute("""INSERT INTO invoices(user_id,invoice_no,seller_name,customer_name,customer_tin,subtotal,tax,total_amount,file_path,status,invoice_date,invoice_data,source)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""", (user_id, invoice_data["invoice_no"], invoice_data.get("seller_name", ""), customer_name,
            invoice_data.get("customer_tin", ""), invoice_data["subtotal"], invoice_data["tax"], invoice_data["total_amount"], file_path,
            status, invoice_data.get("invoice_date") or "", json.dumps(invoice_data), source))


def get_invoice_history(user_id: int):
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM invoices WHERE user_id=? ORDER BY CASE WHEN invoice_date IS NULL OR invoice_date='' THEN created_at ELSE invoice_date END DESC, created_at DESC", (user_id,)).fetchall()
    history = []
    for row in rows:
        item = dict(row)
        try:
            item["invoice_data"] = json.loads(item.pop("invoice_data") or "{}")
        except (TypeError, json.JSONDecodeError):
            item["invoice_data"] = {}
        history.append(item)
    return history


def get_customers(user_id: int):
    with _connect() as conn:
        rows = conn.execute("""SELECT c.customer_name,c.tin_number,c.registration_no,c.email,COUNT(i.invoice_no) invoice_count,MAX(i.created_at) last_invoice_at
            FROM customers c LEFT JOIN invoices i ON i.user_id=c.user_id AND i.customer_name=c.customer_name
            WHERE c.user_id=? GROUP BY c.customer_name ORDER BY c.customer_name COLLATE NOCASE""", (user_id,)).fetchall()
    customers = {r["customer_name"]: {**dict(r), "total_spent_by_currency": {}} for r in rows}
    for invoice in get_invoice_history(user_id):
        name = invoice.get("customer_name") or "Unknown customer"
        data = invoice.get("invoice_data") or {}
        customer = customers.setdefault(name, {"customer_name": name, "tin_number": invoice.get("customer_tin") or "", "registration_no": "", "email": data.get("customer_email", ""), "invoice_count": 0, "last_invoice_at": invoice.get("created_at"), "total_spent_by_currency": {}})
        currency = data.get("currency") or "MYR"
        customer["total_spent_by_currency"][currency] = round(customer["total_spent_by_currency"].get(currency, 0) + float(invoice.get("total_amount") or 0), 2)
    return sorted(customers.values(), key=lambda c: (-sum(c["total_spent_by_currency"].values()), c["customer_name"].lower()))


def get_invoice_by_number(invoice_no: str, user_id: int):
    with _connect() as conn:
        row = conn.execute("SELECT * FROM invoices WHERE user_id=? AND invoice_no=?", (user_id, invoice_no)).fetchone()
    if not row:
        return None
    result = dict(row)
    try:
        result["invoice_data"] = json.loads(result.pop("invoice_data") or "{}")
    except (TypeError, json.JSONDecodeError):
        result["invoice_data"] = {}
    return result


def mark_invoice_email_sent(invoice_no: str, user_id: int):
    with _connect() as conn:
        cur = conn.execute("UPDATE invoices SET email_sent=1 WHERE user_id=? AND invoice_no=?", (user_id, invoice_no))
        return cur.rowcount > 0
