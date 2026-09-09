import numpy as np
embedding=np.random.randn(34,364)
query=np.random.rand(22,364)
def cosine_similarity_check(embedding,query):
    embedding_length=np.linalg.norm(embedding,axis=1,keepdims=True)
    query_length=np.linalg.norm(query,axis=1,keepdims=True)
    if np.any(embedding_length == 0):
        raise ValueError("Embedding contains zero vector")

    if np.any(query_length == 0):
        raise ValueError("Query contains zero vector")
    embedding_norm=embedding/embedding_length
    query_norm=query/query_length
    similarity_score=embedding_norm @ query_norm.T
    sorted_score=np.argsort(similarity_score,axis=0)[::-1]
    top_K_indices=sorted_score[0:5]
    top_k_scores=np.take_along_axis(similarity_score,top_K_indices,axis=0)
    return{"top_K_indices":top_K_indices.ravel(),"top_k_scores":top_k_scores}
print(cosine_similarity_check(embedding,query))
