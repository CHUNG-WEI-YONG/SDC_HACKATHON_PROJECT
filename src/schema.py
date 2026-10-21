from typing import List ,Optional,TypedDict
from pydantic import BaseModel , Field

class LineItem(BaseModel):
    description:str=Field(default="", description="Name or description of the product or service")
    quantity: float = Field(default=1, description="Quantity billed")
    unit_price: float = Field(default=0, description="Price per unit before tax")
    total: Optional[float] = Field(default=None, description="Line total before tax")


class EInvoiceData(BaseModel):
    invoice_no: str = Field(default="", description="Invoice or receipt reference number")
    seller_name: Optional[str] = Field(default="", description="Name of the seller or issuing business")
    seller_tin: Optional[str] = Field(default="", description="Seller tax identification number if provided")
    customer_name: str = Field(default="", description="Name of the buyer or client company")
    customer_tin: Optional[str] = Field(default="", description="Tax Identification Number (TIN/BRN) if present")
    customer_email: Optional[str] = Field(default="", description="Billing email address if present")
    items: List[LineItem] = Field(default_factory=list, description="List of invoiced items")
    subtotal: float = Field(default=0.0, description="Calculated sum of all line item totals before tax")
    tax: float = Field(default=0.0, description="Tax amount (e.g. 6% or 8% SST / VAT)")
    total_amount: float = Field(default=0.0, description="Final total = subtotal + tax")
    invoice_date: Optional[str] = Field(default="", description="Invoice date in YYYY-MM-DD format when present")
    notes: Optional[str] = Field(default="", description="Any additional terms or payment notes")
    currency: Optional[str] = Field(default="MYR", description="Invoice currency code")



class AgentState(TypedDict):
    raw_text: str                          
    invoice_data: Optional[dict]           
    verification_errors: List[str]         
    is_verified: bool                      
    manager_approval: Optional[bool]       
    rejection_reason: Optional[str]
    generated_pdf_path: Optional[str]
    invoice_source: Optional[str]
    user_id: int
