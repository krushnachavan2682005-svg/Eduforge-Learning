from app.config.settings import Settings
from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.pipeline import DocumentEmbeddingPipeline
from app.embeddings.preflight import EmbeddingEnvironmentPreflightService
from app.embeddings.repository import PgVectorEmbeddingRepository
from app.embeddings.sentence_transformer_provider import SentenceTransformerEmbeddingProvider


def build_embedding_components(settings: Settings):
    configuration = EmbeddingConfiguration.from_settings(settings)
    if configuration.provider != "sentence_transformers":
        raise ValueError(f"Unsupported embedding provider: {configuration.provider}")
    repository = PgVectorEmbeddingRepository(settings.database_url)
    provider = SentenceTransformerEmbeddingProvider(configuration)
    preflight = EmbeddingEnvironmentPreflightService(
        repository, provider, dimension=configuration.dimension, normalized=configuration.normalize,
    )
    pipeline = DocumentEmbeddingPipeline(
        repository=repository, provider=provider, preflight=preflight,
        configuration=configuration, batch_size=settings.embedding_batch_size,
        max_batch_tokens=settings.embedding_max_batch_tokens,
        max_retries=settings.embedding_max_retries,
        processing_timeout_seconds=settings.embedding_processing_timeout_seconds,
    )
    return configuration, repository, provider, preflight, pipeline
