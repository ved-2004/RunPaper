"""
api/rate_limiter.py

Simple in-memory sliding-window rate limiter.

Per-route limits:
  - Paper analysis/rerun POSTs             →  5 requests / hour
  - Chat/explain POSTs                     →  20 requests / minute
  - Everything else                      →  60 requests / minute (general API)

Uses a deque per (ip, bucket) key. Old entries are evicted lazily on each request.
A background cleanup runs every 10 minutes to prevent unbounded memory growth.
"""
from __future__ import annotations

import collections
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class _Bucket:
    max_requests: int
    window_seconds: int
    timestamps: collections.deque = field(default_factory=collections.deque)


# (authenticated user or trusted client IP, route_key) -> Bucket
_store: dict[tuple[str, str], _Bucket] = {}
_last_cleanup = time.time()
_CLEANUP_INTERVAL = 600  # 10 minutes


def _route_key(path: str, method: str) -> tuple[str, int, int]:
    """Return (bucket_name, max_requests, window_seconds) for a request."""
    expensive_paths = ("/api/papers/upload-and-analyze", "/api/papers/arxiv-import")
    if method == "POST" and (path in expensive_paths or path.endswith("/rerun")):
        return "analysis", 5, 3600
    if method == "POST" and (path.endswith("/chat") or path.endswith("/explain")):
        return "llm_interaction", 20, 60
    if method == "POST" and path == "/api/feedback":
        return "feedback", 5, 3600
    return "general", 60, 60


def client_ip_from_forwarded(forwarded_for: str, fallback: str) -> str:
    """Use the load balancer-appended client hop, not a spoofable leftmost hop."""
    hops = [part.strip() for part in forwarded_for.split(",") if part.strip()]
    if len(hops) >= 2:
        return hops[-2]
    if hops:
        return hops[0]
    return fallback or "unknown"


def _cleanup():
    """Evict buckets with no recent timestamps (idle IPs)."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < _CLEANUP_INTERVAL:
        return
    stale = [
        k for k, bucket in _store.items()
        if not bucket.timestamps or bucket.timestamps[-1] < now - bucket.window_seconds
    ]
    for k in stale:
        del _store[k]
    if stale:
        logger.debug("Rate limiter: evicted %d stale buckets", len(stale))
    _last_cleanup = now


def check(ip: str, path: str, method: str) -> Optional[int]:
    """
    Check whether this request is within rate limits.

    Returns:
        None  — allowed; request may proceed.
        int   — denied; value is seconds until the window resets (use as Retry-After).
    """
    _cleanup()

    bucket_name, max_req, window = _route_key(path, method)
    key = (ip, bucket_name)

    now = time.time()
    bucket = _store.get(key)
    if bucket is None:
        bucket = _Bucket(max_requests=max_req, window_seconds=window)
        _store[key] = bucket

    # Evict expired timestamps
    cutoff = now - window
    while bucket.timestamps and bucket.timestamps[0] < cutoff:
        bucket.timestamps.popleft()

    if len(bucket.timestamps) >= max_req:
        # Oldest timestamp tells us when the window frees up
        retry_after = int(bucket.timestamps[0] + window - now) + 1
        return max(retry_after, 1)

    bucket.timestamps.append(now)
    return None
