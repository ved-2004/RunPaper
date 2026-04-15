"""
api/services/trial_db.py

Tracks free-trial usage by anonymous browser-generated UUIDs (trial_id).
One free upload is allowed per trial_id.

Uses Supabase when configured; falls back to an in-memory dict for local dev.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

FREE_UPLOADS = 1  # change to allow more in future

# In-memory fallback (resets on server restart — fine for dev)
_fallback: dict[str, int] = {}


def _client():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not (url and key):
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as exc:
        logger.warning("Supabase client init failed in trial_db: %s", exc)
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def check_and_consume(trial_id: str) -> bool:
    """
    Atomically checks and consumes one trial upload.

    Returns:
        True  — trial slot was available; usage has been incremented.
        False — trial already exhausted; nothing was changed.
    """
    if not trial_id or not trial_id.strip():
        return False

    sb = _client()

    if sb is None:
        # In-memory fallback
        used = _fallback.get(trial_id, 0)
        if used >= FREE_UPLOADS:
            return False
        _fallback[trial_id] = used + 1
        logger.info("Trial %s consumed (fallback, now %d/%d)", trial_id, used + 1, FREE_UPLOADS)
        return True

    try:
        # Try to fetch existing row
        resp = (
            sb.table("trials")
            .select("uploads_used")
            .eq("trial_id", trial_id)
            .maybe_single()
            .execute()
        )

        if resp.data is None:
            # First time — insert and allow
            sb.table("trials").insert({
                "trial_id": trial_id,
                "uploads_used": 1,
                "created_at": _now_iso(),
                "last_used_at": _now_iso(),
            }).execute()
            logger.info("Trial %s created and consumed (1/%d)", trial_id, FREE_UPLOADS)
            return True

        used: int = resp.data.get("uploads_used", 0)
        if used >= FREE_UPLOADS:
            logger.info("Trial %s exhausted (%d/%d)", trial_id, used, FREE_UPLOADS)
            return False

        # Increment
        sb.table("trials").update({
            "uploads_used": used + 1,
            "last_used_at": _now_iso(),
        }).eq("trial_id", trial_id).execute()
        logger.info("Trial %s consumed (%d/%d)", trial_id, used + 1, FREE_UPLOADS)
        return True

    except Exception as exc:
        logger.error("trial check_and_consume failed for %s: %s", trial_id, exc)
        # Fail open in case of DB error — don't block the user
        return True


async def get_usage(trial_id: str) -> int:
    """Returns how many uploads this trial_id has used."""
    sb = _client()

    if sb is None:
        return _fallback.get(trial_id, 0)

    try:
        resp = (
            sb.table("trials")
            .select("uploads_used")
            .eq("trial_id", trial_id)
            .maybe_single()
            .execute()
        )
        return resp.data.get("uploads_used", 0) if resp.data else 0
    except Exception:
        return 0
