from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api.main import app
from api.models.user import User
from api.rate_limiter import _route_key, client_ip_from_forwarded
from api.routers.auth import _frontend_callback_url, get_current_user
from api.routers.chat import ChatMessage, ChatRequest, ExplainRequest
from api.routers.papers import _detect_arxiv_id_in_pdf
from api.services import llm_service, papers_db


def _test_user() -> User:
    return User(
        id="00000000-0000-0000-0000-000000000001",
        google_id="google-a",
        email="a@example.com",
        name="User A",
    )


def test_oauth_callback_uses_fragment_not_query_string() -> None:
    url = _frontend_callback_url("token/with spaces")
    assert "?token=" not in url
    assert "#token=token%2Fwith%20spaces" in url


def test_forwarded_ip_uses_load_balancer_appended_client_hop() -> None:
    assert client_ip_from_forwarded("spoofed, 203.0.113.8, 10.0.0.1", "fallback") == "203.0.113.8"
    assert client_ip_from_forwarded("203.0.113.8", "fallback") == "203.0.113.8"
    assert client_ip_from_forwarded("", "fallback") == "fallback"


def test_costly_routes_have_dedicated_rate_limits() -> None:
    assert _route_key("/api/papers/arxiv-import", "POST") == ("analysis", 5, 3600)
    assert _route_key("/api/papers/ABC/rerun", "POST") == ("analysis", 5, 3600)
    assert _route_key("/api/papers/ABC/explain", "POST") == ("llm_interaction", 20, 60)


def test_chat_and_explain_payloads_are_bounded() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(message="hello", history=[ChatMessage(role="user", content="x")] * 21)
    with pytest.raises(ValidationError):
        ChatRequest(message="x" * 4001)
    with pytest.raises(ValidationError):
        ExplainRequest(item_type="unknown", item_label="x", item_content="x")


def test_upload_rejects_non_pdf_content_before_database_work() -> None:
    app.dependency_overrides[get_current_user] = _test_user
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/papers/upload-and-analyze",
                files={"file": ("paper.pdf", b"this is not a pdf", "application/pdf")},
            )
        assert response.status_code == 400
        assert response.json()["detail"] == "File content is not a valid PDF"
    finally:
        app.dependency_overrides.clear()


def test_pdf_header_arxiv_detection_supports_cross_path_deduplication() -> None:
    import fitz

    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "BERT research paper\narXiv:1810.04805v2 [cs.CL]")
    content = document.tobytes()
    document.close()

    assert _detect_arxiv_id_in_pdf(content) == "1810.04805"


class _Response:
    def __init__(self, data):
        self.data = data


class _RpcCall:
    def __init__(self, data):
        self._data = data

    def execute(self):
        return _Response(self._data)


class _FakeSupabase:
    def __init__(self, responses: dict[str, object]):
        self.responses = responses
        self.calls: list[tuple[str, dict]] = []

    def rpc(self, name: str, params: dict):
        self.calls.append((name, params))
        return _RpcCall(self.responses[name])


def test_paper_submission_uses_atomic_database_rpcs(monkeypatch) -> None:
    fake = _FakeSupabase(
        {
            "get_or_create_paper_analysis": [
                {
                    "result_analysis_id": "00000000-0000-0000-0000-000000000010",
                    "result_status": "complete",
                    "result_code_scaffold": {"model_py": "x", "train_py": "x", "config_yaml": "x", "requirements_txt": "x"},
                    "result_flowchart": {"nodes": [{"id": "x"}]},
                    "result_created": False,
                }
            ],
            "link_paper_and_consume_credit": [
                {
                    "result_paper_id": "PAPER123",
                    "result_link_created": True,
                    "result_insufficient_credits": False,
                }
            ],
        }
    )
    monkeypatch.setattr(papers_db, "_client", lambda: fake)

    analysis, created = asyncio.run(
        papers_db.get_or_create_analysis(
            "00000000-0000-0000-0000-000000000099",
            content_hash="abc",
        )
    )
    link = asyncio.run(
        papers_db.link_paper_and_consume_credit(
            "PROPOSED",
            analysis["analysis_id"],
            "00000000-0000-0000-0000-000000000001",
        )
    )

    assert created is False
    assert analysis["is_reusable"] is True
    assert link == {
        "paper_id": "PAPER123",
        "link_created": True,
        "insufficient_credits": False,
    }
    assert [name for name, _ in fake.calls] == [
        "get_or_create_paper_analysis",
        "link_paper_and_consume_credit",
    ]


def test_rerun_claim_and_failed_cleanup_use_scalar_rpcs(monkeypatch) -> None:
    fake = _FakeSupabase(
        {
            "claim_analysis_rerun": True,
            "cleanup_failed_paper_entries": 3,
        }
    )
    monkeypatch.setattr(papers_db, "_client", lambda: fake)

    claimed = asyncio.run(
        papers_db.reset_analysis_for_rerun("00000000-0000-0000-0000-000000000010")
    )
    cleaned = asyncio.run(papers_db.cleanup_failed_user_papers(10))

    assert claimed is True
    assert cleaned == 3


def test_rejected_llm_trigger_marks_analysis_failed(monkeypatch) -> None:
    updates: list[dict] = []

    async def fake_update_analysis(**kwargs):
        updates.append(kwargs)

    monkeypatch.setattr(papers_db, "update_analysis", fake_update_analysis)
    asyncio.run(llm_service._mark_trigger_failed("analysis-1"))

    assert updates == [{
        "analysis_id": "analysis-1",
        "status": "failed",
        "error_message": "Analysis service is temporarily unavailable. Please rerun the paper.",
    }]
