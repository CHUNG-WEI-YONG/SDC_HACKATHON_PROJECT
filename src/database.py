import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "sme_records.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()  # Fixed: call conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            customer_name TEXT PRIMARY KEY,
            tin_number TEXT,
            registration_no TEXT,
            email TEXT
        )
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO customers (customer_name, tin_number, registration_no, email)
        VALUES 
            ('Acme Corp', 'C2589102400', '202101002233', 'billing@acme.com'),
            ('Beta Tech Sdn Bhd', 'C1198273640', '202302009988', 'finance@betatech.my')
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            invoice_no TEXT PRIMARY KEY,
            customer_name TEXT,
            customer_tin TEXT,
            subtotal REAL,
            tax REAL,
            total_amount REAL,
            file_path TEXT,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()

def get_customer_info(name: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT customer_name, tin_number, email FROM customers WHERE LOWER(customer_name) LIKE LOWER(?)", 
        (f"%{name}%",)
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"customer_name": row[0], "tin_number": row[1], "email": row[2]}
    return None

def log_invoice_to_db(invoice_data: dict, file_path: str, status: str = "Approved"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Fixed: added space in INSERT INTO and use OR REPLACE to prevent duplicate key crashes
    cursor.execute("""
        INSERT OR REPLACE INTO invoices (invoice_no, customer_name, customer_tin, subtotal, tax, total_amount, file_path, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        invoice_data["invoice_no"],
        invoice_data["customer_name"],
        invoice_data["customer_tin"],
        invoice_data["subtotal"],
        invoice_data["tax"],
        invoice_data["total_amount"],
        file_path,
        status
    ))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    # Test run: will create sme_records.db in your current folder immediately
    init_db()
    print("Database and tables initialized successfully!")
