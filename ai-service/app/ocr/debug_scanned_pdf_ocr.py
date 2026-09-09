"""Isolate each scanned-PDF OCR step without using the normal OCR pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageStat

from app.config.settings import get_settings
from app.database.postgres import get_connection
from app.storage.object_storage import ObjectStorage


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEBUG_DIR = PROJECT_ROOT / "tmp" / "ocr-debug"


def _print_row(row: dict | None) -> None:
    print(dict(row) if row is not None else None)


def _load_document(database_url: str, organization_id: str, document_id: str) -> dict:
    with get_connection(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id AS document_id, organization_id, storage_bucket, storage_key,
                       document_type, processing_stage
                FROM documents
                WHERE id = %s AND organization_id = %s AND deleted_at IS NULL
                """,
                (document_id, organization_id),
            )
            row = cursor.fetchone()
    if row is None:
        raise RuntimeError("Document was not found for the supplied organization_id and document_id")
    return dict(row)


def _load_ocr_pages(database_url: str, organization_id: str, document_id: str) -> list[int]:
    with get_connection(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT page_number
                FROM document_pages
                WHERE organization_id = %s AND document_id = %s AND needs_ocr = true
                ORDER BY page_number
                """,
                (organization_id, document_id),
            )
            return [row["page_number"] for row in cursor.fetchall()]


def _render_page(pdf_path: Path, image_path: Path, page_number: int, scale: float) -> tuple[int, int]:
    page_index = page_number - 1
    with fitz.open(pdf_path) as pdf:
        if page_index < 0 or page_index >= pdf.page_count:
            raise RuntimeError(
                f"Selected page {page_number} is outside the PDF page range 1..{pdf.page_count}"
            )
        pixmap = pdf.load_page(page_index).get_pixmap(
            matrix=fitz.Matrix(scale, scale), alpha=False
        )
        pixmap.save(image_path)
        return pixmap.width, pixmap.height


def _image_diagnostics(image: Image.Image) -> tuple[float, int, int, bool]:
    grayscale = image.convert("L")
    extrema = grayscale.getextrema()
    standard_deviation = float(ImageStat.Stat(grayscale).stddev[0])
    sample_histogram = grayscale.resize((64, 64)).histogram()
    unique_sample_values = sum(1 for count in sample_histogram if count)
    # A near-uniform image cannot contain readable scanned text. The saved PNG is
    # still the authoritative artifact for visual inspection.
    appears_blank = standard_deviation < 2.0 or unique_sample_values < 3
    return standard_deviation, extrema[0], extrema[1], appears_blank


def _persist(
    database_url: str,
    organization_id: str,
    document_id: str,
    page_number: int,
    text: str,
) -> tuple[int, int]:
    with get_connection(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO document_page_texts (
                    organization_id, document_id, page_number, text, text_length,
                    extraction_method, source, ocr_engine, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, 'tesseract_ocr', 'OCR', 'tesseract', NOW())
                ON CONFLICT (document_id, page_number)
                DO UPDATE SET
                    organization_id = EXCLUDED.organization_id,
                    text = EXCLUDED.text,
                    text_length = EXCLUDED.text_length,
                    extraction_method = EXCLUDED.extraction_method,
                    source = EXCLUDED.source,
                    ocr_engine = EXCLUDED.ocr_engine,
                    updated_at = NOW()
                """,
                (organization_id, document_id, page_number, text, len(text)),
            )
            text_rows_affected = cursor.rowcount
            cursor.execute(
                """
                UPDATE document_pages
                SET ocr_status = 'COMPLETED', needs_ocr = false, has_text = true,
                    text_length = %s, updated_at = NOW()
                WHERE organization_id = %s AND document_id = %s AND page_number = %s
                """,
                (len(text), organization_id, document_id, page_number),
            )
            page_rows_affected = cursor.rowcount
            if page_rows_affected != 1:
                raise RuntimeError(
                    f"Expected one document_pages row to update; updated {page_rows_affected}"
                )
    return text_rows_affected, page_rows_affected


