from typing import Any

from app.content_layout.repository import ContentBlockRepository


class OrderedPageContentService:
    """Read the canonical ordered stream without coupling consumers to SQL."""

    def __init__(self, repository: ContentBlockRepository) -> None:
        self.repository = repository

    def get_page(self, *, organization_id: str, document_id: str, page_number: int) -> list[dict[str, Any]]:
        return self.repository.fetch_ordered(
            organization_id=organization_id, document_id=document_id, page_number=page_number,
        )

    def get_document(self, *, organization_id: str, document_id: str) -> list[dict[str, Any]]:
        return self.repository.fetch_ordered(organization_id=organization_id, document_id=document_id)
