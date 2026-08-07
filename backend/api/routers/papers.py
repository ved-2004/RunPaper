"""
routers/papers.py

POST /api/papers/upload-and-analyze  — upload PDF, start full pipeline (background)
POST /api/papers/arxiv-import        — import from arXiv ID or URL, start pipeline
GET  /api/papers                     — list papers for the current user
GET  /api/papers/{paper_id}          — get paper results (poll until complete)
GET  /api/papers/{paper_id}/pdf-url  — signed URL or arXiv fallback
GET  /api/papers/{paper_id}/download — download code scaffold as .zip
DELETE /api/papers/{paper_id}        — soft-delete user's link to the paper

Deduplication:
  - PDF uploads:   SHA-256 of file bytes → paper_analyses.content_hash
  - arXiv imports: arxiv_id             → paper_analyses.arxiv_id
  If an analysis already exists and is 'complete', the pipeline is skipped entirely
  only when core artifacts are present, and the new user_papers row is linked to
  the existing analysis immediately.
  If the current user already has an active link to that analysis, that paper_id is
  returned instead of creating a duplicate dashboard row.
  If the analysis is 'processing', the new row is still created and the user polls
  the same underlying analysis. If 'failed' or artifact-incomplete, the analysis
  is reset and re-run.

Credits:
  Authenticated users need at least 1 credit for a new user-to-analysis link.
  The link and deduction happen atomically at submission. Repeated submissions,
  failed-run cleanup, and reruns do not double-charge the user.
  Anonymous submissions are rejected with 401.
"""
from __future__ import annotations

import io
import logging
import os
import re
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from api.services import papers_db
from api.services import llm_service
import api.services.storage as storage
from api.routers.auth import get_current_user
from api.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/papers", tags=["papers"])

# Patterns to parse an arXiv ID from user-supplied input (URL or bare ID)
_ARXIV_INPUT_PATTERNS = [
    re.compile(r'arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5}(?:v\d+)?)', re.IGNORECASE),
    re.compile(r'arXiv[:\s]+(\d{4}\.\d{4,5}(?:v\d+)?)', re.IGNORECASE),
    re.compile(r'^(\d{4}\.\d{4,5}(?:v\d+)?)$'),
]


def _parse_arxiv_id_from_input(raw: str) -> Optional[str]:
    """Accept a user-supplied arXiv URL, 'arXiv:XXXX.XXXXX', or bare ID."""
    raw = raw.strip()
    for pattern in _ARXIV_INPUT_PATTERNS:
        m = pattern.search(raw)
        if m:
            return m.group(1).split("v")[0]
    return None


def _detect_arxiv_id_in_pdf(content: bytes) -> Optional[str]:
    """Read only the first-page header to avoid mistaking citations for the paper ID."""
    try:
        import fitz

        with fitz.open(stream=content, filetype="pdf") as document:
            if document.page_count == 0:
                return None
            header_text = document.load_page(0).get_text()[:1500]
        return _parse_arxiv_id_from_input(header_text)
    except Exception as exc:
        logger.debug("Could not inspect PDF header for arXiv ID: %s", exc)
        return None


MAX_FILE_SIZE = 20 * 1024 * 1024  # Keeps base64 forwarding below Cloud Run's 32 MiB HTTP/1 limit.


# ── Response models ───────────────────────────────────────────────────────────

class PaperRecord(BaseModel):
    paper_id: str
    arxiv_id: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[list[str]] = None
    uploaded_at: str
    status: str  # processing | complete | partial | failed
    extraction: Optional[dict] = None
    code_scaffold: Optional[dict] = None
    reproducibility: Optional[list] = None
    flowchart: Optional[dict] = None
    notebook_json: Optional[dict] = None
    sanity_status: Optional[str] = None       # "passed"|"warning"|"failed"|"skipped"|"pending"
    sanity_details: Optional[dict] = None
    error_message: Optional[str] = None


class PaperSummary(BaseModel):
    paper_id: str
    title: Optional[str] = None
    authors: Optional[list[str]] = None
    uploaded_at: str
    status: str  # processing | complete | partial | failed


class ArxivImportRequest(BaseModel):
    arxiv_url: str = Field(min_length=1, max_length=200)


