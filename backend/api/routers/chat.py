"""
routers/chat.py

GET  /api/papers/{paper_id}/faq   — pre-generated Q&A chips
POST /api/papers/{paper_id}/chat  — live chat turn
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.services import papers_db
from api.chat.pipeline import chat_with_paper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/papers", tags=["chat"])


# ── Request / response models ─────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    mode: str = "direct"   # "direct" | "socratic"


class CodeRef(BaseModel):
    file: str
    ref: str
    description: str


class ChatResponse(BaseModel):
    answer: str
    code_refs: list[CodeRef] = []
    flowchart_refs: list[str] = []
    follow_up: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{paper_id}/faq", summary="Get pre-generated FAQ for a paper")
async def get_faq(paper_id: str) -> list:
    row = await papers_db.get_paper(paper_id)
    if not row:
        raise HTTPException(status_code=404, detail="Paper not found")
    return row.get("faq_json") or []


@router.post("/{paper_id}/chat", summary="Send a chat message about the paper")
async def chat(paper_id: str, req: ChatRequest) -> ChatResponse:
    row = await papers_db.get_paper(paper_id)
    if not row:
        raise HTTPException(status_code=404, detail="Paper not found")
    if row.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Paper analysis is not complete yet")

    extraction    = row.get("extraction_json") or {}
    code_scaffold = row.get("code_scaffold_json") or {}
    flowchart     = row.get("flowchart_json")

    if not extraction or not code_scaffold:
        raise HTTPException(status_code=400, detail="Paper data incomplete")

    result = await chat_with_paper(
        message=req.message,
        extraction=extraction,
        code_scaffold=code_scaffold,
        flowchart=flowchart,
        history=[m.model_dump() for m in req.history],
        mode=req.mode,
    )

    return ChatResponse(
        answer=result.get("answer", ""),
        code_refs=[CodeRef(**r) for r in result.get("code_refs", []) if isinstance(r, dict)],
        flowchart_refs=result.get("flowchart_refs", []),
        follow_up=result.get("follow_up"),
    )
