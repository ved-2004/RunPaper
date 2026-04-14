"""
rag/fetchers/papers_with_code_fetcher.py

Stub: Papers With Code API for finding existing implementations.
API: https://paperswithcode.com/api/v1/

TODO: Implement for "existing implementation" feature — show users whether
      a GitHub implementation already exists before generating a scaffold.
"""
from __future__ import annotations


async def find_implementations(
    paper_title: str,
    arxiv_id: str | None = None,
) -> list[dict]:
    """Find GitHub repos implementing the given paper."""
    raise NotImplementedError("Papers With Code fetcher not yet implemented")


async def get_datasets(paper_title: str) -> list[dict]:
    """Find benchmark datasets used by the given paper."""
    raise NotImplementedError("Papers With Code fetcher not yet implemented")
