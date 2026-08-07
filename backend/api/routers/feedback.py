"""
routers/feedback.py

POST /api/feedback  — Submit feedback and request more credits.

Requires authentication. Stores the submission in the `feedback` table
created by migration 009_credits.sql.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.routers.auth import get_current_user
from api.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

_TABLE = "feedback"
_sb_client = None


class FeedbackRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=120)
    organization: str = Field(min_length=1, max_length=200)
    why_credits: str = Field(min_length=1, max_length=3000)
    improvements: str = Field(min_length=1, max_length=3000)


def _client():
    global _sb_client
    if _sb_client is not None:
        return _sb_client
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not (url and key):
        return None
    try:
        from supabase import create_client
        _sb_client = create_client(url, key)
        return _sb_client
    except Exception as exc:
        logger.warning("Supabase client init failed: %s", exc)
        return None


@router.post("", summary="Submit feedback / request more credits")
async def submit_feedback(
    body: FeedbackRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Store a feedback submission from an authenticated user.
    Used to review and manually grant additional credits.
    """
    sb = _client()
    row = {
        "user_id":      current_user.id,
        "name":         body.name.strip(),
        "role":         body.role.strip(),
        "organization": body.organization.strip(),
        "why_credits":  body.why_credits.strip(),
        "improvements": body.improvements.strip(),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    if sb is None:
        # Supabase not configured — log and accept gracefully in dev
        logger.info("Feedback (no DB): user=%s name=%s", current_user.id, body.name)
        return {"success": True, "message": "Feedback received. We'll be in touch!"}

    try:
        sb.table(_TABLE).insert(row).execute()
        logger.info("Feedback stored for user=%s", current_user.id)
        return {"success": True, "message": "Feedback received. We'll be in touch!"}
    except Exception as exc:
        logger.error("submit_feedback failed for user=%s: %s", current_user.id, exc)
        raise HTTPException(status_code=500, detail="Failed to save feedback. Please try again.")
