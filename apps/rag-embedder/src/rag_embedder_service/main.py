from __future__ import annotations

import math
import os
import re
import unicodedata
from functools import lru_cache
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

STUB_EMBEDDING_DIMENSION = 1024
STUB_MODEL = "stub/hash-v1"
BGE_MODEL = "BAAI/bge-m3"
BGE_SMALL_MODEL = "BAAI/bge-small-en-v1.5"
BGE_BASE_MODEL = "BAAI/bge-base-en-v1.5"
LOCAL_BGE_DIMENSIONS = {
    BGE_SMALL_MODEL: 384,
    BGE_BASE_MODEL: 768,
    BGE_MODEL: 1024,
}
EmbedderMode = Literal["stub", "local"]

_TOKEN_PATTERN = re.compile(r"[\w]+", re.UNICODE)


class EmbeddingsRequest(BaseModel):
    model: str = BGE_BASE_MODEL
    input: str | list[str]


class EmbeddingObject(BaseModel):
    object: Literal["embedding"] = "embedding"
    embedding: list[float]
    index: int


class EmbeddingsResponse(BaseModel):
    object: Literal["list"] = "list"
    data: list[EmbeddingObject]
    model: str
    usage: dict[str, int] = Field(default_factory=lambda: {"prompt_tokens": 0, "total_tokens": 0})


app = FastAPI(title="Khanect RAG Embedder", version="0.1.0")


def _mode() -> EmbedderMode:
    raw = os.getenv("EMBEDDER_MODE", "stub").strip().lower()
    return "local" if raw in {"local", "fastembed", "bge", "bge-v1.5", "bge-m3", "bge_m3"} else "stub"


def _configured_model_name() -> str:
    return os.getenv("EMBEDDING_MODEL", BGE_BASE_MODEL).strip() or BGE_BASE_MODEL


def _dimension_for_model(model_name: str) -> int:
    return LOCAL_BGE_DIMENSIONS.get(model_name, STUB_EMBEDDING_DIMENSION if model_name == STUB_MODEL else 0)


def _active_dimension() -> int:
    return _dimension_for_model(_active_model_name())


def embed_text_stub_hash_v1(text: str) -> list[float]:
    return embed_text_stub_hash(text, STUB_EMBEDDING_DIMENSION)


def embed_text_stub_hash(text: str, dimension: int) -> list[float]:
    buckets = [0.0] * dimension
    normalized = unicodedata.normalize("NFKC", text).lower().strip()
    tokens = _TOKEN_PATTERN.findall(normalized) or [normalized]

    for token in tokens:
        hash_value = 2166136261
        for char in token:
            hash_value ^= ord(char)
            hash_value = (hash_value * 16777619) & 0xFFFFFFFF
        bucket = hash_value % dimension
        sign = 1 if (hash_value & 1) == 0 else -1
        buckets[bucket] += sign * max(1.0, len(token) / 8.0)

    magnitude = math.sqrt(sum(value * value for value in buckets)) or 1.0
    return [round(value / magnitude, 8) for value in buckets]


@lru_cache(maxsize=1)
def _load_bge_model(model_name: str) -> Any:
    try:
        from fastembed import TextEmbedding
    except ImportError as error:
        raise RuntimeError("fastembed is not installed; use EMBEDDER_MODE=stub or install [bge] extras") from error

    return TextEmbedding(model_name=model_name)


def _embed_local_bge(texts: list[str], model_name: str) -> list[list[float]]:
    expected_dimension = _dimension_for_model(model_name)
    if not expected_dimension:
        raise RuntimeError(f"unsupported local embedding model: {model_name}")

    model = _load_bge_model(model_name)
    vectors = list(model.embed(texts))
    result: list[list[float]] = []
    for vector in vectors:
        if len(vector) != expected_dimension:
            raise RuntimeError(f"expected {expected_dimension}-dimension vectors from {model_name}; received {len(vector)}")
        result.append([float(value) for value in vector])
    return result


def _normalize_inputs(raw: str | list[str]) -> list[str]:
    if isinstance(raw, str):
        return [raw.replace("\n", " ").strip()]
    return [value.replace("\n", " ").strip() for value in raw]


def _active_model_name() -> str:
    return _configured_model_name() if _mode() == "local" else STUB_MODEL


@app.get("/health")
def health() -> dict[str, str | int]:
    return {
        "status": "ok",
        "runtime": "rag-embedder",
        "mode": _mode(),
        "model": _active_model_name(),
        "dimension": _active_dimension(),
    }


@app.post("/v1/embeddings", response_model=EmbeddingsResponse)
def create_embeddings(body: EmbeddingsRequest) -> EmbeddingsResponse:
    texts = [text for text in _normalize_inputs(body.input) if text]
    if not texts:
        raise HTTPException(status_code=400, detail="input must include at least one non-empty string")

    mode = _mode()
    requested_model = body.model or _active_model_name()
    try:
        if mode == "local":
            model_name = requested_model
            embeddings = _embed_local_bge(texts, model_name)
        else:
            dimension = _dimension_for_model(requested_model) or STUB_EMBEDDING_DIMENSION
            embeddings = [embed_text_stub_hash(text, dimension) for text in texts]
            model_name = requested_model if requested_model in LOCAL_BGE_DIMENSIONS else STUB_MODEL
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return EmbeddingsResponse(
        data=[EmbeddingObject(embedding=embedding, index=index) for index, embedding in enumerate(embeddings)],
        model=model_name,
        usage={"prompt_tokens": sum(len(text.split()) for text in texts), "total_tokens": sum(len(text.split()) for text in texts)},
    )
