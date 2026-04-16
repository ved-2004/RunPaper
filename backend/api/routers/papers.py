"""
routers/papers.py

POST /api/papers/upload-and-analyze  — upload PDF, start full pipeline (background)
GET  /api/papers                     — list all papers
GET  /api/papers/{paper_id}          — get paper results (poll until complete)
GET  /api/papers/{paper_id}/download — download code scaffold as .zip
"""
from __future__ import annotations

import io
import logging
import re
import zipfile
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional as Opt

from api.services import papers_db
from api.services import trial_db
import api.services.storage as storage
from api.paper_extraction.pipeline import extract_paper
from api.paper_extraction.pdf_reader import extract_text_from_pdf
from api.code_generation.pipeline import generate_code
from api.reproducibility.pipeline import analyze_reproducibility
from api.flowchart.pipeline import generate_flowchart
from api.chat.faq import generate_faq

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/papers", tags=["papers"])

# ── arXiv ID detection ────────────────────────────────────────────────────────

_ARXIV_PATTERNS = [
    re.compile(r'arXiv[:\s]+(\d{4}\.\d{4,5}(?:v\d+)?)', re.IGNORECASE),
    re.compile(r'arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5}(?:v\d+)?)', re.IGNORECASE),
]


def _detect_arxiv_id(text: str) -> Optional[str]:
    """Search raw PDF text for an arXiv identifier like 2201.11903."""
    for pattern in _ARXIV_PATTERNS:
        m = pattern.search(text)
        if m:
            # Strip version suffix (v1, v2 …) for a stable URL
            return m.group(1).split("v")[0]
    return None

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


# ── Response models ────────────────────────────────────────────────────────────

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
        error_message=row.get("error_message"),
    )


# ── Background pipeline ────────────────────────────────────────────────────────

async def _run_pipeline(paper_id: str, pdf_bytes: bytes) -> None:
    """
    Full analysis pipeline runs in the background:
    1. Extract structured metadata from PDF
    2. Generate Python code scaffold
    3. Analyze reproducibility
    4. Save all results to DB
    """
    logger.info("Pipeline starting for paper %s", paper_id)
    try:
        # Step 1: Extract paper metadata
        extraction = await extract_paper(pdf_bytes)

        # Step 2: Generate code scaffold
        code_scaffold = await generate_code(extraction)

        # Step 3: Reproducibility analysis
        paper_text = extract_text_from_pdf(pdf_bytes)
        reproducibility = await analyze_reproducibility(extraction, paper_text)

        # Detect arXiv ID from raw text for PDF fallback
        arxiv_id = _detect_arxiv_id(paper_text)
        if arxiv_id:
            logger.info("Detected arXiv ID: %s", arxiv_id)

        # Step 4: Flowchart + code annotations (Learn tab)
        flowchart = await generate_flowchart(extraction, code_scaffold)

        # Step 5: Pre-generate FAQ (served instantly in chat tab)
        faq = await generate_faq(extraction, code_scaffold)

        await papers_db.update_paper(
            paper_id=paper_id,
            status="complete",
            title=extraction.get("title"),
            authors_json=extraction.get("authors"),
            arxiv_id=arxiv_id,
            extraction_json=extraction,
            code_scaffold_json=code_scaffold,
            reproducibility_json=reproducibility,
            flowchart_json=flowchart,
            faq_json=faq,
        )
        logger.info("Pipeline complete for paper %s", paper_id)

    except Exception as exc:
        logger.error("Pipeline failed for paper %s: %s", paper_id, exc, exc_info=True)
        await papers_db.update_paper(
            paper_id=paper_id,
            status="failed",
            error_message=str(exc),
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload-and-analyze", summary="Upload a PDF and start analysis")
async def upload_and_analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_trial_id: Opt[str] = Header(None, alias="X-Trial-ID"),
) -> dict:
    """
    Upload a research paper PDF. Returns a paper_id immediately.
    Poll GET /api/papers/{paper_id} until status == 'complete'.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    # ── Trial gate ────────────────────────────────────────────────────────────
    # Signed-in users (future: pass JWT user_id) bypass this entirely.
    # Anonymous users must supply X-Trial-ID and have uploads remaining.
    if x_trial_id:
        allowed = await trial_db.check_and_consume(x_trial_id)
        if not allowed:
            return JSONResponse(
                status_code=403,
                content={"code": "trial_exhausted", "message": "Free trial used. Sign in to continue."},
            )

    paper_id = papers_db.generate_paper_id()

    # Save to Supabase Storage if configured
    if storage.is_configured():
        bucket_path = storage.upload_file(
            "anonymous", paper_id, file.filename, content
        )
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

    await papers_db.create_paper(user_id=None, paper_id=paper_id, trial_id=x_trial_id)

    background_tasks.add_task(_run_pipeline, paper_id, content)

    return {"paper_id": paper_id, "status": "processing"}


@router.get("", summary="List all papers")
async def list_papers() -> list[PaperSummary]:
    rows = await papers_db.list_user_papers(user_id=None)
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
    Soft-deletes a paper by setting deleted_at. The row is never removed from the DB.
    Returns 404 if paper doesn't exist, 204-equivalent dict on success.
    """
    row = await papers_db.get_paper(paper_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")

    ok = await papers_db.soft_delete_paper(paper_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete paper")

    return {"deleted": True, "paper_id": paper_id}


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
            "model.py": scaffold.get("model_py", ""),
            "train.py": scaffold.get("train_py", ""),
            "config.yaml": scaffold.get("config_yaml", ""),
            "requirements.txt": scaffold.get("requirements_txt", ""),
        }
        for filename, content in file_map.items():
            zf.writestr(filename, content)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="runpaper_{paper_id}.zip"'},
    )
