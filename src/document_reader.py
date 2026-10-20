import base64
import os
from pathlib import Path
from dotenv import load_dotenv
from pypdf import PdfReader
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# Load .env from project root
root_env_path = Path(__file__).resolve().parent.parent / ".env"
if root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)
else:
    load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")
URL = os.getenv("OPENAI_URL", "https://api.deepseek.com")
MODEL = os.getenv("OPENAI_MODEL", "deepseek-flash")

def encode_bytes_to_base64(image_bytes: bytes) -> str:
    """Encodes in-memory image bytes to base64."""
    return base64.b64encode(image_bytes).decode("utf-8")

def encode_file_to_base64(file_path: str) -> str:
    """Encodes a file on disk to base64."""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def describe_image_with_vision(base64_data: str, mime_type: str = "image/jpeg") -> str:
    """Sends base64 image data to DeepSeek's vision model."""
    vision_llm = ChatOpenAI(
        model=MODEL,
        api_key=API_KEY,
        base_url=URL,
        temperature=0
    )

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": (
                    "Transcribe all visible text from this invoice/receipt accurately. "
                    "Include all line items, quantities, unit prices, subtotal, taxes, "
                    "total amount, company name, invoice number, and dates verbatim."
                )
            },
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type};base64,{base64_data}"}
            }
        ]
    )
    response = vision_llm.invoke([message])
    return response.content

def read_document(file_path: str) -> str:
    """
    Reads PDFs (both digital and scanned images) as well as raw image files.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    # 1. Plain text formats
    if ext in [".txt", ".json", ".csv"]:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    # 2. PDF Handling (Checks for text, falls back to embedded image extraction)
    if ext == ".pdf":
        reader = PdfReader(file_path)
        extracted_text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                extracted_text += t + "\n"

        # If it has selectable text, return it directly
        if len(extracted_text.strip()) > 30:
            return extracted_text.strip()

        print("[!] No text layer found in PDF. Extracting embedded image for Vision OCR...")

        # Extract embedded image from the first page
        for page in reader.pages:
            if page.images:
                first_image = page.images[0]
                image_bytes = first_image.data
                base64_img = encode_bytes_to_base64(image_bytes)
                
                # Determine mime type from image file extension
                img_name = first_image.name.lower()
                mime = "image/png" if img_name.endswith(".png") else "image/jpeg"
                return describe_image_with_vision(base64_img, mime)

        raise ValueError("The PDF contains no digital text and no extractable embedded images.")

    # 3. Direct Image Formats (.png, .jpg, .jpeg, .webp)
    if ext in [".png", ".jpg", ".jpeg", ".webp"]:
        base64_img = encode_file_to_base64(file_path)
        mime = "image/png" if ext == ".png" else "image/jpeg"
        return describe_image_with_vision(base64_img, mime)

    raise ValueError(f"Unsupported file format: {ext}")