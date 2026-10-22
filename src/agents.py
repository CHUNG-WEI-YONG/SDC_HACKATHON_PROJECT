from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from .schema import EInvoiceData, AgentState
from .database import get_customer_info, log_invoice_to_db
from .pdf_generators import generate_invoice_pdf
def create_extraction_node(llm):

    structured_llm = llm.with_structured_output(EInvoiceData, method="function_calling")
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an automated invoice parsing agent. Carefully read the document text "
                   "and extract seller and customer details, invoice date and number, line item descriptions, "
                   "quantities, unit prices, taxes, notes, currency, and totals accurately. Do not invent values."),
        ("user", "Document to parse in:\n{text}")
    ])
    chain = prompt | structured_llm

    def extraction_node(state: AgentState):
        extracted: EInvoiceData = chain.invoke({"text": state["raw_text"]})
        return {
            "invoice_data": extracted.model_dump(),
            "verification_errors": []
        }
    return extraction_node



def verification_node(state: AgentState):
    data = state.get("invoice_data") or {}
    errors = []

    # 1. Math verification
    calculated_subtotal = 0.0
    for item in data.get("items", []):
        qty = float(item.get("quantity") or 1.0)
        price = float(item.get("unit_price") or 0.0)
        tot = item.get("total")
        if tot is None:
            tot = qty * price
            item["total"] = tot
        calculated_subtotal += float(tot)

    if data.get("subtotal") is None:
        data["subtotal"] = round(calculated_subtotal, 2)
    stated_subtotal = float(data.get("subtotal") or 0.0)
    if round(calculated_subtotal, 2) != round(stated_subtotal, 2):
        errors.append(f"Value ERROR: Line items sum to RM {calculated_subtotal:.2f}, but document states RM {stated_subtotal:.2f}.")

    subtotal = float(data.get("subtotal") or 0.0)
    tax = float(data.get("tax") or 0.0)
    expected_total = subtotal + tax
    stated_total = float(data.get("total_amount") or 0.0)
    if round(expected_total, 2) != round(stated_total, 2):
        errors.append(f"Tax ERROR: Subtotal + Tax is RM {expected_total:.2f}, but document states RM {stated_total:.2f}.")

    # 2. Database CRM match
    customer_name = data.get("customer_name", "")
    info_record = get_customer_info(customer_name, state.get("user_id")) if state.get("user_id") else None
    if info_record:
        if not data.get("customer_tin"):
            data["customer_tin"] = info_record.get("tin_number", "")
        if not data.get("customer_email"):
            data["customer_email"] = info_record.get("email", "")
    else:
        errors.append(f"Customer '{customer_name}' was not found in registered database.")

    data["subtotal"] = round(float(data.get("subtotal") or 0), 2)
    data["tax"] = round(float(data.get("tax") or 0), 2)
    data["total_amount"] = round(float(data.get("total_amount") or 0), 2)

    return {
        "invoice_data": data,
        "verification_errors": errors,
        "is_verified": len(errors) == 0
    }

def store_node(state: AgentState):
    data = state["invoice_data"]
    pdf_path = generate_invoice_pdf(data)
    log_invoice_to_db(data, pdf_path, state["user_id"], source=state.get("invoice_source") or "document")
    return {**state, "generated_pdf_path": pdf_path}





    
