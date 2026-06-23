from __future__ import annotations

import math
import os
import re
import unicodedata
from functools import lru_cache
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

EMBEDDING_DIMENSION = 1024
STUB_MODEL = "stub/hash-v1"
BGE_MODEL = "BAAI/bge-m3"
EmbedderMode = Literal["stub", "bge-m3"]

_TOKEN_PATTERN = re.compile(r"[\w]+", re.UNICODE)


class EmbeddingsRequest(BaseModel):
    model: str = BGE_MODEL
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
    return "bge-m3" if raw in {"bge-m3", "bge_m3", "bge"} else "stub"


def embed_text_stub_hash_v1(text: str) -> list[float]:
    buckets = [0.0] * EMBEDDING_DIMENSION
    normalized = unicodedata.normalize("NFKC", text).lower().strip()
    tokens = _TOKEN_PATTERN.findall(normalized) or [normalized]

    for token in tokens:
        hash_value = 2166136261
        for char in token:
            hash_value ^= ord(char)
            hash_value = (hash_value * 16777619) & 0xFFFFFFFF
        bucket = hash_value % EMBEDDING_DIMENSION
        sign = 1 if (hash_value & 1) == 0 else -1
        buckets[bucket] += sign * max(1.0, len(token) / 8.0)

    magnitude = math.sqrt(sum(value * value for value in buckets)) or 1.0
    return [round(value / magnitude, 8) for value in buckets]


@lru_cache(maxsize=1)
def _load_bge_model() -> Any:
    try:
        from FlagEmbedding import BGEM3FlagModel
    except ImportError as error:
        raise RuntimeError("FlagEmbedding is not installed; use EMBEDDER_MODE=stub or install [bge] extras") from error

    model_name = os.getenv("EMBEDDING_MODEL", BGE_MODEL)
    return BGEM3FlagModel(model_name, use_fp16=True)


def _embed_bge_m3(texts: list[str]) -> list[list[float]]:
    model = _load_bge_model()
    output = model.encode(texts, batch_size=min(12, len(texts)), max_length=8192)
    vectors = output["dense_vecs"]
    result: list[list[float]] = []
    for vector in vectors:
        if len(vector) != EMBEDDING_DIMENSION:
            raise RuntimeError(f"expected {EMBEDDING_DIMENSION}-dimension vectors from BGE-M3")
        result.append([float(value) for value in vector])
    return result


def _normalize_inputs(raw: str | list[str]) -> list[str]:
    if isinstance(raw, str):
        return [raw.replace("\n", " ").strip()]
    return [value.replace("\n", " ").strip() for value in raw]


def _active_model_name() -> str:
    return BGE_MODEL if _mode() == "bge-m3" else STUB_MODEL


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "runtime": "rag-embedder", "mode": _mode(), "model": _active_model_name()}


@app.post("/v1/embeddings", response_model=EmbeddingsResponse)
def create_embeddings(body: EmbeddingsRequest) -> EmbeddingsResponse:
    texts = [text for text in _normalize_inputs(body.input) if text]
    if not texts:
        raise HTTPException(status_code=400, detail="input must include at least one non-empty string")

    mode = _mode()
    try:
        if mode == "bge-m3":
            embeddings = _embed_bge_m3(texts)
            model_name = body.model or BGE_MODEL
        else:
            embeddings = [embed_text_stub_hash_v1(text) for text in texts]
            model_name = STUB_MODEL
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return EmbeddingsResponse(
        data=[EmbeddingObject(embedding=embedding, index=index) for index, embedding in enumerate(embeddings)],
        model=model_name,
        usage={"prompt_tokens": sum(len(text.split()) for text in texts), "total_tokens": sum(len(text.split()) for text in texts)},
    )