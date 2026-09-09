import os
import tempfile
from pathlib import Path


class EmbeddedImagePreprocessingError(Exception):
    pass


class ImagePreprocessor:
    TARGET_MIN_WIDTH = 1200
    PADDING = 12

    def __init__(self, temp_dir: str) -> None:
        self.temp_dir = temp_dir

    def preprocess(self, image_path: str) -> str:
        try:
            from PIL import Image, ImageOps
        except ImportError as exc:
            raise EmbeddedImagePreprocessingError("Pillow is not installed") from exc
        Path(self.temp_dir).mkdir(parents=True, exist_ok=True)
        fd, output_path = tempfile.mkstemp(
            suffix=".png", prefix="embedded-image-preprocessed-", dir=self.temp_dir,
        )
        os.close(fd)
        try:
            with Image.open(image_path) as source:
                image = ImageOps.exif_transpose(source)
                if image.mode in {"RGBA", "LA"}:
                    background = Image.new("RGBA", image.size, "white")
                    background.alpha_composite(image.convert("RGBA"))
                    image = background.convert("RGB")
                elif image.mode != "RGB":
                    image = image.convert("RGB")
                grayscale = ImageOps.grayscale(image)
                if grayscale.width < self.TARGET_MIN_WIDTH:
                    scale = min(3.0, self.TARGET_MIN_WIDTH / max(1, grayscale.width))
                    grayscale = grayscale.resize(
                        (round(grayscale.width * scale), round(grayscale.height * scale)),
                        Image.Resampling.LANCZOS,
                    )
                grayscale = ImageOps.autocontrast(grayscale, cutoff=1)
                grayscale = ImageOps.expand(grayscale, border=self.PADDING, fill="white")
                grayscale.save(output_path, format="PNG")
            return output_path
        except Exception as exc:
            try:
                os.remove(output_path)
            except OSError:
                pass
            raise EmbeddedImagePreprocessingError("Failed to preprocess embedded image") from exc
