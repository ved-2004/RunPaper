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
  and the new user_papers row is linked to the existing analysis immediately.
  If the analysis is 'processing', the new row is still created and the user polls
  the same underlying analysis. If 'failed', the analysis is reset and re-run.

Paper limit:
  Signed-in users are limited to max_papers (default 5). Exceeding this returns
  403 {"code": "paper_limit_reached", "limit": N}.
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

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional as Opt

from api.services import papers_db
from api.services import trial_db
from api.services import llm_service
import api.services.storage as storage
from api.routers.auth import get_optional_user
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


MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


# ── Response models ───────────────────────────────────────────────────────────

class PaperRecord(BaseModel):
    paper_id: str
    arxiv_id: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[list[str]] = None
    uploaded_at: str
    status: str
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
    status: str


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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload-and-analyze", summary="Upload a PDF and start analysis")
async def upload_and_analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_trial_id: Opt[str] = Header(None, alias="X-Trial-ID"),
    current_user: Optional[User] = Depends(get_optional_user),
) -> dict:
    """
    Upload a research paper PDF. Returns a paper_id immediately.
    Poll GET /api/papers/{paper_id} until status == 'complete'.

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
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit")

    user_id = current_user.id if current_user else None

    # ── Trial gate (anonymous users only) ────────────────────────────────────
    if not user_id and x_trial_id:
        allowed = await trial_db.check_and_consume(x_trial_id)
        if not allowed:
            return JSONResponse(
                status_code=403,
                content={"code": "trial_exhausted", "message": "Free trial used. Sign in to continue."},
            )

    # ── Paper limit (signed-in users) ────────────────────────────────────────
    if user_id:
        count = await papers_db.count_user_papers(user_id)
        max_papers = await papers_db.get_user_max_papers(user_id)
        if count >= max_papers:
            return JSONResponse(
                status_code=403,
                content={
                    "code": "paper_limit_reached",
                    "limit": max_papers,
                    "message": f"You've reached your {max_papers}-paper limit. Reach out to increase it.",
                },
            )

    # ── Deduplication by content hash ────────────────────────────────────────
    content_hash = papers_db.compute_content_hash(content)
    existing = await papers_db.find_existing_analysis(content_hash=content_hash)
    paper_id = papers_db.generate_paper_id()

    if existing:
        analysis_id = existing["analysis_id"]
        analysis_status = existing["status"]
        await papers_db.increment_request_count(analysis_id)
        await papers_db.create_user_paper(
            paper_id, analysis_id, user_id=user_id, trial_id=x_trial_id,
        )
        if analysis_status == "failed":
            # Reset and re-run
            await papers_db.update_analysis(
                analysis_id=analysis_id, status="processing", error_message=None,
            )
            background_tasks.add_task(llm_service.trigger_pipeline, analysis_id, paper_id, content)
            return {"paper_id": paper_id, "status": "processing"}
        logger.info("Reusing existing analysis %s for paper_id=%s", analysis_id, paper_id)
        return {"paper_id": paper_id, "status": analysis_status}

    # ── New analysis ──────────────────────────────────────────────────────────
    analysis_id = str(uuid.uuid4())
    await papers_db.create_analysis(analysis_id, content_hash=content_hash)
    await papers_db.create_user_paper(
        paper_id, analysis_id, user_id=user_id, trial_id=x_trial_id,
    )

    if storage.is_configured():
        bucket_path = storage.upload_file("anonymous", paper_id, file.filename, content)
        if bucket_path:
            expires_at = storage.make_expires_at()
            from api.models.upload import UserUpload
            upload = UserUpload(
                upload_id=f"{paper_id}_pdf",
                user_id=None,
                filename=file.filename,
                file_size_bytes=len(content),
                bucket_path=bucket_path,
                program_id=paper_id,
                uploaded_at=datetime.now(timezone.utc),
                expires_at=expires_at,
            )
            storage.save_upload_metadata(upload)

    background_tasks.add_task(llm_service.trigger_pipeline, analysis_id, paper_id, content)
    return {"paper_id": paper_id, "status": "processing"}


@router.post("/arxiv-import", summary="Import a paper by arXiv URL or ID")
async def arxiv_import(
    background_tasks: BackgroundTasks,
    body: dict = Body(...),
    x_trial_id: Opt[str] = Header(None, alias="X-Trial-ID"),
    current_user: Optional[User] = Depends(get_optional_user),
) -> dict:
    """
    Accept an arXiv URL or bare arXiv ID, fetch the PDF from arxiv.org,
    then run the same analysis pipeline as upload-and-analyze.

    Deduplicates by arXiv ID: if the paper was already analysed, no LLM calls
    are made and the existing results are returned immediately.

    Body: { "arxiv_url": "https://arxiv.org/abs/2301.07041" }
          or  { "arxiv_url": "2301.07041" }
    """
    raw_input = (body.get("arxiv_url") or "").strip()
    if not raw_input:
        raise HTTPException(status_code=400, detail="arxiv_url is required")

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

    user_id = current_user.id if current_user else None

    # ── Trial gate ────────────────────────────────────────────────────────────
    if not user_id and x_trial_id:
        allowed = await trial_db.check_and_consume(x_trial_id)
        if not allowed:
            return JSONResponse(
                status_code=403,
                content={"code": "trial_exhausted", "message": "Free trial used. Sign in to continue."},
            )

    # ── Paper limit ───────────────────────────────────────────────────────────
    if user_id:
        count = await papers_db.count_user_papers(user_id)
        max_papers = await papers_db.get_user_max_papers(user_id)
        if count >= max_papers:
            return JSONResponse(
                status_code=403,
                content={
                    "code": "paper_limit_reached",
                    "limit": max_papers,
                    "message": f"You've reached your {max_papers}-paper limit. Reach out to increase it.",
                },
            )

    # ── Deduplication by arXiv ID ─────────────────────────────────────────────
    existing = await papers_db.find_existing_analysis(arxiv_id=arxiv_id)
    paper_id = papers_db.generate_paper_id()

    if existing:
        analysis_id = existing["analysis_id"]
        analysis_status = existing["status"]
        await papers_db.increment_request_count(analysis_id)
        await papers_db.create_user_paper(
            paper_id, analysis_id, user_id=user_id, trial_id=x_trial_id,
        )
        if analysis_status == "failed":
            await papers_db.update_analysis(
                analysis_id=analysis_id, status="processing", error_message=None,
            )
            background_tasks.add_task(llm_service.trigger_arxiv_pipeline, analysis_id, paper_id, arxiv_id)
            return {"paper_id": paper_id, "status": "processing", "arxiv_id": arxiv_id}
        logger.info("Reusing existing analysis %s for arXiv:%s", analysis_id, arxiv_id)
        return {"paper_id": paper_id, "status": analysis_status, "arxiv_id": arxiv_id}

    # ── New analysis: delegate fetch + pipeline to LLM service ───────────────
    # The LLM service fetches the PDF from arXiv itself, so the main backend
    # never needs to handle the PDF bytes for arXiv imports.
    analysis_id = str(uuid.uuid4())
    await papers_db.create_analysis(analysis_id, arxiv_id=arxiv_id)
    await papers_db.create_user_paper(
        paper_id, analysis_id, user_id=user_id, trial_id=x_trial_id,
    )

    background_tasks.add_task(llm_service.trigger_arxiv_pipeline, analysis_id, paper_id, arxiv_id)
    logger.info("arXiv import queued for %s → paper_id=%s", arxiv_id, paper_id)
    return {"paper_id": paper_id, "status": "processing", "arxiv_id": arxiv_id}


@router.get("", summary="List papers for the current user")
async def list_papers(
    current_user: Optional[User] = Depends(get_optional_user),
) -> list[PaperSummary]:
    user_id = current_user.id if current_user else None
    rows = await papers_db.list_user_papers(user_id=user_id)
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
async def get_paper(paper_id: str) -> PaperRecord:
    row = await papers_db.get_paper(paper_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")
    return _db_row_to_record(row)


@router.get("/{paper_id}/pdf-url", summary="Get a signed URL to view the uploaded PDF")
async def get_pdf_url(paper_id: str) -> dict:
    """
    Returns a URL to view the original uploaded PDF.
    Tries Supabase Storage first, then falls back to arXiv if the paper has an arxiv_id.
    """
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

    row = await papers_db.get_paper(paper_id)
    if row and row.get("arxiv_id"):
        return {"url": f"https://arxiv.org/pdf/{row['arxiv_id']}", "source": "arxiv"}

    raise HTTPException(status_code=404, detail="PDF not available for this paper")


@router.delete("/{paper_id}", summary="Soft-delete a paper")
async def delete_paper(paper_id: str) -> dict:
    """
    Soft-deletes a user's link to a paper by setting user_papers.deleted_at.
    The global paper_analyses row is preserved for other users.
    """
    row = await papers_db.get_paper(paper_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")

    ok = await papers_db.soft_delete_paper(paper_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete paper")

    return {"deleted": True, "paper_id": paper_id}


@router.get("/{paper_id}/notebook", summary="Download the generated Colab notebook (.ipynb)")
async def download_notebook(paper_id: str) -> StreamingResponse:
    """
    Return the generated Jupyter notebook as a .ipynb file.
    Open the downloaded file in Google Colab (File → Open notebook → Upload)
    or run locally with: jupyter notebook
    """
    row = await papers_db.get_paper(paper_id)
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
async def download_zip(paper_id: str) -> StreamingResponse:
    """Return a .zip archive containing model.py, train.py, config.yaml, requirements.txt."""
    row = await papers_db.get_paper(paper_id)
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
