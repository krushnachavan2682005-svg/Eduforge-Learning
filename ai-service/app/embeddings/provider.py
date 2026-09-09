from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    @property
    @abstractmethod
    def model_name(self) -> str: ...

    @property
    @abstractmethod
    def model_version(self) -> str: ...

    @property
    @abstractmethod
    def embedding_dimension(self) -> int: ...

    @property
    @abstractmethod
    def configuration_fingerprint(self) -> str: ...

    @property
    @abstractmethod
    def normalize_embeddings(self) -> bool: ...

    @abstractmethod
    def load_model(self) -> None: ...

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    @abstractmethod
    def embed_query(self, text: str) -> list[float]: ...
