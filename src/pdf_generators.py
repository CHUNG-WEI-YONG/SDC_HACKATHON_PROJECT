import os
import re
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors


INVOICE_OUTPUT_DIR = "generated_invoices"

def sanitize_filename(name:str):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', str(name).strip())

def generate_invoice_pdf(invoice_data:dict)->str:
    os.makedirs(INVOICE_OUTPUT_DIR,exist_ok=True)

    name=sanitize_filename(invoice_data.get("customer_name","UNKNOWN"))
    inv_no = sanitize_filename(invoice_data.get("invoice_no", "DRAFT"))
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"INV_{inv_no}_{name}_{timestamp}.pdf"
    file_path = os.path.join(INVOICE_OUTPUT_DIR, filename)

    doc=SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )

    style=getSampleStyleSheet()
    story=[]

    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=style['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#1E3A8A'),
        spaceAfter=10
    )
    story.append(Paragraph(f"TAX E-INVOICE: #{invoice_data.get('invoice_no')}", title_style))
    story.append(Spacer(1, 10))

    meta_info = [
        [
            Paragraph(f"<b>Billed To:</b><br/>{invoice_data.get('customer_name')}<br/>"
                      f"TIN: {invoice_data.get('customer_tin') or 'N/A'}<br/>"
                      f"Email: {invoice_data.get('customer_email') or 'N/A'}", style['Normal']),
            Paragraph(f"<b>Date:</b> {datetime.now().strftime('%Y-%m-%d')}<br/>"
                      f"<b>Status:</b> Validated & Approved<br/>"
                      f"<b>Standard:</b> SME Digital e-Invoice", style['Normal'])
        ]
    ]
    meta_table = Table(meta_info, colWidths=[270, 260])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))

    table_data = [["Item Description", "Qty", "Unit Price ($)", "Total ($)"]]
    for item in invoice_data.get("items", []):
        table_data.append([
            item.get("description", ""),
            str(item.get("quantity", 1)),
            f"{float(item.get('unit_price', 0)):.2f}",
            f"{float(item.get('total', 0)):.2f}"
        ])


    table_data.append(["", "", "Subtotal:", f"${float(invoice_data.get('subtotal', 0)):.2f}"])
    table_data.append(["", "", "Tax:", f"${float(invoice_data.get('tax', 0)):.2f}"])
    table_data.append(["", "", "Total Amount:", f"${float(invoice_data.get('total_amount', 0)):.2f}"])

    item_table = Table(table_data, colWidths=[280, 50, 100, 100])
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1F2937')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -4), 0.5, colors.HexColor('#E5E7EB')),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (2, -3), (-1, -1), 'Helvetica-Bold'),
    ]))
    story.append(item_table)

    # Compile PDF
    doc.build(story)
    return file_path


if __name__ == "__main__":
    # Test script standalone
    sample_data = {
        "invoice_no": "TEST-001",
        "customer_name": "Acme Corp",
        "customer_tin": "C2589102400",
        "customer_email": "billing@acme.com",
        "items": [{"description": "Setup Fee", "quantity": 1, "unit_price": 500.0, "total": 500.0}],
        "subtotal": 500.0,
        "tax": 30.0,
        "total_amount": 530.0
    }
    saved_path = generate_invoice_pdf(sample_data)
    print(f"Sample PDF created successfully at: {saved_path}")

    

