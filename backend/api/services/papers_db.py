"""
api/services/papers_db.py

Supabase-backed persistence for the `papers` table.

Graceful fallback: if Supabase is not configured, all operations use an
in-memory dict so the app still works in development.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

_TABLE = "papers"

# In-memory fallback when Supabase is not configured
_fallback_store: dict[str, dict] = {}


def _client():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not (url and key):
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as exc:
        logger.warning("Supabase client init failed: %s", exc)
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY"))


def generate_paper_id() -> str:
    return str(uuid.uuid4())[:8].upper()


async def create_paper(
    user_id: Optional[str],
    paper_id: str,
    arxiv_id: Optional[str] = None,
) -> bool:
    """Create a new paper row with status=processing."""
    row = {
        "paper_id": paper_id,
        "user_id": user_id,
        "arxiv_id": arxiv_id,
        "uploaded_at": _now_iso(),
        "status": "processing",
    }

    sb = _client()
    if sb is None:
        _fallback_store[paper_id] = row
        logger.info("Paper %s created in fallback store", paper_id)
        return True

    try:
        sb.table(_TABLE).insert(row).execute()
        logger.info("Paper %s created in Supabase", paper_id)
        return True
    except Exception as exc:
        logger.error("create_paper failed for %s: %s", paper_id, exc)
        _fallback_store[paper_id] = row
        return False


async def update_paper(
    paper_id: str,
    status: str,
    title: Optional[str] = None,
    authors_json: Optional[list] = None,
    extraction_json: Optional[dict] = None,
    code_scaffold_json: Optional[dict] = None,
    reproducibility_json: Optional[list] = None,
    flowchart_json: Optional[dict] = None,
    error_message: Optional[str] = None,
    **kwargs: Any,
) -> bool:
    """Update paper status and results."""
    updates: dict[str, Any] = {"status": status}
    if title is not None:
        updates["title"] = title
    if authors_json is not None:
        updates["authors_json"] = json.loads(json.dumps(authors_json))
    if extraction_json is not None:
        updates["extraction_json"] = json.loads(json.dumps(extraction_json, default=str))
    if code_scaffold_json is not None:
        updates["code_scaffold_json"] = json.loads(json.dumps(code_scaffold_json, default=str))
    if reproducibility_json is not None:
        updates["reproducibility_json"] = json.loads(json.dumps(reproducibility_json, default=str))
    if flowchart_json is not None:
        updates["flowchart_json"] = json.loads(json.dumps(flowchart_json, default=str))
    if "faq_json" in kwargs:
        faq = kwargs["faq_json"]
        if faq is not None:
            updates["faq_json"] = json.loads(json.dumps(faq, default=str))
    if error_message is not None:
        updates["error_message"] = error_message

    sb = _client()
    if sb is None:
        existing = _fallback_store.get(paper_id, {})
        existing.update(updates)
        _fallback_store[paper_id] = existing
        return True

    try:
        sb.table(_TABLE).update(updates).eq("paper_id", paper_id).execute()
        return True
    except Exception as exc:
        logger.error("update_paper failed for %s: %s", paper_id, exc)
        existing = _fallback_store.get(paper_id, {})
        existing.update(updates)
        _fallback_store[paper_id] = existing
        return False


async def get_paper(paper_id: str) -> Optional[dict]:
    """Fetch a paper by its paper_id."""
    sb = _client()
    if sb is None:
        return _fallback_store.get(paper_id)

    try:
        resp = (
            sb.table(_TABLE)
            .select("*")
            .eq("paper_id", paper_id)
            .single()
            .execute()
        )
        return resp.data if resp.data else None
    except Exception as exc:
        logger.error("get_paper failed for %s: %s", paper_id, exc)
        return _fallback_store.get(paper_id)


async def list_user_papers(user_id: Optional[str] = None) -> list[dict]:
    """List non-deleted papers. If user_id is None, returns all (most recent first)."""
    sb = _client()
    if sb is None:
        papers = list(_fallback_store.values())
        if user_id is not None:
            papers = [p for p in papers if p.get("user_id") == user_id]
        # Filter out soft-deleted
        papers = [p for p in papers if not p.get("deleted_at")]
        return sorted(papers, key=lambda p: p.get("uploaded_at", ""), reverse=True)

    try:
        query = sb.table(_TABLE).select("paper_id, title, authors_json, uploaded_at, status")
        if user_id is not None:
            query = query.eq("user_id", user_id)
        resp = query.is_("deleted_at", "null").order("uploaded_at", desc=True).execute()
        return resp.data or []
    except Exception as exc:
        logger.error("list_user_papers failed: %s", exc)
        return []


async def soft_delete_paper(paper_id: str) -> bool:
    """Mark a paper as deleted. Returns True on success."""
    now = _now_iso()
    sb = _client()
    if sb is None:
        if paper_id in _fallback_store:
            _fallback_store[paper_id]["deleted_at"] = now
            return True
        return False

    try:
        sb.table(_TABLE).update({"deleted_at": now}).eq("paper_id", paper_id).execute()
        logger.info("Paper %s soft-deleted", paper_id)
        return True
    except Exception as exc:
        logger.error("soft_delete_paper failed for %s: %s", paper_id, exc)
        return False
