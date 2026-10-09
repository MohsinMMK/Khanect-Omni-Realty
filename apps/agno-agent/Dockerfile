# syntax=docker/dockerfile:1.7

FROM python:3.14-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:0.12.19 /uv /bin/uv

ENV PYTHONUNBUFFERED=1
ENV UV_PYTHON_DOWNLOADS=never
ENV PATH="/app/.venv/bin:$PATH"
WORKDIR /app

COPY apps/agno-agent/pyproject.toml apps/agno-agent/uv.lock apps/agno-agent/README.md ./
COPY apps/agno-agent/src ./src

RUN uv sync --locked --no-dev --no-editable --no-cache

EXPOSE 8000
CMD ["uvicorn", "agno_agent_service.main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]
