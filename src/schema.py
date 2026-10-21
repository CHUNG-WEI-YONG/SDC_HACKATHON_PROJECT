from typing import List ,Optional,TypedDict
from pydantic import BaseModel , Field

class LineItem(BaseModel):
    description:str=Field(description="Name or description of the product or service")
    quantity: float = Field(default=1, description="Quantity billed")
    unit_price: float = Field(default=0, description="Price per unit before tax")
    total: Optional[float] = Field(default=None, description="Line total before tax")


class EInvoiceData(BaseModel):
    invoice_no: str = Field(description="Invoice or receipt reference number")
    customer_name: str = Field(description="Name of the buyer or client company")
    customer_tin: Optional[str] = Field(default="", description="Tax Identification Number (TIN/BRN) if present")
    customer_email: Optional[str] = Field(default="", description="Billing email address if present")
    items: List[LineItem] = Field(default_factory=list, description="List of invoiced items")
    subtotal: float = Field(description="Calculated sum of all line item totals before tax")
    tax: float = Field(default=0.0, description="Tax amount (e.g. 6% or 8% SST / VAT)")
    total_amount: float = Field(description="Final total = subtotal + tax")
    notes: Optional[str] = Field(default="", description="Any additional terms or payment notes")



class AgentState(TypedDict):
    raw_text: str                          
    invoice_data: Optional[dict]           
    verification_errors: List[str]         
    is_verified: bool                      
    manager_approval: Optional[bool]       
    rejection_reason: Optional[str]
    generated_pdf_path: Optional[str]
