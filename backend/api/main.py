"""
backend/api/main.py

RunPaper FastAPI application.

Endpoints:
  GET  /api/health       — Health check
  POST /api/papers/upload-and-analyze — Upload PDF, start analysis pipeline
  GET  /api/papers       — List user's papers
  GET  /api/papers/{id}  — Get paper results
  GET  /auth/google      — Google OAuth2 sign-in
  ...
"""

from __future__ import annotations
import collections
import logging
import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.monitoring import request_id_var, generate_request_id, setup_logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

setup_logging()


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Start the daily cleanup scheduler on startup; stop it on shutdown."""
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from api.routers.uploads import cleanup_expired

        scheduler = AsyncIOScheduler()
        scheduler.add_job(cleanup_expired, "interval", hours=24, id="cleanup_expired_uploads")
        scheduler.start()
        logger.info("APScheduler started — expired-upload cleanup runs every 24 h.")
        yield
        scheduler.shutdown(wait=False)
    except ImportError:
        logger.warning("apscheduler not installed — skipping scheduled cleanup.")
        yield


app = FastAPI(
    title="RunPaper API",
    description="Upload a research paper, get runnable Python code.",
    version="1.0.0",
    lifespan=_lifespan,
)

# Auth — Google OAuth2 + JWT
from api.routers import auth as auth_router
app.include_router(auth_router.router)

# Uploads — cloud storage metadata + TTL management
from api.routers import uploads as uploads_router
app.include_router(uploads_router.router)

# RAG layer (paper chunks retrieval)
from api.routers import rag as rag_router
app.include_router(rag_router.router)

# Papers — PDF upload, analysis pipeline, results
from api.routers import papers as papers_router
app.include_router(papers_router.router)

# Chat — live Q&A + pre-generated FAQ over paper context
from api.routers import chat as chat_router
app.include_router(chat_router.router)

_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:4173",
    *(
        [os.environ["FRONTEND_URL"]]
        if os.environ.get("FRONTEND_URL")
        else []
    ),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Rate Limiting ────────────────────────────────────────────────────────────

_RATE_LIMIT_WINDOW = 60
_RATE_LIMIT_MAX_REQUESTS = 30
_rate_limit_store: dict[str, collections.deque] = {}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path == "/api/health":
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = _rate_limit_store.setdefault(client_ip, collections.deque())

    while window and window[0] < now - _RATE_LIMIT_WINDOW:
        window.popleft()

    if len(window) >= _RATE_LIMIT_MAX_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
            headers={"Retry-After": str(_RATE_LIMIT_WINDOW)},
        )

    window.append(now)
    return await call_next(request)


# ─── Monitoring Middleware ─────────────────────────────────────────────────────

@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    rid = generate_request_id()
    request_id_var.set(rid)

    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 2)

    response.headers["X-Request-ID"] = rid

    logger.info(
        "method=%s path=%s status=%s duration_ms=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    llm_provider = os.environ.get("LLM_PROVIDER", "anthropic")
    api_key_vars = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "gemini": "GEMINI_API_KEY",
    }
    key_var = api_key_vars.get(llm_provider, "ANTHROPIC_API_KEY")
    return {
        "status": "ok",
        "version": "1.0.0",
        "app": "RunPaper",
        "llm_provider": llm_provider,
        "api_key_configured": bool(os.environ.get(key_var)),
    }
