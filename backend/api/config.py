"""Runtime configuration validation."""
from __future__ import annotations

import os
from collections.abc import Mapping
from urllib.parse import urlparse


_PRODUCTION_REQUIRED = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_BUCKET",
    "LLM_SERVICE_URL",
    "LLM_SERVICE_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "JWT_SECRET",
    "BACKEND_URL",
    "FRONTEND_URL",
)

_PLACEHOLDER_MARKERS = ("change-me", "your-", "<password>", "example.com")


def _is_https_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def validate_runtime_config(environ: Mapping[str, str] | None = None) -> None:
    """Reject incomplete or unsafe configuration when running in production."""
    env = os.environ if environ is None else environ
    if env.get("ENVIRONMENT", "development").strip().lower() != "production":
        return

    problems: list[str] = []
    for name in _PRODUCTION_REQUIRED:
        value = env.get(name, "").strip()
        if not value:
            problems.append(f"{name} is missing")
        elif any(marker in value.lower() for marker in _PLACEHOLDER_MARKERS):
            problems.append(f"{name} still contains a placeholder")

    if len(env.get("JWT_SECRET", "")) < 32:
        problems.append("JWT_SECRET must be at least 32 characters")
    if len(env.get("LLM_SERVICE_KEY", "")) < 32:
        problems.append("LLM_SERVICE_KEY must be at least 32 characters")

    for name in ("SUPABASE_URL", "LLM_SERVICE_URL", "BACKEND_URL", "FRONTEND_URL"):
        value = env.get(name, "").strip()
        if value and not _is_https_url(value):
            problems.append(f"{name} must be an https URL in production")

    if problems:
        raise RuntimeError("Invalid production configuration: " + "; ".join(problems))
