"""
FastAPI router — RAG endpoints

POST /api/rag/query   — Query paper chunks vector store
GET  /api/rag/status  — Collection document counts
DELETE /api/rag/index — Clear all collections
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.rag.service import query_rag, get_vector_store
from api.rag.vector_store import COLLECTIONS

router = APIRouter(prefix="/api/rag", tags=["rag"])


class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("/query", summary="Query paper chunks for related content")
async def rag_query(request: RAGQueryRequest) -> dict[str, Any]:
    try:
        return await query_rag(request.query, top_k=request.top_k)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {exc}") from exc


@router.get("/status", summary="RAG index health and document counts")
async def rag_status() -> dict[str, Any]:
    store = get_vector_store()
    counts = {key: store.collection_count(coll) for key, coll in COLLECTIONS.items()}
    return {
        "status": "ok",
        "total_documents": sum(counts.values()),
        "collections": counts,
    }


@router.delete("/index", summary="Clear all RAG collections")
async def rag_clear() -> dict[str, Any]:
    store = get_vector_store()
    for coll in COLLECTIONS.values():
        store.clear_collection(coll)
    return {"status": "ok", "message": "All RAG collections cleared."}
