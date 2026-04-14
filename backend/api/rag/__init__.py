"""
RunPaper RAG Layer
Retrieval-augmented generation over paper chunks (arXiv, Semantic Scholar, Papers With Code).
"""
from .service import query_rag, index_documents, get_vector_store

__all__ = ["query_rag", "index_documents", "get_vector_store"]
