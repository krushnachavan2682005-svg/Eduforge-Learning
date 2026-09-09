class OCRImagePreprocessingError(Exception):
    pass


def preprocess_ocr_image(image_path: str) -> str:
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise OCRImagePreprocessingError("Pillow is not installed") from exc

    try:
        with Image.open(image_path) as image:
            grayscale = ImageOps.grayscale(image)
            grayscale.save(image_path)
        return image_path
    except Exception as exc:
        raise OCRImagePreprocessingError("Failed to preprocess OCR image") from exc
