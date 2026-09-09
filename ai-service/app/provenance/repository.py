from typing import Any

from app.database.postgres import get_connection
from app.database.repositories import RepositoryError


class ProvenanceRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def load(self, *, organization_id: str, document_id: str) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT id,page_count,processing_stage,storage_bucket,storage_key FROM documents WHERE organization_id=%s AND id=%s AND deleted_at IS NULL", (organization_id, document_id))
                document = cursor.fetchone()
                if not document:
                    raise RepositoryError("DOCUMENT_NOT_FOUND", "Document not found for organization", False)
                cursor.execute("""
                    SELECT it.*, i.id AS parent_id, i.organization_id AS parent_organization_id,
                           i.document_id AS parent_document_id, i.page_number AS parent_page_number,
                           i.image_metadata AS parent_metadata
                    FROM document_image_texts it
                    LEFT JOIN document_images i ON i.id=it.image_id
                    WHERE it.organization_id=%s AND it.document_id=%s
                    ORDER BY it.page_number,it.image_id
                """, (organization_id, document_id)); image_texts=[dict(x) for x in cursor.fetchall()]
                cursor.execute("SELECT * FROM document_images WHERE organization_id=%s AND document_id=%s ORDER BY page_number,image_index", (organization_id, document_id)); images=[dict(x) for x in cursor.fetchall()]
                cursor.execute("""
                    SELECT id,page_number,block_order,block_type,source_type,image_id,image_text_id,metadata
                    FROM document_content_blocks WHERE organization_id=%s AND document_id=%s
                    ORDER BY page_number,block_order
                """, (organization_id, document_id)); blocks=[dict(x) for x in cursor.fetchall()]
                cursor.execute("SELECT chunk_index,source_pages,source_block_ids,metadata FROM document_chunks WHERE organization_id=%s AND document_id=%s ORDER BY chunk_index", (organization_id, document_id)); chunks=[dict(x) for x in cursor.fetchall()]
        return {"document":dict(document),"images":images,"image_texts":image_texts,"blocks":blocks,"chunks":chunks}

    def latest_job_payload(self, *, organization_id: str, document_id: str) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT d.id AS document_id,d.organization_id,d.owner_user_id,d.storage_bucket,d.storage_key,
                           d.mime_type,d.file_size_bytes,j.id AS job_id,j.job_type
                    FROM documents d JOIN LATERAL (
                      SELECT * FROM processing_jobs WHERE organization_id=d.organization_id AND document_id=d.id
                      ORDER BY created_at DESC LIMIT 1
                    ) j ON true
                    WHERE d.organization_id=%s AND d.id=%s AND d.deleted_at IS NULL
                """,(organization_id,document_id)); row=cursor.fetchone()
                if not row: raise RepositoryError("DOCUMENT_NOT_FOUND","Document or job not found",False)
                payload=dict(row); payload["processing_type"]=payload.pop("job_type")
                for key in ("document_id", "organization_id", "owner_user_id", "job_id"):
                    if payload.get(key) is not None:
                        payload[key] = str(payload[key])
                return payload
