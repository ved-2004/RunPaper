from __future__ import annotations

from fastapi.testclient import TestClient

from api.config import validate_runtime_config
from api.main import app
from api.models.user import User
from api.routers.auth import _create_jwt, _verify_jwt, get_current_user
from api.services import papers_db


def test_production_config_rejects_missing_values() -> None:
    try:
        validate_runtime_config({"ENVIRONMENT": "production"})
    except RuntimeError as exc:
        message = str(exc)
        assert "JWT_SECRET is missing" in message
        assert "LLM_SERVICE_KEY is missing" in message
    else:
        raise AssertionError("production configuration should fail closed")


def test_development_config_allows_local_defaults() -> None:
    validate_runtime_config({"ENVIRONMENT": "development"})


def test_jwt_round_trip() -> None:
    assert _verify_jwt(_create_jwt("user-a")) == "user-a"


def test_paper_and_rag_routes_are_not_public() -> None:
    with TestClient(app) as client:
        requests = (
            ("GET", "/api/papers", None),
            ("GET", "/api/papers/example", None),
            ("GET", "/api/papers/example/pdf-url", None),
            ("GET", "/api/papers/example/notebook", None),
            ("GET", "/api/papers/example/download", None),
            ("DELETE", "/api/papers/example", None),
            ("POST", "/api/papers/example/rerun", None),
            ("POST", "/api/papers/example/chat", {"message": "hello"}),
            (
                "POST",
                "/api/papers/example/explain",
                {"item_type": "equation", "item_label": "x", "item_content": "x"},
            ),
        )
        for method, path, body in requests:
            response = client.request(method, path, json=body)
            assert response.status_code == 401, (method, path, response.text)

        assert client.get("/api/rag/status").status_code == 404
        assert client.delete("/api/rag/index").status_code == 404


def test_paper_lookup_is_scoped_to_current_user(monkeypatch) -> None:
    current_user = User(
        id="user-a",
        google_id="google-a",
        email="a@example.com",
        name="User A",
    )
    calls: list[tuple[str, str]] = []

    async def fake_get_paper(paper_id: str, user_id: str):
        calls.append((paper_id, user_id))
        return None

    app.dependency_overrides[get_current_user] = lambda: current_user
    monkeypatch.setattr(papers_db, "get_paper", fake_get_paper)
    try:
        with TestClient(app) as client:
            response = client.get("/api/papers/someone-elses-paper")
        assert response.status_code == 404
        assert calls == [("someone-elses-paper", "user-a")]
    finally:
        app.dependency_overrides.clear()
