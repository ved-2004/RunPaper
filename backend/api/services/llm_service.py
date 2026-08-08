"""
api/services/llm_service.py

HTTP client for the RunPaper LLM service.

The main backend delegates all LLM work here:
  - trigger_pipeline()       → POST /analyze  (PDF bytes)
  - trigger_arxiv_pipeline() → POST /analyze  (arXiv ID)
  - chat()                   → POST /chat     (sync, returns response)

The LLM service runs the analysis pipeline and writes results directly to
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

# /analyze holds the internal request open while the pipeline runs. The public
# upload endpoint still returns immediately because this call is a backend task.
_TRIGGER_TIMEOUT = 450
# /chat is a synchronous LLM call — needs more time
_CHAT_TIMEOUT = 120


def _headers() -> dict[str, str]:
    return {
        "X-Service-Key": _LLM_SERVICE_KEY,
        "Content-Type": "application/json",
    }


def _log_pipeline_result(resp: httpx.Response, analysis_id: str) -> None:
    """Log the completed pipeline result while tolerating an older LLM revision."""
    try:
        payload = resp.json()
    except ValueError:
        logger.warning("LLM pipeline returned non-JSON response analysis_id=%s", analysis_id)
        return

    completed = payload.get("completed")
    if completed is True:
        logger.info("LLM pipeline completed analysis_id=%s", analysis_id)
    elif completed is False:
        logger.warning("LLM pipeline finished with failure analysis_id=%s", analysis_id)
    else:
        logger.info(
            "LLM pipeline request finished analysis_id=%s completed=unknown",
            analysis_id,
        )


async def _mark_trigger_failed(analysis_id: str) -> None:
    """Fail a job promptly when the LLM service could not accept it."""
    from api.services import papers_db

    try:
        await papers_db.fail_analysis_if_processing(
            analysis_id,
            "Analysis service is temporarily unavailable. Please rerun the paper.",
        )
    except Exception:
        logger.exception("Could not mark rejected analysis as failed: %s", analysis_id)


async def trigger_pipeline(
    analysis_id: str,
    paper_id: str,
    pdf_bytes: bytes,
) -> None:
    """
    Tell the LLM service to run the analysis pipeline for a PDF upload.
    This runs inside a backend background task and returns when the LLM service finishes.
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
        _log_pipeline_result(resp, analysis_id)
    except Exception as exc:
        logger.error("Failed to trigger pipeline: %s", exc)
        await _mark_trigger_failed(analysis_id)


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
        _log_pipeline_result(resp, analysis_id)
    except Exception as exc:
        logger.error("Failed to trigger arXiv pipeline: %s", exc)
        await _mark_trigger_failed(analysis_id)


async def explain(
    item_type: str,
    item_label: str,
    item_content: str,
    item_context: Optional[str],
    paper_title: Optional[str],
    extraction_summary: Optional[str],
) -> dict:
    """
    Ask the LLM service to explain a specific concept from the paper.
    Returns {"explanation": "...markdown..."}.
    Falls back to a generic error message if the service is unavailable.
    """
    try:
        async with httpx.AsyncClient(timeout=_CHAT_TIMEOUT) as client:
            resp = await client.post(
                f"{_LLM_SERVICE_URL}/explain",
                headers=_headers(),
                json={
                    "item_type":          item_type,
                    "item_label":         item_label,
                    "item_content":       item_content,
                    "item_context":       item_context,
                    "paper_title":        paper_title,
                    "extraction_summary": extraction_summary,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.error("LLM service explain failed: %s", exc)
        return {
            "explanation": "The AI assistant is temporarily unavailable. Please try again.",
        }


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