def _verify(database_url: str, organization_id: str, document_id: str) -> tuple[list[dict], list[dict]]:
    with get_connection(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT document_id, page_number, source, extraction_method, ocr_engine,
                       text_length, LEFT(text, 300) AS preview
                FROM document_page_texts
                WHERE organization_id = %s AND document_id = %s
                ORDER BY page_number
                """,
                (organization_id, document_id),
            )
            texts = [dict(row) for row in cursor.fetchall()]
            cursor.execute(
                """
                SELECT document_id, page_number, needs_ocr, has_text, text_length, ocr_status
                FROM document_pages
                WHERE organization_id = %s AND document_id = %s
                ORDER BY page_number
                """,
                (organization_id, document_id),
            )
            pages = [dict(row) for row in cursor.fetchall()]
    return texts, pages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--document-id", required=True)
    parser.add_argument("--page-number", required=True, type=int)
    args = parser.parse_args()

    settings = get_settings()
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    print("\nSTEP 1: Load document from DB")
    document = _load_document(settings.database_url, args.organization_id, args.document_id)
    for key in (
        "document_id", "organization_id", "storage_bucket", "storage_key",
        "document_type", "processing_stage",
    ):
        print(f"{key}={document[key]}")

    print("\nSTEP 2: Query OCR-required pages from DB")
    ocr_pages = _load_ocr_pages(settings.database_url, args.organization_id, args.document_id)
    print(f"needs_ocr_pages={ocr_pages}")
    print(f"selected_page_number={args.page_number}")
    if not ocr_pages:
        print("ROOT_CAUSE = OCR_REQUIRED_PAGE_QUERY_BUG")
        return 2
    if args.page_number not in ocr_pages:
        print("Selected page is not marked needs_ocr=true; no DB changes were made.")
        return 2

    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    temp_pdf_path = DEBUG_DIR / f"debug_{args.document_id}.pdf"
    image_path = DEBUG_DIR / f"debug_{args.document_id}_page_{args.page_number}.png"

    print("\nSTEP 3: Download PDF from Supabase")
    pdf_bytes = ObjectStorage(settings).download_pdf(
        document["storage_bucket"], document["storage_key"]
    )
    temp_pdf_path.write_bytes(pdf_bytes)
    print(f"downloaded_bytes_size={len(pdf_bytes)}")
    print(f"temp_pdf_path={temp_pdf_path}")
    print(f"temp_pdf_exists={temp_pdf_path.exists()}")

    print("\nSTEP 4: Render selected page using PyMuPDF")
    width, height = _render_page(
        temp_pdf_path, image_path, args.page_number, settings.ocr_render_scale
    )
    print(f"page_number={args.page_number}")
    print(f"page_index={args.page_number - 1}")
    print(f"rendered_image_path={image_path}")
    print(f"rendered_image_exists={image_path.exists()}")
    print(f"image_width={width}")
    print(f"image_height={height}")
    print(f"image_file_size={image_path.stat().st_size}")

    print("\nSTEP 5: Run Tesseract directly on saved rendered image")
    with Image.open(image_path) as image:
        stddev, minimum, maximum, appears_blank = _image_diagnostics(image)
        print(f"image_grayscale_stddev={stddev:.2f}")
        print(f"image_grayscale_range={minimum}..{maximum}")
        print(f"image_appears_blank={appears_blank}")
        ocr_text = ""
        worked_psm: int | None = None
        for psm in (6, 3, 11):
            print(f"psm_attempted={psm}")
            candidate = pytesseract.image_to_string(image, lang="eng", config=f"--psm {psm}")
            candidate = candidate.strip()
            print(f"raw_ocr_text_length={len(candidate)}")
            print(f"ocr_text_preview={candidate[:500]!r}")
            if candidate:
                ocr_text = candidate
                worked_psm = psm
                break
        print(f"which_psm_worked={worked_psm}")

    if not ocr_text:
        if appears_blank:
            print("ROOT_CAUSE = BAD_PDF_RENDER_OR_WRONG_PAGE")
        else:
            print("ROOT_CAUSE = TESSERACT_OCR_EMPTY_OUTPUT")
        return 3

    print("\nSTEP 6: Manually upsert document_page_texts")
    print("insert_update_attempted=true")
    print("source=OCR")
    print("extraction_method=tesseract_ocr")
    print("ocr_engine=tesseract")
    try:
        text_rows, page_rows = _persist(
            settings.database_url,
            args.organization_id,
            args.document_id,
            args.page_number,
            ocr_text,
        )
    except Exception as exc:
        print("rows_affected=0")
        print(f"persistence_error={type(exc).__name__}: {exc}")
        print("ROOT_CAUSE = OCR_PERSISTENCE_FAILED")
        return 4
    print(f"rows_affected={text_rows}")

    print("\nSTEP 7: Update document_pages")
    print("ocr_status=COMPLETED")
    print(f"needs_ocr_updated={page_rows == 1}")
    print(f"text_length_updated={len(ocr_text)}")

    print("\nSTEP 8: Final DB verification")
    text_rows_result, page_rows_result = _verify(
        settings.database_url, args.organization_id, args.document_id
    )
    print("document_page_texts:")
    for row in text_rows_result:
        _print_row(row)
    print("document_pages:")
    for row in page_rows_result:
        _print_row(row)

    saved = any(
        row["page_number"] == args.page_number
        and row["source"] == "OCR"
        and row["text_length"] == len(ocr_text)
        for row in text_rows_result
    )
    if not saved:
        print("ROOT_CAUSE = OCR_PERSISTENCE_FAILED")
        return 4

    print("ROOT_CAUSE = AGENT_PIPELINE_TRIGGER_BUG")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"FATAL_ERROR={type(error).__name__}: {error}", file=sys.stderr)
        raise
