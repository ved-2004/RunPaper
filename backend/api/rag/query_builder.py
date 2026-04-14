"""
Query Builder — converts a paper extraction dict into semantic query strings
for the RAG vector store.
"""
from __future__ import annotations

from typing import Any


def build_queries(extraction: dict[str, Any]) -> list[str]:
    """
    Derive ranked query strings from a paper extraction dict.
    Used to retrieve related paper chunks from the vector store.
    """
    queries: list[str] = []

    title = extraction.get("title") or ""
    contribution = extraction.get("core_contribution") or ""
    method = extraction.get("method") or {}
    architecture = method.get("architecture") or ""
    components = extraction.get("architecture_components") or []

    if title:
        queries.append(title)
    if contribution:
        queries.append(contribution)
    if architecture:
        queries.append(f"architecture {architecture}")
    for comp in components[:3]:
        queries.append(comp)

    # Deduplicate preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for q in queries:
        if q and q not in seen:
            seen.add(q)
            unique.append(q)

    return unique[:8] or ["machine learning neural network architecture"]