def _db_row_to_record(row: dict) -> PaperRecord:
    return PaperRecord(
        paper_id=row.get("paper_id", ""),
        arxiv_id=row.get("arxiv_id"),
        title=row.get("title"),
        authors=row.get("authors_json"),
        uploaded_at=row.get("uploaded_at", ""),
        status=row.get("status", "processing"),
        extraction=row.get("extraction_json"),
        code_scaffold=row.get("code_scaffold_json"),
        reproducibility=row.get("reproducibility_json"),
        flowchart=row.get("flowchart_json"),
        notebook_json=row.get("notebook_json"),
        sanity_status=row.get("sanity_status") or "pending",
        sanity_details=row.get("sanity_details_json"),
        error_message=row.get("error_message"),
    )


def _existing_needs_rerun(existing: dict) -> bool:
    return existing.get("status") == "failed" or (
        existing.get("status") == "complete" and not existing.get("is_reusable", True)
    )


def _insufficient_credits_response() -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={
            "code": "insufficient_credits",
            "message": "You've used all your credits. Submit feedback to get more.",
        },
    )


async def _attach_user_to_analysis(user_id: str, analysis_id: str) -> dict:
    """Create or reuse the user's dashboard link through the atomic DB RPC."""
    try:
        return await papers_db.link_paper_and_consume_credit(
            proposed_paper_id=papers_db.generate_paper_id(),
            analysis_id=analysis_id,
            user_id=user_id,
        )
    except Exception as exc:
        logger.error("Could not attach user=%s to analysis=%s: %s", user_id, analysis_id, exc)
        raise HTTPException(status_code=503, detail="Paper database is temporarily unavailable")


async def _claim_analysis_rerun(analysis_id: str) -> bool:
    try:
        return await papers_db.reset_analysis_for_rerun(analysis_id)
    except Exception as exc:
        logger.error("Could not claim rerun for analysis=%s: %s", analysis_id, exc)
        raise HTTPException(status_code=503, detail="Paper database is temporarily unavailable")


