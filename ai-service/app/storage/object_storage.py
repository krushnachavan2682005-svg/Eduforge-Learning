from supabase import create_client

from app.config.settings import Settings


class StorageObjectNotFoundError(Exception):
    pass


class PdfDownloadFailedError(Exception):
    pass


class ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        self.client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    def download_pdf(self, storage_bucket: str, storage_key: str) -> bytes:
        try:
            data = self.client.storage.from_(storage_bucket).download(storage_key)
        except Exception as exc:
            message = str(exc)
            if "not found" in message.lower() or "404" in message:
                raise StorageObjectNotFoundError(message) from exc
            raise PdfDownloadFailedError(message) from exc

        if not data:
            raise StorageObjectNotFoundError("Storage object was empty or missing")

        if isinstance(data, bytes):
            return data

        return bytes(data)
