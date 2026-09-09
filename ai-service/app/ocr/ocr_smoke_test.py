from pathlib import Path
from tempfile import NamedTemporaryFile

from app.config.settings import get_settings
from app.ocr.tesseract_engine import run_tesseract_ocr


def main() -> None:
    from PIL import Image, ImageDraw, ImageFont

    settings = get_settings()
    expected = "OCR TEST 123"

    with NamedTemporaryFile(delete=False, suffix=".png", dir=settings.ai_service_temp_dir) as temp_file:
        image_path = temp_file.name

    image = Image.new("RGB", (1100, 300), "white")
    draw = ImageDraw.Draw(image)
    font = _load_font(size=72)
    draw.text((80, 95), expected, fill="black", font=font)
    image.save(image_path)

    try:
        result = run_tesseract_ocr(image_path, settings)
        print(f"Extracted text: {result['text']}")
        normalized_text = result["text"].upper().replace(" ", "")
        if "TEST" not in normalized_text or "123" not in normalized_text:
            raise SystemExit("OCR smoke test failed: expected words not found")
        print("OCR smoke test passed")
        print("Extracted text contains expected words")
    finally:
        Path(image_path).unlink(missing_ok=True)


def _load_font(size: int):
    from pathlib import Path
    from PIL import ImageFont

    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/calibri.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


if __name__ == "__main__":
    main()
