# syntax=docker/dockerfile:1.7

FROM python:3.14-slim AS runtime

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY apps/agno-agent/pyproject.toml apps/agno-agent/README.md ./
COPY apps/agno-agent/src ./src

RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "agno_agent_service.main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]
