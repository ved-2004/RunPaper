"""
rag/fetchers/arxiv_fetcher.py

Stub: fetch papers from the arXiv API.
API: https://export.arxiv.org/api/query

TODO: Implement when ready to wire up related-paper search.
"""
from __future__ import annotations


async def fetch_by_id(arxiv_id: str) -> dict:
    """Fetch a single paper by arXiv ID (e.g. '1706.03762')."""
    raise NotImplementedError("arXiv fetcher not yet implemented")


async def search(query: str, max_results: int = 10) -> list[dict]:
    """Search arXiv for papers matching query."""
    raise NotImplementedError("arXiv fetcher not yet implemented")
