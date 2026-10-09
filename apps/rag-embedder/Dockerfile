# syntax=docker/dockerfile:1.7

FROM python:3.14-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:0.12.19 /uv /bin/uv

ENV PYTHONUNBUFFERED=1
ENV UV_PYTHON_DOWNLOADS=never
ENV PATH="/app/.venv/bin:$PATH"
WORKDIR /app

COPY apps/rag-embedder/pyproject.toml apps/rag-embedder/uv.lock apps/rag-embedder/README.md ./
COPY apps/rag-embedder/src ./src

RUN uv sync --locked --no-dev --no-editable --no-cache --extra bge

EXPOSE 8080
CMD ["uvicorn", "rag_embedder_service.main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8080"]
