"""
routers/chat.py

POST /api/papers/{paper_id}/chat  — live chat turn
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.services import papers_db
from api.services import llm_service
from api.routers.auth import get_current_user
from api.models.user import User

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


class ExplainRequest(BaseModel):
    item_type: str   # flowchart_node | equation | hyperparameter | code_annotation
    item_label: str
    item_content: str
    item_context: Optional[str] = None
    paper_title: Optional[str] = None
    extraction_summary: Optional[str] = None


class ExplainResponse(BaseModel):
    explanation: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/{paper_id}/explain", summary="Get an AI explanation for a specific item")
async def explain(
    paper_id: str,
    req: ExplainRequest,
    current_user: User = Depends(get_current_user),
) -> ExplainResponse:
    row = await papers_db.get_paper(paper_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Paper not found")

    result = await llm_service.explain(
        item_type=req.item_type,
        item_label=req.item_label,
        item_content=req.item_content,
        item_context=req.item_context,
        paper_title=req.paper_title,
        extraction_summary=req.extraction_summary,
    )

    return ExplainResponse(explanation=result.get("explanation", ""))


@router.post("/{paper_id}/chat", summary="Send a chat message about the paper")
async def chat(
    paper_id: str,
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    row = await papers_db.get_paper(paper_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Paper not found")
    if row.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Paper analysis is not complete yet")

    extraction    = row.get("extraction_json") or {}
    code_scaffold = row.get("code_scaffold_json") or {}
    flowchart     = row.get("flowchart_json")

    if not extraction or not code_scaffold:
        raise HTTPException(status_code=400, detail="Paper data incomplete")

    result = await llm_service.chat(
        message=req.message,
        history=[m.model_dump() for m in req.history],
        mode=req.mode,
        extraction=extraction,
        code_scaffold=code_scaffold,
        flowchart=flowchart,
    )

    return ChatResponse(
        answer=result.get("answer", ""),
        code_refs=[CodeRef(**r) for r in result.get("code_refs", []) if isinstance(r, dict)],
        flowchart_refs=result.get("flowchart_refs", []),
        follow_up=result.get("follow_up"),
    )