async def mark_stale_papers_failed(stale_after_minutes: int = 15) -> int:
    """
    Background job: find analyses stuck in 'processing' for longer than
    stale_after_minutes and mark them as failed.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_after_minutes)
    marked = 0
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if not (url and key):
            return 0
        sb = create_client(url, key)
        resp = (
            sb.table("paper_analyses")
            .select("analysis_id, first_processed_at")
            .eq("status", "processing")
            .execute()
        )
        for row in (resp.data or []):
            ts = row.get("first_processed_at", "")
            processed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if processed < cutoff:
                await papers_db.update_analysis(
                    analysis_id=row["analysis_id"],
                    status="failed",
                    error_message=f"Processing timed out (stale > {stale_after_minutes} min)",
                )
                logger.warning("Marked stale analysis %s as failed", row["analysis_id"])
                marked += 1
    except Exception as exc:
        logger.error("mark_stale_papers_failed error: %s", exc)
    return marked


async def cleanup_failed_paper_entries(grace_minutes: int = 10) -> int:
    """Hide failed paper cards after a short grace period and refund charged links."""
    cleaned = await papers_db.cleanup_failed_user_papers(grace_minutes=grace_minutes)
    if cleaned:
        logger.info("Cleaned up %d failed paper entries older than %d min", cleaned, grace_minutes)
    return cleaned


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload-and-analyze", summary="Upload a PDF and start analysis")
async def upload_and_analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Upload a research paper PDF. Returns a paper_id immediately.
    Poll GET /api/papers/{paper_id} until status == 'complete'.

    Requires authentication and at least 1 credit for a paper not already on
    this user's dashboard.

    Deduplicates by SHA-256 content hash: if the same PDF was already analysed,
    the existing analysis is reused and no LLM calls are made.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 20 MB limit")
    if b"%PDF-" not in content[:1024]:
        raise HTTPException(status_code=400, detail="File content is not a valid PDF")

    user_id = current_user.id

    # ── Deduplication by content hash ────────────────────────────────────────
    content_hash = papers_db.compute_content_hash(content)
    detected_arxiv_id = _detect_arxiv_id_in_pdf(content)
    try:
        analysis, analysis_created = await papers_db.get_or_create_analysis(
            proposed_analysis_id=str(uuid.uuid4()),
            arxiv_id=detected_arxiv_id,
            content_hash=content_hash,
        )
    except Exception as exc:
        logger.error("Could not get/create analysis for upload: %s", exc)
        raise HTTPException(status_code=503, detail="Paper database is temporarily unavailable")

    analysis_id = analysis["analysis_id"]
    link = await _attach_user_to_analysis(user_id, analysis_id)
    if link["insufficient_credits"]:
        return _insufficient_credits_response()
    paper_id = link["paper_id"]

    if link["link_created"] and storage.is_configured():
        safe_filename = re.sub(r"[^A-Za-z0-9._-]+", "_", os.path.basename(file.filename))[:180]
        safe_filename = safe_filename or "paper.pdf"
        bucket_path = storage.upload_file(user_id, paper_id, safe_filename, content)
        if bucket_path:
            expires_at = storage.make_expires_at()
            from api.models.upload import UserUpload
            upload = UserUpload(
                upload_id=f"{paper_id}_pdf",
                user_id=user_id,
                filename=safe_filename,
                file_size_bytes=len(content),
                bucket_path=bucket_path,
                program_id=paper_id,
                uploaded_at=datetime.now(timezone.utc),
                expires_at=expires_at,
            )
            storage.save_upload_metadata(upload)

    should_run = analysis_created
    if not analysis_created and _existing_needs_rerun(analysis):
        should_run = await _claim_analysis_rerun(analysis_id)

    if should_run:
        background_tasks.add_task(llm_service.trigger_pipeline, analysis_id, paper_id, content)
        return {"paper_id": paper_id, "status": "processing"}

    logger.info("Reusing existing analysis %s for paper_id=%s", analysis_id, paper_id)
    return {"paper_id": paper_id, "status": analysis.get("status", "processing")}


@router.post("/arxiv-import", summary="Import a paper by arXiv URL or ID")
async def arxiv_import(
    background_tasks: BackgroundTasks,
    body: ArxivImportRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Accept an arXiv URL or bare arXiv ID, fetch the PDF from arxiv.org,
    then run the same analysis pipeline as upload-and-analyze.

    Requires authentication and at least 1 credit for a paper not already on
    this user's dashboard.

    Deduplicates by arXiv ID: if the paper was already analysed, no LLM calls
    are made and the existing results are returned immediately.

    Body: { "arxiv_url": "https://arxiv.org/abs/2301.07041" }
          or  { "arxiv_url": "2301.07041" }
    """
    raw_input = body.arxiv_url.strip()

    arxiv_id = _parse_arxiv_id_from_input(raw_input)
    if not arxiv_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not parse an arXiv ID from the input. "
                "Accepted formats: 2301.07041, arXiv:2301.07041, "
                "https://arxiv.org/abs/2301.07041"
            ),
        )

    user_id = current_user.id

    # ── Deduplication by arXiv ID ─────────────────────────────────────────────
    try:
        analysis, analysis_created = await papers_db.get_or_create_analysis(
            proposed_analysis_id=str(uuid.uuid4()),
            arxiv_id=arxiv_id,
        )
    except Exception as exc:
        logger.error("Could not get/create analysis for arXiv:%s: %s", arxiv_id, exc)
        raise HTTPException(status_code=503, detail="Paper database is temporarily unavailable")

    analysis_id = analysis["analysis_id"]
    link = await _attach_user_to_analysis(user_id, analysis_id)
    if link["insufficient_credits"]:
        return _insufficient_credits_response()
    paper_id = link["paper_id"]

    should_run = analysis_created
    if not analysis_created and _existing_needs_rerun(analysis):
        should_run = await _claim_analysis_rerun(analysis_id)

    if should_run:
        background_tasks.add_task(llm_service.trigger_arxiv_pipeline, analysis_id, paper_id, arxiv_id)
        logger.info("arXiv import queued for %s -> paper_id=%s", arxiv_id, paper_id)
        return {"paper_id": paper_id, "status": "processing", "arxiv_id": arxiv_id}

    logger.info("Reusing existing analysis %s for arXiv:%s", analysis_id, arxiv_id)
    return {
        "paper_id": paper_id,
        "status": analysis.get("status", "processing"),
        "arxiv_id": arxiv_id,
    }


@router.get("", summary="List papers for the current user")
async def list_papers(
    current_user: User = Depends(get_current_user),
) -> list[PaperSummary]:
    rows = await papers_db.list_user_papers(user_id=current_user.id)
    return [
        PaperSummary(
            paper_id=r.get("paper_id", ""),
            title=r.get("title"),
            authors=r.get("authors_json"),
            uploaded_at=r.get("uploaded_at", ""),
            status=r.get("status", "processing"),
        )
        for r in rows
    ]


