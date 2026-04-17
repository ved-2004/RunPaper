"""
api/services/llm_service.py

HTTP client for the RunPaper LLM service.

The main backend delegates all LLM work here:
  - trigger_pipeline()       → POST /analyze  (async, PDF bytes)
  - trigger_arxiv_pipeline() → POST /analyze  (async, arXiv ID)
  - chat()                   → POST /chat     (sync, returns response)

The LLM service runs the 5-step pipeline and writes results directly to
Supabase paper_analyses. The main backend never imports LLM SDKs.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:8001")
_LLM_SERVICE_KEY = os.getenv("LLM_SERVICE_KEY", "")

# /analyze just queues the job — fast ACK expected
_TRIGGER_TIMEOUT = 30
# /chat is a synchronous LLM call — needs more time
_CHAT_TIMEOUT = 120


def _headers() -> dict[str, str]:
    return {
        "X-Service-Key": _LLM_SERVICE_KEY,
        "Content-Type": "application/json",
    }


async def trigger_pipeline(
    analysis_id: str,
    paper_id: str,
    pdf_bytes: bytes,
) -> None:
    """
    Tell the LLM service to start the analysis pipeline for a PDF upload.
    Returns as soon as the service accepts the job (pipeline runs in the background there).
    """
    pdf_b64 = base64.b64encode(pdf_bytes).decode()
    try:
        async with httpx.AsyncClient(timeout=_TRIGGER_TIMEOUT) as client:
            resp = await client.post(
                f"{_LLM_SERVICE_URL}/analyze",
                headers=_headers(),
                json={
                    "analysis_id": analysis_id,
                    "paper_id":    paper_id,
                    "source":      "bytes",
                    "pdf_b64":     pdf_b64,
                },
            )
            resp.raise_for_status()
        logger.info("LLM service accepted pipeline for analysis_id=%s", analysis_id)
    except Exception as exc:
        logger.error("Failed to trigger pipeline: %s", exc)
        raise


async def trigger_arxiv_pipeline(
    analysis_id: str,
    paper_id: str,
    arxiv_id: str,
) -> None:
    """
    Tell the LLM service to fetch an arXiv paper and start the pipeline.
    The LLM service owns the arXiv fetch — main backend never touches the PDF.
    """
    try:
        async with httpx.AsyncClient(timeout=_TRIGGER_TIMEOUT) as client:
            resp = await client.post(
                f"{_LLM_SERVICE_URL}/analyze",
                headers=_headers(),
                json={
                    "analysis_id": analysis_id,
                    "paper_id":    paper_id,
                    "source":      "arxiv",
                    "arxiv_id":    arxiv_id,
                },
            )
            resp.raise_for_status()
        logger.info("LLM service accepted arXiv pipeline for %s", arxiv_id)
    except Exception as exc:
        logger.error("Failed to trigger arXiv pipeline: %s", exc)
        raise


async def chat(
    message: str,
    history: list,
    mode: str,
    extraction: dict,
    code_scaffold: dict,
    flowchart: Optional[dict],
) -> dict:
    """
    Proxy a live chat turn to the LLM service.
    Returns the structured response: {answer, code_refs, flowchart_refs, follow_up}.
    Falls back to an error message if the service is unavailable.
    """
    try:
        async with httpx.AsyncClient(timeout=_CHAT_TIMEOUT) as client:
            resp = await client.post(
                f"{_LLM_SERVICE_URL}/chat",
                headers=_headers(),
                json={
                    "message":      message,
                    "history":      history,
                    "mode":         mode,
                    "extraction":   extraction,
                    "code_scaffold": code_scaffold,
                    "flowchart":    flowchart,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.error("LLM service chat failed: %s", exc)
        return {
            "answer": "The AI assistant is temporarily unavailable. Please try again.",
            "code_refs": [],
            "flowchart_refs": [],
            "follow_up": None,
        }
