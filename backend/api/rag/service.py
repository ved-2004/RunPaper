"""
RAG Service — orchestration layer for paper chunk retrieval.

Stub: External fetchers (arXiv, Semantic Scholar, Papers With Code) are not yet
implemented. See api/rag/fetchers/ for interfaces.

Public API:
  query_rag(query, top_k)   ← query the vector store
  index_documents(docs)     ← add documents to the vector store
  is_indexing_complete()    ← readiness check
"""
from __future__ import annotations

import logging
from typing import Any

from api.rag.vector_store import VectorStore, COLLECTIONS

logger = logging.getLogger(__name__)

# Module-level singleton vector store
_store: VectorStore | None = None

_indexing_complete = True  # No background indexing yet


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store


def is_indexing_complete() -> bool:
    return _indexing_complete


async def query_rag(
    query: str,
    top_k: int = 5,
) -> dict[str, Any]:
    """
    Query the RAG vector store for context relevant to the given query string.
    Returns a dict with 'documents' and 'total_documents'.
    """
    store = get_vector_store()
    paper_coll = COLLECTIONS.get("papers")
    if paper_coll is None or store.collection_count(paper_coll) == 0:
        return {"documents": [], "total_documents": 0}

    raw = store.query(paper_coll, query_texts=[query], n_results=top_k)
    docs = [
        {
            "doc_id": r["metadata"].get("arxiv_id", "unknown"),
            "text": r["text"],
            "metadata": r["metadata"],
            "relevance_score": r["relevance_score"],
        }
        for r in raw
    ]
    return {"documents": docs, "total_documents": len(docs)}


async def index_documents(docs: list[dict]) -> int:
    """
    Add documents to the papers RAG collection.
    Each doc should have 'text' and 'metadata' keys.
    metadata should conform to PaperChunkMetadata schema.
    """
    store = get_vector_store()
    paper_coll = COLLECTIONS["papers"]
    return store.add_documents(paper_coll, docs)
