"""
rag/fetchers/semantic_scholar_fetcher.py

Stub: Semantic Scholar API for citation graph and paper metadata.
API: https://api.semanticscholar.org/
Auth: SEMANTIC_SCHOLAR_KEY env var (optional — public API has rate limits)

TODO: Implement for related-work discovery.
"""
from __future__ import annotations


async def get_paper(paper_id: str) -> dict:
    """Fetch paper metadata by Semantic Scholar paper ID or arXiv ID."""
    raise NotImplementedError("Semantic Scholar fetcher not yet implemented")


async def get_citations(paper_id: str) -> list[dict]:
    """Fetch papers that cite the given paper."""
    raise NotImplementedError("Semantic Scholar fetcher not yet implemented")


async def get_references(paper_id: str) -> list[dict]:
    """Fetch papers referenced by the given paper."""
    raise NotImplementedError("Semantic Scholar fetcher not yet implemented")
