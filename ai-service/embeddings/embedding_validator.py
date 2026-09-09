import numpy as np 

embeddings = np.random.rand(384, )

def checking_embedding(embeddings, expected_dim: int):
    if not isinstance(embeddings, np.ndarray):
        embeddings = np.array(embeddings)
    if embeddings.ndim==1:
        embeddings=embeddings.reshape(1,-1)

    if embeddings.size == 0:
        raise ValueError("EMBEDDING_Empty")
    if embeddings.ndim!=expected_dim:
        raise ValueError(f"EMBEDDING_INVALID_SHAPE_RECEIVED,{embeddings.shape}")
    batch_size,embedding_dim= embeddings.shape
    if batch_size==0:
        raise ValueError(f"EMBEDDING_EMPTY_BATCH{batch_size}")
        
    if embedding_dim==0:
        raise ValueError(f"EMBEDDING_EMPTY_DIMENSION")
    if not np.all(np.isfinite(embeddings)):
        raise ValueError("EMBEDDING_CONTAINS_NAN_OR_INF")
    return embeddings.astype(np.float64)
def estimate_embedding_memory(embeddings: np.ndarray) -> int:
    return embeddings.size * embeddings.itemsize


def validate_and_prepare_embeddings(embeddings, expected_dim: int) -> dict:
    safe_embeddings = checking_embedding(embeddings, expected_dim)

    return {
        "embeddings": safe_embeddings,
        "shape": safe_embeddings.shape,
        "dtype": str(safe_embeddings.dtype),
        "memory_bytes": estimate_embedding_memory(safe_embeddings),
        "batch_size": safe_embeddings.shape[0],
        "embedding_dim": safe_embeddings.shape[1],
    }

print(validate_and_prepare_embeddings(embeddings,2))