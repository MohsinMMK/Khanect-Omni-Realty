# syntax=docker/dockerfile:1.7

FROM python:3.14-slim AS runtime

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY apps/rag-embedder/pyproject.toml apps/rag-embedder/README.md ./
COPY apps/rag-embedder/src ./src

RUN pip install --no-cache-dir .

EXPOSE 8080
CMD ["uvicorn", "rag_embedder_service.main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8080"]