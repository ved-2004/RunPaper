"""
rag/models.py

Type definitions for RAG chunk metadata used when indexing paper chunks
into ChromaDB.
"""
from __future__ import annotations

from typing import Literal
from typing_extensions import TypedDict


class PaperChunkMetadata(TypedDict):
    arxiv_id: str
    title: str
    section_type: Literal["abstract", "method", "experiments", "results", "related_work"]
    figure_references: list[str]   # e.g. ["Figure 3", "Figure 4"]
    equation_references: list[str] # e.g. ["Eq. 1", "Eq. 2"]
    chunk_index: int