@router.get("/{paper_id}", summary="Get paper results")
async def get_paper(
    paper_id: str,
    current_user: User = Depends(get_current_user),
) -> PaperRecord:
    row = await papers_db.get_paper(paper_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")
    return _db_row_to_record(row)


@router.post("/{paper_id}/rerun", summary="Rerun a failed or partial paper analysis")
async def rerun_paper(
    paper_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Reset and rerun the shared analysis behind this paper card.
    Does not consume credits. All users linked to the same analysis see updates.
    """
    row = await papers_db.get_paper(paper_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")

    analysis_id = row.get("analysis_id")
    if not analysis_id:
        raise HTTPException(status_code=400, detail="Paper analysis metadata is missing")

    if row.get("status") == "processing":
        return {"paper_id": paper_id, "status": "processing"}
    if row.get("status") == "complete":
        raise HTTPException(status_code=409, detail="This paper analysis is already complete")

    arxiv_id = row.get("arxiv_id")
    pdf_bytes = None
    if not arxiv_id:
        pdf_bytes = storage.download_pdf_for_paper(paper_id)
        if not pdf_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Original PDF is not available for rerun. "
                    "Upload the PDF again or import by arXiv ID."
                ),
            )

    claimed = await _claim_analysis_rerun(analysis_id)
    if not claimed:
        return {"paper_id": paper_id, "status": "processing"}
    if arxiv_id:
        background_tasks.add_task(llm_service.trigger_arxiv_pipeline, analysis_id, paper_id, arxiv_id)
    else:
        background_tasks.add_task(llm_service.trigger_pipeline, analysis_id, paper_id, pdf_bytes)
    logger.info("Rerun queued for paper_id=%s analysis_id=%s", paper_id, analysis_id)
    return {"paper_id": paper_id, "status": "processing"}


@router.get("/{paper_id}/pdf-url", summary="Get a signed URL to view the uploaded PDF")
async def get_pdf_url(
    paper_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Returns a URL to view the original uploaded PDF.
    Tries Supabase Storage first, then falls back to arXiv if the paper has an arxiv_id.
    """
    row = await papers_db.get_paper(paper_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")

    if storage.is_configured():
        sb = storage._client()
        if sb:
            try:
                resp = (
                    sb.table("user_uploads")
                    .select("bucket_path")
                    .eq("upload_id", f"{paper_id}_pdf")
                    .single()
                    .execute()
                )
                if resp.data:
                    url = storage.get_presigned_url(resp.data["bucket_path"])
                    if url:
                        return {"url": url, "source": "storage"}
            except Exception as exc:
                logger.debug("PDF signed URL lookup failed: %s", exc)

    if row.get("arxiv_id"):
        return {"url": f"https://arxiv.org/pdf/{row['arxiv_id']}", "source": "arxiv"}

    raise HTTPException(status_code=404, detail="PDF not available for this paper")


@router.delete("/{paper_id}", summary="Soft-delete a paper")
async def delete_paper(
    paper_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Soft-deletes a user's link to a paper by setting user_papers.deleted_at.
    The global paper_analyses row is preserved for other users.
    """
    row = await papers_db.get_paper(paper_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")

    ok = await papers_db.soft_delete_paper(paper_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete paper")

    return {"deleted": True, "paper_id": paper_id}


@router.get("/{paper_id}/notebook", summary="Download the generated Colab notebook (.ipynb)")
async def download_notebook(
    paper_id: str,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    Return the generated Jupyter notebook as a .ipynb file.
    Open the downloaded file in Google Colab (File → Open notebook → Upload)
    or run locally with: jupyter notebook
    """
    row = await papers_db.get_paper(paper_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")
    if row.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Paper analysis is not complete yet")

    notebook = row.get("notebook_json")
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not available for this paper")

    import json as _json
    title_raw = row.get("title") or paper_id
    safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title_raw)[:50].strip()
    filename = f"{safe_title}.ipynb"

    content = _json.dumps(notebook, indent=1)
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{paper_id}/download", summary="Download code scaffold as .zip")
async def download_zip(
    paper_id: str,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Return a .zip archive containing model.py, train.py, config.yaml, requirements.txt."""
    row = await papers_db.get_paper(paper_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")
    if row.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Paper analysis is not complete yet")

    scaffold = row.get("code_scaffold_json")
    if not scaffold:
        raise HTTPException(status_code=404, detail="No code scaffold available")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        file_map = {
            "model.py":        scaffold.get("model_py", ""),
            "train.py":        scaffold.get("train_py", ""),
            "config.yaml":     scaffold.get("config_yaml", ""),
            "requirements.txt": scaffold.get("requirements_txt", ""),
        }
        for filename, file_content in file_map.items():
            zf.writestr(filename, file_content)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="runpaper_{paper_id}.zip"'},
    )
