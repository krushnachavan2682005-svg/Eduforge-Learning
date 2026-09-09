def is_scanned_pdf(page_count: int, text_length: int) -> bool:
    if page_count <= 0:
        return False
    return text_length < 50
