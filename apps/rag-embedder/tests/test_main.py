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
    response = client.post("/v1/embeddings", json={"model": "BAAI/bge-m3", "input": ["Marina Heights pet policy"]})
    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "stub/hash-v1"
    assert len(payload["data"]) == 1
    assert len(payload["data"][0]["embedding"]) == 1024


def test_stub_embedding_is_deterministic() -> None:
    first = embed_text_stub_hash_v1("Dubai Marina approved FAQ")
    second = embed_text_stub_hash_v1("Dubai Marina approved FAQ")
    assert first == second


def test_health_reports_bge_mode(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDER_MODE", "bge-m3")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["mode"] == "bge-m3"
    assert response.json()["model"] == "BAAI/bge-m3"


def test_embeddings_use_bge_m3_vectors(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDER_MODE", "bge-m3")
    embedder_main._load_bge_model.cache_clear()

    class FakeModel:
        def encode(self, texts, batch_size=12, max_length=8192):
            return {"dense_vecs": [[0.25] * 1024 for _ in texts]}

    monkeypatch.setattr(embedder_main, "_load_bge_model", lambda: FakeModel())
    response = client.post("/v1/embeddings", json={"input": ["Marina Heights pet policy"]})
    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "BAAI/bge-m3"
    assert len(payload["data"][0]["embedding"]) == 1024