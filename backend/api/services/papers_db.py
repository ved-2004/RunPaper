"""
api/services/papers_db.py

Supabase-backed persistence for the paper_analyses + user_papers tables
(Migration 007 schema).

paper_analyses  — global, one row per unique paper (keyed by arXiv ID or SHA-256 hash)
user_papers     — per-user ownership; soft-delete only removes the user's link

Graceful fallback: if Supabase is not configured, all operations use in-memory
dicts so the app still works in development.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── In-memory fallback stores ─────────────────────────────────────────────────
_analyses: dict[str, dict] = {}    # analysis_id → paper_analyses row
_user_papers: dict[str, dict] = {} # paper_id    → user_papers row


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


def compute_content_hash(pdf_bytes: bytes) -> str:
    """SHA-256 hex digest of raw PDF bytes — used to deduplicate non-arXiv uploads."""
    return hashlib.sha256(pdf_bytes).hexdigest()


# ── paper_analyses helpers ────────────────────────────────────────────────────

def _flatten(up_row: dict, analysis: dict) -> dict:
    """Merge a user_papers row + paper_analyses row into the flat dict the router expects."""
    return {
        "paper_id":            up_row.get("paper_id", ""),
        "user_id":             up_row.get("user_id"),
        "trial_id":            up_row.get("trial_id"),
        "analysis_id":         up_row.get("analysis_id"),
        "uploaded_at":         up_row.get("added_at", ""),
        "deleted_at":          up_row.get("deleted_at"),
        # from paper_analyses
        "arxiv_id":            analysis.get("arxiv_id"),
        "title":               analysis.get("title"),
        "authors_json":        analysis.get("authors_json"),
        "status":              analysis.get("status", "processing"),
        "extraction_json":     analysis.get("extraction_json"),
        "code_scaffold_json":  analysis.get("code_scaffold_json"),
        "reproducibility_json": analysis.get("reproducibility_json"),
        "flowchart_json":      analysis.get("flowchart_json"),
        "faq_json":            analysis.get("faq_json"),
        "error_message":       analysis.get("error_message"),
    }


# ── Analysis (global) ─────────────────────────────────────────────────────────

async def find_existing_analysis(
    arxiv_id: Optional[str] = None,
    content_hash: Optional[str] = None,
) -> Optional[dict]:
    """
    Look up an existing analysis by arXiv ID or SHA-256 content hash.
    Returns {"analysis_id": str, "status": str} or None.
    """
    if not arxiv_id and not content_hash:
        return None

    sb = _client()
    if sb is None:
        for row in _analyses.values():
            if arxiv_id and row.get("arxiv_id") == arxiv_id:
                return {"analysis_id": row["analysis_id"], "status": row["status"]}
            if content_hash and row.get("content_hash") == content_hash:
                return {"analysis_id": row["analysis_id"], "status": row["status"]}
        return None

    try:
        query = sb.table("paper_analyses").select("analysis_id, status")
        if arxiv_id:
            resp = query.eq("arxiv_id", arxiv_id).execute()
        else:
            resp = query.eq("content_hash", content_hash).execute()
        if resp.data:
            row = resp.data[0]
            return {"analysis_id": row["analysis_id"], "status": row["status"]}
        return None
    except Exception as exc:
        logger.error("find_existing_analysis failed: %s", exc)
        return None


async def create_analysis(
    analysis_id: str,
    arxiv_id: Optional[str] = None,
    content_hash: Optional[str] = None,
) -> bool:
    """Insert a new paper_analyses row with status=processing."""
    row: dict[str, Any] = {
        "analysis_id":       analysis_id,
        "status":            "processing",
        "first_processed_at": _now_iso(),
        "request_count":     1,
    }
    if arxiv_id:
        row["arxiv_id"] = arxiv_id
    if content_hash:
        row["content_hash"] = content_hash

    sb = _client()
    if sb is None:
        _analyses[analysis_id] = row
        return True

    try:
        sb.table("paper_analyses").insert(row).execute()
        logger.info("Analysis %s created", analysis_id)
        return True
    except Exception as exc:
        logger.error("create_analysis failed for %s: %s", analysis_id, exc)
        _analyses[analysis_id] = row
        return False


async def update_analysis(
    analysis_id: str,
    status: str,
    title: Optional[str] = None,
    authors_json: Optional[list] = None,
    arxiv_id: Optional[str] = None,
    extraction_json: Optional[dict] = None,
    code_scaffold_json: Optional[dict] = None,
    reproducibility_json: Optional[list] = None,
    flowchart_json: Optional[dict] = None,
    error_message: Optional[str] = None,
    **kwargs: Any,
) -> bool:
    """Update a paper_analyses row (pipeline results or error state)."""
    updates: dict[str, Any] = {"status": status}
    if title is not None:
        updates["title"] = title
    if arxiv_id is not None:
        updates["arxiv_id"] = arxiv_id
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
    if "faq_json" in kwargs and kwargs["faq_json"] is not None:
        updates["faq_json"] = json.loads(json.dumps(kwargs["faq_json"], default=str))
    if error_message is not None:
        updates["error_message"] = error_message
    # Allow explicitly clearing error_message
    if "error_message" in kwargs and kwargs.get("error_message") is None and "error_message" not in updates:
        updates["error_message"] = None

    sb = _client()
    if sb is None:
        existing = _analyses.get(analysis_id, {})
        existing.update(updates)
        _analyses[analysis_id] = existing
        return True

    try:
        sb.table("paper_analyses").update(updates).eq("analysis_id", analysis_id).execute()
        return True
    except Exception as exc:
        logger.error("update_analysis failed for %s: %s", analysis_id, exc)
        existing = _analyses.get(analysis_id, {})
        existing.update(updates)
        _analyses[analysis_id] = existing
        return False


async def increment_request_count(analysis_id: str) -> None:
    """Bump request_count each time a new user submits the same paper."""
    sb = _client()
    if sb is None:
        if analysis_id in _analyses:
            _analyses[analysis_id]["request_count"] = (
                _analyses[analysis_id].get("request_count", 1) + 1
            )
        return
    try:
        resp = (
            sb.table("paper_analyses")
            .select("request_count")
            .eq("analysis_id", analysis_id)
            .single()
            .execute()
        )
        if resp.data:
            new_count = (resp.data.get("request_count") or 1) + 1
            sb.table("paper_analyses").update({"request_count": new_count}).eq(
                "analysis_id", analysis_id
            ).execute()
    except Exception as exc:
        logger.warning("increment_request_count failed: %s", exc)


# ── user_papers (per-user ownership) ─────────────────────────────────────────

async def create_user_paper(
    paper_id: str,
    analysis_id: str,
    user_id: Optional[str] = None,
    trial_id: Optional[str] = None,
) -> bool:
    """Insert a user_papers row linking a user/trial to an analysis."""
    row: dict[str, Any] = {
        "paper_id":    paper_id,
        "analysis_id": analysis_id,
        "added_at":    _now_iso(),
    }
    if user_id:
        row["user_id"] = user_id
    if trial_id:
        row["trial_id"] = trial_id

    sb = _client()
    if sb is None:
        _user_papers[paper_id] = row
        return True

    try:
        sb.table("user_papers").insert(row).execute()
        logger.info("user_paper %s → analysis %s", paper_id, analysis_id)
        return True
    except Exception as exc:
        logger.error("create_user_paper failed for %s: %s", paper_id, exc)
        _user_papers[paper_id] = row
        return False


async def get_paper(paper_id: str) -> Optional[dict]:
    """
    Fetch a paper by its paper_id.
    JOINs user_papers + paper_analyses and returns a flat dict.
    """
    sb = _client()
    if sb is None:
        up = _user_papers.get(paper_id)
        if not up:
            return None
        analysis = _analyses.get(up.get("analysis_id", ""), {})
        return _flatten(up, analysis)

    try:
        resp = (
            sb.table("user_papers")
            .select("*, paper_analyses(*)")
            .eq("paper_id", paper_id)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
        if not resp.data:
            return None
        row = dict(resp.data)
        analysis = row.pop("paper_analyses", {}) or {}
        return _flatten(row, analysis)
    except Exception as exc:
        logger.error("get_paper failed for %s: %s", paper_id, exc)
        up = _user_papers.get(paper_id)
        if up:
            return _flatten(up, _analyses.get(up.get("analysis_id", ""), {}))
        return None


async def list_user_papers(user_id: Optional[str] = None) -> list[dict]:
    """List non-deleted papers (summary columns only). Most recent first."""
    sb = _client()
    if sb is None:
        results = []
        for up in _user_papers.values():
            if up.get("deleted_at"):
                continue
            if user_id is not None and up.get("user_id") != user_id:
                continue
            analysis = _analyses.get(up.get("analysis_id", ""), {})
            results.append(_flatten(up, analysis))
        return sorted(results, key=lambda r: r.get("uploaded_at", ""), reverse=True)

    try:
        query = (
            sb.table("user_papers")
            .select("paper_id, user_id, added_at, paper_analyses(title, authors_json, status, arxiv_id)")
            .is_("deleted_at", "null")
        )
        if user_id is not None:
            query = query.eq("user_id", user_id)
        resp = query.order("added_at", desc=True).execute()
        rows = []
        for row in (resp.data or []):
            analysis = row.pop("paper_analyses", {}) or {}
            rows.append({
                "paper_id":    row.get("paper_id", ""),
                "uploaded_at": row.get("added_at", ""),
                "title":       analysis.get("title"),
                "authors_json": analysis.get("authors_json"),
                "status":      analysis.get("status", "processing"),
                "arxiv_id":    analysis.get("arxiv_id"),
            })
        return rows
    except Exception as exc:
        logger.error("list_user_papers failed: %s", exc)
        return []


async def count_user_papers(user_id: str) -> int:
    """Count non-deleted papers for a signed-in user."""
    sb = _client()
    if sb is None:
        return sum(
            1 for up in _user_papers.values()
            if up.get("user_id") == user_id and not up.get("deleted_at")
        )
    try:
        resp = (
            sb.table("user_papers")
            .select("paper_id", count="exact")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
        return resp.count or 0
    except Exception as exc:
        logger.error("count_user_papers failed: %s", exc)
        return 0


async def get_user_max_papers(user_id: str) -> int:
    """Return the max_papers limit for a user (defaults to 5)."""
    sb = _client()
    if sb is None:
        return 5
    try:
        resp = sb.table("users").select("max_papers").eq("id", user_id).single().execute()
        if resp.data:
            return int(resp.data.get("max_papers") or 5)
        return 5
    except Exception as exc:
        logger.warning("get_user_max_papers failed: %s", exc)
        return 5


async def soft_delete_paper(paper_id: str) -> bool:
    """
    Set user_papers.deleted_at. The global paper_analyses row is preserved
    so other users who submitted the same paper are unaffected.
    """
    now = _now_iso()
    sb = _client()
    if sb is None:
        if paper_id in _user_papers:
            _user_papers[paper_id]["deleted_at"] = now
            return True
        return False

    try:
        sb.table("user_papers").update({"deleted_at": now}).eq("paper_id", paper_id).execute()
        logger.info("user_paper %s soft-deleted", paper_id)
        return True
    except Exception as exc:
        logger.error("soft_delete_paper failed for %s: %s", paper_id, exc)
        return False


async def migrate_trial_papers(trial_id: str, user_id: str) -> int:
    """
    Claim all anonymous user_papers with the given trial_id for user_id.
    Returns the number of papers migrated.
    """
    if not trial_id or not user_id:
        return 0

    sb = _client()
    if sb is None:
        count = 0
        for row in _user_papers.values():
            if row.get("trial_id") == trial_id and not row.get("user_id"):
                row["user_id"] = user_id
                count += 1
        logger.info("migrate_trial_papers (fallback): migrated %d papers", count)
        return count

    try:
        resp = (
            sb.table("user_papers")
            .update({"user_id": user_id})
            .eq("trial_id", trial_id)
            .is_("user_id", "null")
            .execute()
        )
        count = len(resp.data) if resp.data else 0
        logger.info(
            "migrate_trial_papers: migrated %d papers for trial %s → user %s",
            count, trial_id, user_id,
        )
        return count
    except Exception as exc:
        logger.error("migrate_trial_papers failed: %s", exc)
        return 0
