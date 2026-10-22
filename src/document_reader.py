import base64
from io import BytesIO
import os
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# Load .env from project root
source_env_path = Path(__file__).resolve().parent / ".env"
root_env_path = Path(__file__).resolve().parent.parent / ".env"
if source_env_path.exists():
    load_dotenv(dotenv_path=source_env_path)
elif root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)
else:
    load_dotenv()

def encode_bytes_to_base64(image_bytes: bytes) -> str:
    """Encodes in-memory image bytes to base64."""
    return base64.b64encode(image_bytes).decode("utf-8")

def normalize_image_for_vision(image_bytes: bytes) -> tuple[str, str]:
    """Normalize JPEG variants (EXIF orientation, CMYK, grayscale) for vision APIs."""
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            if source.width > 8192 or source.height > 8192:
                source.thumbnail((8192, 8192), Image.Resampling.LANCZOS)
            image = ImageOps.exif_transpose(source)
            image.load()

            # Vision endpoints are most consistent with ordinary RGB/RGBA images.
            # Preserve transparency on a white canvas before converting to JPEG.
            if image.mode in ("RGBA", "LA") or "transparency" in image.info:
                rgba = image.convert("RGBA")
                background = Image.new("RGBA", rgba.size, "white")
                image = Image.alpha_composite(background, rgba).convert("RGB")
            elif image.mode != "RGB":
                image = image.convert("RGB")

            normalized = BytesIO()
            image.save(normalized, format="JPEG", quality=95, optimize=True)
            return encode_bytes_to_base64(normalized.getvalue()), "image/jpeg"
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as error:
        raise ValueError("This image could not be decoded. Re-save it as a standard JPG or PNG and upload it again.") from error


def describe_image_with_vision(base64_data: str, mime_type: str, vision_llm=None) -> str:
    """Send an image to the configured invoice model for text transcription."""
    if vision_llm is None:
        api_key = os.getenv("APIKEY") or os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("AI_URL") or os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_URL")
        model = os.getenv("BASEMODEL") or os.getenv("OPENAI_MODEL")
        if not api_key or not base_url or not model:
            raise ValueError("Set APIKEY, AI_URL, and BASEMODEL in src/.env to analyze invoice images.")
        vision_llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=0,
            extra_body={"thinking": {"type": "disabled"}} if "deepseek.com" in base_url.lower() else None,
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
    if not isinstance(response.content, str) or not response.content.strip():
        raise ValueError("The vision model returned no readable invoice text. Try a clearer, closer photo.")
    return response.content.strip()

def read_document(file_path: str, vision_llm=None) -> str:
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
                base64_img, mime = normalize_image_for_vision(image_bytes)
                return describe_image_with_vision(base64_img, mime, vision_llm)

        raise ValueError("The PDF contains no digital text and no extractable embedded images.")

    # 3. Direct Image Formats (.png, .jpg, .jpeg, .webp)
    if ext in [".png", ".jpg", ".jpeg", ".webp"]:
        with open(file_path, "rb") as image_file:
            base64_img, mime = normalize_image_for_vision(image_file.read())
        return describe_image_with_vision(base64_img, mime, vision_llm)

    raise ValueError(f"Unsupported file format: {ext}")
