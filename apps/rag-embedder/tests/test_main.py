from fastapi.testclient import TestClient

import rag_embedder_service.main as embedder_main
from rag_embedder_service.main import app, embed_text_stub_hash_v1

client = TestClient(app)


def test_health_reports_stub_mode_by_default(monkeypatch) -> None:
    monkeypatch.delenv("EMBEDDER_MODE", raising=False)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["mode"] == "stub"


def test_embeddings_returns_openai_compatible_shape() -> None:
    response = client.post("/v1/embeddings", json={"model": "BAAI/bge-base-en-v1.5", "input": ["Marina Heights pet policy"]})
    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "BAAI/bge-base-en-v1.5"
    assert len(payload["data"]) == 1
    assert len(payload["data"][0]["embedding"]) == 768


def test_stub_embedding_is_deterministic() -> None:
    first = embed_text_stub_hash_v1("Dubai Marina approved FAQ")
    second = embed_text_stub_hash_v1("Dubai Marina approved FAQ")
    assert first == second


def test_health_reports_local_bge_mode(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDER_MODE", "local")
    monkeypatch.setenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["mode"] == "local"
    assert response.json()["model"] == "BAAI/bge-small-en-v1.5"
    assert response.json()["dimension"] == 384


def test_embeddings_use_local_bge_vectors(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDER_MODE", "local")
    embedder_main._load_bge_model.cache_clear()

    class FakeModel:
        def embed(self, texts):
            return [[0.25] * 384 for _ in texts]

    monkeypatch.setattr(embedder_main, "_load_bge_model", lambda _model_name: FakeModel())
    response = client.post("/v1/embeddings", json={"model": "BAAI/bge-small-en-v1.5", "input": ["Marina Heights pet policy"]})
    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "BAAI/bge-small-en-v1.5"
    assert len(payload["data"][0]["embedding"]) == 384


def test_embeddings_reject_empty_input() -> None:
    response = client.post("/v1/embeddings", json={"input": ["   "]})
    assert response.status_code == 400
